import type { InventoryCategory } from './category-schema.ts';
import type { InventoryItem, ItemType } from './item-schema.ts';
import type { KardexDocument, KardexMovement, NewKardexDocument, NewKardexMovement, StockRow } from './kardex-schema.ts';
import type { NewRecipeVersion, RecipeUsage, RecipeVersion } from './recipe-schema.ts';
import type { Supplier } from './supplier-schema.ts';

/**
 * Store del catálogo de inventario (REQ-F-049): contrato que implementan Prisma/MySQL
 * (packages/db/src/prisma-inventory-store.ts) y la memoria (memory-inventory-store.ts), acciones del
 * historial y forma de las consultas. Las reglas viven en inventory-repository.ts.
 *
 * El store mantiene las claves únicas: `active_name_key` (= nameKey mientras está activo) de artículos
 * y categorías, y el registro de SKU. Si una escritura choca con ellas (carrera entre dos peticiones),
 * lanza ItemNameTakenError, CategoryNameTakenError, SkuTakenError o SupplierNameTakenError.
 */

export const INVENTORY_ACTIONS = Object.freeze({
  CREATE: 'create',
  UPDATE: 'update',
  OVERWRITE_AFTER_CONFLICT: 'overwrite_after_conflict',
  DEACTIVATE: 'deactivate',
  REACTIVATE: 'reactivate',
  /** Una variante toma la categoría que cambió en su padre (RF-5). */
  INHERIT: 'inherit',
} as const);
export type InventoryAction = (typeof INVENTORY_ACTIONS)[keyof typeof INVENTORY_ACTIONS];

/** Acciones del historial de una receta (REQ-F-050): entity 'recipe', entityId = artículo producido. */
export const RECIPE_ACTIONS = Object.freeze({
  NEW_VERSION: 'new_version',
  CLOSE: 'close',
} as const);
export type RecipeAction = (typeof RECIPE_ACTIONS)[keyof typeof RECIPE_ACTIONS];

export type InventoryEntity = 'item' | 'category' | 'recipe' | 'supplier';
/** Entidades cuyo historial se consulta con `history` (el de una receta son sus versiones). */
export type HistoryEntity = 'item' | 'category' | 'supplier';

export interface FieldChange {
  field: string;
  before: unknown;
  after: unknown;
}

export interface InventoryChangeEntry {
  at: Date;
  entity: InventoryEntity;
  entityId: number;
  action: InventoryAction | RecipeAction;
  /** null: el sistema (semilla de desarrollo o importación). */
  actorId: number | null;
  actorName: string;
  changes: FieldChange[];
}

export interface StoredInventoryChange extends Omit<InventoryChangeEntry, 'entity' | 'action'> {
  id: number;
  entity: HistoryEntity;
  action: InventoryAction;
}

export type NewItem = Omit<InventoryItem, 'id'>;
export type NewCategory = Omit<InventoryCategory, 'id'>;
export type NewSupplier = Omit<Supplier, 'id'>;

export const ITEM_STATUSES = Object.freeze(['active', 'inactive', 'all'] as const);
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export interface ItemQuery {
  status: ItemStatus;
  type: ItemType | null;
  categoryId: number | null;
  /** Texto a buscar: contenido en el nombre (sin distinguir mayúsculas) o en un SKU del artículo. */
  q: string | null;
  /** Desde 1. */
  page: number;
  pageSize: number;
}

export interface ItemListEntry extends InventoryItem {
  /** Número de variantes (activas e inactivas) si es padre; 0 si no. */
  variantCount: number;
}

/** Filtro de la lista de documentos (REQ-F-051, RF-9). */
export interface DocumentQuery {
  type: string | null;
  supplierId: number | null;
  page: number;
  pageSize: number;
}

export interface CategoryWithUsage extends InventoryCategory {
  activeItemCount: number;
}

