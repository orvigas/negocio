import type { Context, Middleware, Next, ParameterizedContext } from 'koa';

import type { Config } from '../config/env.ts';
import { DatabaseUnavailableError } from '../db/errors.ts';
import type { UserRecord, UserRepository } from '../repositories/user-repository.ts';
import { safeEqualStrings } from '../services/admin-auth.ts';
import type { SessionInfo, SessionStore } from '../services/session-store.ts';
import type { Logger } from '../utils/logger.ts';

/** Estado de Koa en las rutas de administración. */
export interface AdminState {
  adminSession?: SessionInfo;
  /** Usuario de la sesión, leído de la base de datos en cada petición (rol y negocios vigentes). */
  adminUser?: UserRecord;
}
export type AdminContext = ParameterizedContext<AdminState>;

/**
 * Protección de /admin (REQ-F-001, RF-5):
 * - cabeceras noindex y sin caché en todas las respuestas de /admin;
 * - solo por HTTPS en producción (DT-3);
 * - administración no disponible (503) mientras la base de datos no tenga usuarios
 *   (REQ-F-007, R-4 y DT-11) o si la base de datos no responde (R-3: página HTML 503);
 * - validación de origen y token CSRF en las acciones POST;
 * - sesión obligatoria (cookie opaca validada contra el almacén en memoria) de un usuario
 *   activo cuya `sessionVersion` no cambió (REQ-F-007, DT-7).
 */

export const ADMIN_PREFIX = '/admin';
/** API JSON de productos (REQ-F-008): sus errores de disponibilidad también son JSON. */
export const ADMIN_API_PREFIX = '/admin/api';
export const LOGIN_PATH = '/admin/login';
export const SESSION_COOKIE = 'admin_sid';

const isAdminPath = (path: string): boolean => path === ADMIN_PREFIX || path.startsWith(`${ADMIN_PREFIX}/`);
export const isAdminApiPath = (path: string): boolean => path === ADMIN_API_PREFIX || path.startsWith(`${ADMIN_API_PREFIX}/`);

function respondUnavailable(ctx: Context): void {
  ctx.status = 503;
  ctx.type = 'json';
  ctx.body = { error: { code: 'ADMIN_UNAVAILABLE', message: 'Administración no disponible' } };
}

/**
 * Primer filtro de todo /admin: cabeceras, HTTPS y disponibilidad.
 * `users` ausente: la administración no está montada (503). Cada petición comprueba que haya
 * usuarios (una consulta trivial): así /admin se habilita sin reiniciar cuando el comando de
 * recuperación crea el primero (DT-11) y, si la base de datos falla, también la página de acceso
 * responde 503 (R-3, CA-5).
 */
export function createAdminGate({
  config,
  logger,
  users,
  renderUnavailable,
}: {
  config: Config;
  logger: Logger;
  users?: Pick<UserRepository, 'hasUsers'> | undefined;
  renderUnavailable: () => string;
}): Middleware {
  const available = async (): Promise<boolean> => (users ? users.hasUsers() : false);

  return async function adminGate(ctx, next) {
    if (!isAdminPath(ctx.path)) {
      await next();
      return;
    }

    ctx.set('Cache-Control', 'no-store');
    ctx.set('X-Robots-Tag', 'noindex, nofollow');
    // Helmet envía `no-referrer` en todo el sitio; con esa política el navegador manda
    // `Origin: null` en los POST de formulario. En /admin basta `same-origin`: el navegador
    // envía el Origin real a este mismo sitio y sigue sin filtrar el referrer a terceros
    // (la administración no enlaza a otros sitios).
    ctx.set('Referrer-Policy', 'same-origin');

    if (config.isProduction && !ctx.secure) {
      // Con el proxy con TLS delante (Traefik), TRUST_PROXY=true hace que Koa lea X-Forwarded-Proto.
      logger.warn('admin_requires_https', { path: ctx.path });
      return respondUnavailable(ctx);
    }
    try {
      if (!(await available())) return respondUnavailable(ctx);
      await next();
    } catch (err) {
      if (!(err instanceof DatabaseUnavailableError)) throw err;
      // Solo nombre y códigos: el mensaje de Prisma lleva rutas e invocaciones (DT-9).
      logger.error('database_unavailable', { path: ctx.path, ...err.details });
      ctx.status = 503;
      if (isAdminApiPath(ctx.path)) {
        ctx.type = 'json';
        ctx.body = { error: { code: 'DATABASE_UNAVAILABLE', message: 'Base de datos no disponible' } };
      } else {
        ctx.type = 'html';
        ctx.body = renderUnavailable();
      }
    }
    return undefined;
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
  assertCsrfValue(ctx, logger, fields.get('_csrf'));
}

/** Cabecera del token CSRF en la API JSON (REQ-F-008). */
export const CSRF_HEADER = 'X-CSRF-Token';

/** Compara el token recibido (campo o cabecera) con el de la sesión. */
export function assertCsrfValue(ctx: AdminContext, logger: Logger, token: unknown): void {
  const expected = ctx.state.adminSession?.csrfToken;
  if (typeof token !== 'string' || token === '' || !expected || !safeEqualStrings(token, expected)) rejectCsrf(ctx, logger, 'token');
}

/**
 * Sesión vigente de la petición: la cookie es válida y su usuario existe, está activo y no cambió
 * su `sessionVersion` (REQ-F-007, D-8 y DT-7). Si no, destruye la sesión, borra la cookie y
 * devuelve null (quien llama decide la respuesta: 303 en HTML, 401 en la API).
 */
export async function resolveSession(
  ctx: AdminContext,
  { sessions, config, users }: { sessions: SessionStore; config: Config; users: Pick<UserRepository, 'findById'> },
): Promise<{ session: SessionInfo; user: UserRecord } | null> {
  const session = sessions.touch(ctx.cookies.get(SESSION_COOKIE));
  const user = session ? await users.findById(session.userId) : null;
  if (!session || !user || !user.active || user.sessionVersion !== session.sessionVersion) {
    if (session) sessions.destroy(session.id);
    ctx.cookies.set(SESSION_COOKIE, null, sessionCookieOptions(config));
    return null;
  }
  ctx.state.adminSession = session;
  ctx.state.adminUser = user;
  return { session, user };
}

export type SessionGuard = (ctx: AdminContext, next: Next, options?: { returnTo?: string }) => Promise<unknown>;

/**
 * Sesión obligatoria. Sin sesión (o caducada), redirige al acceso; en un POST además avisa
 * de que la sesión caducó y no lee ni escribe nada (CA-20, CA-22).
 * La sesión también deja de valer si su usuario ya no existe, está desactivado o cambió su
 * `sessionVersion` (REQ-F-007, D-8 y DT-7).
 */
export function createSessionGuard({
  sessions,
  config,
  users,
}: {
  sessions: SessionStore;
  config: Config;
  users: Pick<UserRepository, 'findById'>;
}): SessionGuard {
  return async function requireSession(ctx, next, { returnTo } = {}) {
    if (!(await resolveSession(ctx, { sessions, config, users }))) {
      const query = new URLSearchParams();
      if (returnTo) query.set('next', returnTo);
      if (ctx.method === 'POST') query.set('expirada', '1');
      const search = query.toString();
      ctx.status = 303;
      ctx.redirect(search ? `${LOGIN_PATH}?${search}` : LOGIN_PATH);
      return undefined;
    }
    await next();
    return undefined;
  };
}
