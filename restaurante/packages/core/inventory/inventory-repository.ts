import { validateCategoryFields, type CategoryFieldsInput, type InventoryCategory } from './category-schema.ts';
import { COST_SCALE, formatDecimal, parseDecimal } from './decimal.ts';
import {
  CategoryInUseError,
  CategoryInactiveError,
  CategoryNameTakenError,
  CategoryNotFoundError,
  InventoryConflictError,
  InventoryValidationError,
  ItemHasActiveVariantsError,
  ItemInActiveRecipesError,
  ItemLockedError,
  ItemNameTakenError,
  ItemNotFoundError,
  ParentInactiveError,
  SkuTakenError,
  type FieldErrors,
} from './errors.ts';
import {
  PARENT_TYPES,
  costFieldErrors,
  isItemKind,
  isItemType,
  readInventoriable,
  readReferenceCost,
  skuKey,
  unitsSnapshot,
  validateItemFields,
  type InventoryItem,
  type ItemFieldsInput,
  type ItemKind,
  type ItemType,
} from './item-schema.ts';
import {
  INVENTORY_ACTIONS,
  ITEM_STATUSES,
  type FieldChange,
  type InventoryAction,
  type InventoryEntity,
  type InventoryStore,
  type InventoryStoreTx,
  type ItemListEntry,
  type ItemStatus,
  type CategoryWithUsage,
  type StoredInventoryChange,
} from './inventory-store.ts';
import { readId } from './text.ts';
import { convertToBase, equivalences, type Equivalence, type InventoryUnit } from './units.ts';

/**
 * Casos de uso del catálogo de inventario (REQ-F-049, T1): alta, edición, baja y reactivación de
 * artículos y categorías, lista con filtros, ficha y conversión de unidades.
 *
 * - Cada escritura va en una transacción del store junto con su entrada de historial (RN-16).
 * - Concurrencia (RF-8): versión por artículo; la escritura con una versión vieja da
 *   InventoryConflictError con los datos vigentes. "Guardar encima" envía la versión vigente con
 *   `overwrite` y queda registrada como `overwrite_after_conflict`.
 * - Nombre único entre los activos sin distinguir mayúsculas (RF-2): comprobación previa (error por
 *   campo) y la clave única del store como garantía ante carreras.
 * - SKU (PV-14, DT-3): editable; todo SKU asignado queda registrado y no se reutiliza en otro artículo.
 * - RN-4: la unidad base y los empaques se bloquean cuando `store.isInUse` lo indica (REQ-F-050: el
 *   artículo tiene versiones de receta o aparece en una línea; REQ-F-051: o tiene movimientos).
 * - REQ-F-050: la edición y la inactivación toman primero el candado `recetas` (consultan el uso en
 *   recetas); inactivar un artículo usado en recetas vigentes exige `recipes: 'keep'` (RF-7).
 */

export const ITEM_PAGE_SIZE = 50;
export const HISTORY_LIMIT = 50;
/** Máximo de la búsqueda de la lista. */
export const QUERY_MAX = 80;

export interface InventoryAuthor {
  /** null: el sistema (semilla de desarrollo). */
  id: number | null;
  name: string;
}

export interface CreateItemInput extends ItemFieldsInput {
  /** simple (por defecto), parent o variant. */
  kind?: unknown;
  /** Obligatorio salvo en una variante (lo hereda del padre). */
  type?: unknown;
  /** Obligatoria salvo en una variante (la hereda del padre). */
  categoryId?: unknown;
  /** Solo en una variante. */
  parentId?: unknown;
}

export interface UpdateItemInput extends ItemFieldsInput {
  version: unknown;
  /** Si llega, debe ser el tipo vigente: el tipo no cambia (RN-1). */
  type?: unknown;
  /** En una variante, si llega, debe ser la del padre. */
  categoryId?: unknown;
  /** "Guardar encima" tras un conflicto. */
  overwrite?: boolean;
}

