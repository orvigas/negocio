import type { Context, Middleware, Next, ParameterizedContext } from 'koa';

import type { Config } from '../config/env.ts';
import { safeEqualStrings } from '../services/admin-auth.ts';
import type { SessionInfo, SessionStore } from '../services/session-store.ts';
import type { Logger } from '../utils/logger.ts';

/** Estado de Koa en las rutas de administración. */
export interface AdminState {
  adminSession?: SessionInfo;
}
export type AdminContext = ParameterizedContext<AdminState>;

/**
 * Protección de /admin (REQ-F-001, RF-5):
 * - cabeceras noindex y sin caché en todas las respuestas de /admin;
 * - administración deshabilitada sin credenciales (503) y solo por HTTPS en producción (DT-3);
 * - validación de origen y token CSRF en las acciones POST;
 * - sesión obligatoria (cookie opaca validada contra el almacén en memoria).
 */

export const ADMIN_PREFIX = '/admin';
export const LOGIN_PATH = '/admin/login';
export const SESSION_COOKIE = 'admin_sid';

const isAdminPath = (path: string): boolean => path === ADMIN_PREFIX || path.startsWith(`${ADMIN_PREFIX}/`);

function respondUnavailable(ctx: Context): void {
  ctx.status = 503;
  ctx.type = 'json';
  ctx.body = { error: { code: 'ADMIN_UNAVAILABLE', message: 'Administración no disponible' } };
}

/** Primer filtro de todo /admin: cabeceras y disponibilidad. */
export function createAdminGate({ config, logger }: { config: Config; logger: Logger }): Middleware {
  return async function adminGate(ctx, next) {
    if (!isAdminPath(ctx.path)) return next();

    ctx.set('Cache-Control', 'no-store');
    ctx.set('X-Robots-Tag', 'noindex, nofollow');
    // Helmet envía `no-referrer` en todo el sitio; con esa política el navegador manda
    // `Origin: null` en los POST de formulario. En /admin basta `same-origin`: el navegador
    // envía el Origin real a este mismo sitio y sigue sin filtrar el referrer a terceros
    // (la administración no enlaza a otros sitios).
    ctx.set('Referrer-Policy', 'same-origin');

    if (!config.admin.enabled) return respondUnavailable(ctx);
    if (config.isProduction && !ctx.secure) {
      // Con nginx + TLS delante, TRUST_PROXY=true hace que Koa lea X-Forwarded-Proto.
      logger.warn('admin_requires_https', { path: ctx.path });
      return respondUnavailable(ctx);
    }
    return next();
  };
}

/** Opciones de la cookie de sesión. */
export function sessionCookieOptions(config: Pick<Config, 'isProduction'>) {
  return {
    httpOnly: true,
    sameSite: 'strict' as const,
    path: ADMIN_PREFIX,
    secure: config.isProduction,
    signed: false,
    overwrite: true,
  };
}

function rejectCsrf(ctx: Context, logger: Logger, reason: string): never {
  logger.warn('admin_csrf_rejected', { path: ctx.path, reason });
  ctx.throw(403, 'La petición no es válida. Recarga la página e inténtalo de nuevo.', { code: 'CSRF_INVALID' });
}

/**
 * Primera capa contra CSRF: el navegador indica el origen de la petición.
 *
 * - `Sec-Fetch-Site` (cabecera que solo pone el navegador; otro sitio no la puede falsear):
 *   si llega, debe ser `same-origin`.
 * - `Origin`: si llega con un origen concreto, debe ser el de este sitio. `Origin: null` (lo que
 *   manda el navegador con `Referrer-Policy: no-referrer`, o desde contextos opacos) no prueba
 *   nada por sí solo: solo se acepta si el navegador confirma `Sec-Fetch-Site: same-origin`.
 * - Sin ninguna de las dos (clientes que no son navegador) decide el token CSRF.
 *
 * El control principal sigue siendo el token sincronizador (`assertCsrfToken`) y la cookie
 * `SameSite=Strict`.
 */
export function assertSameOrigin(ctx: Context, logger: Logger): void {
  const origin = ctx.get('Origin');
  const site = ctx.get('Sec-Fetch-Site');
  // Ojo: en Koa 3 `ctx.origin` devuelve la cabecera Origin; el origen propio se calcula aquí
  // (con TRUST_PROXY, protocolo y host salen de X-Forwarded-Proto/Host de nginx).
  const ownOrigin = `${ctx.protocol}://${ctx.host}`;

  if (site && site !== 'same-origin') rejectCsrf(ctx, logger, 'fetch_site');
  if (origin === 'null') {
    if (site !== 'same-origin') rejectCsrf(ctx, logger, 'origin_null');
  } else if (origin && origin !== ownOrigin) {
    rejectCsrf(ctx, logger, 'origin');
  }
}

/** Segunda capa: token sincronizador de la sesión en el campo oculto `_csrf`. */
export function assertCsrfToken(ctx: AdminContext, logger: Logger, fields: Map<string, string>): void {
  const token = fields.get('_csrf');
  const expected = ctx.state.adminSession?.csrfToken;
  if (typeof token !== 'string' || !expected || !safeEqualStrings(token, expected)) rejectCsrf(ctx, logger, 'token');
}

export type SessionGuard = (ctx: AdminContext, next: Next, options?: { returnTo?: string }) => Promise<unknown>;

/**
 * Sesión obligatoria. Sin sesión (o caducada), redirige al acceso; en un POST además avisa
 * de que la sesión caducó y no lee ni escribe nada (CA-20, CA-22).
 */
export function createSessionGuard({ sessions, config }: { sessions: SessionStore; config: Config }): SessionGuard {
  return async function requireSession(ctx, next, { returnTo } = {}) {
    const session = sessions.touch(ctx.cookies.get(SESSION_COOKIE));
    if (!session) {
      ctx.cookies.set(SESSION_COOKIE, null, sessionCookieOptions(config));
      const query = new URLSearchParams();
      if (returnTo) query.set('next', returnTo);
      if (ctx.method === 'POST') query.set('expirada', '1');
      const search = query.toString();
      ctx.status = 303;
      ctx.redirect(search ? `${LOGIN_PATH}?${search}` : LOGIN_PATH);
      return undefined;
    }
    ctx.state.adminSession = session;
    return next();
  };
}
