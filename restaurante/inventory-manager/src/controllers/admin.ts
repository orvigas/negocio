import { randomBytes } from 'node:crypto';

import type { RouterContext } from '@koa/router';

import {
  IDEMPOTENCY_KEY_PATTERN,
  emptyProductFormValues,
  formErrors,
  parseProductForm,
  productFormValues,
  type AdminApiClient,
  type AdminApiResult,
  type AdminCredentials,
  type Freshness,
  type ProductFieldsResponse,
  type ProductFormField,
  type PublicBusinessId,
} from '@restaurante/contracts';
import { assertSameOrigin, readFormBody, type Logger, type SafeHtml } from '@restaurante/web';

import type { InventoryConfig } from '../config.ts';
import { clearSessionId, readSessionId, sanitizeNext, writeSessionId } from '../session.ts';
import { BUSINESS_NAMES, NEW_TITLES, displayDate, productPath, productsPath, type PageContext, type Views } from '../views/index.ts';

/**
 * Pantallas del admin nuevo (REQ-F-039, RF-1 a RF-11). El navegador solo habla con este servidor;
 * cada acción la decide la API (`/api/v1/admin`), a la que se reenvía la sesión (D-1):
 *
 * - GET: sesión (si no vale, 303 al acceso con `next`) -> negocio permitido (403 sin datos) -> datos.
 * - POST: mismo origen (403) -> sesión -> negocio -> formulario -> la API valida el token CSRF del
 *   campo `_csrf` (X-CSRF-Token, D-2), las reglas (422) y la versión (409). Después, 303 (PRG).
 * - Si la API no responde o responde 5xx: 503 con un aviso claro, conservando lo escrito (RF-10).
 *
 * Nunca se registran cookies, ids de sesión, tokens ni contraseñas.
 */

type Ctx = RouterContext;
type Handler = (ctx: Ctx) => Promise<void>;

export interface AdminController {
  loginPage: Handler;
  login: Handler;
  logout: Handler;
  home: Handler;
  products: Handler;
  newProduct: Handler;
  create: Handler;
  deleted: Handler;
  editPage: Handler;
  update: Handler;
  deletePage: Handler;
  remove: Handler;
  restore: Handler;
  moveUp: Handler;
  moveDown: Handler;
}

interface Session extends PageContext {
  sessionId: string;
}

/** Mensajes de éxito (`?ok=`, lista cerrada) y si dependen de la frescura (`&pendiente=1`). */
const SUCCESS: Readonly<Record<string, string>> = Object.freeze({
  created: 'Producto creado como no disponible y al final de su categoría. Edítalo para mostrarlo en la landing.',
  saved: 'Cambios guardados.',
  deleted: 'Producto eliminado.',
  restored: 'Producto recuperado: quedó al final y no disponible.',
  moved: 'Orden actualizado.',
});
const FRESH_TEXT = 'La landing y el bot ya muestran el cambio.';
const PENDING_TEXT = 'La landing y el bot lo mostrarán en cuanto se actualicen (como mucho en un minuto).';
const PROBLEMS: Readonly<Record<string, string>> = Object.freeze({
  orden: 'El producto cambió mientras ordenabas la lista: no se movió nada. Revisa el orden actual e inténtalo de nuevo.',
});
const UNAVAILABLE = { tone: 'error' as const, title: 'Servicio no disponible.', paragraphs: ['No se pudo conectar con el sistema: no se guardó nada. Lo que escribiste sigue en el formulario; inténtalo de nuevo en unos minutos.'] };
const BUSINESSES: readonly PublicBusinessId[] = ['molotes', 'birria'];
const ID_PATTERN = /^[1-9]\d{0,9}$/;
const LOGIN_BODY_LIMIT = 4 * 1024;
const SMALL_BODY_LIMIT = 4 * 1024;

