import { DatabaseUnavailableError } from '../shared/index.ts';
import type { InventoryCategory } from './category-schema.ts';
import { CategoryNameTakenError, ItemNameTakenError, SkuTakenError } from './errors.ts';
import type { InventoryItem } from './item-schema.ts';
import type {
  CategoryWithUsage,
  InventoryStore,
  InventoryStoreTx,
  ItemQuery,
  StoredInventoryChange,
} from './inventory-store.ts';

/**
 * Store del catálogo de inventario en memoria (REQ-F-049): mismas operaciones y claves únicas que el
 * de Prisma, sin base de datos. Doble de las pruebas unitarias.
 *
 * Atomicidad: cada transacción trabaja sobre una copia y solo la publica si termina sin error (las
 * transacciones se serializan). `state` permite inspeccionar los datos, `failNext` simula una base
 * caída y `markInUse` simula un artículo usado en una receta o un movimiento (RN-4).
 */

export interface MemoryInventoryState {
  categories: InventoryCategory[];
  items: InventoryItem[];
  /** Registro de SKU: clave en mayúsculas -> artículo. */
  skus: Map<string, { itemId: number; assignedAt: Date }>;
  changes: StoredInventoryChange[];
  inUse: Set<number>;
  nextCategoryId: number;
  nextItemId: number;
  nextChangeId: number;
}

export interface MemoryInventoryStore extends InventoryStore {
  readonly state: MemoryInventoryState;
  /** Las próximas `times` operaciones (lectura o transacción) fallan como si la base no respondiera. */
  failNext(times?: number): void;
  /** RN-4: el artículo pasa a estar en uso (T2 y T3 lo harán con recetas y movimientos). */
  markInUse(itemId: number): void;
}

const emptyState = (): MemoryInventoryState => ({
  categories: [],
  items: [],
  skus: new Map(),
  changes: [],
  inUse: new Set(),
  nextCategoryId: 1,
  nextItemId: 1,
  nextChangeId: 1,
});

const copyState = (state: MemoryInventoryState): MemoryInventoryState => ({
  categories: structuredClone(state.categories),
  items: structuredClone(state.items),
  skus: structuredClone(state.skus),
  changes: structuredClone(state.changes),
  inUse: new Set(state.inUse),
  nextCategoryId: state.nextCategoryId,
  nextItemId: state.nextItemId,
  nextChangeId: state.nextChangeId,
});

const byName = <T extends { name: string; id: number }>(a: T, b: T): number => a.name.localeCompare(b.name, 'es') || a.id - b.id;

function matches(data: MemoryInventoryState, item: InventoryItem, query: ItemQuery): boolean {
  if (query.status === 'active' && !item.active) return false;
  if (query.status === 'inactive' && item.active) return false;
  if (query.type !== null && item.type !== query.type) return false;
  if (query.categoryId !== null && item.categoryId !== query.categoryId) return false;
  if (query.q === null) return true;
  const name = query.q.toLowerCase();
  const sku = query.q.toUpperCase();
  if (item.nameKey.includes(name)) return true;
  return [...data.skus].some(([key, entry]) => entry.itemId === item.id && key.includes(sku));
}

