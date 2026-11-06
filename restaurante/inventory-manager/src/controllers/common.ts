import type { RouterContext } from '@koa/router';

import type { AdminApiClient, AdminApiResult, AdminCredentials, PublicBusinessId } from '@restaurante/contracts';
import { assertSameOrigin, readFormBody, type Logger, type SafeHtml } from '@restaurante/web';

import type { InventoryConfig } from '../config.ts';
import { clearSessionId, readSessionId, sanitizeNext } from '../session.ts';
import type { HeaderSection, PageContext, Views } from '../views/index.ts';

/**
 * Piezas comunes de los controladores del admin nuevo (REQ-F-039; extraídas en REQ-F-040 para
 * compartirlas entre productos, usuarios y "Mi cuenta"): respuestas HTML, POST/redirect/GET, el paso al
 * acceso, la sesión reenviada a la API (D-1), los fallos de la API (503 sin detalles internos) y, para
 * las pantallas solo de administradores (usuarios y bot, REQ-F-043), el rol y el formulario cerrado.
 *
 * Nunca se registran cookies, ids de sesión, tokens ni contraseñas.
 */

export type Ctx = RouterContext;

export interface Session extends PageContext {
  sessionId: string;
}

const ID_PATTERN = /^[1-9]\d{0,9}$/;
const BUSINESSES: readonly PublicBusinessId[] = ['molotes', 'birria'];

export const isHttpError = (result: AdminApiResult<unknown>, status: number, code: string): boolean =>
  !result.ok && result.kind === 'http' && result.status === status && result.error.code === code;

