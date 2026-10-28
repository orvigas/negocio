import { isIP } from 'node:net';

import type { Context } from 'koa';

import { loginRequestSchema, type AdminUser, type LoginResponse, type SessionResponse } from '@restaurante/contracts';
import {
  allowedBusinesses,
  type LoginThrottle,
  type SessionStore,
  type UserAuthenticator,
  type UserRecord,
  type UserRepository,
} from '@restaurante/core/identity';
import type { Logger } from '@restaurante/core/shared';
import { readJsonBody } from '@restaurante/web';

import { ApiHttpError } from '../errors.ts';
import type { AdminAccess } from './access.ts';

/**
 * Acceso a la API de administración (REQ-F-039, RF-1 a RF-4; D-1):
 *
 *   POST   /api/v1/admin/sesion  -> 201 { session: { id, csrfToken }, user }  (entrar)
 *   GET    /api/v1/admin/sesion  -> 200 { user, csrfToken }                   (sesión vigente)
 *   DELETE /api/v1/admin/sesion  -> 204                                       (salir; con CSRF)
 *
 * Límite de intentos por la IP del visitante (RF-2): el último valor de `X-Forwarded-For`, que
 * escribe el admin con la IP que le da Traefik. La API solo es alcanzable desde la red interna, así
 * que nadie de internet puede fijar esa cabecera. Sin una IP válida, 400 (no se mezclan todos los
 * intentos en uno). Con el límite superado, 429 sin comprobar la contraseña.
 */

export const LOGIN_BODY_LIMIT = 4 * 1024;

// Propiedades función (no métodos): se pasan sueltas al router sin perder el contexto.
export interface SessionRoutes {
  login: (ctx: Context) => Promise<void>;
  current: (ctx: Context) => Promise<void>;
  logout: (ctx: Context) => Promise<void>;
}

export const toAdminUser = (user: UserRecord): AdminUser => ({
  id: user.id,
  name: user.displayName,
  role: user.role,
  businesses: allowedBusinesses(user),
});

/** IP del visitante: último valor de X-Forwarded-For, o null si falta o no es una IP. */
export function clientIp(ctx: Context): string | null {
  const last = ctx.get('X-Forwarded-For').split(',').at(-1)?.trim() ?? '';
  return isIP(last) === 0 ? null : last;
}

export function createSessionRoutes({
  access,
  sessions,
  throttle,
  users,
  authenticator,
  logger,
  now,
}: {
  access: AdminAccess;
  sessions: SessionStore;
  throttle: LoginThrottle;
  users: Pick<UserRepository, 'recordLogin'>;
  authenticator: UserAuthenticator<UserRecord>;
  logger: Logger;
  now: () => Date;
}): SessionRoutes {
  return Object.freeze<SessionRoutes>({
    async login(ctx) {
      const ip = clientIp(ctx);
      if (ip === null) throw new ApiHttpError(400, 'CLIENT_IP_REQUIRED', 'Falta la IP del visitante (X-Forwarded-For).');

      const status = throttle.status(ip);
      if (status.locked) {
        logger.warn('admin_login_locked', { ip });
        throw new ApiHttpError(429, 'LOGIN_LOCKED', 'Acceso bloqueado temporalmente por demasiados intentos.', {
          'Retry-After': String(status.retryAfterSeconds),
        });
      }

      const parsed = loginRequestSchema.safeParse(await readJsonBody(ctx, { limit: LOGIN_BODY_LIMIT }));
      // Cuenta inexistente, contraseña incorrecta, cuenta desactivada o cuerpo inválido: misma respuesta.
      const user = parsed.success ? await authenticator.authenticate(parsed.data.username, parsed.data.password) : null;
      if (!user) {
        const locked = throttle.recordFailure(ip);
        logger.warn('admin_login_failed', { ip, locked });
        if (locked) {
          throw new ApiHttpError(429, 'LOGIN_LOCKED', 'Acceso bloqueado temporalmente por demasiados intentos.', {
            'Retry-After': String(throttle.status(ip).retryAfterSeconds),
          });
        }
        throw new ApiHttpError(401, 'INVALID_CREDENTIALS', 'Usuario o contraseña incorrectos.');
      }

      throttle.recordSuccess(ip);
      const session = sessions.create({ userId: user.id, sessionVersion: user.sessionVersion });
      await users.recordLogin(user.id, now());
      logger.info('admin_login_succeeded', { ip, userId: user.id });
      const body: LoginResponse = { session: { id: session.id, csrfToken: session.csrfToken }, user: toAdminUser(user) };
      ctx.status = 201;
      ctx.body = body;
    },

    async current(ctx) {
      const { user, session } = await access.authenticate(ctx);
      const body: SessionResponse = { user: toAdminUser(user), csrfToken: session.csrfToken };
      ctx.body = body;
    },

    async logout(ctx) {
      const auth = await access.authenticate(ctx);
      access.assertCsrf(ctx, auth);
      sessions.destroy(auth.session.id);
      logger.info('admin_logout', { userId: auth.user.id });
      ctx.status = 204;
    },
  });
}
