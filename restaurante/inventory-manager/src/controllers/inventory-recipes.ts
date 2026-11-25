import { IDEMPOTENCY_KEY_PATTERN, type AdminApiClient, type CurrentRecipe, type RecipeDetailResponse, type RecipeIngredientsResponse, type RecipeLineRequest } from '@restaurante/contracts';
import type { Logger, SafeHtml } from '@restaurante/web';

import type { InventoryConfig } from '../config.ts';
import { displayDate, type Views } from '../views/index.ts';
import {
  RECIPES_PATH,
  RECIPE_LINE_PARTS,
  RECIPE_MAX_DEPTH,
  RECIPE_MAX_ROWS,
  RECIPE_ROWS_STEP,
  isEmptyLine,
  readRecipeForm,
  recipeClosePath,
  recipeEditPath,
  recipeFormValues,
  recipeLineField,
  recipePath,
  visibleRows,
  type RecipeEditorItem,
  type RecipeFormValues,
} from '../views/inventory-recipes.ts';
import { itemPath } from '../views/inventory.ts';
import { createControllerKit, type Ctx, type Session } from './common.ts';
import { UNAVAILABLE, createInventoryAccess, httpFailure, newRequestId, queryText } from './inventory-common.ts';

/**
 * Recetas del inventario en el admin (REQ-F-050, T2), solo para administradores y gerentes. La API
 * (`/api/v1/admin/inventario`) decide cada regla; aquí solo se lee el formulario, se resuelve el nombre del
 * ingrediente con la lista de la API y se vuelve a pintar lo escrito ante un error:
 *
 * - GET: sesión (303 al acceso) -> rol (403 sin pedir nada a la API) -> datos.
 * - POST: mismo origen (403) -> lista cerrada de campos (400) -> sesión -> rol -> la API. Después, 303 (PRG).
 * - "Añadir 10 filas" (`action=rows`, H-3) vuelve a pintar el editor con lo escrito, sin guardar.
 * - 422 por línea y campo; ciclo y profundidad con su ruta y, si se identifica, su línea (REQ-F-054);
 *   409 de conflicto con lo escrito y la nueva versión de partida (RF-9), y 503 con lo escrito si la API
 *   no responde.
 *
 * Nunca se registran nombres, cantidades, costos ni tokens: solo la ruta, ids y códigos.
 */

type Handler = (ctx: Ctx) => Promise<void>;

export interface RecipeController {
  list: Handler;
  recipe: Handler;
  version: Handler;
  editor: Handler;
  save: Handler;
  closePage: Handler;
  close: Handler;
}

const RECIPE_BODY_LIMIT = 64 * 1024;
const SMALL_LIMIT = 4 * 1024;
const LINE_FIELDS = Array.from({ length: RECIPE_MAX_ROWS }, (_, slot) => RECIPE_LINE_PARTS.map((part) => recipeLineField(slot, part))).flat();
const SAVE_FIELDS = Object.freeze(['_csrf', 'action', 'requestId', 'baseVersionId', 'rows', 'yieldQuantity', 'note', ...LINE_FIELDS]);
const CLOSE_FIELDS = Object.freeze(['_csrf', 'version', 'baseVersionId']);
const ID_PATTERN = /^[1-9]\d{0,9}$/;

/** Mensajes de éxito (`?ok=`, lista cerrada). */
const SUCCESS: Readonly<Record<string, string>> = Object.freeze({
  saved: 'Versión nueva guardada: ya es la vigente.',
  unchanged: 'No había cambios: no se creó una versión nueva.',
  closed: 'Receta cerrada: el artículo queda sin receta vigente.',
});
const NOT_ALLOWED = 'Este artículo no lleva receta: solo los Intermedios y los Compuestos (no un artículo con variantes).';
const UNKNOWN_INGREDIENT = 'No hay un ingrediente activo con ese nombre: elige uno de la lista.';
const CYCLE_LINE = 'Este ingrediente cierra el ciclo: quítalo o elige otro.';
const TOO_DEEP_LINE = `Con este ingrediente las recetas pasan de ${RECIPE_MAX_DEPTH} niveles: quítalo o elige otro.`;
const KEPT = 'No se guardó nada. Lo que escribiste sigue en el formulario.';

