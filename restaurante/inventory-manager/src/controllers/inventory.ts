import {
  IDEMPOTENCY_KEY_PATTERN,
  INVENTORY_ITEM_KINDS,
  type AdminApiClient,
  type InventoryItemDetail,
  type InventoryItemKind,
  type PackagingUnitRequest,
} from '@restaurante/contracts';
import type { Logger, SafeHtml } from '@restaurante/web';

import type { InventoryConfig } from '../config.ts';
import { displayDate, type Views } from '../views/index.ts';
import {
  CATEGORIES_PATH,
  EMPTY_ITEM_FORM,
  ITEMS_PATH,
  NEW_ITEM_PATH,
  UNIT_SLOTS,
  categoryEditPath,
  costFields,
  itemDeactivatePath,
  itemEditPath,
  itemFormValues,
  itemPath,
  readItemForm,
  trimDecimal,
  unitField,
  type CategoryOption,
  type ConversionView,
  type ItemFormValues,
  type ParentInfo,
} from '../views/inventory.ts';
import { createControllerKit, type Ctx, type Session } from './common.ts';
import { UNAVAILABLE, createInventoryAccess, httpFailure, newRequestId, queryText } from './inventory-common.ts';

/**
 * Inventario del admin nuevo (REQ-F-049, T1: RF-1 a RF-9 y RF-11), solo para administradores y
 * gerentes. Cada acción la decide la API (`/api/v1/admin/inventario`), a la que se reenvía la sesión y
 * el token CSRF del campo `_csrf`:
 *
 * - GET: sesión (si no vale, 303 al acceso con `next`) -> rol (403 sin datos y sin pedir nada a la API) -> datos.
 * - POST: mismo origen (403) -> lista cerrada de campos (400) -> sesión -> rol -> la API (CSRF, 422 por
 *   campo, 409 de versión y de reglas). Después, 303 (PRG): el botón atrás no reenvía.
 * - Con la API caída: 503 con lo escrito conservado.
 *
 * Nunca se registran nombres, cuerpos, cookies ni tokens: solo la ruta, ids y códigos.
 */

type Handler = (ctx: Ctx) => Promise<void>;

export interface InventoryController {
  root: Handler;
  items: Handler;
  newItem: Handler;
  createItem: Handler;
  item: Handler;
  editItem: Handler;
  updateItem: Handler;
  deactivatePage: Handler;
  deactivateItem: Handler;
  reactivateItem: Handler;
  categories: Handler;
  createCategory: Handler;
  editCategory: Handler;
  renameCategory: Handler;
  deactivateCategory: Handler;
  reactivateCategory: Handler;
}

const ITEM_BODY_LIMIT = 16 * 1024;
const SMALL_LIMIT = 4 * 1024;
const UNIT_FIELDS = Array.from({ length: UNIT_SLOTS }, (_, slot) => [unitField(slot, 'name'), unitField(slot, 'factor')]).flat();
const ITEM_DATA_FIELDS = ['_csrf', 'action', 'kind', 'name', 'description', 'type', 'categoryId', 'sku', 'baseUnit', 'referenceCost', 'inventoriable', ...UNIT_FIELDS];
const ITEM_CREATE_FIELDS = Object.freeze([...ITEM_DATA_FIELDS, 'requestId', 'parentId']);
const ITEM_UPDATE_FIELDS = Object.freeze([...ITEM_DATA_FIELDS, 'version']);
const STATUS_FIELDS = Object.freeze(['_csrf', 'version', 'variants', 'recipes']);
const CATEGORY_CREATE_FIELDS = Object.freeze(['_csrf', 'requestId', 'name']);
const CATEGORY_RENAME_FIELDS = Object.freeze(['_csrf', 'name']);
const CATEGORY_STATUS_FIELDS = Object.freeze(['_csrf', 'version']);