export interface DeactivateItemInput {
  version: unknown;
  /** En un padre con variantes activas: 'deactivate' confirma que también se inactivan. */
  variants?: unknown;
  /** RF-7: 'keep' confirma inactivar aunque se use en recetas vigentes (las versiones no cambian). */
  recipes?: unknown;
}

export interface ItemListFilterInput {
  status?: unknown;
  type?: unknown;
  categoryId?: unknown;
  q?: unknown;
  page?: unknown;
}

export interface ItemSummary extends ItemListEntry {
  categoryName: string;
}

export interface ItemPage {
  items: ItemSummary[];
  page: { number: number; size: number; total: number };
}

export interface ItemDetail {
  item: InventoryItem;
  category: InventoryCategory;
  parent: InventoryItem | null;
  variants: InventoryItem[];
  /** RN-4: unidad base y empaques bloqueados por el uso. */
  locked: boolean;
  equivalences: Equivalence[];
  history: StoredInventoryChange[];
}

export interface ConversionResult {
  quantity: bigint;
  unit: InventoryUnit;
}

export interface InventoryRepository {
  listItems(filter?: ItemListFilterInput): Promise<ItemPage>;
  getItem(id: number): Promise<ItemDetail>;
  createItem(input: CreateItemInput, author: InventoryAuthor): Promise<InventoryItem>;
  updateItem(id: number, input: UpdateItemInput, author: InventoryAuthor): Promise<InventoryItem>;
  deactivateItem(id: number, input: DeactivateItemInput, author: InventoryAuthor): Promise<InventoryItem>;
  reactivateItem(id: number, input: { version: unknown }, author: InventoryAuthor): Promise<InventoryItem>;
  /** Convierte una cantidad (texto decimal) en `unit` a la unidad base del artículo (RF-4). */
  convert(id: number, quantity: unknown, unit: string): Promise<ConversionResult>;
  listCategories(): Promise<CategoryWithUsage[]>;
  createCategory(input: CategoryFieldsInput, author: InventoryAuthor): Promise<InventoryCategory>;
  renameCategory(id: number, input: CategoryFieldsInput, author: InventoryAuthor): Promise<InventoryCategory>;
  deactivateCategory(id: number, author: InventoryAuthor): Promise<InventoryCategory>;
  reactivateCategory(id: number, author: InventoryAuthor): Promise<InventoryCategory>;
}

const NAME_TAKEN = 'Ya hay un artículo activo con ese nombre.';
const SKU_TAKEN = 'Ese SKU ya se usó en otro artículo.';
const CATEGORY_NAME_TAKEN = 'Ya hay una categoría activa con ese nombre.';

export function normalizeAuthor(author: InventoryAuthor): InventoryAuthor {
  const name = typeof author?.name === 'string' ? author.name.trim() : '';
  if (name === '') throw new TypeError('El autor de un cambio del inventario necesita un nombre');
  if (author.id !== null && !(Number.isSafeInteger(author.id) && author.id >= 1)) throw new TypeError('Id de autor inválido');
  return { id: author.id, name };
}

function requireVersion(value: unknown): number {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 1) return value;
  throw new InventoryValidationError({ version: 'Falta la versión o no es un entero positivo.' });
}

function fail(errors: FieldErrors): void {
  if (Object.keys(errors).length > 0) throw new InventoryValidationError(errors);
}

const conflictOf = (item: InventoryItem): InventoryConflictError =>
  new InventoryConflictError({ id: item.id, version: item.version, updatedAt: item.updatedAt, updatedBy: item.updatedByName });

/** Campos del historial de un artículo (factores como texto: el JSON no admite bigint). */
function itemSnapshot(item: InventoryItem): Record<string, unknown> {
  return {
    kind: item.kind,
    type: item.type,
    parentId: item.parentId,
    categoryId: item.categoryId,
    name: item.name,
    description: item.description,
    sku: item.sku,
    baseUnit: item.baseUnit,
    units: unitsSnapshot(item.units),
    active: item.active,
    referenceCost: item.referenceCost === null ? null : formatDecimal(item.referenceCost, COST_SCALE),
    inventoriable: item.inventoriable,
  };
}

