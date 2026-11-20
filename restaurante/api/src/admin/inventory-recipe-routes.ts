import {
  INVENTORY_ERROR_CODES,
  INVENTORY_RECIPE_ERROR_CODES as CODES,
  inventoryRecipePaths,
  recipeCloseResponseSchema,
  recipeDetailResponseSchema,
  recipeIngredientsResponseSchema,
  recipeListResponseSchema,
  recipeSaveResponseSchema,
  recipeUsedInResponseSchema,
  recipeVersionResponseSchema,
  type CostedRecipeLine,
  type RecipeItemRef,
  type RecipeLineDto,
  type RecipeVersionSummary,
} from '@restaurante/contracts';
import {
  COST_SCALE,
  InventoryBusyError,
  InventoryValidationError,
  ItemNotFoundError,
  RecipeCycleError,
  RecipeItemInactiveError,
  RecipeNotAllowedError,
  RecipeTooDeepError,
  RecipeVersionConflictError,
  RecipeVersionNotFoundError,
  WASTE_SCALE,
  formatDecimal,
  unitsSnapshot,
  type InventoryAuthor,
  type InventoryItem,
  type RecipeLine,
  type RecipeRepository,
  type RecipeVersion,
  type SaveRecipeResult,
} from '@restaurante/core/inventory';
import { toZonedIsoString, type Logger } from '@restaurante/core/shared';

import { ApiHttpError } from '../errors.ts';
import type { AdminAccess, AdminAuth } from './access.ts';
import type { IdempotencyStore } from './idempotency.ts';
import { idempotencyKey, inventoryBusy, routeId, runOnce, type Handler, type RouteContext } from './inventory-shared.ts';
import { createResponder, isRecord, validationFailed } from './responses.ts';

/**
 * Recetas del inventario en `/api/v1/admin/inventario` (REQ-F-050, T2), con las reglas de
 * `core/inventory` (recipe-repository.ts):
 *
 *   GET  /recetas?tipo=&q=&pagina=         -> { recipes, page }       (RF-1)
 *   GET  /recetas/ingredientes             -> { ingredients }         (opciones del editor)
 *   GET  /recetas/versiones/:id            -> { item, version }       (historial, sin costo; PT-4)
 *   GET  /articulos/:id/recetas            -> { item, current, versions } (RF-2 y RF-6)
 *   POST /articulos/:id/recetas  (Idempotency-Key) -> 201 { created: true, version } | 200 sin cambios
 *   POST /articulos/:id/recetas/cerrar     -> { version | null }       (RF-4)
 *   GET  /articulos/:id/usado-en           -> { recipes }             (RF-8, C-5)
 *
 * Orden: sesión (401) -> rol administrador o gerente (403) -> CSRF en escrituras (403) -> id (404) ->
 * cuerpo (413/415/400/422) -> reglas (422, 409, 503). Los logs solo llevan ids, números de versión,
 * acciones y conteos: nunca cantidades, costos ni nombres.
 */

export interface InventoryRecipeRoutes {
  list: Handler;
  ingredients: Handler;
  version: Handler;
  get: Handler;
  save: Handler;
  close: Handler;
  usedIn: Handler;
}

/** 40 líneas con su nota (200 caracteres) caben de sobra. */
export const RECIPE_BODY_LIMIT = 64 * 1024;
const SAVE_FIELDS: readonly string[] = Object.freeze(['baseVersionId', 'yieldQuantity', 'note', 'lines']);
const LINE_FIELDS: readonly string[] = Object.freeze(['ingredientId', 'quantity', 'unit', 'wastePercent', 'note']);
const CLOSE_FIELDS: readonly string[] = Object.freeze(['baseVersionId']);
/** Claves de core -> parámetros de la query (los `fields` de un 422 usan los nombres de la query). */
const FILTER_FIELDS: Readonly<Record<string, string>> = Object.freeze({ type: 'tipo', q: 'q', page: 'pagina' });
const UNKNOWN_ITEM = '(artículo desconocido)';

const authorOf = ({ user }: AdminAuth): InventoryAuthor => ({ id: user.id, name: user.displayName });
const cost = (value: bigint | null): string | null => (value === null ? null : formatDecimal(value, COST_SCALE));
const renameFields = (fields: Record<string, string>, names: Readonly<Record<string, string>>): Record<string, string> =>
  Object.fromEntries(Object.entries(fields).map(([key, message]) => [names[key] ?? key, message]));

/** Valor único de la query; '' cuenta como ausente (formularios GET). Repetido: se deja para que core lo rechace. */
const queryValue = (value: string | string[] | undefined): unknown => (value === undefined || value === '' ? undefined : value);

const itemRef = (item: InventoryItem): RecipeItemRef => ({ id: item.id, name: item.name, kind: item.kind, type: item.type, baseUnit: item.baseUnit, active: item.active });

