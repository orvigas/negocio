import { DatabaseUnavailableError } from '../shared/index.ts';
import type { InventoryCategory } from './category-schema.ts';
import { AlreadyReversedError, CategoryNameTakenError, IdempotencyRaceError, InventoryBusyError, ItemNameTakenError, SkuTakenError, SupplierNameTakenError } from './errors.ts';
import type { InventoryItem } from './item-schema.ts';
import type {
  CategoryWithUsage,
  InventoryChangeEntry,
  InventoryStore,
  InventoryStoreTx,
  ItemQuery,
  StoredInventoryChange,
} from './inventory-store.ts';
import type { KardexDocument, KardexMovement, StockRow } from './kardex-schema.ts';
import type { RecipeUsage, RecipeVersion } from './recipe-schema.ts';
import type { Supplier } from './supplier-schema.ts';
import { searchKey } from './text.ts';

/**
 * Store del catálogo de inventario en memoria (REQ-F-049): mismas operaciones y claves únicas que el
 * de Prisma, sin base de datos. Doble de las pruebas unitarias.
 *
 * Atomicidad: cada transacción trabaja sobre una copia y solo la publica si termina sin error (las
 * transacciones se serializan, así que el candado de recetas y el bloqueo de existencias no hacen nada).
 * `state` permite inspeccionar los datos, `failNext` simula una base caída y `markInUse` simula un
 * artículo en uso (RN-4; las recetas y los movimientos ya cuentan solos, REQ-F-050 y REQ-F-051).
 */

/** Existencia de un artículo (REQ-F-051, DT-T3-2). */
export type MemoryStockRow = StockRow;

export interface MemoryInventoryState {
  categories: InventoryCategory[];
  items: InventoryItem[];
  /** Registro de SKU: clave en mayúsculas -> artículo. */
  skus: Map<string, { itemId: number; assignedAt: Date }>;
  /** Historial de artículos, categorías y recetas. */
  changes: (InventoryChangeEntry & { id: number })[];
  inUse: Set<number>;
  recipeVersions: RecipeVersion[];
  suppliers: Supplier[];
  /** Existencias por artículo (REQ-F-051). */
  stock: Map<number, MemoryStockRow>;
  /** Documentos del Kardex (sin `reversedById`, que se calcula al leer). */
  documents: Omit<KardexDocument, 'reversedById'>[];
  movements: KardexMovement[];
  nextCategoryId: number;
  nextItemId: number;
  nextChangeId: number;
  nextRecipeVersionId: number;
  nextSupplierId: number;
  nextDocumentId: number;
  nextMovementId: number;
}

export interface MemoryInventoryStore extends InventoryStore {
  readonly state: MemoryInventoryState;
  /**
   * Las próximas `times` operaciones (lectura o transacción) fallan como si la base no respondiera
   * (`unavailable`) o como una espera del candado agotada (`busy`, MySQL 1205; REQ-F-050).
   */
  failNext(times?: number, kind?: 'unavailable' | 'busy'): void;
  /** RN-4: el artículo pasa a estar en uso (T3 lo hará con los movimientos). */
  markInUse(itemId: number): void;
}

const emptyState = (): MemoryInventoryState => ({
  categories: [],
  items: [],
  skus: new Map(),
  changes: [],
  inUse: new Set(),
  recipeVersions: [],
  suppliers: [],
  stock: new Map(),
  documents: [],
  movements: [],
  nextCategoryId: 1,
  nextItemId: 1,
  nextChangeId: 1,
  nextRecipeVersionId: 1,
  nextSupplierId: 1,
  nextDocumentId: 1,
  nextMovementId: 1,
});

const copyState = (state: MemoryInventoryState): MemoryInventoryState => ({
  categories: structuredClone(state.categories),
  items: structuredClone(state.items),
  skus: structuredClone(state.skus),
  changes: structuredClone(state.changes),
  inUse: new Set(state.inUse),
  recipeVersions: structuredClone(state.recipeVersions),
  suppliers: structuredClone(state.suppliers),
  stock: structuredClone(state.stock),
  documents: structuredClone(state.documents),
  movements: structuredClone(state.movements),
  nextCategoryId: state.nextCategoryId,
  nextItemId: state.nextItemId,
  nextChangeId: state.nextChangeId,
  nextRecipeVersionId: state.nextRecipeVersionId,
  nextSupplierId: state.nextSupplierId,
  nextDocumentId: state.nextDocumentId,
  nextMovementId: state.nextMovementId,
});

