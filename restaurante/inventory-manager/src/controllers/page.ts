import { PAGE_CONFLICT_CODE, PAGE_NO_PREVIOUS_CODE, PAGE_UNAVAILABLE_CODE, type AdminApiClient, type AdminApiResult, type Freshness, type PageFormField, type PageStateResponse, type PublicBusinessId } from '@restaurante/contracts';
import type { Logger, SafeHtml } from '@restaurante/web';

import type { InventoryConfig } from '../config.ts';
import { clearSessionId } from '../session.ts';
import type { NoticeOptions, Views } from '../views/index.ts';
import { DEFAULT_GROUP, pagePath, pageRestorePath } from '../views/page.ts';
import { createControllerKit, isHttpError, type Ctx, type Session } from './common.ts';

/**
 * Sección "Página" del admin nuevo (REQ-F-044, RF-4, RF-6, RF-7 y RF-9). Las reglas son de la API: aquí
 * no se valida ningún campo, solo se envía lo escrito como texto.
 *
 * - Orden: mismo origen (403) -> cuerpo -> sesión (303 al acceso) -> negocio (404) -> permiso (403, sin
 *   llamar a la API por ese negocio) -> la API. Éxito: 303 (POST/redirect/GET).
 * - `PAGE_UNAVAILABLE` (RF-4, CA-18): GET 200 y POST 409, con el aviso y sin formulario. Es un estado,
 *   no una avería: un 503 de otra causa no se confunde con él.
 * - 422: errores por campo. 409 `PAGE_CONFLICT`: conserva lo escrito y muestra quién y cuándo (CA-9).
 *   El 409 no prueba que el intento anterior fallara: pudo ser un doble envío o una respuesta perdida
 *   de la misma persona. Si el último cambio lleva su nombre, el aviso no habla de "otra persona"; al
 *   restaurar, nunca lo afirma: muestra la versión vigente en vez de pedir confirmar otra vez.
 * - Resto (5xx, `timeout`, `network`, `invalid_response` y 400, 404, 413 o 415 de la API; H-4 de QA): la
 *   escritura queda sin confirmar. Se conserva lo escrito y se pide revisar, sin afirmar nada (RF-9).
 *   Repetir es seguro: `expectedVersion` convierte en un 409 lo que ya se hubiera guardado.
 *
 * Nunca se registran los textos de la página.
 */

type Handler = (ctx: Ctx) => Promise<void>;

export interface PageController {
  edit: Handler;
  save: Handler;
  restorePage: Handler;
  restore: Handler;
}

const SMALL_BODY_LIMIT = 4 * 1024;
/** Campos del formulario que no son de la página. */
const FORM_META_FIELDS: readonly string[] = Object.freeze(['_csrf', 'expectedVersion', 'action']);

/** Mensajes de éxito (`?ok=`, lista cerrada). */
const SUCCESS: Readonly<Record<string, string>> = Object.freeze({
  saved: 'Cambios guardados.',
  restored: 'Versión anterior restaurada. Si restauras otra vez, se deshace.',
});
/** Lo que se sabe de la landing tras la escritura (`?landing=`, lista cerrada); sin él, no se afirma nada. */
const FRESHNESS: Readonly<Record<string, string>> = Object.freeze({
  confirmed: 'La landing ya muestra el cambio.',
  pending: 'La landing lo mostrará en cuanto se actualice (como mucho en un minuto).',
});
const UNCONFIRMED = 'No pudimos confirmar el cambio. Revisa la página antes de repetirlo.';
const KEEP_OR_DISCARD = 'Lo que escribiste sigue en el formulario. Puedes guardarlo sobre la versión vigente o descartarlo.';

const isClosed = (result: AdminApiResult<unknown>): boolean => isHttpError(result, 503, PAGE_UNAVAILABLE_CODE);

/** Lo escrito en los campos de la página, sin los del formulario. */
const writtenOf = (fields: Map<string, string>): Map<string, string> => new Map([...fields].filter(([name]) => !FORM_META_FIELDS.includes(name)));

/**
 * Sin campos conocidos (arranque con la API caída, p. ej. en pleno despliegue): lo escrito se devuelve
 * con su nombre técnico en cajas de texto. Peor presentación, pero no se pierde (RF-9).
 */