export function createControllerKit({ config, api, views, logger }: { config: InventoryConfig; api: AdminApiClient; views: Views; logger: Logger }) {
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

  /** Sesión cerrada por un cambio del propio usuario (REQ-F-040, `meta.ownSessionClosed`): al acceso con el aviso. */
  function toLoginClosed(ctx: Ctx): void {
    clearSessionId(ctx, isProduction);
    seeOther(ctx, '/acceso?ok=sesion_cerrada');
  }

  function unavailable(ctx: Ctx, reason: string, context?: PageContext, business?: PublicBusinessId, section?: HeaderSection): void {
    logger.warn('api_unavailable', { path: ctx.path, reason });
    send(ctx, 503, views.message({ title: 'Servicio no disponible', notice: { tone: 'error', title: 'Servicio no disponible.', paragraphs: ['No se pudo conectar con el sistema. Inténtalo de nuevo en unos minutos.'] }, context, business, section }));
  }

  const failureReason = (result: AdminApiResult<unknown>): string => (result.ok ? 'ok' : result.kind === 'http' ? `http_${result.status}` : result.kind);
  const isUnavailable = (result: AdminApiResult<unknown>): boolean => !result.ok && (result.kind !== 'http' || result.status >= 500);

  /**
   * Sesión de la API (D-1). null si ya respondió (acceso o 503). Con `onUnavailable`, si la API no
   * responde, quien llama puede volver a pintar lo escrito (devuelve true si ya respondió).
   */
  async function session(ctx: Ctx, returnTo: string, onUnavailable?: () => boolean): Promise<Session | null> {
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
    if (onUnavailable?.()) {
      logger.warn('api_unavailable', { path: ctx.path, reason: failureReason(result) });
      return null;
    }
    unavailable(ctx, failureReason(result));
    return null;
  }

  /** Sesión de un POST de negocio: si la API no responde, `onUnavailable` recibe el negocio conocido. */
  function businessSession(ctx: Ctx, returnTo: string, onUnavailable?: (business: PublicBusinessId) => boolean): Promise<Session | null> {
    const known = BUSINESSES.find((candidate) => candidate === ctx.params.business);
    return session(ctx, returnTo, onUnavailable && known ? () => onUnavailable(known) : undefined);
  }

  /** `:negocio` conocido (404) y permitido (403, sin datos; RF-6 y CA-4 de REQ-F-039). */
  function businessOf(ctx: Ctx, auth: Session): PublicBusinessId | null {
    const known = BUSINESSES.find((candidate) => candidate === ctx.params.business);
    if (!known) {
      notFound(ctx, { context: auth });
      return null;
    }
    if (!auth.user.businesses.includes(known)) {
      forbidden(ctx, auth, 'No tienes permiso sobre este negocio.');
      return null;
    }
    return known;
  }

  /**
   * Entrada común de los POST con sesión y negocio. Con `preserve`, si la API no responde al comprobar
   * la sesión, se vuelve a pintar lo escrito en vez de perderlo (RF-10 de REQ-F-039).
   */
  async function postStart(ctx: Ctx, returnTo: (business: string) => string, limit?: number, preserve?: (business: PublicBusinessId, fields: Map<string, string>) => boolean) {
    assertSameOrigin(ctx, logger);
    const fields = await readFormBody(ctx, limit ? { limit } : undefined);
    const auth = await businessSession(ctx, returnTo(String(ctx.params.business)), (business) => (preserve ? preserve(business, fields) : false));
    if (!auth) return null;
    const business = businessOf(ctx, auth);
    if (!business) return null;
    return { auth, business, fields };
  }

  function forbidden(ctx: Ctx, context: PageContext, message: string): void {
    logger.warn('admin_forbidden', { path: ctx.path, userId: context.user.id });
    send(ctx, 403, views.message({ title: 'Sin permiso', notice: { tone: 'error', title: message }, context }));
  }

  /** Sesión y rol administrador. null si ya respondió; `forbiddenMessage` es el texto del 403. */
  async function adminSession(ctx: Ctx, returnTo: string, forbiddenMessage: string, onUnavailable?: () => boolean): Promise<Session | null> {
    const auth = await session(ctx, returnTo, onUnavailable);
    if (!auth) return null;
    if (auth.user.role !== 'admin') {
      forbidden(ctx, auth, forbiddenMessage);
      return null;
    }
    return auth;
  }

  /** Mismo origen y formulario con una lista cerrada de campos (DEF-004 de REQ-F-007): otro campo, 400. */
  async function readClosedForm(ctx: Ctx, allowed: readonly string[], limit: number): Promise<Map<string, string>> {
    assertSameOrigin(ctx, logger);
    const fields = await readFormBody(ctx, { limit });
    if ([...fields.keys()].some((name) => !allowed.includes(name))) ctx.throw(400, 'El formulario tiene campos desconocidos.', { code: 'INVALID_FORM' });
    return fields;
  }

  /** Errores por campo de un 422; null si la respuesta es otra. La clave '' es un error general. */
  const fieldErrors = (result: AdminApiResult<unknown>): Record<string, string> | null =>
    !result.ok && result.kind === 'http' && result.status === 422 ? (result.error.fields ?? { '': result.error.message }) : null;

  function notFound(
    ctx: Ctx,
    { context, business, section, backHref = '/', backLabel = 'Volver al inicio' }: { context?: PageContext | undefined; business?: PublicBusinessId | undefined; section?: HeaderSection | undefined; backHref?: string; backLabel?: string } = {},
  ): void {
    send(ctx, 404, views.message({ title: 'No encontrado', notice: { tone: 'warning', title: 'No encontramos lo que buscas.' }, context, business, section, backHref, backLabel }));
  }

  function idOf(ctx: Ctx): number | null {
    const { id } = ctx.params;
    return typeof id === 'string' && ID_PATTERN.test(id) ? Number(id) : null;
  }

  const credentials = (auth: Session, fields?: Map<string, string>): AdminCredentials => ({ sessionId: auth.sessionId, csrfToken: fields?.get('_csrf') ?? '' });

  return Object.freeze({ send, seeOther, toLogin, toLoginClosed, unavailable, failureReason, isUnavailable, session, businessOf, postStart, forbidden, adminSession, readClosedForm, fieldErrors, notFound, idOf, credentials });
}

export type ControllerKit = ReturnType<typeof createControllerKit>;