/** Mensajes de éxito (`?ok=`, lista cerrada). */
const SUCCESS: Readonly<Record<string, string>> = Object.freeze({
  created: 'Artículo creado.',
  saved: 'Cambios guardados.',
  deactivated: 'Artículo inactivado: conserva su historial y puedes reactivarlo.',
  reactivated: 'Artículo reactivado.',
  category_created: 'Categoría creada.',
  category_renamed: 'Categoría renombrada.',
  category_deactivated: 'Categoría inactivada.',
  category_reactivated: 'Categoría reactivada.',
});
const isKind = (value: string | undefined): value is InventoryItemKind => (INVENTORY_ITEM_KINDS as readonly string[]).includes(value ?? '');
const invalidForm = (ctx: Ctx): never => ctx.throw(400, 'El formulario tiene valores imposibles.', { code: 'INVALID_FORM' });
/** Clase del artículo del campo oculto `kind` (otro valor: 400). */
const formKind = (ctx: Ctx, value: string | undefined): InventoryItemKind => (isKind(value) ? value : invalidForm(ctx));

/** Empaques escritos (sin las filas vacías) y la fila del formulario de cada uno, para devolver los errores a su sitio. */
function packagingUnits(values: ItemFormValues): { units: PackagingUnitRequest[]; slots: number[] } {
  const units: PackagingUnitRequest[] = [];
  const slots: number[] = [];
  values.units.forEach((unit, slot) => {
    if (unit.name.trim() === '' && unit.factor.trim() === '') return;
    units.push({ name: unit.name, factor: unit.factor.trim() });
    slots.push(slot);
  });
  return { units, slots };
}

/** `units.<i>…` de la API (lista compacta) -> `units.<fila>…` del formulario. */
function unitErrorsToSlots(errors: Record<string, string>, slots: readonly number[]): Record<string, string> {
  return Object.fromEntries(
    Object.entries(errors).map(([key, message]) => {
      const match = /^units\.(\d+)(\..+)?$/.exec(key);
      const slot = match ? slots[Number(match[1])] : undefined;
      return [slot === undefined || !match ? key : `units.${slot}${match[2] ?? ''}`, message];
    }),
  );
}

