import { z } from 'zod';

import { ADMIN_API_PREFIX } from './admin.ts';
import { INVENTORY_ITEM_KINDS, INVENTORY_ITEM_TYPES, INVENTORY_UNITS, costText, packagingUnitSchema } from './inventory.ts';

/**
 * Contrato de las recetas del inventario (REQ-F-050, T2) en `/api/v1/admin/inventario`: lista con el
 * costo teórico, receta de un artículo (vigente con su costo e historial), una versión del historial
 * (sin costo; PT-4), «usado en», opciones de ingrediente, guardar una versión y cerrar la receta.
 * Solo administradores y gerentes (403 `FORBIDDEN_ROLE` al resto); las escrituras llevan el token CSRF.
 *
 * - Las reglas viven en core (`packages/core/inventory`); la API responde 422 `VALIDATION_FAILED` con
 *   `fields` por campo (`yieldQuantity`, `lines`, `lines.N.ingredient`, `lines.N.quantity`,
 *   `lines.N.unit`, `lines.N.wastePercent`, `lines.N.note`…).
 * - Cantidades con 3 decimales («6.000»), merma en % con 2 («40.00») y costos con 4 («166.6667»),
 *   siempre como texto: nunca como `number`. La pantalla redondea los costos a 2 decimales.
 * - Un costo que falta es `null` («Sin costo»), nunca 0.
 */

/** Origen del costo de una línea (RF-6). Copia de `COST_SOURCES` de core (una prueba de `api/` lo vigila). */
export const INVENTORY_COST_SOURCES = Object.freeze(['cpp', 'referencia', 'receta', 'sin_costo'] as const);
export type InventoryCostSource = (typeof INVENTORY_COST_SOURCES)[number];

/** Tipos que llevan receta (filtro `tipo` de la lista). */
export const INVENTORY_RECIPE_ITEM_TYPES = Object.freeze(['intermedio', 'compuesto'] as const);

export const INVENTORY_RECIPE_ERROR_CODES = Object.freeze({
  RECIPE_NOT_ALLOWED: 'RECIPE_NOT_ALLOWED',
  RECIPE_ITEM_INACTIVE: 'RECIPE_ITEM_INACTIVE',
  RECIPE_VERSION_NOT_FOUND: 'RECIPE_VERSION_NOT_FOUND',
  RECIPE_VERSION_CONFLICT: 'RECIPE_VERSION_CONFLICT',
  RECIPE_CYCLE: 'RECIPE_CYCLE',
  RECIPE_TOO_DEEP: 'RECIPE_TOO_DEEP',
} as const);

const INVENTORY_PREFIX = `${ADMIN_API_PREFIX}/inventario`;

/** Rutas de las recetas (relativas al origen de la API). */
export const inventoryRecipePaths = Object.freeze({
  list: `${INVENTORY_PREFIX}/recetas`,
  ingredients: `${INVENTORY_PREFIX}/recetas/ingredientes`,
  version: (versionId: number) => `${INVENTORY_PREFIX}/recetas/versiones/${versionId}`,
  item: (itemId: number) => `${INVENTORY_PREFIX}/articulos/${itemId}/recetas`,
  close: (itemId: number) => `${INVENTORY_PREFIX}/articulos/${itemId}/recetas/cerrar`,
  usedIn: (itemId: number) => `${INVENTORY_PREFIX}/articulos/${itemId}/usado-en`,
});

const id = z.number().int().positive();
const isoDate = z.string().min(1);
const quantityText = z.string().regex(/^\d+\.\d{3}$/);
const wasteText = z.string().regex(/^\d+\.\d{2}$/);
const unit = z.enum(INVENTORY_UNITS);

/** Artículo de una receta (producido o ingrediente). */
export const recipeItemRefSchema = z.object({
  id,
  name: z.string(),
  kind: z.enum(INVENTORY_ITEM_KINDS),
  type: z.enum(INVENTORY_ITEM_TYPES),
  baseUnit: unit.nullable(),
  active: z.boolean(),
});
export type RecipeItemRef = z.infer<typeof recipeItemRefSchema>;

