import type { RouterContext } from '@koa/router';

import { isBusinessId, type BusinessId, type Logger } from '@restaurante/core/shared';
import { canEditBusiness, type UserRecord, type UserRepository } from '@restaurante/core/identity';

import type { Config } from '../config/env.ts';
import { CSRF_HEADER, assertCsrfValue, assertSameOrigin, resolveSession, type AdminState } from '../middleware/admin-guard.ts';
import type { SessionInfo, SessionStore } from '../services/session-store.ts';

/**
 * Acceso a la API JSON de productos (REQ-F-008, D-19 y DT-11). Mismo control que las páginas de
 * /admin (sesión con `sessionVersion`, permiso por negocio, mismo origen y token CSRF), pero con
 * respuestas JSON y en el orden de D-19:
 *
 *   sesión (401) -> permiso sobre el negocio (403) -> en escrituras, origen y X-CSRF-Token (403).
 *
 * Después, el controlador comprueba la existencia (404), lee el cuerpo (413/415/400) y el
 * repositorio valida (422) y compara la versión (409).
 */

export type ApiContext = RouterContext<AdminState>;

export interface ApiAuth {
  user: UserRecord;
  session: SessionInfo;
}

export interface AdminApiAccess {
  /** Sesión válida o 401. */
  authenticate(ctx: ApiContext): Promise<ApiAuth>;
  /** Sesión, `:business` conocido (404) y permitido (403); en escrituras, además origen y CSRF. */
  business(ctx: ApiContext, options: { write: boolean }): Promise<ApiAuth & { businessId: BusinessId }>;
}

export function createAdminApiAccess({
  config,
  sessions,
  users,
  logger,
}: {
  config: Config;
  sessions: SessionStore;
  users: UserRepository;
  logger: Logger;
}): AdminApiAccess {
  async function authenticate(ctx: ApiContext): Promise<ApiAuth> {
    const resolved = await resolveSession(ctx, { sessions, config, users });
    if (!resolved) ctx.throw(401, 'Inicia sesión para usar la API.', { code: 'UNAUTHENTICATED' });
    return resolved;
  }

  return Object.freeze<AdminApiAccess>({
    authenticate,

    async business(ctx: ApiContext, { write }: { write: boolean }) {
      const auth = await authenticate(ctx);
      const { business } = ctx.params;
      if (!isBusinessId(business)) ctx.throw(404, 'Negocio desconocido.', { code: 'NOT_FOUND' });
      if (!canEditBusiness(auth.user, business)) {
        logger.warn('admin_forbidden', { path: ctx.path, method: ctx.method, userId: auth.user.id });
        ctx.throw(403, 'No tienes permiso sobre este negocio.', { code: 'FORBIDDEN_BUSINESS' });
      }
      if (write) {
        assertSameOrigin(ctx, logger);
        assertCsrfValue(ctx, logger, ctx.get(CSRF_HEADER));
      }
      return { ...auth, businessId: business };
    },
  });
}