export function createInventoryController({ config, api, views, logger }: { config: InventoryConfig; api: AdminApiClient; views: Views; logger: Logger }): InventoryController {
  const kit = createControllerKit({ config, api, views, logger });
  const { send, seeOther, failureReason, isUnavailable, readClosedForm, fieldErrors, idOf, credentials } = kit;
  const { notFound, inventorySession, apiFailure } = createInventoryAccess({ config, kit, views });

  function successNotices(ctx: Ctx): SafeHtml[] {
    const { ok } = ctx.query;
    return typeof ok === 'string' && Object.hasOwn(SUCCESS, ok) ? [views.notice({ tone: 'success', title: SUCCESS[ok] as string })] : [];
  }

  /** Categorías para los `select` (null si la API no responde). */
  async function categoryOptions(auth: Session | null): Promise<CategoryOption[] | null> {
    if (!auth) return null;
    const result = await api.listInventoryCategories(credentials(auth));
    return result.ok ? result.data.categories.map(({ id, name, active }) => ({ id, name, active })) : null;
  }

  /** Sin la lista de la API (caída), solo la categoría que se eligió, para no perderla. */
  const fallbackCategories = (values: ItemFormValues): CategoryOption[] => (/^[1-9]\d{0,9}$/.test(values.categoryId) ? [{ id: Number(values.categoryId), name: 'Categoría elegida', active: true }] : []);

  const parentInfo = (detail: InventoryItemDetail): ParentInfo => ({ id: detail.id, name: detail.name, type: detail.type, categoryName: detail.category.name });

  interface ItemFormState {
    mode: 'create' | 'edit';
    kind: InventoryItemKind;
    id?: number | undefined;
    parentId?: number | null | undefined;
    values: ItemFormValues;
    hidden: Record<string, string>;
    errors?: Record<string, string>;
    notices?: SafeHtml[];
    conflict?: boolean;
    locked?: boolean;
  }

  /** Pinta el formulario de artículo con las categorías y el padre vigentes (o lo escrito, si la API no responde). */
  async function itemForm(ctx: Ctx, status: number, auth: Session | null, csrf: string, state: ItemFormState): Promise<void> {
    let parent: ParentInfo | null = null;
    let categories: CategoryOption[] = [];
    if (state.kind === 'variant') {
      if (auth && state.parentId) {
        const found = await api.getInventoryItem(credentials(auth), state.parentId);
        if (found.ok) parent = parentInfo(found.data.item);
      }
    } else {
      categories = (await categoryOptions(auth)) ?? fallbackCategories(state.values);
    }
    send(ctx, status, views.inventoryItemForm({ context: auth, csrfToken: auth?.csrfToken ?? csrf, parent, categories, ...state }));
  }

  /**
   * Cuerpo para la API según la clase del artículo (un padre no lleva unidad, SKU ni empaques; una variante
   * hereda la categoría). El costo de referencia y el inventariable (REQ-F-050) solo van si el formulario
   * los mostró (`shown`): en un alta, el costo solo si se escribió.
   */
  function itemInput(kind: InventoryItemKind, values: ItemFormValues, shown: { referenceCost: boolean; inventoriable: boolean }, mode: 'create' | 'edit') {
    const { units, slots } = packagingUnits(values);
    const common = { name: values.name, description: values.description };
    const stock = kind === 'parent' ? {} : { sku: values.sku, baseUnit: values.baseUnit, units };
    const category = kind === 'variant' ? {} : { categoryId: values.categoryId };
    const cost = values.referenceCost.trim();
    const referenceCost = mode === 'create' ? (cost === '' ? {} : { referenceCost: cost }) : shown.referenceCost ? { referenceCost: cost === '' ? null : cost } : {};
    const inventoriable = shown.inventoriable ? { inventoriable: values.inventoriable } : {};
    return { input: { ...common, ...stock, ...category, ...referenceCost, ...inventoriable }, slots };
  }

  function domainNotice(message: string): SafeHtml {
    return views.notice({ tone: 'warning', urgent: true, title: message, paragraphs: ['No se guardó nada. Lo que escribiste sigue en el formulario.'] });
  }

  /** Recetas vigentes que usan el artículo (REQ-F-050, RF-8); null si la API no las dio. */
  async function usedIn(auth: Session, id: number) {
    const result = await api.inventoryRecipeUsedIn(credentials(auth), id);
    return result.ok ? result.data.recipes : null;
  }

  async function detailPage(ctx: Ctx, auth: Session, id: number, status: number, notices: SafeHtml[], conversion?: ConversionView): Promise<void> {
    const [found, categories, recipes] = await Promise.all([api.getInventoryItem(credentials(auth), id), categoryOptions(auth), usedIn(auth, id)]);
    if (!found.ok) return apiFailure(ctx, found, auth, itemPath(id));
    send(ctx, status, views.inventoryItem({ context: auth, item: found.data.item, history: found.data.history, categories: categories ?? [], usedIn: recipes, conversion, notices }));
  }

  async function categoriesPage(ctx: Ctx, auth: Session, status: number, extra: { name?: string; requestId?: string; errors?: Record<string, string>; notices?: SafeHtml[] } = {}): Promise<void> {
    const result = await api.listInventoryCategories(credentials(auth));
    if (!result.ok) return apiFailure(ctx, result, auth, CATEGORIES_PATH, 'inventory-categories');
    send(ctx, status, views.inventoryCategories({ context: auth, csrfToken: auth.csrfToken, categories: result.data.categories, requestId: extra.requestId ?? newRequestId(), ...extra }));
  }

  async function changeCategoryStatus(ctx: Ctx, active: boolean): Promise<void> {
    const fields = await readClosedForm(ctx, CATEGORY_STATUS_FIELDS, SMALL_LIMIT);
    const auth = await inventorySession(ctx, CATEGORIES_PATH);
    if (!auth) return;
    const id = idOf(ctx);
    if (id === null) return notFound(ctx, auth, 'inventory-categories');
    const result = await api.setInventoryCategoryActive(credentials(auth, fields), id, active);
    if (result.ok) return seeOther(ctx, `${CATEGORIES_PATH}?ok=${active ? 'category_reactivated' : 'category_deactivated'}`);
    if (httpFailure(result, 409)) {
      logger.info('inventory_category_rejected', { categoryId: id, code: result.error.code });
      return categoriesPage(ctx, auth, 409, { notices: [views.notice({ tone: 'warning', urgent: true, title: result.error.message })] });
    }
    return apiFailure(ctx, result, auth, CATEGORIES_PATH, 'inventory-categories');
  }

  return Object.freeze<InventoryController>({
    async root(ctx) {
      seeOther(ctx, ITEMS_PATH);
    },

    async items(ctx) {
      const auth = await inventorySession(ctx, ITEMS_PATH);
      if (!auth) return;
      const filter = { estado: queryText(ctx.query.estado), tipo: queryText(ctx.query.tipo), categoria: queryText(ctx.query.categoria), q: queryText(ctx.query.q) };
      const [list, categories] = await Promise.all([
        api.listInventoryItems(credentials(auth), { status: filter.estado, type: filter.tipo, categoryId: filter.categoria, q: filter.q, page: queryText(ctx.query.pagina) }),
        categoryOptions(auth),
      ]);
      const errors = fieldErrors(list);
      if (errors) return send(ctx, 422, views.inventoryItems({ context: auth, filter, categories: categories ?? [], list: null, errors }));
      if (!list.ok) return apiFailure(ctx, list, auth, ITEMS_PATH);
      send(ctx, 200, views.inventoryItems({ context: auth, filter, categories: categories ?? [], list: list.data, notices: successNotices(ctx) }));
    },

    async newItem(ctx) {
      const auth = await inventorySession(ctx, NEW_ITEM_PATH);
      if (!auth) return;
      const hidden = { requestId: newRequestId() };
      const rawParent = queryText(ctx.query.padre);
      if (rawParent !== '') {
        if (!/^[1-9]\d{0,9}$/.test(rawParent)) return notFound(ctx, auth);
        const found = await api.getInventoryItem(credentials(auth), Number(rawParent));
        if (!found.ok) return apiFailure(ctx, found, auth, NEW_ITEM_PATH);
        const parent = found.data.item;
        if (parent.kind !== 'parent') return notFound(ctx, auth);
        if (!parent.active) {
          return send(ctx, 409, views.message({ title: 'Artículo inactivo', notice: { tone: 'warning', title: 'No se pueden añadir variantes a un artículo inactivo: reactívalo primero.' }, context: auth, section: 'inventory', backHref: itemPath(parent.id), backLabel: `Volver a ${parent.name}` }));
        }
        return itemForm(ctx, 200, auth, '', { mode: 'create', kind: 'variant', parentId: parent.id, values: EMPTY_ITEM_FORM, hidden: { ...hidden, kind: 'variant', parentId: String(parent.id) } });
      }
      const kind: InventoryItemKind = ctx.query.clase === 'padre' ? 'parent' : 'simple';
      return itemForm(ctx, 200, auth, '', { mode: 'create', kind, values: EMPTY_ITEM_FORM, hidden: { ...hidden, kind } });
    },

    async createItem(ctx) {
      const fields = await readClosedForm(ctx, ITEM_CREATE_FIELDS, ITEM_BODY_LIMIT);
      const kind = formKind(ctx, fields.get('kind'));
      const values = readItemForm(fields);
      const rawParent = fields.get('parentId') ?? '';
      const parentId = kind === 'variant' && /^[1-9]\d{0,9}$/.test(rawParent) ? Number(rawParent) : null;
      if (kind === 'variant' && parentId === null) invalidForm(ctx);
      const requestId = fields.get('requestId') ?? '';
      const hidden = { requestId: IDEMPOTENCY_KEY_PATTERN.test(requestId) ? requestId : newRequestId(), kind, ...(parentId === null ? {} : { parentId: String(parentId) }) };
      const csrf = fields.get('_csrf') ?? '';
      const state = { mode: 'create' as const, kind, parentId, values, hidden };
      const pending: Promise<void>[] = [];
      const auth = await inventorySession(ctx, NEW_ITEM_PATH, () => {
        pending.push(itemForm(ctx, 503, null, csrf, { ...state, notices: [views.notice(UNAVAILABLE)] }));
        return true;
      });
      await Promise.all(pending);
      if (!auth) return;
      const { input, slots } = itemInput(kind, values, costFields('create', kind, values.type), 'create');
      const result = await api.createInventoryItem(credentials(auth, fields), { ...input, kind, ...(kind === 'variant' ? { parentId: parentId ?? 0 } : { type: values.type }) }, hidden.requestId);
      if (result.ok) {
        logger.info('inventory_item_created', { itemId: result.data.item.id });
        return seeOther(ctx, `${itemPath(result.data.item.id)}?ok=created`);
      }
      const errors = fieldErrors(result);
      if (errors) return itemForm(ctx, 422, auth, csrf, { ...state, errors: unitErrorsToSlots(errors, slots) });
      if (httpFailure(result, 409)) return itemForm(ctx, 409, auth, csrf, { ...state, notices: [domainNotice(result.error.message)] });
      if (isUnavailable(result)) {
        logger.warn('api_unavailable', { path: ctx.path, reason: failureReason(result) });
        return itemForm(ctx, 503, auth, csrf, { ...state, notices: [views.notice(UNAVAILABLE)] });
      }
      return apiFailure(ctx, result, auth, NEW_ITEM_PATH);
    },

    async item(ctx) {
      const auth = await inventorySession(ctx, ctx.path);
      if (!auth) return;
      const id = idOf(ctx);
      if (id === null) return notFound(ctx, auth);
      const quantity = queryText(ctx.query.cantidad).trim();
      const unit = queryText(ctx.query.unidad);
      if (quantity === '' && unit === '') return detailPage(ctx, auth, id, 200, successNotices(ctx));
      const result = await api.convertInventoryQuantity(credentials(auth), id, quantity, unit);
      if (result.ok) return detailPage(ctx, auth, id, 200, [], { quantity, unit, result: trimDecimal(result.data.quantity) });
      if (httpFailure(result, 422)) {
        const error = result.error.fields?.cantidad ?? result.error.message;
        return detailPage(ctx, auth, id, 422, [], { quantity, unit, error });
      }
      return apiFailure(ctx, result, auth, itemPath(id));
    },

    async editItem(ctx) {
      const auth = await inventorySession(ctx, ctx.path);
      if (!auth) return;
      const id = idOf(ctx);
      if (id === null) return notFound(ctx, auth);
      const found = await api.getInventoryItem(credentials(auth), id);
      if (!found.ok) return apiFailure(ctx, found, auth, ctx.path);
      const { item } = found.data;
      return itemForm(ctx, 200, auth, '', {
        mode: 'edit',
        kind: item.kind,
        id,
        parentId: item.parentId,
        values: itemFormValues(item),
        hidden: { kind: item.kind, type: item.type, version: String(item.version) },
        locked: item.locked,
      });
    },

    async updateItem(ctx) {
      const fields = await readClosedForm(ctx, ITEM_UPDATE_FIELDS, ITEM_BODY_LIMIT);
      const id = idOf(ctx);
      const action = fields.get('action');
      if (action !== 'update' && action !== 'overwrite') invalidForm(ctx);
      const kind = formKind(ctx, fields.get('kind'));
      const values = readItemForm(fields);
      const csrf = fields.get('_csrf') ?? '';
      const hidden = { kind, type: values.type, version: fields.get('version') ?? '' };
      const state = { mode: 'edit' as const, kind, id: id ?? 0, values, hidden };
      const pending: Promise<void>[] = [];
      const auth = await inventorySession(ctx, id === null ? ITEMS_PATH : itemEditPath(id), () => {
        if (id === null) return false;
        pending.push(itemForm(ctx, 503, null, csrf, { ...state, notices: [views.notice(UNAVAILABLE)] }));
        return true;
      });
      await Promise.all(pending);
      if (!auth) return;
      if (id === null) return notFound(ctx, auth);
      // La clase, el padre y el bloqueo vigentes los da la API (lo oculto del formulario solo sirve si no responde).
      const current = await api.getInventoryItem(credentials(auth), id);
      if (!current.ok && !isUnavailable(current)) return apiFailure(ctx, current, auth, itemEditPath(id));
      const known = current.ok ? current.data.item : null;
      const realKind = known?.kind ?? kind;
      const rendered = { ...state, kind: realKind, parentId: known?.parentId ?? null, locked: known?.locked ?? false, values: { ...values, type: known?.type ?? values.type } };
      const version = Number(fields.get('version'));
      const { input, slots } = itemInput(realKind, values, costFields('edit', realKind, known?.type ?? values.type), 'edit');
      const result = await api.updateInventoryItem(credentials(auth, fields), id, { ...input, version: Number.isSafeInteger(version) ? version : 0, ...(action === 'overwrite' ? { overwrite: true } : {}) });
      if (result.ok) {
        logger.info('inventory_item_saved', { itemId: id, overwrite: action === 'overwrite' });
        return seeOther(ctx, `${itemPath(id)}?ok=saved`);
      }
      const errors = fieldErrors(result);
      if (errors) return itemForm(ctx, 422, auth, csrf, { ...rendered, errors: unitErrorsToSlots(errors, slots) });
      if (httpFailure(result, 409) && result.error.current) {
        // RF-8 (CA-9): lo escrito se conserva; se muestra quién y cuándo cambió la versión vigente. Solo se
        // guarda sobre ella si el usuario lo pide (botón "Guardar mis cambios sobre la versión vigente").
        const { current: latest } = result.error;
        logger.info('inventory_conflict_shown', { itemId: id });
        const conflict = views.notice({
          tone: 'warning',
          urgent: true,
          title: 'Otra persona cambió este artículo mientras lo editabas: no se guardó nada.',
          paragraphs: [`Última modificación: ${latest.updatedBy ?? 'otra sesión'}, el ${displayDate(latest.updatedAt)}.`, 'Lo que escribiste sigue en el formulario. Puedes cargar la versión vigente o guardar tus cambios sobre ella.'],
          links: [{ href: itemEditPath(id), label: 'Cargar la versión vigente (descarta lo escrito)' }],
        });
        return itemForm(ctx, 409, auth, csrf, { ...rendered, hidden: { ...hidden, version: String(latest.version) }, notices: [conflict], conflict: true });
      }
      if (httpFailure(result, 409)) return itemForm(ctx, 409, auth, csrf, { ...rendered, notices: [domainNotice(result.error.message)] });
      if (isUnavailable(result)) {
        logger.warn('api_unavailable', { path: ctx.path, reason: failureReason(result) });
        return itemForm(ctx, 503, auth, csrf, { ...rendered, notices: [views.notice(UNAVAILABLE)] });
      }
      return apiFailure(ctx, result, auth, itemEditPath(id));
    },

    async deactivatePage(ctx) {
      const auth = await inventorySession(ctx, ctx.path);
      if (!auth) return;
      const id = idOf(ctx);
      if (id === null) return notFound(ctx, auth);
      const [found, recipes] = await Promise.all([api.getInventoryItem(credentials(auth), id), usedIn(auth, id)]);
      if (!found.ok) return apiFailure(ctx, found, auth, ctx.path);
      if (!found.data.item.active) return seeOther(ctx, itemPath(id));
      send(ctx, 200, views.inventoryItemDeactivate({ context: auth, item: found.data.item, recipes: recipes ?? [] }));
    },

    async deactivateItem(ctx) {
      const fields = await readClosedForm(ctx, STATUS_FIELDS, SMALL_LIMIT);
      const id = idOf(ctx);
      const auth = await inventorySession(ctx, id === null ? ITEMS_PATH : itemDeactivatePath(id));
      if (!auth) return;
      if (id === null) return notFound(ctx, auth);
      const version = Number(fields.get('version'));
      const result = await api.deactivateInventoryItem(credentials(auth, fields), id, {
        version: Number.isSafeInteger(version) ? version : 0,
        ...(fields.get('variants') === 'deactivate' ? { variants: 'deactivate' as const } : {}),
        ...(fields.get('recipes') === 'keep' ? { recipes: 'keep' as const } : {}),
      });
      if (result.ok) return seeOther(ctx, `${itemPath(id)}?ok=deactivated`);
      if (httpFailure(result, 409)) {
        // Cambió mientras se confirmaba (otra versión, una variante nueva o una receta que lo usa, REQ-F-050
        // RF-7): se vuelve a confirmar con los datos vigentes y, si las hay, la lista de recetas afectadas.
        const found = await api.getInventoryItem(credentials(auth), id);
        if (!found.ok) return apiFailure(ctx, found, auth, itemPath(id));
        if (!found.data.item.active) return seeOther(ctx, itemPath(id));
        const inRecipes = result.error.code === 'ITEM_IN_ACTIVE_RECIPES';
        const recipes = inRecipes ? (result.error.recipes ?? []) : ((await usedIn(auth, id)) ?? []);
        logger.info('inventory_item_deactivate_rejected', { itemId: id, code: result.error.code });
        const title = result.error.code === 'VERSION_CONFLICT' ? 'El artículo cambió mientras lo revisabas: no se inactivó. Revisa los datos e inténtalo de nuevo.' : inRecipes ? 'Se usa en recetas vigentes: no se inactivó. Revisa la lista y confirma.' : result.error.message;
        return send(ctx, 409, views.inventoryItemDeactivate({ context: auth, item: found.data.item, recipes, notices: [views.notice({ tone: 'warning', urgent: true, title })] }));
      }
      return apiFailure(ctx, result, auth, itemPath(id));
    },

    async reactivateItem(ctx) {
      const fields = await readClosedForm(ctx, STATUS_FIELDS, SMALL_LIMIT);
      const id = idOf(ctx);
      const auth = await inventorySession(ctx, id === null ? ITEMS_PATH : itemPath(id));
      if (!auth) return;
      if (id === null) return notFound(ctx, auth);
      const version = Number(fields.get('version'));
      const result = await api.reactivateInventoryItem(credentials(auth, fields), id, { version: Number.isSafeInteger(version) ? version : 0 });
      if (result.ok) return seeOther(ctx, `${itemPath(id)}?ok=reactivated`);
      if (httpFailure(result, 409) || httpFailure(result, 422)) {
        const title = result.error.code === 'VERSION_CONFLICT' ? 'El artículo cambió mientras lo revisabas: no se reactivó. Inténtalo de nuevo.' : result.error.message;
        return detailPage(ctx, auth, id, result.status, [views.notice({ tone: 'warning', urgent: true, title })]);
      }
      return apiFailure(ctx, result, auth, itemPath(id));
    },

    async categories(ctx) {
      const auth = await inventorySession(ctx, CATEGORIES_PATH);
      if (!auth) return;
      return categoriesPage(ctx, auth, 200, { notices: successNotices(ctx) });
    },

    async createCategory(ctx) {
      const fields = await readClosedForm(ctx, CATEGORY_CREATE_FIELDS, SMALL_LIMIT);
      const name = fields.get('name') ?? '';
      const raw = fields.get('requestId') ?? '';
      const requestId = IDEMPOTENCY_KEY_PATTERN.test(raw) ? raw : newRequestId();
      const preserve = (auth: Session | null) =>
        send(ctx, 503, views.inventoryCategories({ context: auth, csrfToken: auth?.csrfToken ?? fields.get('_csrf') ?? '', categories: null, name, requestId, notices: [views.notice(UNAVAILABLE)] }));
      const auth = await inventorySession(ctx, CATEGORIES_PATH, () => {
        preserve(null);
        return true;
      });
      if (!auth) return;
      const result = await api.createInventoryCategory(credentials(auth, fields), { name }, requestId);
      if (result.ok) return seeOther(ctx, `${CATEGORIES_PATH}?ok=category_created`);
      const errors = fieldErrors(result);
      if (errors) return categoriesPage(ctx, auth, 422, { name, requestId, errors });
      if (isUnavailable(result)) {
        logger.warn('api_unavailable', { path: ctx.path, reason: failureReason(result) });
        return preserve(auth);
      }
      return apiFailure(ctx, result, auth, CATEGORIES_PATH, 'inventory-categories');
    },

    async editCategory(ctx) {
      const auth = await inventorySession(ctx, ctx.path);
      if (!auth) return;
      const id = idOf(ctx);
      if (id === null) return notFound(ctx, auth, 'inventory-categories');
      const result = await api.listInventoryCategories(credentials(auth));
      if (!result.ok) return apiFailure(ctx, result, auth, ctx.path, 'inventory-categories');
      const category = result.data.categories.find((entry) => entry.id === id);
      if (!category) return notFound(ctx, auth, 'inventory-categories');
      send(ctx, 200, views.inventoryCategoryForm({ context: auth, csrfToken: auth.csrfToken, id, name: category.name, currentName: category.name }));
    },

    async renameCategory(ctx) {
      const fields = await readClosedForm(ctx, CATEGORY_RENAME_FIELDS, SMALL_LIMIT);
      const id = idOf(ctx);
      const name = fields.get('name') ?? '';
      const form = (auth: Session | null, status: number, extra: { errors?: Record<string, string>; notices?: SafeHtml[] }) =>
        send(ctx, status, views.inventoryCategoryForm({ context: auth, csrfToken: auth?.csrfToken ?? fields.get('_csrf') ?? '', id: id ?? 0, name, currentName: null, ...extra }));
      const auth = await inventorySession(ctx, id === null ? CATEGORIES_PATH : categoryEditPath(id), () => {
        if (id === null) return false;
        form(null, 503, { notices: [views.notice(UNAVAILABLE)] });
        return true;
      });
      if (!auth) return;
      if (id === null) return notFound(ctx, auth, 'inventory-categories');
      const result = await api.renameInventoryCategory(credentials(auth, fields), id, { name });
      if (result.ok) return seeOther(ctx, `${CATEGORIES_PATH}?ok=category_renamed`);
      const errors = fieldErrors(result);
      if (errors) return form(auth, 422, { errors });
      if (httpFailure(result, 409)) return form(auth, 409, { notices: [domainNotice(result.error.message)] });
      if (isUnavailable(result)) {
        logger.warn('api_unavailable', { path: ctx.path, reason: failureReason(result) });
        return form(auth, 503, { notices: [views.notice(UNAVAILABLE)] });
      }
      return apiFailure(ctx, result, auth, categoryEditPath(id), 'inventory-categories');
    },

    deactivateCategory: (ctx) => changeCategoryStatus(ctx, false),
    reactivateCategory: (ctx) => changeCategoryStatus(ctx, true),
  });
}