export function createAdminController({
  config,
  api,
  views,
  logger,
}: {
  config: InventoryConfig;
  api: AdminApiClient;
  views: Views;
  logger: Logger;
}): AdminController {
  const { isProduction } = config;

  function send(ctx: Ctx, status: number, html: SafeHtml): void {
    ctx.status = status;
    ctx.type = 'html';
    ctx.body = html.toString();
  }

  function seeOther(ctx: Ctx, url: string): void {
    ctx.status = 303;
    ctx.redirect(url);
  }

  /** Al acceso; en un POST, con el aviso de sesión caducada y la pantalla a la que volver. */
  function toLogin(ctx: Ctx, returnTo: string): void {
    const query = new URLSearchParams();
    const next = sanitizeNext(returnTo);
    if (next !== '/') query.set('next', next);
    if (ctx.method === 'POST') query.set('expirada', '1');
    const search = query.toString();
    seeOther(ctx, search ? `/acceso?${search}` : '/acceso');
  }

  function unavailable(ctx: Ctx, reason: string, context?: PageContext, business?: PublicBusinessId): void {
    logger.warn('api_unavailable', { path: ctx.path, reason });
    send(ctx, 503, views.message({ title: 'Servicio no disponible', notice: { tone: 'error', title: 'Servicio no disponible.', paragraphs: ['No se pudo conectar con el sistema. Inténtalo de nuevo en unos minutos.'] }, context, business }));
  }

  const failureReason = (result: AdminApiResult<unknown>): string => (result.ok ? 'ok' : result.kind === 'http' ? `http_${result.status}` : result.kind);
  const isUnavailable = (result: AdminApiResult<unknown>): boolean => !result.ok && (result.kind !== 'http' || result.status >= 500);

  /** Sesión de la API (D-1). null si ya respondió (acceso o 503). */
  async function session(ctx: Ctx, returnTo: string, onUnavailable?: (business: PublicBusinessId) => boolean): Promise<Session | null> {
    const sessionId = readSessionId(ctx, isProduction);
    if (!sessionId) {
      toLogin(ctx, returnTo);
      return null;
    }
    const result = await api.session({ sessionId });
    if (result.ok) return { sessionId, user: result.data.user, csrfToken: result.data.csrfToken };
    if (!result.ok && result.kind === 'http' && result.status === 401) {
      clearSessionId(ctx, isProduction);
      toLogin(ctx, returnTo);
      return null;
    }
    const known = BUSINESSES.find((candidate) => candidate === ctx.params.business);
    if (known && onUnavailable?.(known)) {
      logger.warn('api_unavailable', { path: ctx.path, reason: failureReason(result) });
      return null;
    }
    unavailable(ctx, failureReason(result));
    return null;
  }

  /** `:negocio` conocido (404) y permitido (403, sin datos; RF-6 y CA-4). */
  function businessOf(ctx: Ctx, auth: Session): PublicBusinessId | null {
    const { business } = ctx.params;
    const known = BUSINESSES.find((candidate) => candidate === business);
    if (!known) {
      notFound(ctx, auth);
      return null;
    }
    if (!auth.user.businesses.includes(known)) {
      logger.warn('admin_forbidden', { path: ctx.path, userId: auth.user.id });
      send(ctx, 403, views.message({ title: 'Sin permiso', notice: { tone: 'error', title: 'No tienes permiso sobre este negocio.' }, context: auth }));
      return null;
    }
    return known;
  }

  function notFound(ctx: Ctx, context?: PageContext, business?: PublicBusinessId): void {
    send(ctx, 404, views.message({ title: 'No encontrado', notice: { tone: 'warning', title: 'No encontramos lo que buscas.' }, context, business, ...(business ? { backHref: productsPath(business), backLabel: 'Volver a productos' } : {}) }));
  }

  function idOf(ctx: Ctx): number | null {
    const { id } = ctx.params;
    return typeof id === 'string' && ID_PATTERN.test(id) ? Number(id) : null;
  }

  /** Respuestas de la API que no son de dominio: 401 -> acceso, 403 CSRF, 404 y el resto -> 503. */
  function apiFailure(ctx: Ctx, result: AdminApiResult<unknown>, auth: Session, business: PublicBusinessId, returnTo: string): void {
    if (!result.ok && result.kind === 'http') {
      if (result.status === 401) {
        clearSessionId(ctx, isProduction);
        return toLogin(ctx, returnTo);
      }
      if (result.status === 403) {
        return send(ctx, 403, views.message({ title: 'Petición no válida', notice: { tone: 'error', title: result.error.message }, context: auth, business, backHref: productsPath(business), backLabel: 'Volver a productos' }));
      }
      if (result.status === 404) return notFound(ctx, auth, business);
    }
    return unavailable(ctx, failureReason(result), auth, business);
  }

  const credentials = (auth: Session, fields?: Map<string, string>): AdminCredentials => ({ sessionId: auth.sessionId, csrfToken: fields?.get('_csrf') ?? '' });
  const okUrl = (business: PublicBusinessId, key: keyof typeof SUCCESS, freshness?: Freshness): string =>
    `${productsPath(business)}?ok=${key}${freshness === 'pending' ? '&pendiente=1' : ''}`;

  /**
   * Entrada común de los POST con sesión y negocio. Con `preserve`, si la API no responde al comprobar
   * la sesión, se vuelve a pintar lo escrito en vez de perderlo (RF-10).
   */
  async function postStart(ctx: Ctx, returnTo: (business: string) => string, limit?: number, preserve?: (business: PublicBusinessId, fields: Map<string, string>) => boolean) {
    assertSameOrigin(ctx, logger);
    const fields = await readFormBody(ctx, limit ? { limit } : undefined);
    const auth = await session(ctx, returnTo(String(ctx.params.business)), (business) => (preserve ? preserve(business, fields) : false));
    if (!auth) return null;
    const business = businessOf(ctx, auth);
    if (!business) return null;
    return { auth, business, fields };
  }

  async function renderList(ctx: Ctx, auth: Session, business: PublicBusinessId, extraNotices: SafeHtml[] = []): Promise<void> {
    const result = await api.listProducts(credentials(auth), business);
    if (!result.ok) return apiFailure(ctx, result, auth, business, productsPath(business));
    const notices = [...extraNotices];
    const { ok, pendiente, problema } = ctx.query;
    if (typeof ok === 'string' && Object.hasOwn(SUCCESS, ok)) {
      const fresh = ok === 'created' ? [] : [pendiente === '1' ? PENDING_TEXT : FRESH_TEXT];
      notices.push(views.notice({ tone: 'success', title: SUCCESS[ok] as string, paragraphs: fresh }));
    }
    if (typeof problema === 'string' && Object.hasOwn(PROBLEMS, problema)) notices.push(views.notice({ tone: 'error', title: PROBLEMS[problema] as string }));
    return send(ctx, 200, views.products(auth, business, views.productList(auth, business, result.data.products), notices));
  }

  /**
   * Descriptores ya recibidos, por combinación: salen del código de core (no cambian mientras la API no
   * se despliega), así que con la API caída se puede volver a pintar lo escrito (RF-10).
   */
  const descriptors = new Map<string, ProductFieldsResponse>();
  const descriptorKey = (business: string, category: string, detailsType: string | null) => `${business}:${category}:${detailsType ?? ''}`;

  /** Descriptor del formulario de una combinación; null si ya respondió. */
  async function fieldsFor(ctx: Ctx, auth: Session, business: PublicBusinessId, category: string, detailsType: string | null, returnTo: string, preserve?: (fields: ProductFieldsResponse) => void) {
    const result = await api.productFields(credentials(auth), business, { category, detailsType });
    if (result.ok) {
      descriptors.set(descriptorKey(business, category, detailsType), result.data);
      return result.data;
    }
    const cached = descriptors.get(descriptorKey(business, category, detailsType));
    if (preserve && cached && isUnavailable(result)) {
      logger.warn('api_unavailable', { path: ctx.path, reason: failureReason(result) });
      preserve(cached);
      return null;
    }
    if (!result.ok && result.kind === 'http' && result.status === 400) {
      notFound(ctx, auth, business);
      return null;
    }
    apiFailure(ctx, result, auth, business, returnTo);
    return null;
  }

  const newRequestId = (): string => randomBytes(18).toString('base64url');

  async function move(ctx: Ctx, direction: 'up' | 'down'): Promise<void> {
    const fragment = ctx.get('X-Fragment') === 'product-list';
    const start = await postStart(ctx, (business) => productsPath(business as PublicBusinessId), SMALL_BODY_LIMIT);
    if (!start) return;
    const { auth, business, fields } = start;
    const id = idOf(ctx);
    if (id === null) return notFound(ctx, auth, business);
    const version = Number(fields.get('version'));
    const result = await api.moveProduct(credentials(auth, fields), business, id, direction, Number.isSafeInteger(version) ? version : 0);
    const conflict = !result.ok && result.kind === 'http' && (result.status === 409 || result.status === 422);
    if (!result.ok && !conflict) return apiFailure(ctx, result, auth, business, productsPath(business));
    if (fragment) {
      // Mejora con JS: el fragmento de la lista vigente reemplaza la anterior (mismo orden de reglas).
      const list = await api.listProducts(credentials(auth), business);
      if (!list.ok) return apiFailure(ctx, list, auth, business, productsPath(business));
      ctx.set('X-Reorder-Result', conflict ? 'conflict' : result.ok ? result.data.meta.freshness : 'pending');
      return send(ctx, conflict ? 409 : 200, views.productList(auth, business, list.data.products));
    }
    if (conflict) return seeOther(ctx, `${productsPath(business)}?problema=orden`);
    return seeOther(ctx, okUrl(business, 'moved', result.ok ? result.data.meta.freshness : 'pending'));
  }

  return Object.freeze<AdminController>({
    async loginPage(ctx) {
      const next = sanitizeNext(ctx.query.next);
      send(ctx, 200, views.login({ next, problem: ctx.query.expirada === '1' ? 'expired' : undefined }));
    },

    async login(ctx) {
      assertSameOrigin(ctx, logger);
      const fields = await readFormBody(ctx, { limit: LOGIN_BODY_LIMIT });
      const next = sanitizeNext(fields.get('next'));
      // La IP del visitante: con TRUST_PROXY, el último valor que añade Traefik (nunca la que manda el
      // navegador). La API la usa para el límite de intentos (RF-2).
      const result = await api.login({ username: fields.get('username') ?? '', password: fields.get('password') ?? '' }, ctx.ip);
      if (result.ok) {
        // Siempre un id nuevo de la API: sin fijación de sesión.
        writeSessionId(ctx, isProduction, result.data.session.id);
        return seeOther(ctx, next);
      }
      if (!result.ok && result.kind === 'http' && (result.status === 401 || result.status === 429)) {
        const locked = result.status === 429;
        return send(ctx, result.status, views.login({ next, problem: locked ? 'locked' : 'invalid' }));
      }
      logger.warn('api_unavailable', { path: ctx.path, reason: failureReason(result) });
      return send(ctx, 503, views.login({ next, problem: 'unavailable' }));
    },

    async logout(ctx) {
      assertSameOrigin(ctx, logger);
      const fields = await readFormBody(ctx, { limit: SMALL_BODY_LIMIT });
      const sessionId = readSessionId(ctx, isProduction);
      if (sessionId) {
        const result = await api.logout({ sessionId, csrfToken: fields.get('_csrf') ?? '' });
        if (!result.ok && result.kind === 'http' && result.status === 403) {
          return send(ctx, 403, views.message({ title: 'Petición no válida', notice: { tone: 'error', title: result.error.message } }));
        }
      }
      clearSessionId(ctx, isProduction);
      return seeOther(ctx, '/acceso');
    },

    async home(ctx) {
      const auth = await session(ctx, '/');
      if (!auth) return;
      const [only] = auth.user.businesses;
      if (auth.user.businesses.length === 1 && only) return seeOther(ctx, productsPath(only));
      send(ctx, 200, views.businesses(auth));
    },

    async products(ctx) {
      const auth = await session(ctx, ctx.path);
      if (!auth) return;
      const business = businessOf(ctx, auth);
      if (!business) return;
      await renderList(ctx, auth, business);
    },

    async newProduct(ctx) {
      const auth = await session(ctx, ctx.path);
      if (!auth) return;
      const business = businessOf(ctx, auth);
      if (!business) return;
      const { categoria, tipo } = ctx.query;
      const category = business === 'birria' ? (categoria ?? 'platillo') : categoria;
      if (category !== 'platillo' && category !== 'bebida') return send(ctx, 200, views.kindChoice(auth, business, 'category'));
      if (business === 'birria' && typeof tipo !== 'string') return send(ctx, 200, views.kindChoice(auth, business, 'detailsType'));
      const detailsType = business === 'birria' && typeof tipo === 'string' ? tipo : null;
      const descriptor = await fieldsFor(ctx, auth, business, category, detailsType, ctx.path);
      if (!descriptor) return;
      send(ctx, 200, createForm(auth, business, descriptor.create, emptyProductFormValues(descriptor.create), { category, detailsType: detailsType ?? '', requestId: newRequestId() }));
    },

    async create(ctx) {
      const start = await postStart(ctx, (business) => `${productsPath(business as PublicBusinessId)}/nuevo`, undefined, (business, fields) => {
        const cached = descriptors.get(descriptorKey(business, fields.get('category') ?? '', fields.get('detailsType') || null));
        if (!cached) return false;
        preserveCreate(ctx, null, business, cached, fields);
        return true;
      });
      if (!start) return;
      const { auth, business, fields } = start;
      const category = fields.get('category') ?? '';
      const detailsType = fields.get('detailsType') || null;
      const descriptor = await fieldsFor(ctx, auth, business, category, detailsType, `${productsPath(business)}/nuevo`, (cached) => preserveCreate(ctx, auth, business, cached, fields));
      if (!descriptor) return;
      const parsed = parseProductForm(descriptor.create, fields);
      if (parsed.structureError) ctx.throw(400, 'El formulario tiene valores imposibles.', { code: 'INVALID_FORM' });
      const hidden = createHidden(fields);
      const input = { ...parsed.input, category, ...(detailsType ? { detailsType } : {}) };
      const result = await api.createProduct(credentials(auth, fields), business, input, hidden.requestId);
      if (result.ok) return seeOther(ctx, okUrl(business, 'created', result.data.meta.freshness));
      if (!result.ok && result.kind === 'http' && result.status === 422) {
        return send(ctx, 422, createForm(auth, business, descriptor.create, parsed.values, hidden, formErrors(result.error.fields ?? { '': result.error.message }, parsed.slots)));
      }
      if (isUnavailable(result)) {
        logger.warn('api_unavailable', { path: ctx.path, reason: failureReason(result) });
        return send(ctx, 503, createForm(auth, business, descriptor.create, parsed.values, hidden, {}, [views.notice(UNAVAILABLE)]));
      }
      return apiFailure(ctx, result, auth, business, `${productsPath(business)}/nuevo`);
    },

    async deleted(ctx) {
      const auth = await session(ctx, ctx.path);
      if (!auth) return;
      const business = businessOf(ctx, auth);
      if (!business) return;
      await renderDeleted(ctx, auth, business, 200, []);
    },

    async editPage(ctx) {
      const auth = await session(ctx, ctx.path);
      if (!auth) return;
      const business = businessOf(ctx, auth);
      if (!business) return;
      const id = idOf(ctx);
      if (id === null) return notFound(ctx, auth, business);
      const found = await api.getProduct(credentials(auth), business, id);
      if (!found.ok) return apiFailure(ctx, found, auth, business, ctx.path);
      const { product } = found.data;
      if (product.deleted) return notFound(ctx, auth, business);
      const descriptor = await fieldsFor(ctx, auth, business, product.category, product.detailsType, ctx.path);
      if (!descriptor) return;
      send(ctx, 200, editForm(auth, business, id, product.name, descriptor.update, productFormValues(descriptor.update, product), { category: product.category, detailsType: product.detailsType ?? '', version: String(product.version) }));
    },

    async update(ctx) {
      const start = await postStart(ctx, (business) => `${productsPath(business as PublicBusinessId)}/${String(ctx.params.id)}/editar`, undefined, (business, fields) => {
        const id = idOf(ctx);
        const cached = descriptors.get(descriptorKey(business, fields.get('category') ?? '', fields.get('detailsType') || null));
        if (!cached || id === null) return false;
        preserveUpdate(ctx, null, business, id, cached, fields);
        return true;
      });
      if (!start) return;
      const { auth, business, fields } = start;
      const id = idOf(ctx);
      if (id === null) return notFound(ctx, auth, business);
      const editPath = `${productPath(business, id)}/editar`;
      const category = fields.get('category') ?? '';
      const detailsType = fields.get('detailsType') || null;
      const descriptor = await fieldsFor(ctx, auth, business, category, detailsType, editPath, (cached) => preserveUpdate(ctx, auth, business, id, cached, fields));
      if (!descriptor) return;
      const parsed = parseProductForm(descriptor.update, fields);
      if (parsed.structureError) ctx.throw(400, 'El formulario tiene valores imposibles.', { code: 'INVALID_FORM' });
      const action = fields.get('action');
      if (action !== 'update' && action !== 'overwrite') ctx.throw(400, 'Acción desconocida.', { code: 'INVALID_FORM' });
      const version = Number(fields.get('version'));
      const hidden = { category, detailsType: detailsType ?? '', version: fields.get('version') ?? '' };
      const name = typeof parsed.input.name === 'string' && parsed.input.name.trim() !== '' ? parsed.input.name : 'producto';
      const result = await api.updateProduct(credentials(auth, fields), business, id, { ...parsed.input, version: Number.isSafeInteger(version) ? version : 0 }, { overwrite: action === 'overwrite' });
      if (result.ok) return seeOther(ctx, okUrl(business, 'saved', result.data.meta.freshness));
      if (!result.ok && result.kind === 'http' && result.status === 422) {
        return send(ctx, 422, editForm(auth, business, id, name, descriptor.update, parsed.values, hidden, formErrors(result.error.fields ?? { '': result.error.message }, parsed.slots)));
      }
      if (!result.ok && result.kind === 'http' && result.status === 409 && result.error.current) {
        // RF-9 (CA-7): lo escrito se conserva; se muestra quién y cuándo cambió la versión vigente. Solo
        // se guarda sobre ella si el usuario lo pide expresamente (botón de sobrescribir).
        const { current } = result.error;
        logger.info('product_conflict_shown', { business, productId: id });
        const conflict = views.notice({
          tone: 'warning',
          urgent: true,
          title: 'Otra persona cambió este producto mientras lo editabas: no se guardó nada.',
          paragraphs: [`Última modificación: ${current.updatedBy ?? 'otra sesión'}, el ${displayDate(current.updatedAt)}.`, 'Lo que escribiste sigue en el formulario. Puedes cargar la versión vigente o guardar tus cambios sobre ella.'],
          links: [{ href: editPath, label: 'Cargar la versión vigente (descarta lo escrito)' }],
        });
        return send(ctx, 409, editForm(auth, business, id, name, descriptor.update, parsed.values, { ...hidden, version: String(current.version) }, {}, [conflict], true));
      }
      if (isUnavailable(result)) {
        logger.warn('api_unavailable', { path: ctx.path, reason: failureReason(result) });
        return send(ctx, 503, editForm(auth, business, id, name, descriptor.update, parsed.values, hidden, {}, [views.notice(UNAVAILABLE)]));
      }
      return apiFailure(ctx, result, auth, business, editPath);
    },

    async deletePage(ctx) {
      const auth = await session(ctx, ctx.path);
      if (!auth) return;
      const business = businessOf(ctx, auth);
      if (!business) return;
      const id = idOf(ctx);
      if (id === null) return notFound(ctx, auth, business);
      const found = await api.getProduct(credentials(auth), business, id);
      if (!found.ok) return apiFailure(ctx, found, auth, business, ctx.path);
      if (found.data.product.deleted) return notFound(ctx, auth, business);
      send(ctx, 200, views.productDelete(auth, business, found.data.product));
    },

    async remove(ctx) {
      const start = await postStart(ctx, (business) => `${productsPath(business as PublicBusinessId)}/${String(ctx.params.id)}/eliminar`, SMALL_BODY_LIMIT);
      if (!start) return;
      const { auth, business, fields } = start;
      const id = idOf(ctx);
      if (id === null) return notFound(ctx, auth, business);
      const version = Number(fields.get('version'));
      const result = await api.removeProduct(credentials(auth, fields), business, id, Number.isSafeInteger(version) ? version : 0);
      if (result.ok) return seeOther(ctx, okUrl(business, 'deleted', result.data.meta.freshness));
      if (!result.ok && result.kind === 'http' && (result.status === 409 || result.status === 422)) {
        const found = await api.getProduct(credentials(auth), business, id);
        if (!found.ok) return apiFailure(ctx, found, auth, business, productsPath(business));
        if (found.data.product.deleted) return seeOther(ctx, okUrl(business, 'deleted'));
        const problem = result.status === 409 ? 'El producto cambió mientras lo revisabas: no se eliminó. Revisa los datos e inténtalo de nuevo.' : (Object.values(result.error.fields ?? {})[0] ?? result.error.message);
        return send(ctx, result.status, views.productDelete(auth, business, found.data.product, [views.notice({ tone: 'error', title: problem })]));
      }
      return apiFailure(ctx, result, auth, business, productsPath(business));
    },

    async restore(ctx) {
      const start = await postStart(ctx, (business) => `${productsPath(business as PublicBusinessId)}/eliminados`, SMALL_BODY_LIMIT);
      if (!start) return;
      const { auth, business, fields } = start;
      const id = idOf(ctx);
      if (id === null) return notFound(ctx, auth, business);
      const version = Number(fields.get('version'));
      const result = await api.restoreProduct(credentials(auth, fields), business, id, Number.isSafeInteger(version) ? version : 0);
      if (result.ok) return seeOther(ctx, okUrl(business, 'restored', result.data.meta.freshness));
      if (!result.ok && result.kind === 'http' && (result.status === 409 || result.status === 422)) {
        const problem = result.status === 409 ? 'El producto cambió mientras revisabas la lista: no se recuperó. Inténtalo de nuevo.' : (Object.values(result.error.fields ?? {})[0] ?? result.error.message);
        return renderDeleted(ctx, auth, business, result.status, [views.notice({ tone: 'error', title: problem })]);
      }
      return apiFailure(ctx, result, auth, business, `${productsPath(business)}/eliminados`);
    },

    moveUp: (ctx) => move(ctx, 'up'),
    moveDown: (ctx) => move(ctx, 'down'),
  });

  function createHidden(fields: Map<string, string>): Record<string, string> {
    const requestId = fields.get('requestId') ?? '';
    return { category: fields.get('category') ?? '', detailsType: fields.get('detailsType') ?? '', requestId: IDEMPOTENCY_KEY_PATTERN.test(requestId) ? requestId : newRequestId() };
  }

  /** RF-10 (CA-8): la API no responde; se vuelve a pintar lo escrito con el aviso (503). */
  function preserveCreate(ctx: Ctx, auth: Session | null, business: PublicBusinessId, descriptor: ProductFieldsResponse, fields: Map<string, string>): void {
    const parsed = parseProductForm(descriptor.create, fields);
    send(ctx, 503, createForm(auth, business, descriptor.create, parsed.values, createHidden(fields), {}, [views.notice(UNAVAILABLE)], fields.get('_csrf') ?? ''));
  }

  function preserveUpdate(ctx: Ctx, auth: Session | null, business: PublicBusinessId, id: number, descriptor: ProductFieldsResponse, fields: Map<string, string>): void {
    const parsed = parseProductForm(descriptor.update, fields);
    const hidden = { category: fields.get('category') ?? '', detailsType: fields.get('detailsType') ?? '', version: fields.get('version') ?? '' };
    const name = typeof parsed.input.name === 'string' && parsed.input.name.trim() !== '' ? parsed.input.name : 'producto';
    send(ctx, 503, editForm(auth, business, id, name, descriptor.update, parsed.values, hidden, {}, [views.notice(UNAVAILABLE)], false, fields.get('_csrf') ?? ''));
  }

  async function renderDeleted(ctx: Ctx, auth: Session, business: PublicBusinessId, status: number, notices: SafeHtml[]): Promise<void> {
    const result = await api.listProducts(credentials(auth), business, { deleted: true });
    if (!result.ok) return apiFailure(ctx, result, auth, business, `${productsPath(business)}/eliminados`);
    send(ctx, status, views.productsDeleted(auth, business, result.data.products.filter((product) => product.deleted), notices));
  }

  function createForm(auth: Session | null, business: PublicBusinessId, fields: readonly ProductFormField[], values: Record<string, string>, hidden: Record<string, string>, errors: Record<string, string> = {}, notices: SafeHtml[] = [], csrf = ''): SafeHtml {
    const category = hidden.category ?? 'platillo';
    return views.productForm({
      context: auth,
      csrfToken: auth?.csrfToken ?? csrf,
      business,
      mode: 'create',
      title: `${NEW_TITLES[category] ?? 'Nuevo producto'} de ${BUSINESS_NAMES[business]}`,
      action: productsPath(business),
      fields,
      values,
      errors,
      hidden,
      notices,
    });
  }

  function editForm(
    auth: Session | null,
    business: PublicBusinessId,
    id: number,
    name: string,
    fields: readonly ProductFormField[],
    values: Record<string, string>,
    hidden: Record<string, string>,
    errors: Record<string, string> = {},
    notices: SafeHtml[] = [],
    conflict = false,
    csrf = '',
  ): SafeHtml {
    return views.productForm({ context: auth, csrfToken: auth?.csrfToken ?? csrf, business, mode: 'edit', title: `Editar ${name}`, action: productPath(business, id), fields, values, errors, hidden, notices, conflict });
  }
}