const invalidForm = (ctx: Ctx): never => ctx.throw(400, 'El formulario tiene valores imposibles.', { code: 'INVALID_FORM' });
const nameKey = (name: string): string => name.trim().normalize('NFC').toLocaleLowerCase('es');

/** Filas pedidas (campo oculto `rows`): múltiplo de 10 entre 10 y 40; otro valor, 10. */
function rowsOf(raw: string | undefined): number {
  const value = Number(raw);
  return Number.isInteger(value) && value >= RECIPE_ROWS_STEP && value <= RECIPE_MAX_ROWS && value % RECIPE_ROWS_STEP === 0 ? value : RECIPE_ROWS_STEP;
}

/**
 * Fila del formulario que provoca un ciclo o un exceso de niveles (REQ-F-054, RF-1 y RF-2): la ruta de la
 * API empieza en la receta que se guarda, así que `path[1]` es el ingrediente de una de sus líneas. null si
 * la ruta no lo dice o ninguna fila escrita lo tiene (se queda el aviso sin enlace; CA-6).
 */
function culpritSlot(path: readonly string[], values: RecipeFormValues): number | null {
  const name = path[1];
  if (name === undefined) return null;
  const slot = values.lines.findIndex((line) => !isEmptyLine(line) && nameKey(line.ingredient) === nameKey(name));
  return slot === -1 ? null : slot;
}

/** `lines.<i>…` de la API (lista compacta) -> `lines.<fila>…` del formulario. */
function lineErrorsToSlots(errors: Record<string, string>, slots: readonly number[]): Record<string, string> {
  return Object.fromEntries(
    Object.entries(errors).map(([key, message]) => {
      const match = /^lines\.(\d+)(\..+)?$/.exec(key);
      const slot = match ? slots[Number(match[1])] : undefined;
      return [slot === undefined || !match ? key : `lines.${slot}${match[2] ?? ''}`, message];
    }),
  );
}