const postedFields = (fields: Map<string, string>): PageFormField[] => [...writtenOf(fields).keys()].map((name) => ({ name, group: DEFAULT_GROUP, kind: 'text', label: name }));

export function createPageController({ config, api, views, logger }: { config: InventoryConfig; api: AdminApiClient; views: Views; logger: Logger }): PageController {
  const kit = createControllerKit({ config, api, views, logger });
  const { send, seeOther, session, businessOf, postStart, unavailable, failureReason, fieldErrors, credentials, toLogin } = kit;

  /**
   * Campos ya recibidos, por negocio: salen del código de core (no cambian mientras la API no se
   * despliega), así que con la API caída se puede volver a pintar lo escrito (RF-9).
   */
  const descriptors = new Map<PublicBusinessId, readonly PageFormField[]>();

  const okUrl = (business: PublicBusinessId, ok: 'saved' | 'restored', freshness: Freshness): string => `${pagePath(business)}?ok=${ok}&landing=${freshness}`;

  function closed(ctx: Ctx, status: number, auth: Session, business: PublicBusinessId): void {
    logger.info('page_unavailable_shown', { business, status });
    send(ctx, status, views.pageClosed(auth, business));
  }

  /** 401 -> acceso, 403 -> aviso; el resto, `onDown`. */
  function apiFailure(ctx: Ctx, result: AdminApiResult<unknown>, auth: Session, business: PublicBusinessId, returnTo: string, onDown: () => void | Promise<void>): void | Promise<void> {
    if (!result.ok && result.kind === 'http' && result.status === 401) {
      clearSessionId(ctx, config.isProduction);
      return toLogin(ctx, returnTo);
    }
    if (!result.ok && result.kind === 'http' && result.status === 403) {
      return send(ctx, 403, views.message({ title: 'Petición no válida', notice: { tone: 'error', title: result.error.message }, context: auth, business, section: 'page', backHref: pagePath(business), backLabel: 'Volver a la página' }));
    }
    return onDown();
  }

  /** Un fallo de lectura no tiene nada que conservar: 503 común. */
  const readFailure = (ctx: Ctx, result: AdminApiResult<unknown>, auth: Session, business: PublicBusinessId) =>
    apiFailure(ctx, result, auth, business, ctx.path, () => unavailable(ctx, failureReason(result), auth, business, 'page'));

  function successOf(ctx: Ctx): NoticeOptions | null {
    const { ok, landing } = ctx.query;
    if (typeof ok !== 'string' || !Object.hasOwn(SUCCESS, ok)) return null;
    const paragraphs = typeof landing === 'string' && Object.hasOwn(FRESHNESS, landing) ? [FRESHNESS[landing] as string] : [];
    return { tone: 'success', title: SUCCESS[ok] as string, paragraphs };
  }

  /** El formulario con la versión leída de la API. */
  function currentForm(ctx: Ctx, status: number, auth: Session, business: PublicBusinessId, { page, fields }: PageStateResponse, notices: SafeHtml[]): void {
    descriptors.set(business, fields);
    send(ctx, status, views.pageForm({ context: auth, csrfToken: auth.csrfToken, business, fields, values: page.values, version: page.version, current: page, notices }));
  }

  const pageMessage = (ctx: Ctx, status: number, auth: Session, business: PublicBusinessId, notice: NoticeOptions) =>
    send(ctx, status, views.message({ title: 'Página', notice, context: auth, business, section: 'page', backHref: pagePath(business), backLabel: 'Revisar la página' }));

  /** Vuelve a pintar lo escrito, con la versión recibida salvo que se indique otra (409). */
  function repaint(
    ctx: Ctx,
    status: number,
    auth: Session | null,
    business: PublicBusinessId,
    pageFields: readonly PageFormField[],
    fields: Map<string, string>,
    view: { errors?: Record<string, string>; notices?: SafeHtml[]; version?: string },
  ): void {
    send(
      ctx,
      status,
      views.pageForm({
        context: auth,
        csrfToken: auth?.csrfToken ?? fields.get('_csrf') ?? '',
        business,
        fields: pageFields,
        values: Object.fromEntries(pageFields.map(({ name }) => [name, fields.get(name) ?? ''])),
        version: view.version ?? fields.get('expectedVersion') ?? '',
        errors: view.errors ?? {},
        notices: view.notices ?? [],
        // Tras un 409, una versión ya aceptada no debe perder la decisión de sobrescribir (RF-8).
        conflict: view.version !== undefined || fields.get('action') === 'overwrite',
      }),
    );
  }

  const unconfirmedNotice = (business: PublicBusinessId): SafeHtml =>
    views.notice({
      tone: 'error',
      title: UNCONFIRMED,
      paragraphs: ['Lo que escribiste sigue en el formulario. Si vuelves a guardar y la página ya cambió, te avisaremos antes de pisar nada.'],
      links: [{ href: pagePath(business), label: 'Revisar la versión vigente (descarta lo escrito aquí)' }],
    });

  const unconfirmedRestore = (ctx: Ctx, auth: Session | null, business: PublicBusinessId) =>
    send(ctx, 503, views.message({ title: 'Página', notice: { tone: 'error', title: UNCONFIRMED }, context: auth ?? undefined, business, section: 'page', backHref: pagePath(business), backLabel: 'Revisar la página' }));

  /** Campos del formulario para volver a pintar: los conocidos, los de la API o los recibidos. */
  async function pageFieldsOf(auth: Session, business: PublicBusinessId, fields: Map<string, string>): Promise<readonly PageFormField[]> {
    const cached = descriptors.get(business);
    if (cached) return cached;
    const result = await api.getPage(credentials(auth), business);
    if (!result.ok) return postedFields(fields);
    descriptors.set(business, result.data.fields);
    return result.data.fields;
  }

  /** La confirmación con la versión vigente (exige confirmar de nuevo), con el aviso del intento fallido. */
  async function renderRestore(ctx: Ctx, status: number, auth: Session, business: PublicBusinessId, notices: SafeHtml[], title: string): Promise<void> {
    const result = await api.getPage(credentials(auth), business);
    if (result.ok) return send(ctx, status, views.pageRestore(auth, business, result.data.page, notices));
    if (isClosed(result)) return closed(ctx, 409, auth, business);
    return pageMessage(ctx, status, auth, business, { tone: 'warning', title });
  }

  /**
   * Tras un 409 de restaurar: la versión vigente, sin el formulario de confirmar. Decidir pasa otra vez
   * por "Restaurar versión anterior": un doble envío confirmado a ciegas desharía la restauración.
   */
  async function renderCurrent(ctx: Ctx, status: number, auth: Session, business: PublicBusinessId, notice: NoticeOptions): Promise<void> {
    const result = await api.getPage(credentials(auth), business);
    if (result.ok) return currentForm(ctx, status, auth, business, result.data, [views.notice(notice)]);
    if (isClosed(result)) return closed(ctx, 409, auth, business);
    return pageMessage(ctx, status, auth, business, notice);
  }

  return Object.freeze<PageController>({
    async edit(ctx) {
      const auth = await session(ctx, ctx.path);
      if (!auth) return;
      const business = businessOf(ctx, auth);
      if (!business) return;
      const result = await api.getPage(credentials(auth), business);
      if (isClosed(result)) return closed(ctx, 200, auth, business);
      const success = successOf(ctx);
      if (result.ok) return currentForm(ctx, 200, auth, business, result.data, success ? [views.notice(success)] : []);
      if (!success) return readFailure(ctx, result, auth, business);
      // La escritura ya se confirmó: que falle esta lectura no debe ocultarlo.
      return apiFailure(ctx, result, auth, business, ctx.path, () => {
        logger.warn('api_unavailable', { path: ctx.path, reason: failureReason(result) });
        pageMessage(ctx, 503, auth, business, { ...success, paragraphs: [...(success.paragraphs ?? []), 'No pudimos cargar la página ahora. Inténtalo de nuevo en unos minutos.'] });
      });
    },

    async save(ctx) {
      const start = await postStart(ctx, (business) => pagePath(business as PublicBusinessId), undefined, (business, fields) => {
        repaint(ctx, 503, null, business, descriptors.get(business) ?? postedFields(fields), fields, { notices: [unconfirmedNotice(business)] });
        return true;
      });
      if (!start) return;
      const { auth, business, fields } = start;
      const action = fields.get('action');
      if (action !== 'save' && action !== 'overwrite') return ctx.throw(400, 'Acción desconocida.', { code: 'INVALID_FORM' });

      const result = await api.savePage(credentials(auth, fields), business, {
        expectedVersion: fields.get('expectedVersion') ?? '',
        ...(action === 'overwrite' ? { overwrite: true } : {}),
        fields: Object.fromEntries(writtenOf(fields)),
      });
      if (result.ok) return seeOther(ctx, okUrl(business, 'saved', result.data.meta.freshness));
      if (isClosed(result)) return closed(ctx, 409, auth, business);
      const repaintWith = async (status: number, view: Parameters<typeof repaint>[6]) => repaint(ctx, status, auth, business, await pageFieldsOf(auth, business, fields), fields, view);

      const errors = fieldErrors(result);
      if (errors) return repaintWith(422, { errors });
      if (!result.ok && result.kind === 'http' && isHttpError(result, 409, PAGE_CONFLICT_CODE) && result.error.currentPage) {
        const { currentPage } = result.error;
        logger.info('page_conflict_shown', { business });
        const lastChange = `Última modificación: ${views.changeText(currentPage, 'otra sesión')}.`;
        const conflict = views.notice({
          tone: 'warning',
          urgent: true,
          ...(currentPage.updatedBy === auth.user.name
            ? { title: 'La página ya cambió: el último cambio lleva tu nombre.', paragraphs: [lastChange, 'Puede ser un guardado tuyo anterior que sí se aplicó, o un cambio desde otra pestaña.', KEEP_OR_DISCARD] }
            : { title: 'Otra persona cambió esta página mientras la editabas: no se guardó nada.', paragraphs: [lastChange, KEEP_OR_DISCARD] }),
        });
        return repaintWith(409, { notices: [conflict], version: currentPage.version });
      }
      return apiFailure(ctx, result, auth, business, pagePath(business), () => {
        logger.warn('api_unavailable', { path: ctx.path, reason: failureReason(result) });
        return repaintWith(503, { notices: [unconfirmedNotice(business)] });
      });
    },

    async restorePage(ctx) {
      const auth = await session(ctx, ctx.path);
      if (!auth) return;
      const business = businessOf(ctx, auth);
      if (!business) return;
      const result = await api.getPage(credentials(auth), business);
      if (isClosed(result)) return closed(ctx, 200, auth, business);
      if (!result.ok) return readFailure(ctx, result, auth, business);
      return send(ctx, 200, views.pageRestore(auth, business, result.data.page));
    },

    async restore(ctx) {
      const start = await postStart(ctx, (business) => pageRestorePath(business as PublicBusinessId), SMALL_BODY_LIMIT, (business) => {
        unconfirmedRestore(ctx, null, business);
        return true;
      });
      if (!start) return;
      const { auth, business, fields } = start;
      const result = await api.restorePage(credentials(auth, fields), business, { expectedVersion: fields.get('expectedVersion') ?? '' });
      if (result.ok) return seeOther(ctx, okUrl(business, 'restored', result.data.meta.freshness));
      if (isClosed(result)) return closed(ctx, 409, auth, business);
      const failed = (status: number, title: string, paragraphs: string[] = []) => renderRestore(ctx, status, auth, business, [views.notice({ tone: 'warning', urgent: true, title, paragraphs })], title);
      if (isHttpError(result, 409, PAGE_NO_PREVIOUS_CODE)) return failed(409, 'No hay una versión anterior que restaurar: no se cambió nada.');
      if (!result.ok && result.kind === 'http' && isHttpError(result, 409, PAGE_CONFLICT_CODE) && result.error.currentPage) {
        return renderCurrent(ctx, 409, auth, business, {
          tone: 'warning',
          urgent: true,
          title: 'La página cambió desde que abriste la confirmación.',
          paragraphs: [`Última modificación: ${views.changeText(result.error.currentPage, 'autor sin registrar')}.`, 'Puede ser tu propia restauración, si ya se aplicó, o un cambio posterior. Revisa la versión vigente antes de decidir: si ya se aplicó, restaurar otra vez la desharía.'],
        });
      }
      if (fieldErrors(result)) return failed(422, 'No se restauró nada: recarga la página e inténtalo de nuevo.');
      return apiFailure(ctx, result, auth, business, pageRestorePath(business), () => {
        logger.warn('api_unavailable', { path: ctx.path, reason: failureReason(result) });
        unconfirmedRestore(ctx, auth, business);
      });
    },
  });
}
