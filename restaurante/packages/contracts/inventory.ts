import { z } from 'zod';

import { ADMIN_API_PREFIX } from './admin.ts';

/**
 * Contrato del catálogo de inventario (REQ-F-049, T1) en `/api/v1/admin/inventario`: artículos,
 * variantes, unidades de empaque, conversión, historial y categorías. Solo administradores y gerentes
 * (403 `FORBIDDEN_ROLE` para el resto); las escrituras llevan el token CSRF.
 *
 * Las reglas están solo en core (`packages/core/inventory`) y la API responde 422 `VALIDATION_FAILED`
 * con `fields` (la clave '' es un error general). Las cantidades y los factores viajan como texto
 * decimal con punto («24» al escribir, «24.000» en las respuestas), nunca como `number`. Las listas
 * cerradas copian las de core porque el admin no puede importarlo; una prueba de `api/` comprueba que
 * no se desincronizan.
 */

export const INVENTORY_ITEM_TYPES = Object.freeze(['insumo', 'intermedio', 'compuesto', 'reventa'] as const);
export type InventoryItemType = (typeof INVENTORY_ITEM_TYPES)[number];
/** simple: artículo normal; parent: agrupa variantes; variant: hija de un padre. */
export const INVENTORY_ITEM_KINDS = Object.freeze(['simple', 'parent', 'variant'] as const);
export type InventoryItemKind = (typeof INVENTORY_ITEM_KINDS)[number];
export const INVENTORY_UNITS = Object.freeze(['kg', 'g', 'L', 'ml', 'pza', 'hr'] as const);
export type InventoryUnit = (typeof INVENTORY_UNITS)[number];
/** Filtro de estado de la lista (por defecto, `active`). */
export const INVENTORY_ITEM_STATUSES = Object.freeze(['active', 'inactive', 'all'] as const);
export type InventoryItemStatus = (typeof INVENTORY_ITEM_STATUSES)[number];
/** Acciones del historial. */
export const INVENTORY_HISTORY_ACTIONS = Object.freeze(['create', 'update', 'overwrite_after_conflict', 'deactivate', 'reactivate', 'inherit'] as const);

/** Códigos de error propios del inventario (además de VALIDATION_FAILED, VERSION_CONFLICT y los de acceso). */
export const INVENTORY_ERROR_CODES = Object.freeze({
  ITEM_NOT_FOUND: 'ITEM_NOT_FOUND',
  CATEGORY_NOT_FOUND: 'CATEGORY_NOT_FOUND',
  ITEM_LOCKED: 'ITEM_LOCKED',
  ITEM_HAS_ACTIVE_VARIANTS: 'ITEM_HAS_ACTIVE_VARIANTS',
  ITEM_NAME_TAKEN: 'ITEM_NAME_TAKEN',
  PARENT_INACTIVE: 'PARENT_INACTIVE',
  CATEGORY_INACTIVE: 'CATEGORY_INACTIVE',
  CATEGORY_IN_USE: 'CATEGORY_IN_USE',
  CATEGORY_NAME_TAKEN: 'CATEGORY_NAME_TAKEN',
  UNIT_CONVERSION_UNAVAILABLE: 'UNIT_CONVERSION_UNAVAILABLE',
  /** REQ-F-050, RF-7: el artículo se usa en recetas vigentes; se confirma con `recipes: 'keep'`. */
  ITEM_IN_ACTIVE_RECIPES: 'ITEM_IN_ACTIVE_RECIPES',
  /** REQ-F-050: otra escritura retiene el candado del inventario más de lo que se espera (503). */
  INVENTORY_BUSY: 'INVENTORY_BUSY',
} as const);

const INVENTORY_PREFIX = `${ADMIN_API_PREFIX}/inventario`;

/** Rutas del inventario (relativas al origen de la API). */
export const inventoryPaths = Object.freeze({
  items: `${INVENTORY_PREFIX}/articulos`,
  item: (id: number) => `${INVENTORY_PREFIX}/articulos/${id}`,
  itemConversion: (id: number) => `${INVENTORY_PREFIX}/articulos/${id}/conversion`,
  itemStatus: (id: number, action: 'desactivar' | 'reactivar') => `${INVENTORY_PREFIX}/articulos/${id}/${action}`,
  categories: `${INVENTORY_PREFIX}/categorias`,
  category: (id: number) => `${INVENTORY_PREFIX}/categorias/${id}`,
  categoryStatus: (id: number, action: 'desactivar' | 'reactivar') => `${INVENTORY_PREFIX}/categorias/${id}/${action}`,
});