export interface InventoryStoreReader {
  getItem(id: number): Promise<InventoryItem | null>;
  /** Variantes del padre, por nombre. */
  listVariants(parentId: number): Promise<InventoryItem[]>;
  /** Página de artículos ordenada por nombre, y el total que cumple los filtros. */
  listItems(query: ItemQuery): Promise<{ items: ItemListEntry[]; total: number }>;
  getCategory(id: number): Promise<InventoryCategory | null>;
  /** Todas las categorías, por nombre, con su número de artículos activos. */
  listCategories(): Promise<CategoryWithUsage[]>;
  /** Últimos `limit` cambios de la entidad, del más reciente al más antiguo. */
  history(entity: HistoryEntity, entityId: number, limit: number): Promise<StoredInventoryChange[]>;
  /**
   * RN-4: ¿el artículo tiene versiones de receta, aparece en una línea de cualquier versión (REQ-F-050)
   * o tiene movimientos (REQ-F-051, RN-T3-11)?
   */
  isInUse(itemId: number): Promise<boolean>;
  /** ¿El artículo tiene movimientos del Kardex (REQ-F-051, RN-T3-11)? Su existencia tiene `last_seq > 0`. */
  hasMovements(itemId: number): Promise<boolean>;
  /** Artículos con esos ids (los que no existen se omiten). */
  itemsByIds(ids: readonly number[]): Promise<InventoryItem[]>;
  /** Artículos que se pueden ofrecer como ingrediente (RN-T2-3): activos, de esos tipos y que no son padres; por nombre. */
  ingredientCandidates(types: readonly ItemType[]): Promise<InventoryItem[]>;
  /** Versiones vigentes de todas las recetas, con sus líneas por posición. */
  currentRecipes(): Promise<RecipeVersion[]>;
  /** Todas las versiones de la receta del artículo, de la más reciente a la más antigua. */
  recipeVersions(itemId: number): Promise<RecipeVersion[]>;
  recipeVersion(id: number): Promise<RecipeVersion | null>;
  /** Recetas vigentes con una línea que usa el artículo (RF-8, C-5), por nombre del artículo producido. */
  usedIn(itemId: number): Promise<RecipeUsage[]>;
  getSupplier(id: number): Promise<Supplier | null>;
  /** Proveedores con ese estado, por nombre (REQ-F-051, RF-1; son pocos: la búsqueda y la página las hace core). */
  listSuppliers(status: ItemStatus): Promise<Supplier[]>;

  // --- Kardex (REQ-F-051) ---
  /** Existencias de esos artículos (los que no tienen fila se omiten). */
  stockRows(itemIds: readonly number[]): Promise<Map<number, StockRow>>;
  /** Todas las existencias (unos cientos de filas: Existencias y el CPP de las recetas). */
  allStock(): Promise<StockRow[]>;
  documentById(id: number): Promise<KardexDocument | null>;
  documentByIdempotencyKey(key: string): Promise<KardexDocument | null>;
  /** Documentos con esos ids (los que no existen se omiten). Una consulta: Kardex del artículo (RF-8). */
  documentsByIds(ids: readonly number[]): Promise<KardexDocument[]>;
  /** Movimientos del documento, por línea. */
  documentMovements(documentId: number): Promise<KardexMovement[]>;
  /** Devoluciones de una compra, de la más antigua a la más reciente. */
  returnsOf(purchaseId: number): Promise<KardexDocument[]>;
  /** Página de documentos, del más reciente al más antiguo, y el total que cumple el filtro. */
  listDocuments(query: DocumentQuery): Promise<{ documents: KardexDocument[]; total: number }>;
  /** Página del Kardex de un artículo, del movimiento más reciente al más antiguo (por seq). */
  itemMovements(itemId: number, page: number, pageSize: number): Promise<{ movements: KardexMovement[]; total: number }>;
  /**
   * RN-T3-8: artículos con movimientos vigentes (de un documento no revertido que no es una reversión),
   * entre `itemIds` (null: todos).
   */
  itemsWithActiveMovements(itemIds: readonly number[] | null): Promise<Set<number>>;
  /** DT-T3-4: costo de la última compra no revertida del artículo, sin contar `excludeDocumentId`; null si no hay. */
  lastPurchaseCost(itemId: number, excludeDocumentId: number | null): Promise<bigint | null>;
  /** `inventory:verify`: hasta `limit` movimientos después de (itemId, seq), en orden de artículo y seq. */
  movementsAfter(itemId: number, seq: number, limit: number): Promise<KardexMovement[]>;
  /** `inventory:verify`: número de documentos. */
  countDocuments(): Promise<number>;
}