/** Líneas con un campo desconocido: 422 por línea (el cuerpo es una lista cerrada también dentro de `lines`). */
function unknownLineFields(lines: unknown): Record<string, string> {
  if (!Array.isArray(lines)) return {};
  const fields: Record<string, string> = {};
  // Array.isArray lo tipa como any[]: sus elementos aún no están validados.
  for (const [index, line] of (lines as unknown[]).entries()) {
    if (!isRecord(line)) continue;
    for (const key of Object.keys(line)) if (!LINE_FIELDS.includes(key)) fields[`lines.${index}.${key}`] = 'Campo desconocido.';
  }
  return fields;
}

export function createInventoryRecipeRoutes({
  access,
  recipes,
  idempotency,
  timeZone,
  logger,
}: {
  access: AdminAccess;
  recipes: RecipeRepository;
  idempotency: IdempotencyStore<SaveRecipeResult>;
  timeZone: string;
  logger: Logger;
}): InventoryRecipeRoutes {
  const { send, closedBody } = createResponder(logger);
  const iso = (date: Date) => toZonedIsoString(date, timeZone);
  const itemNotFound = () => new ApiHttpError(404, INVENTORY_ERROR_CODES.ITEM_NOT_FOUND, 'Artículo no encontrado.');
  const versionNotFound = () => new ApiHttpError(404, CODES.RECIPE_VERSION_NOT_FOUND, 'Versión de receta no encontrada.');

  const summaryDto = (version: RecipeVersion): RecipeVersionSummary => ({
    id: version.id,
    itemId: version.itemId,
    number: version.number,
    yieldQuantity: formatDecimal(version.yieldQuantity),
    validFrom: iso(version.validFrom),
    validTo: version.validTo === null ? null : iso(version.validTo),
    createdBy: version.createdByName,
    lineCount: version.lines.length,
  });

  const lineDto = (line: RecipeLine, ingredients: ReadonlyMap<number, InventoryItem>): RecipeLineDto => {
    const ingredient = ingredients.get(line.ingredientId);
    return {
      position: line.position,
      // La clave foránea garantiza el ingrediente; si faltara, se muestra sin romper la respuesta.
      ingredient: ingredient ? itemRef(ingredient) : { id: line.ingredientId, name: UNKNOWN_ITEM, kind: 'simple', type: 'insumo', baseUnit: null, active: false },
      quantity: formatDecimal(line.quantity),
      unit: line.unit,
      netBaseQuantity: formatDecimal(line.netBaseQuantity),
      wastePercent: formatDecimal(line.wastePercent, WASTE_SCALE),
      grossBaseQuantity: formatDecimal(line.grossBaseQuantity),
      note: line.note,
    };
  };

  const byId = (items: readonly InventoryItem[]) => new Map(items.map((item) => [item.id, item]));

  /** Errores de dominio -> 404, 409, 422 y 503. El resto (DatabaseUnavailableError: 503) sigue al manejador central. */
  async function run(ctx: RouteContext, itemId: number | null, task: () => Promise<void>, fieldNames?: Readonly<Record<string, string>>): Promise<void> {
    try {
      await task();
    } catch (err) {
      if (err instanceof InventoryValidationError) return validationFailed(ctx, fieldNames ? renameFields(err.fields, fieldNames) : err.fields);
      if (err instanceof ItemNotFoundError) throw itemNotFound();
      if (err instanceof RecipeVersionNotFoundError) throw versionNotFound();
      if (err instanceof RecipeNotAllowedError) throw new ApiHttpError(409, CODES.RECIPE_NOT_ALLOWED, err.message);
      if (err instanceof RecipeItemInactiveError) throw new ApiHttpError(409, CODES.RECIPE_ITEM_INACTIVE, err.message);
      if (err instanceof RecipeVersionConflictError) {
        logger.info('inventory_recipe_conflict', { itemId });
        const current = err.current;
        ctx.status = 409;
        ctx.body = {
          error: {
            code: CODES.RECIPE_VERSION_CONFLICT,
            message: 'La receta cambió mientras la editabas: no se guardó nada. Revisa la versión vigente.',
            current: current ? { id: current.id, number: current.number, validFrom: iso(current.validFrom), createdBy: current.createdByName } : null,
          },
        };
        return;
      }
      if (err instanceof RecipeCycleError) {
        logger.info('inventory_recipe_cycle', { itemId, depth: err.path.length - 1 });
        ctx.status = 422;
        ctx.body = { error: { code: CODES.RECIPE_CYCLE, message: err.message, path: err.path } };
        return;
      }
      if (err instanceof RecipeTooDeepError) {
        logger.info('inventory_recipe_too_deep', { itemId, depth: err.depth });
        throw new ApiHttpError(422, CODES.RECIPE_TOO_DEEP, err.message);
      }
      if (err instanceof InventoryBusyError) throw inventoryBusy(ctx, logger);
      throw err;
    }
  }

  return Object.freeze<InventoryRecipeRoutes>({
    async list(ctx) {
      await access.inventory(ctx, { write: false });
      const { tipo, q, pagina } = ctx.query;
      await run(
        ctx,
        null,
        async () => {
          const page = await recipes.listRecipes({ type: queryValue(tipo), q: queryValue(q), page: queryValue(pagina) });
          send(ctx, recipeListResponseSchema, {
            recipes: page.recipes.map((entry) => ({
              item: itemRef(entry.item),
              versionId: entry.version.id,
              versionNumber: entry.version.number,
              yieldQuantity: formatDecimal(entry.version.yieldQuantity),
              unitCost: cost(entry.unitCost),
              missingCount: entry.missingCount,
              validFrom: iso(entry.version.validFrom),
              usesInactive: entry.usesInactive,
            })),
            page: page.page,
          });
        },
        FILTER_FIELDS,
      );
    },

    async ingredients(ctx) {
      await access.inventory(ctx, { write: false });
      await run(ctx, null, async () => {
        const options = await recipes.ingredientOptions();
        send(ctx, recipeIngredientsResponseSchema, { ingredients: options.map((item) => ({ ...itemRef(item), units: unitsSnapshot(item.units) })) });
      });
    },

    async version(ctx) {
      await access.inventory(ctx, { write: false });
      const id = routeId(ctx, versionNotFound);
      await run(ctx, null, async () => {
        const { version, item, ingredients } = await recipes.getVersion(id);
        const map = byId(ingredients);
        send(ctx, recipeVersionResponseSchema, { item: itemRef(item), version: { ...summaryDto(version), note: version.note, lines: version.lines.map((line) => lineDto(line, map)) } });
      });
    },

    async get(ctx) {
      await access.inventory(ctx, { write: false });
      const id = routeId(ctx, itemNotFound);
      await run(ctx, id, async () => {
        const detail = await recipes.getRecipe(id);
        const map = byId(detail.ingredients);
        let current = null;
        if (detail.current) {
          const { version, cost: recipeCost } = detail.current;
          const lines: CostedRecipeLine[] = recipeCost.lines.map((line) => ({ ...lineDto(line, map), unitCost: cost(line.unitCost), cost: cost(line.cost), source: line.source }));
          current = {
            version: { ...summaryDto(version), note: version.note, lines },
            total: cost(recipeCost.total),
            unitCost: cost(recipeCost.unitCost),
            missing: recipeCost.missing.map(({ itemId, name, path }) => ({ itemId, name, path })),
            inactiveIngredientIds: detail.inactiveIngredientIds,
          };
        }
        send(ctx, recipeDetailResponseSchema, { item: itemRef(detail.item), current, versions: detail.versions.map(summaryDto) });
      });
    },

    async save(ctx) {
      const auth = await access.inventory(ctx, { write: true });
      const id = routeId(ctx, itemNotFound);
      const key = idempotencyKey(ctx);
      const body = await closedBody(ctx, SAVE_FIELDS, RECIPE_BODY_LIMIT);
      if (!body) return;
      const unknownFields = unknownLineFields(body.lines);
      if (Object.keys(unknownFields).length > 0) return validationFailed(ctx, unknownFields);
      await run(ctx, id, async () => {
        const { value, replayed } = await runOnce(logger, { store: idempotency, scope: `inventario-recetas:${id}`, auth, key, body }, () =>
          recipes.saveVersion(id, { baseVersionId: body.baseVersionId, yieldQuantity: body.yieldQuantity, note: body.note, lines: body.lines }, authorOf(auth)),
        );
        const action = replayed ? 'replayed' : value.created ? 'new_version' : 'unchanged';
        logger.info('inventory_recipe_saved', { itemId: id, versionNumber: value.version.number, action });
        if (value.created) ctx.set('Location', inventoryRecipePaths.version(value.version.id));
        send(ctx, recipeSaveResponseSchema, { created: value.created, version: summaryDto(value.version) }, value.created ? 201 : 200);
      });
    },

    async close(ctx) {
      const auth = await access.inventory(ctx, { write: true });
      const id = routeId(ctx, itemNotFound);
      const body = await closedBody(ctx, CLOSE_FIELDS, RECIPE_BODY_LIMIT);
      if (!body) return;
      await run(ctx, id, async () => {
        const closed = await recipes.closeRecipe(id, { baseVersionId: body.baseVersionId }, authorOf(auth));
        logger.info('inventory_recipe_saved', { itemId: id, versionNumber: closed?.number ?? null, action: closed ? 'close' : 'close_unchanged' });
        send(ctx, recipeCloseResponseSchema, { version: closed ? summaryDto(closed) : null });
      });
    },

    async usedIn(ctx) {
      await access.inventory(ctx, { write: false });
      const id = routeId(ctx, itemNotFound);
      await run(ctx, id, async () => {
        const usages = await recipes.usedIn(id);
        send(ctx, recipeUsedInResponseSchema, {
          recipes: usages.map((usage) => ({ itemId: usage.itemId, name: usage.itemName, active: usage.itemActive, versionId: usage.versionId, versionNumber: usage.versionNumber })),
        });
      });
    },
  });
}