/** Línea guardada: neta en la unidad capturada, neta y bruta en la base del ingrediente. */
export const recipeLineSchema = z.object({
  position: z.number().int().min(1).max(40),
  ingredient: recipeItemRefSchema,
  quantity: quantityText,
  unit: z.string(),
  netBaseQuantity: quantityText,
  wastePercent: wasteText,
  grossBaseQuantity: quantityText,
  note: z.string().nullable(),
});
export type RecipeLineDto = z.infer<typeof recipeLineSchema>;

/** Línea de la vigente con su costo: unitario del ingrediente y de la línea (null: sin costo) y su origen. */
export const costedRecipeLineSchema = recipeLineSchema.extend({
  unitCost: costText.nullable(),
  cost: costText.nullable(),
  source: z.enum(INVENTORY_COST_SOURCES),
});
export type CostedRecipeLine = z.infer<typeof costedRecipeLineSchema>;

/** Resumen de una versión (historial): número, intervalo y autor. */
export const recipeVersionSummarySchema = z.object({
  id,
  itemId: id,
  number: id,
  yieldQuantity: quantityText,
  validFrom: isoDate,
  /** null mientras está vigente. */
  validTo: isoDate.nullable(),
  createdBy: z.string(),
  lineCount: z.number().int().nonnegative(),
});
export type RecipeVersionSummary = z.infer<typeof recipeVersionSummarySchema>;

/** Versión completa sin costo (historial en solo lectura; PT-4). */
export const recipeVersionSchema = recipeVersionSummarySchema.extend({
  note: z.string().nullable(),
  lines: z.array(recipeLineSchema),
});
export type RecipeVersionDto = z.infer<typeof recipeVersionSchema>;

/** Ingrediente hoja sin costo y la ruta de recetas hasta él (HU-4). */
export const missingCostSchema = z.object({ itemId: id, name: z.string(), path: z.array(z.string()) });
export type MissingCostDto = z.infer<typeof missingCostSchema>;

/** Vigente con su costo teórico (RF-2 y RF-6). */
export const currentRecipeSchema = z.object({
  version: recipeVersionSummarySchema.extend({ note: z.string().nullable(), lines: z.array(costedRecipeLineSchema) }),
  /** Costo total de la receta o null si falta algún costo. */
  total: costText.nullable(),
  /** Costo por unidad base del artículo producido o null («Sin costo»). */
  unitCost: costText.nullable(),
  missing: z.array(missingCostSchema),
  /** Ids de los ingredientes inactivos de la vigente (RF-7: aviso). */
  inactiveIngredientIds: z.array(id),
});
export type CurrentRecipe = z.infer<typeof currentRecipeSchema>;

/** 200 de `GET /inventario/articulos/:id/recetas`. */
export const recipeDetailResponseSchema = z.object({
  item: recipeItemRefSchema,
  /** null: el artículo no tiene receta vigente. */
  current: currentRecipeSchema.nullable(),
  /** Todas las versiones, de la más reciente a la más antigua. */
  versions: z.array(recipeVersionSummarySchema),
});
export type RecipeDetailResponse = z.infer<typeof recipeDetailResponseSchema>;

/** Fila de la lista de recetas (RF-1). */
export const recipeListEntrySchema = z.object({
  item: recipeItemRefSchema,
  versionId: id,
  versionNumber: id,
  yieldQuantity: quantityText,
  unitCost: costText.nullable(),
  /** Ingredientes sin costo (0 si la receta tiene costo). */
  missingCount: z.number().int().nonnegative(),
  validFrom: isoDate,
  /** RF-7: la vigente usa algún ingrediente inactivo. */
  usesInactive: z.boolean(),
});
export type RecipeListEntryDto = z.infer<typeof recipeListEntrySchema>;