export interface InventoryStoreTx extends InventoryStoreReader {
  /** Id del artículo activo con esa clave de nombre, o null. */
  activeItemIdByNameKey(nameKey: string): Promise<number | null>;
  /** Inserta el artículo y, si no es padre, su existencia en 0 y sin costo (REQ-F-051, RF-12 y DT-T3-2). */
  insertItem(item: NewItem): Promise<InventoryItem>;
  /** Reemplaza el artículo completo (con sus empaques) si su versión vigente es `expectedVersion`; si no, false. */
  replaceItem(item: InventoryItem, expectedVersion: number): Promise<boolean>;
  /** Artículo al que se asignó el SKU (clave en mayúsculas), o null si nunca se usó. */
  skuOwner(skuKey: string): Promise<number | null>;
  registerSku(skuKey: string, itemId: number, at: Date): Promise<void>;
  activeCategoryIdByNameKey(nameKey: string): Promise<number | null>;
  insertCategory(category: NewCategory): Promise<InventoryCategory>;
  updateCategory(category: InventoryCategory): Promise<void>;
  countActiveItemsInCategory(categoryId: number): Promise<number>;
  addChange(entry: InventoryChangeEntry): Promise<void>;
  /** Id del proveedor activo con esa clave de nombre, o null. */
  activeSupplierIdByNameKey(nameKey: string): Promise<number | null>;
  insertSupplier(supplier: NewSupplier): Promise<Supplier>;
  /** Reemplaza el proveedor si su versión vigente es `expectedVersion`; si no, false. */
  replaceSupplier(supplier: Supplier, expectedVersion: number): Promise<boolean>;
  /**
   * Bloquea hasta el fin de la transacción las existencias de esos artículos, en orden ascendente de
   * id (DT-13), y crea la que falte (DT-T3-2: un artículo creado por una imagen anterior). La primera
   * escritura del Kardex y el cambio de unidad o de `inventoriable` (RN-T3-11) la toman antes de leer.
   */
  lockStock(itemIds: readonly number[]): Promise<void>;
  /**
   * Candado de recetas (REQ-F-050): la primera sentencia de toda escritura de recetas y de las
   * escrituras de artículos que consultan su uso. Serializa esas escrituras hasta el fin de la transacción.
   */
  lockRecipes(): Promise<void>;
  /** Inserta una versión vigente con sus líneas. */
  insertRecipeVersion(version: NewRecipeVersion): Promise<RecipeVersion>;
  /** Cierra la versión si sigue vigente (única escritura sobre una versión guardada); false si no lo era. */
  closeRecipeVersion(id: number, at: Date): Promise<boolean>;
  /** Bloquea el documento hasta el fin de la transacción (devolución y reversión). false si no existe. */
  lockDocument(id: number): Promise<boolean>;
  /**
   * Inserta un documento con sus movimientos (solo altas, RN-T3-9). Una clave de idempotencia repetida
   * lanza IdempotencyRaceError; una segunda reversión del mismo documento, AlreadyReversedError.
   */
  insertDocument(document: NewKardexDocument, movements: readonly NewKardexMovement[]): Promise<KardexDocument>;
  /** Guarda la existencia de esos artículos (la proyección del Kardex). */
  saveStock(rows: readonly StockRow[]): Promise<void>;
}

export interface InventoryStore {
  /** Lecturas consistentes entre sí (una transacción de lectura). */
  read<T>(task: (reader: InventoryStoreReader) => Promise<T>): Promise<T>;
  /** Ejecuta `task` de forma atómica y aislada: si lanza, no queda nada escrito. */
  transaction<T>(task: (tx: InventoryStoreTx) => Promise<T>): Promise<T>;
  /**
   * Transacción de las escrituras de recetas (REQ-F-050): READ COMMITTED, con el candado `recetas`
   * como primera sentencia (la toma `task` con `lockRecipes`), para que cada lectura posterior vea lo
   * último confirmado (dos guardados A→B y B→A no pasan los dos).
   */
  recipeTransaction<T>(task: (tx: InventoryStoreTx) => Promise<T>): Promise<T>;
  /**
   * Transacción del Kardex (REQ-F-051, DT-13): READ COMMITTED con bloqueo de filas en orden (documento
   * de origen y después existencias por id ascendente). Reintenta los interbloqueos; una espera
   * agotada es InventoryBusyError (503).
   */
  kardexTransaction<T>(task: (tx: InventoryStoreTx) => Promise<T>): Promise<T>;
}