const id = z.number().int().positive();
const isoDate = z.string().min(1);
/** Decimal con exactamente 3 decimales («24.000»). */
const decimalText = z.string().regex(/^-?\d+\.\d{3}$/);
/** Costo con exactamente 4 decimales («18.4000»), en MXN con IVA (REQ-F-050). */
export const costText = z.string().regex(/^\d+\.\d{4}$/);

export const packagingUnitSchema = z.object({ name: z.string(), factor: decimalText });

const itemRefSchema = z.object({ id, name: z.string(), active: z.boolean() });

/** Fila de la lista (RF-1). */
export const inventoryItemSummarySchema = z.object({
  id,
  kind: z.enum(INVENTORY_ITEM_KINDS),
  type: z.enum(INVENTORY_ITEM_TYPES),
  parentId: id.nullable(),
  categoryId: id,
  categoryName: z.string(),
  name: z.string(),
  sku: z.string().nullable(),
  baseUnit: z.enum(INVENTORY_UNITS).nullable(),
  active: z.boolean(),
  /** Número de variantes (activas e inactivas) si es padre; 0 si no. */
  variantCount: z.number().int().nonnegative(),
  version: id,
  updatedAt: isoDate,
});
export type InventoryItemSummary = z.infer<typeof inventoryItemSummarySchema>;

/** Artículo completo (respuesta de una escritura y base de la ficha). */
export const inventoryItemSchema = z.object({
  id,
  kind: z.enum(INVENTORY_ITEM_KINDS),
  type: z.enum(INVENTORY_ITEM_TYPES),
  parentId: id.nullable(),
  categoryId: id,
  name: z.string(),
  description: z.string().nullable(),
  sku: z.string().nullable(),
  /** null solo en un padre. */
  baseUnit: z.enum(INVENTORY_UNITS).nullable(),
  units: z.array(packagingUnitSchema),
  active: z.boolean(),
  version: id,
  createdAt: isoDate,
  updatedAt: isoDate,
  updatedBy: z.string().nullable(),
  /** Costo de referencia por unidad base (REQ-F-050, C-1); null: sin costo de referencia. */
  referenceCost: costText.nullable(),
  /** false: no lleva existencias y se costea por su referencia (REQ-F-050, C-3). */
  inventoriable: z.boolean(),
});
export type InventoryItem = z.infer<typeof inventoryItemSchema>;

/** Ficha (RF-2 a RF-5, RF-7): el artículo con su categoría, padre, variantes y equivalencias. */
export const inventoryItemDetailSchema = inventoryItemSchema.extend({
  category: itemRefSchema,
  parent: itemRefSchema.nullable(),
  variants: z.array(
    z.object({ id, name: z.string(), sku: z.string().nullable(), baseUnit: z.enum(INVENTORY_UNITS).nullable(), active: z.boolean() }),
  ),
  /** RN-4: la unidad base y los empaques ya no se pueden cambiar. */
  locked: z.boolean(),
  /** Cuánto es 1 `unit` en la unidad base. Vacía en un padre. */
  equivalences: z.array(z.object({ unit: z.string(), quantity: decimalText })),
});
export type InventoryItemDetail = z.infer<typeof inventoryItemDetailSchema>;

/** Entrada del historial (RN-16): quién, cuándo y antes → después. */
export const inventoryHistoryEntrySchema = z.object({
  id,
  at: isoDate,
  action: z.enum(INVENTORY_HISTORY_ACTIONS),
  author: z.string(),
  changes: z.array(z.object({ field: z.string(), before: z.unknown(), after: z.unknown() })),
});
export type InventoryHistoryEntry = z.infer<typeof inventoryHistoryEntrySchema>;

export const inventoryCategorySchema = z.object({ id, name: z.string(), active: z.boolean(), createdAt: isoDate, updatedAt: isoDate });
export type InventoryCategory = z.infer<typeof inventoryCategorySchema>;
/** Categoría de la lista, con su número de artículos activos. */
export const inventoryCategoryWithUsageSchema = inventoryCategorySchema.extend({ activeItemCount: z.number().int().nonnegative() });
export type InventoryCategoryWithUsage = z.infer<typeof inventoryCategoryWithUsageSchema>;