/** Costo de referencia e inventariable de la entrada; ausentes: `fallback` (alta: null y true). */
function readCostInput(input: ItemFieldsInput, fallback: { referenceCost: bigint | null; inventoriable: boolean }, errors: FieldErrors) {
  let { referenceCost, inventoriable } = fallback;
  if (input.referenceCost !== undefined) {
    const parsed = readReferenceCost(input.referenceCost);
    if ('error' in parsed) errors.referenceCost = parsed.error;
    else referenceCost = parsed.value;
  }
  if (input.inventoriable !== undefined) {
    const parsed = readInventoriable(input.inventoriable);
    if ('error' in parsed) errors.inventoriable = parsed.error;
    else inventoriable = parsed.value;
  }
  return { referenceCost, inventoriable };
}

function diff(before: Record<string, unknown> | null, after: Record<string, unknown>): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const [field, value] of Object.entries(after)) {
    const previous = before ? before[field] : null;
    if (JSON.stringify(previous) !== JSON.stringify(value)) changes.push({ field, before: previous ?? null, after: value });
  }
  return changes;
}

const categorySnapshot = (category: InventoryCategory): Record<string, unknown> => ({ name: category.name, active: category.active });

/** Traduce los choques del store con las claves únicas a errores por campo. */
async function asFieldErrors<T>(task: () => Promise<T>): Promise<T> {
  try {
    return await task();
  } catch (err) {
    if (err instanceof ItemNameTakenError) throw new InventoryValidationError({ name: NAME_TAKEN });
    if (err instanceof SkuTakenError) throw new InventoryValidationError({ sku: SKU_TAKEN });
    if (err instanceof CategoryNameTakenError) throw new InventoryValidationError({ name: CATEGORY_NAME_TAKEN });
    throw err;
  }
}

function readFilter(filter: ItemListFilterInput): { status: ItemStatus; type: ItemType | null; categoryId: number | null; q: string | null; page: number } {
  const errors: FieldErrors = {};
  const status = filter.status ?? 'active';
  if (!(ITEM_STATUSES as readonly unknown[]).includes(status)) errors.status = 'Elige activos, inactivos o todos.';
  const type = filter.type ?? null;
  if (type !== null && !isItemType(type)) errors.type = 'Elige un tipo de la lista.';
  const categoryId = filter.categoryId === undefined || filter.categoryId === null ? null : readId(filter.categoryId);
  if (filter.categoryId !== undefined && filter.categoryId !== null && categoryId === null) errors.categoryId = 'Elige una categoría de la lista.';
  let q: string | null = null;
  if (filter.q !== undefined && filter.q !== null) {
    if (typeof filter.q !== 'string') errors.q = 'Debe ser texto.';
    else {
      q = filter.q.trim().normalize('NFC') || null;
      if (q !== null && [...q].length > QUERY_MAX) errors.q = `Máximo ${QUERY_MAX} caracteres.`;
    }
  }
  const page = filter.page === undefined || filter.page === null ? 1 : readId(filter.page);
  if (page === null) errors.page = 'La página debe ser un entero positivo.';
  fail(errors);
  // Validados arriba: fail() lanza si alguno no lo es.
  return { status: status as ItemStatus, type: type as ItemType | null, categoryId, q, page: page ?? 1 };
}