export function createRecipeController({ config, api, views, logger }: { config: InventoryConfig; api: AdminApiClient; views: Views; logger: Logger }): RecipeController {
  const kit = createControllerKit({ config, api, views, logger });
  const { send, seeOther, failureReason, isUnavailable, readClosedForm, fieldErrors, idOf, credentials } = kit;
  const { notFound, inventorySession, apiFailure } = createInventoryAccess({ config, kit, views });

  function successNotices(ctx: Ctx): SafeHtml[] {
    const { ok } = ctx.query;
    return typeof ok === 'string' && Object.hasOwn(SUCCESS, ok) ? [views.notice({ tone: 'success', title: SUCCESS[ok] as string })] : [];
  }

  /** 409 `RECIPE_NOT_ALLOWED` de una lectura: aviso con la vuelta a la ficha. */
  const notAllowed = (ctx: Ctx, auth: Session, itemId: number) =>
    send(ctx, 409, views.message({ title: 'Sin receta', notice: { tone: 'warning', title: NOT_ALLOWED }, context: auth, section: 'inventory-recipes', backHref: itemPath(itemId), backLabel: 'Volver a la ficha' }));

  /** Receta del artículo; null si ya respondió (404, 409, 503…). */
  async function readRecipe(ctx: Ctx, auth: Session, itemId: number, returnTo: string): Promise<RecipeDetailResponse | null> {
    const result = await api.getInventoryRecipe(credentials(auth), itemId);
    if (result.ok) return result.data;
    if (httpFailure(result, 409) && result.error.code === 'RECIPE_NOT_ALLOWED') notAllowed(ctx, auth, itemId);
    else apiFailure(ctx, result, auth, returnTo, 'inventory-recipes');
    return null;
  }

  interface EditorState {
    item: RecipeEditorItem;
    values: RecipeFormValues;
    rows: number;
    hidden: Record<string, string>;
    errors?: Record<string, string>;
    notices?: SafeHtml[];
    conflict?: boolean;
    errorHeading?: { title: string; paragraphs: string[] };
    focusSlot?: number;
    /** Ya leídos (para no volver a pedirlos). */
    detail?: RecipeDetailResponse | null;
    ingredients?: RecipeIngredientsResponse['ingredients'] | null;
  }

  /** Pinta el editor con la vigente y los ingredientes de la API (o sin ellos, con lo escrito, si no responde). */
  async function editorPage(ctx: Ctx, status: number, auth: Session | null, csrf: string, state: EditorState): Promise<void> {
    let { detail = null, ingredients = null } = state;
    if (auth) {
      const [readDetail, readIngredients] = await Promise.all([
        detail ? null : api.getInventoryRecipe(credentials(auth), state.item.id),
        ingredients ? null : api.inventoryRecipeIngredients(credentials(auth)),
      ]);
      if (readDetail?.ok) detail = readDetail.data;
      if (readIngredients?.ok) ingredients = readIngredients.data.ingredients;
    }
    const item = detail ? { id: detail.item.id, name: detail.item.name, baseUnit: detail.item.baseUnit } : state.item;
    send(ctx, status, views.inventoryRecipeEditor({ context: auth, csrfToken: auth?.csrfToken ?? csrf, item, values: state.values, rows: state.rows, hidden: state.hidden, ingredients, current: detail?.current ?? null, errors: state.errors ?? {}, notices: state.notices ?? [], conflict: state.conflict ?? false, errorHeading: state.errorHeading, focusSlot: state.focusSlot }));
  }

  const inactiveNotice = (current: CurrentRecipe) => {
    const names = current.version.lines.filter((line) => current.inactiveIngredientIds.includes(line.ingredient.id)).map((line) => line.ingredient.name);
    return views.notice({ tone: 'warning', title: 'La versión vigente usa ingredientes inactivos.', paragraphs: [`${names.join(', ')}: ya no se pueden usar. Reemplázalos o deja vacía su fila antes de guardar.`] });
  };

  async function closeRecipePage(ctx: Ctx, auth: Session, itemId: number, status: number, notices: SafeHtml[]): Promise<void> {
    const detail = await readRecipe(ctx, auth, itemId, recipeClosePath(itemId));
    if (!detail) return;
    send(ctx, status, views.inventoryRecipeClose({ context: auth, detail, notices }));
  }

  return Object.freeze<RecipeController>({
    async list(ctx) {
      const auth = await inventorySession(ctx, RECIPES_PATH);
      if (!auth) return;
      const filter = { tipo: queryText(ctx.query.tipo), q: queryText(ctx.query.q) };
      const list = await api.listInventoryRecipes(credentials(auth), { type: filter.tipo, q: filter.q, page: queryText(ctx.query.pagina) });
      const errors = fieldErrors(list);
      if (errors) return send(ctx, 422, views.inventoryRecipes({ context: auth, filter, list: null, errors }));
      if (!list.ok) return apiFailure(ctx, list, auth, RECIPES_PATH, 'inventory-recipes');
      send(ctx, 200, views.inventoryRecipes({ context: auth, filter, list: list.data }));
    },

    async recipe(ctx) {
      const auth = await inventorySession(ctx, ctx.path);
      if (!auth) return;
      const id = idOf(ctx);
      if (id === null) return notFound(ctx, auth, 'inventory-recipes');
      const detail = await readRecipe(ctx, auth, id, ctx.path);
      if (!detail) return;
      send(ctx, 200, views.inventoryRecipe({ context: auth, detail, notices: successNotices(ctx) }));
    },

    async version(ctx) {
      const auth = await inventorySession(ctx, ctx.path);
      if (!auth) return;
      const id = idOf(ctx);
      if (id === null) return notFound(ctx, auth, 'inventory-recipes');
      const result = await api.getInventoryRecipeVersion(credentials(auth), id);
      if (!result.ok) return apiFailure(ctx, result, auth, ctx.path, 'inventory-recipes');
      send(ctx, 200, views.inventoryRecipeVersion({ context: auth, data: result.data }));
    },

    async editor(ctx) {
      const auth = await inventorySession(ctx, ctx.path);
      if (!auth) return;
      const id = idOf(ctx);
      if (id === null) return notFound(ctx, auth, 'inventory-recipes');
      const [detail, ingredients] = await Promise.all([readRecipe(ctx, auth, id, ctx.path), api.inventoryRecipeIngredients(credentials(auth))]);
      if (!detail) return;
      if (!ingredients.ok) return apiFailure(ctx, ingredients, auth, ctx.path, 'inventory-recipes');
      const { item, current } = detail;
      if (!item.active) {
        return send(ctx, 409, views.message({ title: 'Artículo inactivo', notice: { tone: 'warning', title: 'El artículo está inactivo: su receta no admite versiones nuevas. Reactívalo primero.' }, context: auth, section: 'inventory-recipes', backHref: recipePath(id), backLabel: 'Volver a la receta' }));
      }
      const values = recipeFormValues(current);
      const notices = current && current.inactiveIngredientIds.length > 0 ? [inactiveNotice(current)] : [];
      return editorPage(ctx, 200, auth, '', {
        item: { id, name: item.name, baseUnit: item.baseUnit },
        values,
        rows: RECIPE_ROWS_STEP,
        hidden: { requestId: newRequestId(), baseVersionId: current ? String(current.version.id) : '' },
        notices,
        detail,
        ingredients: ingredients.data.ingredients,
      });
    },

    async save(ctx) {
      const fields = await readClosedForm(ctx, SAVE_FIELDS, RECIPE_BODY_LIMIT);
      const id = idOf(ctx);
      const action = fields.get('action') ?? 'save';
      if (action !== 'save' && action !== 'rows' && action !== 'overwrite') invalidForm(ctx);
      const rawBase = fields.get('baseVersionId') ?? '';
      if (rawBase !== '' && !ID_PATTERN.test(rawBase)) invalidForm(ctx);
      const baseVersionId = rawBase === '' ? null : Number(rawBase);
      const rawRequest = fields.get('requestId') ?? '';
      const hidden = { requestId: IDEMPOTENCY_KEY_PATTERN.test(rawRequest) ? rawRequest : newRequestId(), baseVersionId: rawBase };
      const values = readRecipeForm(fields);
      const csrf = fields.get('_csrf') ?? '';
      const item: RecipeEditorItem = { id: id ?? 0, name: 'este artículo', baseUnit: null };
      const state = { item, values, rows: rowsOf(fields.get('rows')), hidden };
      const pending: Promise<void>[] = [];
      const auth = await inventorySession(ctx, id === null ? RECIPES_PATH : recipeEditPath(id), () => {
        if (id === null) return false;
        pending.push(editorPage(ctx, 503, null, csrf, { ...state, notices: [views.notice(UNAVAILABLE)] }));
        return true;
      });
      await Promise.all(pending);
      if (!auth) return;
      if (id === null) return notFound(ctx, auth, 'inventory-recipes');

      // H-3: "Añadir 10 filas" vuelve a pintar lo escrito con 10 filas más, sin guardar, con el foco en el
      // ingrediente de la primera fila nueva (REQ-F-054, RF-3; sin fila nueva, ningún foco).
      if (action === 'rows') return editorPage(ctx, 200, auth, csrf, { ...state, rows: Math.min(RECIPE_MAX_ROWS, state.rows + RECIPE_ROWS_STEP), focusSlot: visibleRows(values, state.rows) });

      const options = await api.inventoryRecipeIngredients(credentials(auth));
      if (!options.ok) {
        if (isUnavailable(options)) {
          logger.warn('api_unavailable', { path: ctx.path, reason: failureReason(options) });
          return editorPage(ctx, 503, auth, csrf, { ...state, notices: [views.notice(UNAVAILABLE)] });
        }
        return apiFailure(ctx, options, auth, recipeEditPath(id), 'inventory-recipes');
      }
      const ingredients = options.data.ingredients;
      const byName = new Map(ingredients.map((ingredient) => [nameKey(ingredient.name), ingredient.id]));
      // Filas escritas (sin las vacías) y su posición en el formulario, para devolver los errores a su sitio.
      const lines: RecipeLineRequest[] = [];
      const slots: number[] = [];
      const unknown = new Set<number>();
      values.lines.forEach((line, slot) => {
        if (isEmptyLine(line)) return;
        const ingredientId = line.ingredient.trim() === '' ? 0 : (byName.get(nameKey(line.ingredient)) ?? 0);
        if (ingredientId === 0 && line.ingredient.trim() !== '') unknown.add(slot);
        // 0: sin ingrediente resuelto; la API lo rechaza en su línea y aquí se explica el motivo.
        lines.push({ ingredientId, quantity: line.quantity.trim(), unit: line.unit.trim(), ...(line.wastePercent.trim() === '' ? {} : { wastePercent: line.wastePercent.trim() }), note: line.note.trim() === '' ? null : line.note });
        slots.push(slot);
      });
      const result = await api.saveInventoryRecipe(credentials(auth, fields), id, { baseVersionId, yieldQuantity: values.yieldQuantity.trim(), note: values.note.trim() === '' ? null : values.note, lines }, hidden.requestId);
      if (result.ok) {
        logger.info('inventory_recipe_saved', { itemId: id, created: result.data.created, overwrite: action === 'overwrite' });
        return seeOther(ctx, `${recipePath(id)}?ok=${result.data.created ? 'saved' : 'unchanged'}`);
      }
      const repaint = (status: number, extra: Partial<EditorState>) => editorPage(ctx, status, auth, csrf, { ...state, ingredients, ...extra });
      // Ciclo o profundidad: una sola alerta con la explicación y, si se identifica la línea, su enlace y la
      // marca en el campo (REQ-F-054, RF-1 y RF-2).
      const rejectLine = (title: string, paragraphs: string[], slot: number | null, message: string) =>
        slot === null
          ? repaint(422, { notices: [views.notice({ tone: 'error', title, paragraphs })] })
          : repaint(422, { errors: { [recipeLineField(slot, 'ingredient')]: message }, errorHeading: { title, paragraphs } });
      if (httpFailure(result, 422) && result.error.code === 'RECIPE_CYCLE') {
        const path = result.error.path ?? [];
        return rejectLine(
          'La receta se contendría a sí misma: no se guardó nada.',
          [...(path.length > 0 ? [`Ruta del ciclo: ${path.join(' → ')}.`] : []), 'Quita el ingrediente que cierra el ciclo. Lo que escribiste sigue en el formulario.'],
          culpritSlot(path, values),
          CYCLE_LINE,
        );
      }
      if (httpFailure(result, 422) && result.error.code === 'RECIPE_TOO_DEEP') {
        const path = result.error.path ?? [];
        const usedBy = result.error.usedBy ?? [];
        const chain = [...usedBy].reverse().concat(path);
        // Sin subreceta propia en la cadena (solo la receta que se guarda), el exceso viene de quienes la usan.
        const external = path.length === 1 && usedBy.length > 0;
        const paragraphs = external
          ? [`Las recetas que usan este artículo ya llegan al límite: ${chain.join(' → ')}. Ninguna línea de esta receta lo provoca. No se guardó nada; lo que escribiste sigue en el formulario.`]
          : [...(chain.length > 0 ? [`Cadena más larga: ${chain.join(' → ')}.`] : []), KEPT];
        return rejectLine(result.error.message, paragraphs, external ? null : culpritSlot(path, values), TOO_DEEP_LINE);
      }
      const errors = fieldErrors(result);
      if (errors) {
        const mapped = lineErrorsToSlots(errors, slots);
        for (const slot of unknown) mapped[recipeLineField(slot, 'ingredient')] = UNKNOWN_INGREDIENT;
        return repaint(422, { errors: mapped });
      }
      if (httpFailure(result, 409) && result.error.code === 'RECIPE_VERSION_CONFLICT') {
        // RF-9: lo escrito se conserva; se puede guardar sobre la vigente (nueva versión de partida) si se pide (H-5).
        const latest = result.error.recipeCurrent ?? null;
        logger.info('inventory_recipe_conflict_shown', { itemId: id });
        const conflict = views.notice({
          tone: 'warning',
          urgent: true,
          title: 'Otra persona cambió esta receta mientras la editabas: no se guardó nada.',
          paragraphs: [
            latest ? `Versión vigente: ${latest.number}, de ${latest.createdBy}, desde el ${displayDate(latest.validFrom)}.` : 'La receta se cerró: ya no tiene versión vigente.',
            'Lo que escribiste sigue en el formulario. Revisa la vigente o guarda tus cambios sobre ella.',
          ],
          links: [{ href: recipePath(id), label: 'Ver la receta vigente (en esta pestaña se pierde lo escrito)' }],
        });
        return repaint(409, { hidden: { ...hidden, baseVersionId: latest ? String(latest.id) : '' }, notices: [conflict], conflict: true });
      }
      if (httpFailure(result, 409)) {
        logger.info('inventory_recipe_rejected', { itemId: id, code: result.error.code });
        return repaint(409, { notices: [views.notice({ tone: 'warning', urgent: true, title: result.error.message, paragraphs: ['No se guardó nada. Lo que escribiste sigue en el formulario.'] })] });
      }
      if (isUnavailable(result)) {
        logger.warn('api_unavailable', { path: ctx.path, reason: failureReason(result) });
        return repaint(503, { notices: [views.notice(UNAVAILABLE)] });
      }
      return apiFailure(ctx, result, auth, recipeEditPath(id), 'inventory-recipes');
    },

    async closePage(ctx) {
      const auth = await inventorySession(ctx, ctx.path);
      if (!auth) return;
      const id = idOf(ctx);
      if (id === null) return notFound(ctx, auth, 'inventory-recipes');
      return closeRecipePage(ctx, auth, id, 200, []);
    },

    async close(ctx) {
      const fields = await readClosedForm(ctx, CLOSE_FIELDS, SMALL_LIMIT);
      const id = idOf(ctx);
      const auth = await inventorySession(ctx, id === null ? RECIPES_PATH : recipeClosePath(id));
      if (!auth) return;
      if (id === null) return notFound(ctx, auth, 'inventory-recipes');
      const rawBase = fields.get('baseVersionId') ?? '';
      if (rawBase !== '' && !ID_PATTERN.test(rawBase)) invalidForm(ctx);
      const result = await api.closeInventoryRecipe(credentials(auth, fields), id, { baseVersionId: rawBase === '' ? null : Number(rawBase) });
      if (result.ok) {
        logger.info('inventory_recipe_closed', { itemId: id, closed: result.data.version !== null });
        return seeOther(ctx, `${recipePath(id)}?ok=closed`);
      }
      if (httpFailure(result, 409)) {
        const title = result.error.code === 'RECIPE_VERSION_CONFLICT' ? 'La receta cambió mientras lo revisabas: no se cerró. Revisa la versión vigente y confirma de nuevo.' : result.error.message;
        return closeRecipePage(ctx, auth, id, 409, [views.notice({ tone: 'warning', urgent: true, title })]);
      }
      return apiFailure(ctx, result, auth, recipeClosePath(id), 'inventory-recipes');
    },
  });
}