export function createMemoryInventoryStore(): MemoryInventoryStore {
  const state = emptyState();
  let failures = 0;
  let queue: Promise<unknown> = Promise.resolve();

  function maybeFail(): void {
    if (failures > 0) {
      failures -= 1;
      throw new DatabaseUnavailableError({ name: 'SimulatedFailure', code: undefined, originalCode: undefined });
    }
  }

  const activeNameTaken = (data: MemoryInventoryState, item: Pick<InventoryItem, 'id' | 'nameKey' | 'active'>): boolean =>
    item.active && data.items.some((other) => other.id !== item.id && other.active && other.nameKey === item.nameKey);

  const activeCategoryTaken = (data: MemoryInventoryState, category: Pick<InventoryCategory, 'id' | 'nameKey' | 'active'>): boolean =>
    category.active && data.categories.some((other) => other.id !== category.id && other.active && other.nameKey === category.nameKey);

  function txOn(data: MemoryInventoryState): InventoryStoreTx {
    const findItem = (id: number) => data.items.find((item) => item.id === id) ?? null;
    return {
      async getItem(id) {
        return structuredClone(findItem(id));
      },
      async listVariants(parentId) {
        return structuredClone(data.items.filter((item) => item.parentId === parentId).sort(byName));
      },
      async listItems(query) {
        const all = data.items.filter((item) => matches(data, item, query)).sort(byName);
        const start = (query.page - 1) * query.pageSize;
        const items = all.slice(start, start + query.pageSize).map((item) => ({
          ...structuredClone(item),
          variantCount: item.kind === 'parent' ? data.items.filter((other) => other.parentId === item.id).length : 0,
        }));
        return { items, total: all.length };
      },
      async getCategory(id) {
        return structuredClone(data.categories.find((category) => category.id === id) ?? null);
      },
      async listCategories(): Promise<CategoryWithUsage[]> {
        return structuredClone(data.categories)
          .sort(byName)
          .map((category) => ({ ...category, activeItemCount: data.items.filter((item) => item.active && item.categoryId === category.id).length }));
      },
      async history(entity, entityId, limit) {
        return structuredClone(data.changes.filter((change) => change.entity === entity && change.entityId === entityId).sort((a, b) => b.id - a.id).slice(0, limit));
      },
      async isInUse(itemId) {
        return data.inUse.has(itemId);
      },
      async activeItemIdByNameKey(nameKey) {
        return data.items.find((item) => item.active && item.nameKey === nameKey)?.id ?? null;
      },
      async insertItem(item) {
        const saved: InventoryItem = { ...structuredClone(item), id: data.nextItemId };
        if (activeNameTaken(data, saved)) throw new ItemNameTakenError();
        data.nextItemId += 1;
        data.items.push(saved);
        return structuredClone(saved);
      },
      async replaceItem(item, expectedVersion) {
        const index = data.items.findIndex((other) => other.id === item.id);
        if (index < 0 || data.items[index]?.version !== expectedVersion) return false;
        if (activeNameTaken(data, item)) throw new ItemNameTakenError();
        data.items[index] = structuredClone(item);
        return true;
      },
      async skuOwner(skuKey) {
        return data.skus.get(skuKey)?.itemId ?? null;
      },
      async registerSku(skuKey, itemId, at) {
        if (data.skus.has(skuKey)) throw new SkuTakenError();
        data.skus.set(skuKey, { itemId, assignedAt: at });
      },
      async activeCategoryIdByNameKey(nameKey) {
        return data.categories.find((category) => category.active && category.nameKey === nameKey)?.id ?? null;
      },
      async insertCategory(category) {
        const saved: InventoryCategory = { ...structuredClone(category), id: data.nextCategoryId };
        if (activeCategoryTaken(data, saved)) throw new CategoryNameTakenError();
        data.nextCategoryId += 1;
        data.categories.push(saved);
        return structuredClone(saved);
      },
      async updateCategory(category) {
        const index = data.categories.findIndex((other) => other.id === category.id);
        if (index < 0) throw new Error('Categoría inexistente');
        if (activeCategoryTaken(data, category)) throw new CategoryNameTakenError();
        data.categories[index] = structuredClone(category);
      },
      async countActiveItemsInCategory(categoryId) {
        return data.items.filter((item) => item.active && item.categoryId === categoryId).length;
      },
      async addChange(entry) {
        data.changes.push({ ...structuredClone(entry), id: data.nextChangeId });
        data.nextChangeId += 1;
      },
    };
  }

  /** Serializa las operaciones: una lectura nunca ve una transacción a medias. */
  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = queue.then(task);
    queue = run.catch(() => {});
    return run;
  }

  return {
    state,
    failNext(times = 1) {
      failures = times;
    },
    markInUse(itemId) {
      state.inUse.add(itemId);
    },
    read(task) {
      return enqueue(async () => {
        maybeFail();
        return task(txOn(state));
      });
    },
    transaction(task) {
      return enqueue(async () => {
        maybeFail();
        const draft = copyState(state);
        const result = await task(txOn(draft));
        Object.assign(state, draft);
        return result;
      });
    },
  };
}