const byName = <T extends { name: string; id: number }>(a: T, b: T): number => a.name.localeCompare(b.name, 'es') || a.id - b.id;

function matches(data: MemoryInventoryState, item: InventoryItem, query: ItemQuery): boolean {
  if (query.status === 'active' && !item.active) return false;
  if (query.status === 'inactive' && item.active) return false;
  if (query.type !== null && item.type !== query.type) return false;
  if (query.categoryId !== null && item.categoryId !== query.categoryId) return false;
  if (query.q === null) return true;
  // Como MySQL (utf8mb4_es_0900_ai_ci): sin distinguir mayúsculas ni acentos (REQ-F-051, OBS-12 b).
  const sku = query.q.toUpperCase();
  if (searchKey(item.name).includes(searchKey(query.q))) return true;
  return [...data.skus].some(([key, entry]) => entry.itemId === item.id && key.includes(sku));
}

export function createMemoryInventoryStore(): MemoryInventoryStore {
  const state = emptyState();
  let failures = 0;
  let failureKind: 'unavailable' | 'busy' = 'unavailable';
  let queue: Promise<unknown> = Promise.resolve();

  function maybeFail(): void {
    if (failures > 0) {
      failures -= 1;
      if (failureKind === 'busy') throw new InventoryBusyError();
      throw new DatabaseUnavailableError({ name: 'SimulatedFailure', code: undefined, originalCode: undefined });
    }
  }

  const activeNameTaken = (data: MemoryInventoryState, item: Pick<InventoryItem, 'id' | 'nameKey' | 'active'>): boolean =>
    item.active && data.items.some((other) => other.id !== item.id && other.active && other.nameKey === item.nameKey);

  const activeSupplierTaken = (data: MemoryInventoryState, supplier: Pick<Supplier, 'id' | 'nameKey' | 'active'>): boolean =>
    supplier.active && data.suppliers.some((other) => other.id !== supplier.id && other.active && other.nameKey === supplier.nameKey);

  const newStock = (itemId: number, at: Date): MemoryStockRow => ({ itemId, quantity: 0n, avgCost: null, lastCost: null, lastSeq: 0, updatedAt: at });

  const activeCategoryTaken = (data: MemoryInventoryState, category: Pick<InventoryCategory, 'id' | 'nameKey' | 'active'>): boolean =>
    category.active && data.categories.some((other) => other.id !== category.id && other.active && other.nameKey === category.nameKey);

  function txOn(data: MemoryInventoryState): InventoryStoreTx {
    const findItem = (id: number) => data.items.find((item) => item.id === id) ?? null;
    const hasMovements = (itemId: number): boolean => (data.stock.get(itemId)?.lastSeq ?? 0) > 0;
    const withReversal = (document: Omit<KardexDocument, 'reversedById'>): KardexDocument => ({
      ...structuredClone(document),
      reversedById: data.documents.find((other) => other.reversesDocumentId === document.id)?.id ?? null,
    });
    const isActiveDocument = (documentId: number): boolean => {
      const document = data.documents.find((other) => other.id === documentId);
      return !!document && document.type !== 'reversion' && !data.documents.some((other) => other.reversesDocumentId === documentId);
    };
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
        const entries = data.changes.filter((change) => change.entity === entity && change.entityId === entityId).sort((a, b) => b.id - a.id).slice(0, limit);
        // Filtrado por una entidad de artículo o categoría: sus acciones son las de INVENTORY_ACTIONS.
        return structuredClone(entries) as StoredInventoryChange[];
      },
      async isInUse(itemId) {
        return (
          data.inUse.has(itemId) ||
          hasMovements(itemId) ||
          data.recipeVersions.some((version) => version.itemId === itemId || version.lines.some((line) => line.ingredientId === itemId))
        );
      },
      async hasMovements(itemId) {
        return hasMovements(itemId);
      },
      async getSupplier(id) {
        return structuredClone(data.suppliers.find((supplier) => supplier.id === id) ?? null);
      },
      async listSuppliers(status) {
        const wanted = data.suppliers.filter((supplier) => status === 'all' || supplier.active === (status === 'active'));
        return structuredClone(wanted).sort(byName);
      },
      async activeSupplierIdByNameKey(nameKey) {
        return data.suppliers.find((supplier) => supplier.active && supplier.nameKey === nameKey)?.id ?? null;
      },
      async insertSupplier(supplier) {
        const saved: Supplier = { ...structuredClone(supplier), id: data.nextSupplierId };
        if (activeSupplierTaken(data, saved)) throw new SupplierNameTakenError();
        data.nextSupplierId += 1;
        data.suppliers.push(saved);
        return structuredClone(saved);
      },
      async replaceSupplier(supplier, expectedVersion) {
        const index = data.suppliers.findIndex((other) => other.id === supplier.id);
        if (index < 0 || data.suppliers[index]?.version !== expectedVersion) return false;
        if (activeSupplierTaken(data, supplier)) throw new SupplierNameTakenError();
        data.suppliers[index] = structuredClone(supplier);
        return true;
      },
      async stockRows(itemIds) {
        const rows = new Map<number, StockRow>();
        for (const itemId of itemIds) {
          const row = data.stock.get(itemId);
          if (row) rows.set(itemId, structuredClone(row));
        }
        return rows;
      },
      async allStock() {
        return structuredClone([...data.stock.values()]).sort((a, b) => a.itemId - b.itemId);
      },
      async documentById(id) {
        const document = data.documents.find((other) => other.id === id);
        return document ? withReversal(document) : null;
      },
      async documentByIdempotencyKey(key) {
        const document = data.documents.find((other) => other.idempotencyKey === key);
        return document ? withReversal(document) : null;
      },
      async documentMovements(documentId) {
        return structuredClone(data.movements.filter((movement) => movement.documentId === documentId).sort((a, b) => a.line - b.line));
      },
      async returnsOf(purchaseId) {
        return data.documents.filter((document) => document.sourceDocumentId === purchaseId).sort((a, b) => a.id - b.id).map(withReversal);
      },
      async listDocuments(query) {
        const all = data.documents
          .filter((document) => (query.type === null || document.type === query.type) && (query.supplierId === null || document.supplierId === query.supplierId))
          .sort((a, b) => b.id - a.id);
        const start = (query.page - 1) * query.pageSize;
        return { documents: all.slice(start, start + query.pageSize).map(withReversal), total: all.length };
      },
      async itemMovements(itemId, page, pageSize) {
        const all = data.movements.filter((movement) => movement.itemId === itemId).sort((a, b) => b.seq - a.seq);
        const start = (page - 1) * pageSize;
        return { movements: structuredClone(all.slice(start, start + pageSize)), total: all.length };
      },
      async itemsWithActiveMovements(itemIds) {
        const ids = new Set<number>();
        for (const movement of data.movements) {
          if ((itemIds === null || itemIds.includes(movement.itemId)) && isActiveDocument(movement.documentId)) ids.add(movement.itemId);
        }
        return ids;
      },
      async lastPurchaseCost(itemId, excludeDocumentId) {
        const purchases = data.movements
          .filter((movement) => movement.itemId === itemId && movement.type === 'compra' && movement.documentId !== excludeDocumentId && isActiveDocument(movement.documentId))
          .sort((a, b) => b.seq - a.seq);
        return purchases[0]?.unitCost ?? null;
      },
      async movementsAfter(itemId, seq, limit) {
        return structuredClone(
          data.movements
            .filter((movement) => movement.itemId > itemId || (movement.itemId === itemId && movement.seq > seq))
            .sort((a, b) => a.itemId - b.itemId || a.seq - b.seq)
            .slice(0, limit),
        );
      },
      async countDocuments() {
        return data.documents.length;
      },
      async lockDocument(id) {
        return data.documents.some((document) => document.id === id);
      },
      async insertDocument(document, movements) {
        if (document.idempotencyKey !== null && data.documents.some((other) => other.idempotencyKey === document.idempotencyKey)) throw new IdempotencyRaceError();
        if (document.reversesDocumentId !== null && data.documents.some((other) => other.reversesDocumentId === document.reversesDocumentId)) throw new AlreadyReversedError(null);
        const saved = { ...structuredClone(document), id: data.nextDocumentId };
        data.nextDocumentId += 1;
        data.documents.push(saved);
        for (const movement of movements) {
          if (data.movements.some((other) => other.itemId === movement.itemId && other.seq === movement.seq)) throw new Error('seq repetido');
          data.movements.push({ ...structuredClone(movement), id: data.nextMovementId, documentId: saved.id });
          data.nextMovementId += 1;
        }
        return withReversal(saved);
      },
      async saveStock(rows) {
        for (const row of rows) data.stock.set(row.itemId, structuredClone(row));
      },
      async lockStock(itemIds) {
        for (const itemId of itemIds) {
          if (!data.stock.has(itemId) && findItem(itemId)) data.stock.set(itemId, newStock(itemId, new Date()));
        }
      },
      async itemsByIds(ids) {
        return structuredClone(data.items.filter((item) => ids.includes(item.id)));
      },
      async ingredientCandidates(types) {
        return structuredClone(data.items.filter((item) => item.active && item.kind !== 'parent' && types.includes(item.type)).sort(byName));
      },
      async currentRecipes() {
        return structuredClone(data.recipeVersions.filter((version) => version.validTo === null));
      },
      async recipeVersions(itemId) {
        return structuredClone(data.recipeVersions.filter((version) => version.itemId === itemId).sort((a, b) => b.number - a.number));
      },
      async recipeVersion(id) {
        return structuredClone(data.recipeVersions.find((version) => version.id === id) ?? null);
      },
      async usedIn(itemId) {
        const usages: RecipeUsage[] = [];
        for (const version of data.recipeVersions) {
          if (version.validTo !== null || !version.lines.some((line) => line.ingredientId === itemId)) continue;
          const producer = findItem(version.itemId);
          if (producer) usages.push({ itemId: producer.id, itemName: producer.name, itemActive: producer.active, versionId: version.id, versionNumber: version.number });
        }
        return usages.sort((a, b) => a.itemName.localeCompare(b.itemName, 'es') || a.itemId - b.itemId);
      },
      async lockRecipes() {},
      async insertRecipeVersion(version) {
        if (data.recipeVersions.some((other) => other.itemId === version.itemId && (other.validTo === null || other.number === version.number))) {
          throw new Error('Versión vigente o número repetido');
        }
        const saved: RecipeVersion = { ...structuredClone(version), id: data.nextRecipeVersionId, validTo: null };
        data.nextRecipeVersionId += 1;
        data.recipeVersions.push(saved);
        return structuredClone(saved);
      },
      async closeRecipeVersion(id, at) {
        const version = data.recipeVersions.find((other) => other.id === id);
        if (!version || version.validTo !== null) return false;
        version.validTo = at;
        return true;
      },
      async activeItemIdByNameKey(nameKey) {
        return data.items.find((item) => item.active && item.nameKey === nameKey)?.id ?? null;
      },
      async insertItem(item) {
        const saved: InventoryItem = { ...structuredClone(item), id: data.nextItemId };
        if (activeNameTaken(data, saved)) throw new ItemNameTakenError();
        data.nextItemId += 1;
        data.items.push(saved);
        if (saved.kind !== 'parent') data.stock.set(saved.id, newStock(saved.id, saved.createdAt));
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

  const transaction: InventoryStore['transaction'] = (task) =>
    enqueue(async () => {
      maybeFail();
      const draft = copyState(state);
      const result = await task(txOn(draft));
      Object.assign(state, draft);
      return result;
    });

  return {
    state,
    failNext(times = 1, kind = 'unavailable') {
      failures = times;
      failureKind = kind;
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
    transaction,
    recipeTransaction: transaction,
    kardexTransaction: transaction,
  };
}
