import {
  INVENTORY_ERROR_CODES as CODES,
  inventoryCategoryListResponseSchema,
  inventoryCategoryResponseSchema,
  inventoryConversionResponseSchema,
  inventoryItemDetailResponseSchema,
  inventoryItemListResponseSchema,
  inventoryItemResponseSchema,
  inventoryPaths,
  type InventoryCategory as CategoryDto,
  type InventoryItem as ItemDto,
  type InventoryItemDetail,
  type InventoryHistoryEntry,
  type InventoryItemSummary,
} from '@restaurante/contracts';
import {
  CategoryInUseError,
  CategoryInactiveError,
  CategoryNameTakenError,
  CategoryNotFoundError,
  InventoryBusyError,
  InventoryConflictError,
  InventoryValidationError,
  ItemHasActiveVariantsError,
  ItemInActiveRecipesError,
  ItemLockedError,
  ItemNameTakenError,
  ItemNotFoundError,
  ParentInactiveError,
  UnitConversionError,
  COST_SCALE,
  formatDecimal,
  unitsSnapshot,
  type InventoryAuthor,
  type InventoryCategory,
  type InventoryItem,
  type InventoryRepository,
  type ItemDetail,
  type ItemSummary,
  type StoredInventoryChange,
} from '@restaurante/core/inventory';
import { toZonedIsoString, type Logger } from '@restaurante/core/shared';

import { ApiHttpError } from '../errors.ts';
import type { AdminAccess, AdminAuth } from './access.ts';
import type { IdempotencyStore } from './idempotency.ts';
import { idempotencyKey, inventoryBusy, routeId, runOnce, type Handler, type RouteContext } from './inventory-shared.ts';
import { createResponder, validationFailed } from './responses.ts';

/**
 * Catálogo de inventario en `/api/v1/admin/inventario` (REQ-F-049, T1), con las reglas de
 * `core/inventory`:
 *
 *   GET  /articulos?estado=&tipo=&categoria=&q=&pagina=   -> { items, page }
 *   POST /articulos                    (Idempotency-Key)  -> 201 { item }
 *   GET  /articulos/:id                                   -> { item, history }
 *   GET  /articulos/:id/conversion?cantidad=&unidad=      -> { quantity, unit }
 *   PUT  /articulos/:id                (version, overwrite) -> { item }
 *   POST /articulos/:id/desactivar     (version, variants, recipes) -> { item }
 *   POST /articulos/:id/reactivar      (version)            -> { item }
 *   GET  /categorias                                      -> { categories }
 *   POST /categorias                   (Idempotency-Key)  -> 201 { category }
 *   PUT  /categorias/:id                                  -> { category }
 *   POST /categorias/:id/desactivar | /reactivar          -> { category }
 *
 * Orden: sesión (401) -> rol administrador o gerente (403) -> CSRF en escrituras (403) -> id (404) ->
 * cuerpo (413/415/400/422) -> reglas (422, 409). Los logs solo llevan ids, acciones y códigos.
 *
 * REQ-F-050: el artículo lleva `referenceCost` e `inventoriable`; inactivar uno usado en recetas
 * vigentes responde 409 `ITEM_IN_ACTIVE_RECIPES` con la lista hasta confirmar con `recipes: 'keep'`;
 * una espera agotada del candado del inventario responde 503 `INVENTORY_BUSY`.
 */

export interface InventoryRoutes {
  listItems: Handler;
  createItem: Handler;
  getItem: Handler;
  convert: Handler;
  updateItem: Handler;
  deactivateItem: Handler;
  reactivateItem: Handler;
  listCategories: Handler;
  createCategory: Handler;
  renameCategory: Handler;
  deactivateCategory: Handler;
  reactivateCategory: Handler;
}

/** Cuerpo JSON de un artículo: textos cortos y como mucho 8 empaques. */
export const INVENTORY_BODY_LIMIT = 16 * 1024;
const UNIT_MAX = 40;
const COST_FIELDS = ['referenceCost', 'inventoriable'] as const;
const ITEM_CREATE_FIELDS: readonly string[] = Object.freeze(['kind', 'type', 'categoryId', 'parentId', 'name', 'description', 'sku', 'baseUnit', 'units', ...COST_FIELDS]);
const ITEM_UPDATE_FIELDS: readonly string[] = Object.freeze(['version', 'overwrite', 'type', 'categoryId', 'name', 'description', 'sku', 'baseUnit', 'units', ...COST_FIELDS]);
const DEACTIVATE_FIELDS: readonly string[] = Object.freeze(['version', 'variants', 'recipes']);
const REACTIVATE_FIELDS: readonly string[] = Object.freeze(['version']);
const CATEGORY_FIELDS: readonly string[] = Object.freeze(['name']);
/** Claves de core -> parámetros de la query (los `fields` de un 422 usan los nombres de la query). */
const FILTER_FIELDS: Readonly<Record<string, string>> = Object.freeze({ status: 'estado', type: 'tipo', categoryId: 'categoria', q: 'q', page: 'pagina' });
const CONVERSION_FIELDS: Readonly<Record<string, string>> = Object.freeze({ quantity: 'cantidad' });

