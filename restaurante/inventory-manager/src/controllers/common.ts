import type { RouterContext } from '@koa/router';

import type { AdminApiClient, AdminApiResult, AdminCredentials, PublicBusinessId } from '@restaurante/contracts';
import type { Logger, SafeHtml } from '@restaurante/web';

import type { InventoryConfig } from '../config.ts';
import { clearSessionId, readSessionId, sanitizeNext } from '../session.ts';
import type { HeaderSection, PageContext, Views } from '../views/index.ts';

/**
 * Piezas comunes de los controladores del admin nuevo (REQ-F-039; extraídas en REQ-F-040 para
 * compartirlas entre productos, usuarios y "Mi cuenta"): respuestas HTML, POST/redirect/GET, el paso al
 * acceso, la sesión reenviada a la API (D-1) y los fallos de la API (503 sin detalles internos).
 *
 * Nunca se registran cookies, ids de sesión, tokens ni contraseñas.
 */

export type Ctx = RouterContext;

export interface Session extends PageContext {
  sessionId: string;
}

const ID_PATTERN = /^[1-9]\d{0,9}$/;

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

  function unavailable(ctx: Ctx, reason: string, context?: PageContext, business?: PublicBusinessId): void {
    logger.warn('api_unavailable', { path: ctx.path, reason });
    send(ctx, 503, views.message({ title: 'Servicio no disponible', notice: { tone: 'error', title: 'Servicio no disponible.', paragraphs: ['No se pudo conectar con el sistema. Inténtalo de nuevo en unos minutos.'] }, context, business }));
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

  return Object.freeze({ send, seeOther, toLogin, toLoginClosed, unavailable, failureReason, isUnavailable, session, notFound, idOf, credentials });
}

export type ControllerKit = ReturnType<typeof createControllerKit>;
