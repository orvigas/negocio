import { SESSION_COOKIE, sessionCookieOptions } from '../middleware/admin-guard.ts';
import { hashPassword, verifyPassword } from '../services/admin-auth.ts';
import { validatePasswordPair } from '../services/user-schema.ts';
import { ACCOUNT_PATH } from '../views/admin/index.ts';
import { ACCOUNT_SUCCESS_MESSAGES, renderAccount, type FieldErrors } from '../views/admin/users.ts';
import { createAdminAccess, type AdminRouterContext } from './admin-access.ts';
import type { AdminDeps } from './admin.ts';

type Handler = (ctx: AdminRouterContext) => unknown;

export interface AdminAccountController {
  page: Handler;
  changePassword: Handler;
}

/**
 * "Mi cuenta" (REQ-F-007, D-9 y R-9): cualquier usuario cambia su propia contraseña escribiendo
 * la actual y dos veces la nueva. Al cambiarla se cierran sus otras sesiones: se incrementa su
 * `sessionVersion` (DT-7) y la petición actual recibe una sesión nueva.
 * Un error en la contraseña actual no cuenta para el límite de intentos de acceso.
 */

const ACCOUNT_BODY_LIMIT = 16 * 1024;
const WRONG_CURRENT = 'La contraseña actual no es correcta.';
/** Campos del formulario (DEF-004): cualquier otro (p. ej. `role`) responde 400. */
const ACCOUNT_FIELDS = Object.freeze(['currentPassword', 'password', 'passwordConfirmation']);

export function createAdminAccountController(deps: AdminDeps): AdminAccountController {
  const { config, renderer, now, sessions, users, hashParams, logger } = deps;
  const access = createAdminAccess({ config, sessions, users, renderer, now, logger });

  return Object.freeze<AdminAccountController>({
    page(ctx) {
      return access.page(ctx, { returnTo: ACCOUNT_PATH }, (auth) => {
        const success = ctx.query.ok === 'password_change' ? ACCOUNT_SUCCESS_MESSAGES.password_change : undefined;
        access.sendHtml(ctx, 200, renderAccount(renderer, { ...access.pageContext(auth), success }));
      });
    },

    async changePassword(ctx) {
      const auth = await access.post(ctx, { returnTo: ACCOUNT_PATH, limit: ACCOUNT_BODY_LIMIT, allowedFields: ACCOUNT_FIELDS });
      if (!auth) return undefined;
      const { fields, user } = auth;

      const storedHash = await users.findPasswordHash(user.id);
      const currentOk = await verifyPassword(fields.get('currentPassword') ?? '', storedHash);
      const errors: FieldErrors = {
        ...(currentOk ? {} : { currentPassword: WRONG_CURRENT }),
        ...validatePasswordPair(fields.get('password'), fields.get('passwordConfirmation')),
      };
      if (Object.keys(errors).length > 0) {
        if (!currentOk) logger.warn('admin_password_change_rejected', { userId: user.id, reason: 'current_password' });
        return access.sendHtml(ctx, 422, renderAccount(renderer, { ...access.pageContext(auth), errors }));
      }

      const passwordHash = await hashPassword(fields.get('password'), hashParams);
      const updated = await users.setPassword(user.id, passwordHash, { kind: 'user', id: user.id }, 'password_change');
      // Cierra todas sus sesiones (también las de otros navegadores) y abre una nueva aquí.
      sessions.destroyUser(user.id);
      const session = sessions.create({ userId: updated.id, sessionVersion: updated.sessionVersion });
      ctx.cookies.set(SESSION_COOKIE, session.id, sessionCookieOptions(config));
      logger.info('admin_password_changed', { userId: user.id });
      return access.seeOther(ctx, `${ACCOUNT_PATH}?ok=password_change`);
    },
  });
}