/** 200 de `GET /inventario/recetas?tipo=&q=&pagina=`. */
export const recipeListResponseSchema = z.object({
  recipes: z.array(recipeListEntrySchema),
  page: z.object({ number: id, size: id, total: z.number().int().nonnegative() }),
});
export type RecipeListResponse = z.infer<typeof recipeListResponseSchema>;

/** 200 de `GET /inventario/recetas/versiones/:id`. */
export const recipeVersionResponseSchema = z.object({ item: recipeItemRefSchema, version: recipeVersionSchema });
export type RecipeVersionResponse = z.infer<typeof recipeVersionResponseSchema>;

/** 201 (versión nueva) o 200 (sin cambios: no se creó versión) de `POST /inventario/articulos/:id/recetas`. */
export const recipeSaveResponseSchema = z.object({ created: z.boolean(), version: recipeVersionSummarySchema });
export type RecipeSaveResponse = z.infer<typeof recipeSaveResponseSchema>;

/** 200 de `POST /inventario/articulos/:id/recetas/cerrar`: la versión cerrada, o null si no había vigente. */
export const recipeCloseResponseSchema = z.object({ version: recipeVersionSummarySchema.nullable() });
export type RecipeCloseResponse = z.infer<typeof recipeCloseResponseSchema>;

/** 200 de `GET /inventario/articulos/:id/usado-en` (RF-8): recetas vigentes que lo usan. */
export const recipeUsedInResponseSchema = z.object({
  recipes: z.array(z.object({ itemId: id, name: z.string(), active: z.boolean(), versionId: id, versionNumber: id })),
});
export type RecipeUsedInResponse = z.infer<typeof recipeUsedInResponseSchema>;

/** 200 de `GET /inventario/recetas/ingredientes`: activos, de tipo permitido, con su base y sus empaques. */
export const recipeIngredientsResponseSchema = z.object({
  ingredients: z.array(recipeItemRefSchema.extend({ units: z.array(packagingUnitSchema) })),
});
export type RecipeIngredientsResponse = z.infer<typeof recipeIngredientsResponseSchema>;

/** 409 `RECIPE_VERSION_CONFLICT` (C-4, RF-9): la vigente (null si ya no hay) para conservar lo escrito. */
export const recipeConflictErrorSchema = z.object({
  error: z.object({
    code: z.literal('RECIPE_VERSION_CONFLICT'),
    message: z.string(),
    current: z.object({ id, number: id, validFrom: isoDate, createdBy: z.string() }).nullable(),
  }),
});
export type RecipeConflictErrorBody = z.infer<typeof recipeConflictErrorSchema>;

/** 422 `RECIPE_CYCLE` (RF-5, CA-4): la ruta del ciclo, por nombre, del artículo a sí mismo. */
export const recipeCycleErrorSchema = z.object({
  error: z.object({ code: z.literal('RECIPE_CYCLE'), message: z.string(), path: z.array(z.string()) }),
});
export type RecipeCycleErrorBody = z.infer<typeof recipeCycleErrorSchema>;

/** Línea de una versión nueva (forma; las reglas las aplica la API con core). */
export interface RecipeLineRequest {
  ingredientId: number;
  /** Neta (aprovechable tras la merma), con punto decimal. */
  quantity: string;
  /** Unidad del sistema o empaque del ingrediente. */
  unit: string;
  /** % con 2 decimales como máximo; vacío o ausente es 0. */
  wastePercent?: string;
  note?: string | null;
}

/** Versión nueva (`Idempotency-Key` recomendada). `baseVersionId`: la vigente de partida, o null. */
export interface RecipeSaveRequest {
  baseVersionId: number | null;
  yieldQuantity: string;
  note?: string | null;
  lines: RecipeLineRequest[];
}

export interface RecipeCloseRequest {
  baseVersionId: number | null;
}

/** Filtros de la lista (query: `tipo`, `q`, `pagina`). */
export interface RecipeListFilter {
  type?: string;
  q?: string;
  page?: string;
}