/** 200 de `GET /inventario/articulos`. */
export const inventoryItemListResponseSchema = z.object({
  items: z.array(inventoryItemSummarySchema),
  page: z.object({ number: id, size: id, total: z.number().int().nonnegative() }),
});
export type InventoryItemListResponse = z.infer<typeof inventoryItemListResponseSchema>;
/** 200 de `GET /inventario/articulos/:id` (últimos 50 cambios, del más reciente al más antiguo). */
export const inventoryItemDetailResponseSchema = z.object({ item: inventoryItemDetailSchema, history: z.array(inventoryHistoryEntrySchema) });
export type InventoryItemDetailResponse = z.infer<typeof inventoryItemDetailResponseSchema>;
/** 201 o 200 de las escrituras sobre un artículo. */
export const inventoryItemResponseSchema = z.object({ item: inventoryItemSchema });
export type InventoryItemResponse = z.infer<typeof inventoryItemResponseSchema>;
/** 200 de `GET /inventario/articulos/:id/conversion`: la cantidad en la unidad base. */
export const inventoryConversionResponseSchema = z.object({ quantity: decimalText, unit: z.enum(INVENTORY_UNITS) });
export type InventoryConversionResponse = z.infer<typeof inventoryConversionResponseSchema>;
export const inventoryCategoryListResponseSchema = z.object({ categories: z.array(inventoryCategoryWithUsageSchema) });
export type InventoryCategoryListResponse = z.infer<typeof inventoryCategoryListResponseSchema>;
export const inventoryCategoryResponseSchema = z.object({ category: inventoryCategorySchema });
export type InventoryCategoryResponse = z.infer<typeof inventoryCategoryResponseSchema>;

/** Filtros de la lista (query: `estado`, `tipo`, `categoria`, `q`, `pagina`). Un 422 usa esas claves en `fields`. */
export interface InventoryItemFilter {
  status?: string;
  type?: string;
  categoryId?: string;
  q?: string;
  page?: string;
}

/** Cuerpos de las peticiones (forma; las reglas las aplica la API con core). Lista cerrada de campos. */
export interface PackagingUnitRequest {
  name: string;
  factor: string;
}
interface ItemFieldsRequest {
  name: string;
  description?: string | null;
  sku?: string | null;
  baseUnit?: string | null;
  units?: PackagingUnitRequest[];
  /** REQ-F-050: texto decimal (≥ 0, 4 decimales) o null para quitarlo. Ausente en una edición: no cambia. */
  referenceCost?: string | null;
  /** REQ-F-050: solo un Insumo puede ser false. Ausente en una edición: no cambia. */
  inventoriable?: boolean;
}
/** Alta (`Idempotency-Key` recomendada). Una variante lleva `parentId` y hereda tipo y categoría. */
export interface InventoryItemCreateRequest extends ItemFieldsRequest {
  kind?: string;
  type?: string;
  categoryId?: number | string;
  parentId?: number | string;
}
/** Edición: `version` vigente; `overwrite` = "guardar encima" tras un 409. */
export interface InventoryItemUpdateRequest extends ItemFieldsRequest {
  version: number;
  overwrite?: boolean;
  type?: string;
  categoryId?: number | string;
}
/**
 * Baja: `variants: 'deactivate'` confirma que también se inactivan las variantes activas de un padre;
 * `recipes: 'keep'` confirma inactivar aunque se use en recetas vigentes, que no cambian (REQ-F-050, RF-7).
 */
export interface InventoryItemDeactivateRequest {
  version: number;
  variants?: 'deactivate';
  recipes?: 'keep';
}

/** 409 `ITEM_IN_ACTIVE_RECIPES` (REQ-F-050, RF-7 y CA-10): recetas vigentes que usan el artículo (o sus variantes). */
export const itemInActiveRecipesErrorSchema = z.object({
  error: z.object({
    code: z.literal('ITEM_IN_ACTIVE_RECIPES'),
    message: z.string(),
    recipes: z.array(z.object({ itemId: id, name: z.string() })),
  }),
});
export type ItemInActiveRecipesErrorBody = z.infer<typeof itemInActiveRecipesErrorSchema>;
export interface InventoryItemReactivateRequest {
  version: number;
}
export interface InventoryCategoryRequest {
  name: string;
}
