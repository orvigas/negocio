import type { Context } from 'koa';

import { passwordChangeResponseSchema, type PasswordChangeResponse } from '@restaurante/contracts';
import {
  WRONG_CURRENT_PASSWORD_MESSAGE,
  hashPassword,
  validatePasswordPair,
  verifyPassword,
  type PasswordHashParams,
  type SessionStore,
  type UserRepository,
} from '@restaurante/core/identity';
import type { Logger } from '@restaurante/core/shared';

import type { AdminAccess } from './access.ts';
import { createResponder, validationFailed } from './responses.ts';
import { toAdminUser } from './session-routes.ts';
import { USER_BODY_LIMIT } from './user-routes.ts';

/**
 * Cuenta propia en `/api/v1/admin` (REQ-F-040, RF-2 y RF-10; paridad con "Mi cuenta" de REQ-F-007):
 *
 *   POST /cuenta/contrasena  { currentPassword, password, passwordConfirmation }
 *     -> 200 { session: { id, csrfToken }, user }
 *
 * Cualquier usuario con sesión, y siempre sobre el usuario de la sesión: no admite id ni otros campos
 * (un `role` o un `businesses` dan 422 y no cambian nada). Orden: sesión (401) -> CSRF (403) -> cuerpo
 * (413/415/400/422) -> contraseña actual y nueva (422).
 *
 * Una contraseña actual incorrecta no cuenta para el límite de intentos de acceso y no tiene límite
 * propio (decisión "Paridad, sin límite (Recomendado)"). Al confirmarse se cierran todas las sesiones
 * del usuario en la API (también la actual) y se abre una nueva para el navegador actual; las del
 * /admin actual caen en su siguiente petición porque sube `sessionVersion`.
 */

const ACCOUNT_FIELDS = Object.freeze(['currentPassword', 'password', 'passwordConfirmation']);

export interface AccountRoutes {
  changePassword: (ctx: Context) => Promise<void>;
}

export function createAccountRoutes({
  access,
  sessions,
  users,
  hashParams,
  logger,
}: {
  access: AdminAccess;
  sessions: SessionStore;
  users: Pick<UserRepository, 'findPasswordHash' | 'setPassword'>;
  hashParams?: PasswordHashParams;
  logger: Logger;
}): AccountRoutes {
  const { send, closedBody } = createResponder(logger);

  return Object.freeze<AccountRoutes>({
    async changePassword(ctx) {
      const auth = await access.authenticate(ctx);
      access.assertCsrf(ctx, auth);
      const body = await closedBody(ctx, ACCOUNT_FIELDS, USER_BODY_LIMIT);
      if (!body) return;
      const { user } = auth;

      const storedHash = await users.findPasswordHash(user.id);
      const currentOk = await verifyPassword(typeof body.currentPassword === 'string' ? body.currentPassword : '', storedHash);
      const errors: Record<string, string> = {
        ...(currentOk ? {} : { currentPassword: WRONG_CURRENT_PASSWORD_MESSAGE }),
        ...validatePasswordPair(body.password, body.passwordConfirmation),
      };
      if (Object.keys(errors).length > 0) {
        if (!currentOk) logger.warn('admin_password_change_rejected', { userId: user.id, reason: 'current_password' });
        return validationFailed(ctx, errors);
      }

      const passwordHash = await (hashParams ? hashPassword(body.password, hashParams) : hashPassword(body.password));
      const updated = await users.setPassword(user.id, passwordHash, { kind: 'user', id: user.id }, 'password_change');
      // Todas sus sesiones de la API (también la actual) se cierran; el navegador actual sigue con una nueva.
      sessions.destroyUser(user.id);
      const session = sessions.create({ userId: updated.id, sessionVersion: updated.sessionVersion });
      logger.info('admin_password_changed', { userId: user.id });
      const response: PasswordChangeResponse = { session: { id: session.id, csrfToken: session.csrfToken }, user: toAdminUser(updated) };
      send(ctx, passwordChangeResponseSchema, response);
    },
  });
}
