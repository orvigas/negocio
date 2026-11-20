import type { InventoryCategory } from './category-schema.ts';
import type { InventoryItem, ItemType } from './item-schema.ts';
import type { NewRecipeVersion, RecipeUsage, RecipeVersion } from './recipe-schema.ts';

/**
 * Store del catálogo de inventario (REQ-F-049): contrato que implementan Prisma/MySQL
 * (packages/db/src/prisma-inventory-store.ts) y la memoria (memory-inventory-store.ts), acciones del
 * historial y forma de las consultas. Las reglas viven en inventory-repository.ts.
 *
 * El store mantiene las claves únicas: `active_name_key` (= nameKey mientras está activo) de artículos
 * y categorías, y el registro de SKU. Si una escritura choca con ellas (carrera entre dos peticiones),
 * lanza ItemNameTakenError, CategoryNameTakenError o SkuTakenError.
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

export type InventoryEntity = 'item' | 'category' | 'recipe';
/** Entidades cuyo historial se consulta con `history` (el de una receta son sus versiones). */
export type HistoryEntity = 'item' | 'category';

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
   * RN-4: ¿el artículo tiene versiones de receta o aparece en una línea de cualquier versión (REQ-F-050)?
   * T3 añadirá los movimientos.
   */
  isInUse(itemId: number): Promise<boolean>;
  /** ¿El artículo tiene movimientos de existencias? Hasta T3 (REQ-F-051) no hay movimientos: false. */
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
}

export interface InventoryStoreTx extends InventoryStoreReader {
  /** Id del artículo activo con esa clave de nombre, o null. */
  activeItemIdByNameKey(nameKey: string): Promise<number | null>;
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
  /**
   * Candado de recetas (REQ-F-050): la primera sentencia de toda escritura de recetas y de las
   * escrituras de artículos que consultan su uso. Serializa esas escrituras hasta el fin de la transacción.
   */
  lockRecipes(): Promise<void>;
  /** Inserta una versión vigente con sus líneas. */
  insertRecipeVersion(version: NewRecipeVersion): Promise<RecipeVersion>;
  /** Cierra la versión si sigue vigente (única escritura sobre una versión guardada); false si no lo era. */
  closeRecipeVersion(id: number, at: Date): Promise<boolean>;
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
}