export function createInventoryRepository({ store, now = () => new Date() }: { store: InventoryStore; now?: () => Date }): InventoryRepository {
  if (!store) throw new TypeError('createInventoryRepository requiere un store');

  const stamp = (item: InventoryItem, author: InventoryAuthor, at: Date): InventoryItem => ({
    ...item,
    version: item.version + 1,
    updatedAt: at,
    updatedById: author.id,
    updatedByName: author.name,
  });

  async function record(tx: InventoryStoreTx, entity: InventoryEntity, entityId: number, action: InventoryAction, author: InventoryAuthor, at: Date, changes: FieldChange[]) {
    await tx.addChange({ at, entity, entityId, action, actorId: author.id, actorName: author.name, changes });
  }

  /** Reemplaza el artículo y registra el cambio; una versión que ya no es la vigente da conflicto. */
  async function save(tx: InventoryStoreTx, before: InventoryItem, after: InventoryItem, action: InventoryAction, author: InventoryAuthor, at: Date): Promise<void> {
    if (!(await tx.replaceItem(after, before.version))) {
      const current = await tx.getItem(before.id);
      throw current ? conflictOf(current) : new ItemNotFoundError();
    }
    await record(tx, 'item', after.id, action, author, at, diff(itemSnapshot(before), itemSnapshot(after)));
  }

  async function loadItem(tx: InventoryStoreTx, id: number, version: number): Promise<InventoryItem> {
    const item = await tx.getItem(id);
    if (!item) throw new ItemNotFoundError();
    if (item.version !== version) throw conflictOf(item);
    return item;
  }

  async function activeCategory(tx: InventoryStoreTx, categoryId: number): Promise<InventoryCategory> {
    const category = await tx.getCategory(categoryId);
    if (!category) throw new InventoryValidationError({ categoryId: 'La categoría no existe.' });
    if (!category.active) throw new CategoryInactiveError();
    return category;
  }

  async function checkName(tx: InventoryStoreTx, nameKey: string, selfId: number | null): Promise<void> {
    const owner = await tx.activeItemIdByNameKey(nameKey);
    if (owner !== null && owner !== selfId) throw new InventoryValidationError({ name: NAME_TAKEN });
  }

  /** Registra el SKU nuevo del artículo; uno que ya tuvo el mismo artículo vale (DT-3). */
  async function claimSku(tx: InventoryStoreTx, sku: string | null, itemId: number, at: Date): Promise<void> {
    if (sku === null) return;
    const owner = await tx.skuOwner(skuKey(sku));
    if (owner === itemId) return;
    if (owner !== null) throw new InventoryValidationError({ sku: SKU_TAKEN });
    await tx.registerSku(skuKey(sku), itemId, at);
  }

  const write = <T>(task: (tx: InventoryStoreTx) => Promise<T>): Promise<T> => store.transaction((tx) => asFieldErrors(() => task(tx)));

  return Object.freeze<InventoryRepository>({
    async listItems(filter = {}) {
      const query = readFilter(filter);
      return store.read(async (reader) => {
        const [{ items, total }, categories] = await Promise.all([
          reader.listItems({ ...query, pageSize: ITEM_PAGE_SIZE }),
          reader.listCategories(),
        ]);
        const names = new Map(categories.map((category) => [category.id, category.name]));
        return {
          items: items.map((item) => ({ ...item, categoryName: names.get(item.categoryId) ?? '' })),
          page: { number: query.page, size: ITEM_PAGE_SIZE, total },
        };
      });
    },

    getItem(id) {
      return store.read(async (reader) => {
        const item = await reader.getItem(id);
        if (!item) throw new ItemNotFoundError();
        const [category, parent, variants, locked, history] = await Promise.all([
          reader.getCategory(item.categoryId),
          item.parentId === null ? Promise.resolve(null) : reader.getItem(item.parentId),
          item.kind === 'parent' ? reader.listVariants(item.id) : Promise.resolve([]),
          reader.isInUse(item.id),
          reader.history('item', item.id, HISTORY_LIMIT),
        ]);
        // La clave foránea category_id garantiza que la categoría existe.
        return { item, category: category as InventoryCategory, parent, variants, locked, equivalences: equivalences(item), history };
      });
    },

    async createItem(input, rawAuthor) {
      const author = normalizeAuthor(rawAuthor);
      const errors: FieldErrors = {};
      const kind: ItemKind | null = input.kind === undefined || input.kind === null ? 'simple' : isItemKind(input.kind) ? input.kind : null;
      if (kind === null) errors.kind = 'Elige artículo, padre o variante.';
      let parentId: number | null = null;
      let type: ItemType | null = null;
      let categoryId: number | null = null;
      if (kind === 'variant') {
        parentId = readId(input.parentId);
        if (parentId === null) errors.parentId = 'Elige el artículo padre.';
        if (input.type !== undefined) errors.type = 'La variante hereda el tipo del padre.';
        if (input.categoryId !== undefined) errors.categoryId = 'La variante hereda la categoría del padre.';
      } else {
        if (input.parentId !== undefined && input.parentId !== null) errors.parentId = 'Solo una variante tiene artículo padre.';
        if (isItemType(input.type)) type = input.type;
        else errors.type = 'Elige el tipo de artículo.';
        if (kind === 'parent' && type !== null && !PARENT_TYPES.includes(type)) errors.type = 'Un artículo padre solo puede ser de Reventa o Compuesto.';
        categoryId = readId(input.categoryId);
        if (categoryId === null) errors.categoryId = 'Elige la categoría.';
      }
      const fields = validateItemFields(input, kind ?? 'simple');
      if (!fields.ok) Object.assign(errors, fields.errors);
      const cost = readCostInput(input, { referenceCost: null, inventoriable: true }, errors);
      if (kind !== null && type !== null) Object.assign(errors, costFieldErrors(kind, type, cost.referenceCost, cost.inventoriable));
      if (!fields.ok || kind === null || Object.keys(errors).length > 0) throw new InventoryValidationError(errors);
      const { value } = fields;

      return write(async (tx) => {
        const at = now();
        if (kind === 'variant') {
          const parent = await tx.getItem(parentId as number);
          if (!parent || parent.kind !== 'parent') throw new InventoryValidationError({ parentId: 'El artículo padre no existe.' });
          if (!parent.active) throw new ParentInactiveError();
          type = parent.type;
          categoryId = parent.categoryId;
          // Validado aquí: el tipo de una variante es el del padre.
          fail(costFieldErrors(kind, type, cost.referenceCost, cost.inventoriable));
        }
        // Validados arriba (o heredados del padre): categoryId y type ya no son null.
        await activeCategory(tx, categoryId as number);
        await checkName(tx, value.nameKey, null);
        const item = await tx.insertItem({
          kind,
          type: type as ItemType,
          parentId,
          categoryId: categoryId as number,
          ...value,
          ...cost,
          active: true,
          version: 1,
          createdAt: at,
          updatedAt: at,
          updatedById: author.id,
          updatedByName: author.name,
        });
        await claimSku(tx, item.sku, item.id, at);
        await record(tx, 'item', item.id, INVENTORY_ACTIONS.CREATE, author, at, diff(null, itemSnapshot(item)));
        return item;
      });
    },

    async updateItem(id, input, rawAuthor) {
      const author = normalizeAuthor(rawAuthor);
      const version = requireVersion(input.version);
      return write(async (tx) => {
        await tx.lockRecipes();
        // REQ-F-051 (RN-T3-11): la existencia se bloquea antes de consultar hasMovements e isInUse, así
        // un primer movimiento simultáneo espera a este cambio o este cambio ve el movimiento.
        await tx.lockStock([id]);
        const at = now();
        const current = await tx.getItem(id);
        if (!current) throw new ItemNotFoundError();
        const errors: FieldErrors = {};
        if (input.type !== undefined && input.type !== current.type) errors.type = 'El tipo no se cambia después de crear el artículo.';
        let categoryId = current.categoryId;
        if (current.kind === 'variant') {
          if (input.categoryId !== undefined && readId(input.categoryId) !== current.categoryId) errors.categoryId = 'La variante hereda la categoría del padre.';
        } else {
          const requested = readId(input.categoryId);
          if (requested === null) errors.categoryId = 'Elige la categoría.';
          else categoryId = requested;
        }
        const fields = validateItemFields(input, current.kind);
        if (!fields.ok) Object.assign(errors, fields.errors);
        const cost = readCostInput(input, current, errors);
        Object.assign(errors, costFieldErrors(current.kind, current.type, cost.referenceCost, cost.inventoriable));
        if (!fields.ok || Object.keys(errors).length > 0) throw new InventoryValidationError(errors);
        if (current.version !== version) throw conflictOf(current);
        if (cost.inventoriable !== current.inventoriable && (await tx.hasMovements(id))) {
          throw new InventoryValidationError({ inventoriable: 'El artículo ya tiene movimientos: no puede cambiar si lleva existencias.' });
        }

        if (categoryId !== current.categoryId) await activeCategory(tx, categoryId);
        if (current.active && fields.value.nameKey !== current.nameKey) await checkName(tx, fields.value.nameKey, id);
        const unitsChanged = fields.value.baseUnit !== current.baseUnit || JSON.stringify(unitsSnapshot(fields.value.units)) !== JSON.stringify(unitsSnapshot(current.units));
        if (unitsChanged && (await tx.isInUse(id))) throw new ItemLockedError();

        const next: InventoryItem = { ...current, ...fields.value, ...cost, categoryId };
        if (diff(itemSnapshot(current), itemSnapshot(next)).length === 0) return current;
        if (fields.value.sku !== null && skuKey(fields.value.sku) !== (current.sku === null ? null : skuKey(current.sku))) await claimSku(tx, fields.value.sku, id, at);

        const saved = stamp(next, author, at);
        await save(tx, current, saved, input.overwrite === true ? INVENTORY_ACTIONS.OVERWRITE_AFTER_CONFLICT : INVENTORY_ACTIONS.UPDATE, author, at);
        if (current.kind === 'parent' && categoryId !== current.categoryId) {
          for (const variant of await tx.listVariants(id)) {
            await save(tx, variant, stamp({ ...variant, categoryId }, author, at), INVENTORY_ACTIONS.INHERIT, author, at);
          }
        }
        return saved;
      });
    },

    async deactivateItem(id, input, rawAuthor) {
      const author = normalizeAuthor(rawAuthor);
      const version = requireVersion(input.version);
      if (input.variants !== undefined && input.variants !== 'deactivate') throw new InventoryValidationError({ variants: 'Valor no válido.' });
      if (input.recipes !== undefined && input.recipes !== 'keep') throw new InventoryValidationError({ recipes: 'Valor no válido.' });
      return write(async (tx) => {
        await tx.lockRecipes();
        const at = now();
        const current = await loadItem(tx, id, version);
        if (!current.active) return current;
        const active = current.kind === 'parent' ? (await tx.listVariants(id)).filter((variant) => variant.active) : [];
        if (active.length > 0 && input.variants !== 'deactivate') throw new ItemHasActiveVariantsError(active.length);
        if (input.recipes !== 'keep') {
          // RF-7, CA-10: recetas vigentes que usan el artículo o, en cascada, sus variantes activas.
          const usages = (await Promise.all([current, ...active].map((entry) => tx.usedIn(entry.id)))).flat();
          const recipes = [...new Map(usages.map((usage) => [usage.itemId, { itemId: usage.itemId, name: usage.itemName }])).values()];
          if (recipes.length > 0) throw new ItemInActiveRecipesError(recipes);
        }
        for (const variant of active) await save(tx, variant, stamp({ ...variant, active: false }, author, at), INVENTORY_ACTIONS.DEACTIVATE, author, at);
        const saved = stamp({ ...current, active: false }, author, at);
        await save(tx, current, saved, INVENTORY_ACTIONS.DEACTIVATE, author, at);
        return saved;
      });
    },

    async reactivateItem(id, input, rawAuthor) {
      const author = normalizeAuthor(rawAuthor);
      const version = requireVersion(input.version);
      return store.transaction(async (tx) => {
        const at = now();
        const current = await loadItem(tx, id, version);
        if (current.active) return current;
        if (current.parentId !== null) {
          const parent = await tx.getItem(current.parentId);
          if (!parent?.active) throw new ParentInactiveError();
        }
        const category = await tx.getCategory(current.categoryId);
        if (!category?.active) throw new CategoryInactiveError();
        if ((await tx.activeItemIdByNameKey(current.nameKey)) !== null) throw new ItemNameTakenError();
        const saved = stamp({ ...current, active: true }, author, at);
        await save(tx, current, saved, INVENTORY_ACTIONS.REACTIVATE, author, at);
        return saved;
      });
    },

    async convert(id, quantity, unit) {
      const parsed = parseDecimal(quantity);
      if (!parsed.ok) throw new InventoryValidationError({ quantity: parsed.error });
      if (parsed.value === 0n) throw new InventoryValidationError({ quantity: 'Escribe una cantidad mayor que 0.' });
      const item = await store.read((reader) => reader.getItem(id));
      if (!item) throw new ItemNotFoundError();
      const result = convertToBase(parsed.value, unit, item);
      // convertToBase ya rechazó al padre (sin unidad base).
      return { quantity: result, unit: item.baseUnit as InventoryUnit };
    },

    listCategories() {
      return store.read((reader) => reader.listCategories());
    },

    async createCategory(input, rawAuthor) {
      const author = normalizeAuthor(rawAuthor);
      const fields = validateCategoryFields(input);
      if (!fields.ok) throw new InventoryValidationError(fields.errors);
      return write(async (tx) => {
        const at = now();
        if ((await tx.activeCategoryIdByNameKey(fields.value.nameKey)) !== null) throw new InventoryValidationError({ name: CATEGORY_NAME_TAKEN });
        const category = await tx.insertCategory({ ...fields.value, active: true, createdAt: at, updatedAt: at });
        await record(tx, 'category', category.id, INVENTORY_ACTIONS.CREATE, author, at, diff(null, categorySnapshot(category)));
        return category;
      });
    },

    async renameCategory(id, input, rawAuthor) {
      const author = normalizeAuthor(rawAuthor);
      const fields = validateCategoryFields(input);
      return write(async (tx) => {
        const at = now();
        const current = await tx.getCategory(id);
        if (!current) throw new CategoryNotFoundError();
        if (!fields.ok) throw new InventoryValidationError(fields.errors);
        if (fields.value.name === current.name) return current;
        if (current.active && fields.value.nameKey !== current.nameKey) {
          const owner = await tx.activeCategoryIdByNameKey(fields.value.nameKey);
          if (owner !== null && owner !== id) throw new InventoryValidationError({ name: CATEGORY_NAME_TAKEN });
        }
        const next = { ...current, ...fields.value, updatedAt: at };
        await tx.updateCategory(next);
        await record(tx, 'category', id, INVENTORY_ACTIONS.UPDATE, author, at, diff(categorySnapshot(current), categorySnapshot(next)));
        return next;
      });
    },

    async deactivateCategory(id, rawAuthor) {
      const author = normalizeAuthor(rawAuthor);
      return store.transaction(async (tx) => {
        const at = now();
        const current = await tx.getCategory(id);
        if (!current) throw new CategoryNotFoundError();
        if (!current.active) return current;
        const count = await tx.countActiveItemsInCategory(id);
        if (count > 0) throw new CategoryInUseError(count);
        const next = { ...current, active: false, updatedAt: at };
        await tx.updateCategory(next);
        await record(tx, 'category', id, INVENTORY_ACTIONS.DEACTIVATE, author, at, diff(categorySnapshot(current), categorySnapshot(next)));
        return next;
      });
    },

    async reactivateCategory(id, rawAuthor) {
      const author = normalizeAuthor(rawAuthor);
      return store.transaction(async (tx) => {
        const at = now();
        const current = await tx.getCategory(id);
        if (!current) throw new CategoryNotFoundError();
        if (current.active) return current;
        if ((await tx.activeCategoryIdByNameKey(current.nameKey)) !== null) throw new CategoryNameTakenError();
        const next = { ...current, active: true, updatedAt: at };
        await tx.updateCategory(next);
        await record(tx, 'category', id, INVENTORY_ACTIONS.REACTIVATE, author, at, diff(categorySnapshot(current), categorySnapshot(next)));
        return next;
      });
    },
  });
}

/**
 * Forma del historial de un alta o un cambio (RN-16), para las escrituras que no pasan por este
 * repositorio (importación única de REQ-F-050, A5): mismas entradas que un alta desde la API.
 */
export { categorySnapshot as categoryHistorySnapshot, diff as historyChanges, itemSnapshot as itemHistorySnapshot };