const authorOf = ({ user }: AdminAuth): InventoryAuthor => ({ id: user.id, name: user.displayName });
const renameFields = (fields: Record<string, string>, names: Readonly<Record<string, string>>): Record<string, string> =>
  Object.fromEntries(Object.entries(fields).map(([key, message]) => [names[key] ?? key, message]));

/** Valor único de la query; '' cuenta como ausente (formularios GET). Repetido: se deja para que core lo rechace. */
function queryValue(value: string | string[] | undefined): unknown {
  if (value === undefined || value === '') return undefined;
  return value;
}

export function createInventoryRoutes({
  access,
  inventory,
  idempotency,
  timeZone,
  logger,
}: {
  access: AdminAccess;
  inventory: InventoryRepository;
  idempotency: { items: IdempotencyStore<InventoryItem>; categories: IdempotencyStore<InventoryCategory> };
  timeZone: string;
  logger: Logger;
}): InventoryRoutes {
  const { send, closedBody: readClosed } = createResponder(logger);
  const iso = (date: Date) => toZonedIsoString(date, timeZone);
  const closedBody = (ctx: RouteContext, allowed: readonly string[]) => readClosed(ctx, allowed, INVENTORY_BODY_LIMIT);

  const itemDto = (item: InventoryItem): ItemDto => ({
    id: item.id,
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
    version: item.version,
    createdAt: iso(item.createdAt),
    updatedAt: iso(item.updatedAt),
    updatedBy: item.updatedByName,
    referenceCost: item.referenceCost === null ? null : formatDecimal(item.referenceCost, COST_SCALE),
    inventoriable: item.inventoriable,
  });

  const summaryDto = (item: ItemSummary): InventoryItemSummary => ({
    id: item.id,
    kind: item.kind,
    type: item.type,
    parentId: item.parentId,
    categoryId: item.categoryId,
    categoryName: item.categoryName,
    name: item.name,
    sku: item.sku,
    baseUnit: item.baseUnit,
    active: item.active,
    variantCount: item.variantCount,
    version: item.version,
    updatedAt: iso(item.updatedAt),
  });

  const detailDto = (detail: ItemDetail): InventoryItemDetail => ({
    ...itemDto(detail.item),
    category: { id: detail.category.id, name: detail.category.name, active: detail.category.active },
    parent: detail.parent ? { id: detail.parent.id, name: detail.parent.name, active: detail.parent.active } : null,
    variants: detail.variants.map((variant) => ({ id: variant.id, name: variant.name, sku: variant.sku, baseUnit: variant.baseUnit, active: variant.active })),
    locked: detail.locked,
    equivalences: detail.equivalences.map(({ unit, quantity }) => ({ unit, quantity: formatDecimal(quantity) })),
  });

  const historyDto = (entry: StoredInventoryChange): InventoryHistoryEntry => ({
    id: entry.id,
    at: iso(entry.at),
    action: entry.action,
    author: entry.actorName,
    changes: entry.changes.map(({ field, before, after }) => ({ field, before, after })),
  });

  const categoryDto = (category: InventoryCategory): CategoryDto => ({
    id: category.id,
    name: category.name,
    active: category.active,
    createdAt: iso(category.createdAt),
    updatedAt: iso(category.updatedAt),
  });

  const idOf = routeId;
  const itemNotFound = () => new ApiHttpError(404, CODES.ITEM_NOT_FOUND, 'Artículo no encontrado.');
  const categoryNotFound = () => new ApiHttpError(404, CODES.CATEGORY_NOT_FOUND, 'Categoría no encontrada.');

  /** Errores de dominio -> 404, 409 y 422. El resto (DatabaseUnavailableError: 503) sigue al manejador central. */
  async function run(ctx: RouteContext, task: () => Promise<void>, fieldNames?: Readonly<Record<string, string>>): Promise<void> {
    try {
      await task();
    } catch (err) {
      if (err instanceof InventoryValidationError) return validationFailed(ctx, fieldNames ? renameFields(err.fields, fieldNames) : err.fields);
      if (err instanceof ItemNotFoundError) throw itemNotFound();
      if (err instanceof CategoryNotFoundError) throw categoryNotFound();
      if (err instanceof InventoryConflictError) {
        logger.info('inventory_conflict', { itemId: err.current.id });
        ctx.status = 409;
        ctx.body = {
          error: {
            code: 'VERSION_CONFLICT',
            message: 'El artículo cambió mientras lo editabas: no se guardó nada.',
            current: { id: err.current.id, version: err.current.version, updatedAt: iso(err.current.updatedAt), updatedBy: err.current.updatedBy },
          },
        };
        return;
      }
      if (err instanceof ItemLockedError) throw new ApiHttpError(409, CODES.ITEM_LOCKED, err.message);
      if (err instanceof ItemHasActiveVariantsError) throw new ApiHttpError(409, CODES.ITEM_HAS_ACTIVE_VARIANTS, err.message);
      if (err instanceof ItemNameTakenError) throw new ApiHttpError(409, CODES.ITEM_NAME_TAKEN, err.message);
      if (err instanceof ParentInactiveError) throw new ApiHttpError(409, CODES.PARENT_INACTIVE, err.message);
      if (err instanceof CategoryInactiveError) throw new ApiHttpError(409, CODES.CATEGORY_INACTIVE, err.message);
      if (err instanceof CategoryInUseError) throw new ApiHttpError(409, CODES.CATEGORY_IN_USE, err.message);
      if (err instanceof CategoryNameTakenError) throw new ApiHttpError(409, CODES.CATEGORY_NAME_TAKEN, err.message);
      if (err instanceof UnitConversionError) throw new ApiHttpError(422, err.code, err.message);
      if (err instanceof ItemInActiveRecipesError) {
        logger.info('inventory_item_in_active_recipes', { recipes: err.recipes.length });
        ctx.status = 409;
        ctx.body = { error: { code: CODES.ITEM_IN_ACTIVE_RECIPES, message: err.message, recipes: err.recipes.map(({ itemId, name }) => ({ itemId, name })) } };
        return;
      }
      if (err instanceof InventoryBusyError) throw inventoryBusy(ctx, logger);
      throw err;
    }
  }

  /** Alta idempotente (doble envío); el índice único del nombre es la segunda barrera. */
  const once = <T>(store: IdempotencyStore<T>, scope: string, auth: AdminAuth, key: string, body: unknown, task: () => Promise<T>) =>
    runOnce(logger, { store, scope, auth, key, body }, task);

  const saved = (ctx: RouteContext, item: InventoryItem, action: string, status = 200) => {
    logger.info('inventory_item_saved', { itemId: item.id, action });
    send(ctx, inventoryItemResponseSchema, { item: itemDto(item) }, status);
  };

  return Object.freeze<InventoryRoutes>({
    async listItems(ctx) {
      await access.inventory(ctx, { write: false });
      const { estado, tipo, categoria, q, pagina } = ctx.query;
      await run(
        ctx,
        async () => {
          const page = await inventory.listItems({ status: queryValue(estado), type: queryValue(tipo), categoryId: queryValue(categoria), q: queryValue(q), page: queryValue(pagina) });
          send(ctx, inventoryItemListResponseSchema, { items: page.items.map(summaryDto), page: page.page });
        },
        FILTER_FIELDS,
      );
    },

    async createItem(ctx) {
      const auth = await access.inventory(ctx, { write: true });
      const key = idempotencyKey(ctx);
      const body = await closedBody(ctx, ITEM_CREATE_FIELDS);
      if (!body) return;
      await run(ctx, async () => {
        const { value, replayed } = await once(idempotency.items, 'inventario-articulos', auth, key, body, () => inventory.createItem(body, authorOf(auth)));
        if (replayed) logger.info('inventory_create_replayed', { itemId: value.id });
        ctx.set('Location', inventoryPaths.item(value.id));
        saved(ctx, value, replayed ? 'create_replayed' : 'create', 201);
      });
    },

    async getItem(ctx) {
      await access.inventory(ctx, { write: false });
      const id = idOf(ctx, itemNotFound);
      await run(ctx, async () => {
        const detail = await inventory.getItem(id);
        send(ctx, inventoryItemDetailResponseSchema, { item: detailDto(detail), history: detail.history.map(historyDto) });
      });
    },

    async convert(ctx) {
      await access.inventory(ctx, { write: false });
      const id = idOf(ctx, itemNotFound);
      const { cantidad, unidad } = ctx.query;
      if (typeof unidad !== 'string' || unidad.trim() === '' || [...unidad].length > UNIT_MAX) return validationFailed(ctx, { unidad: 'Elige una unidad.' });
      await run(
        ctx,
        async () => {
          const result = await inventory.convert(id, cantidad, unidad);
          send(ctx, inventoryConversionResponseSchema, { quantity: formatDecimal(result.quantity), unit: result.unit });
        },
        CONVERSION_FIELDS,
      );
    },

    async updateItem(ctx) {
      const auth = await access.inventory(ctx, { write: true });
      const id = idOf(ctx, itemNotFound);
      const body = await closedBody(ctx, ITEM_UPDATE_FIELDS);
      if (!body) return;
      if (body.overwrite !== undefined && typeof body.overwrite !== 'boolean') return validationFailed(ctx, { overwrite: 'Debe ser verdadero o falso.' });
      const overwrite = body.overwrite === true;
      await run(ctx, async () => {
        const item = await inventory.updateItem(id, { ...body, version: body.version, overwrite }, authorOf(auth));
        saved(ctx, item, overwrite ? 'overwrite_after_conflict' : 'update');
      });
    },

    async deactivateItem(ctx) {
      const auth = await access.inventory(ctx, { write: true });
      const id = idOf(ctx, itemNotFound);
      const body = await closedBody(ctx, DEACTIVATE_FIELDS);
      if (!body) return;
      await run(ctx, async () => saved(ctx, await inventory.deactivateItem(id, { version: body.version, variants: body.variants, recipes: body.recipes }, authorOf(auth)), 'deactivate'));
    },

    async reactivateItem(ctx) {
      const auth = await access.inventory(ctx, { write: true });
      const id = idOf(ctx, itemNotFound);
      const body = await closedBody(ctx, REACTIVATE_FIELDS);
      if (!body) return;
      await run(ctx, async () => saved(ctx, await inventory.reactivateItem(id, { version: body.version }, authorOf(auth)), 'reactivate'));
    },

    async listCategories(ctx) {
      await access.inventory(ctx, { write: false });
      const categories = await inventory.listCategories();
      send(ctx, inventoryCategoryListResponseSchema, { categories: categories.map((category) => ({ ...categoryDto(category), activeItemCount: category.activeItemCount })) });
    },

    async createCategory(ctx) {
      const auth = await access.inventory(ctx, { write: true });
      const key = idempotencyKey(ctx);
      const body = await closedBody(ctx, CATEGORY_FIELDS);
      if (!body) return;
      await run(ctx, async () => {
        const { value } = await once(idempotency.categories, 'inventario-categorias', auth, key, body, () => inventory.createCategory(body, authorOf(auth)));
        logger.info('inventory_category_saved', { categoryId: value.id, action: 'create' });
        ctx.set('Location', inventoryPaths.category(value.id));
        send(ctx, inventoryCategoryResponseSchema, { category: categoryDto(value) }, 201);
      });
    },

    async renameCategory(ctx) {
      const auth = await access.inventory(ctx, { write: true });
      const id = idOf(ctx, categoryNotFound);
      const body = await closedBody(ctx, CATEGORY_FIELDS);
      if (!body) return;
      await run(ctx, async () => {
        const category = await inventory.renameCategory(id, body, authorOf(auth));
        logger.info('inventory_category_saved', { categoryId: id, action: 'update' });
        send(ctx, inventoryCategoryResponseSchema, { category: categoryDto(category) });
      });
    },

    async deactivateCategory(ctx) {
      const auth = await access.inventory(ctx, { write: true });
      const id = idOf(ctx, categoryNotFound);
      if (!(await closedBody(ctx, []))) return;
      await run(ctx, async () => {
        const category = await inventory.deactivateCategory(id, authorOf(auth));
        logger.info('inventory_category_saved', { categoryId: id, action: 'deactivate' });
        send(ctx, inventoryCategoryResponseSchema, { category: categoryDto(category) });
      });
    },

    async reactivateCategory(ctx) {
      const auth = await access.inventory(ctx, { write: true });
      const id = idOf(ctx, categoryNotFound);
      if (!(await closedBody(ctx, []))) return;
      await run(ctx, async () => {
        const category = await inventory.reactivateCategory(id, authorOf(auth));
        logger.info('inventory_category_saved', { categoryId: id, action: 'reactivate' });
        send(ctx, inventoryCategoryResponseSchema, { category: categoryDto(category) });
      });
    },
  });
}
