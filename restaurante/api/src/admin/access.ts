import type { Context } from 'koa';

import { CSRF_HEADER } from '@restaurante/contracts';
import {
  canEditBusiness,
  isAdmin,
  resolveSession,
  safeEqualStrings,
  type SessionInfo,
  type SessionStore,
  type UserRecord,
  type UserRepository,
} from '@restaurante/core/identity';
import { isBusinessId, type BusinessId, type Logger } from '@restaurante/core/shared';

import { ApiHttpError } from '../errors.ts';

/**
 * Acceso a `/api/v1/admin` (REQ-F-039, D-1 y D-2). La sesión es de la API: el admin
 * (inventory-manager) reenvía su id como `Authorization: Bearer <id>`. Orden (el de D-19 del
 * `/admin/api` actual):
 *
 *   sesión (401) -> negocio conocido (404) -> permiso sobre el negocio (403) -> en escrituras,
 *   token CSRF de la sesión en X-CSRF-Token (403).
 *
 * Nunca se registran el id de sesión ni el token CSRF.
 */

export interface AdminAuth {
  user: UserRecord;
  session: SessionInfo;
}

export interface AdminAccess {
  /** Sesión vigente o 401. */
  authenticate(ctx: Context): Promise<AdminAuth>;
  /** Token CSRF de la sesión en la cabecera o 403. */
  assertCsrf(ctx: Context, auth: AdminAuth): void;
  /** Sesión, `:business` conocido (404) y permitido (403); en escrituras, además el CSRF. */
  business(ctx: Context & { params: Record<string, string> }, options: { write: boolean }): Promise<AdminAuth & { businessId: BusinessId }>;
  /**
   * Gestión de usuarios (REQ-F-040, RF-1): sesión (401) -> rol administrador (403, antes de mirar el
   * id: un editor recibe 403 también con su propio id) -> en escrituras, el CSRF (403).
   */
  adminOnly(ctx: Context, options: { write: boolean }): Promise<AdminAuth>;
}

const BEARER = /^Bearer ([A-Za-z0-9_-]{1,128})$/;

/** Id de sesión de la cabecera Authorization (formato validado; el almacén decide si existe). */
export function bearerToken(ctx: Context): string | null {
  return BEARER.exec(ctx.get('Authorization'))?.[1] ?? null;
}

export function createAdminAccess({
  sessions,
  users,
  logger,
}: {
  sessions: SessionStore;
  users: Pick<UserRepository, 'findById'>;
  logger: Logger;
}): AdminAccess {
  async function authenticate(ctx: Context): Promise<AdminAuth> {
    const resolved = await resolveSession({ sessions, users }, bearerToken(ctx));
    if (!resolved) throw new ApiHttpError(401, 'UNAUTHENTICATED', 'Inicia sesión para continuar.');
    return resolved;
  }

  function assertCsrf(ctx: Context, auth: AdminAuth): void {
    const token = ctx.get(CSRF_HEADER);
    if (token === '' || !safeEqualStrings(token, auth.session.csrfToken)) {
      logger.warn('admin_csrf_rejected', { path: ctx.path, reason: 'token' });
      throw new ApiHttpError(403, 'CSRF_INVALID', 'La petición no es válida. Recarga la página e inténtalo de nuevo.');
    }
  }

  return Object.freeze<AdminAccess>({
    authenticate,
    assertCsrf,

    async business(ctx, { write }) {
      const auth = await authenticate(ctx);
      const { business } = ctx.params;
      if (!isBusinessId(business)) throw new ApiHttpError(404, 'BUSINESS_NOT_FOUND', 'Negocio desconocido.');
      if (!canEditBusiness(auth.user, business)) {
        logger.warn('admin_forbidden', { path: ctx.path, method: ctx.method, userId: auth.user.id });
        throw new ApiHttpError(403, 'FORBIDDEN_BUSINESS', 'No tienes permiso sobre este negocio.');
      }
      if (write) assertCsrf(ctx, auth);
      return { ...auth, businessId: business };
    },

    async adminOnly(ctx, { write }) {
      const auth = await authenticate(ctx);
      if (!isAdmin(auth.user)) {
        logger.warn('admin_forbidden', { path: ctx.path, method: ctx.method, userId: auth.user.id });
        throw new ApiHttpError(403, 'FORBIDDEN_ROLE', 'No tienes permiso para gestionar usuarios.');
      }
      if (write) assertCsrf(ctx, auth);
      return auth;
    },
  });
}
