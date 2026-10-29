import { BUSINESS_IDS } from '@restaurante/core/shared';
import {
  LAST_ADMIN_MESSAGE,
  LastAdminError,
  USERNAME_TAKEN_MESSAGE,
  UserNotFoundError,
  UsernameTakenError,
  businessField,
  hashPassword,
  isAdmin,
  readUserForm,
  validatePasswordPair,
  validateUserData,
  type Actor,
  type UserFormValues,
  type UserRecord,
} from '@restaurante/core/identity';

import { USERS_PATH } from '../views/admin/index.ts';
import {
  EMPTY_USER_FORM,
  NEW_USER_PATH,
  USER_SUCCESS_MESSAGES,
  renderUserForm,
  renderUserPasswordForm,
  renderUsersList,
  userFormValues,
} from '../views/admin/users.ts';
import { createAdminAccess, type AdminRouterContext, type Authenticated, type Permission } from './admin-access.ts';
import type { AdminDeps } from './admin.ts';

type Handler = (ctx: AdminRouterContext) => unknown;

export interface AdminUsersController {
  list: Handler;
  newPage: Handler;
  create: Handler;
  editPage: Handler;
  update: Handler;
  deactivate: Handler;
  reactivate: Handler;
  passwordPage: Handler;
  resetPassword: Handler;
}

/**
 * Gestión de usuarios (REQ-F-007, R-8): solo administradores (un editor recibe 403 sin que se
 * lea el formulario, CA-7). POST-redirect-GET con CSRF; los errores se muestran junto a cada
 * campo y se conserva lo escrito, salvo las contraseñas.
 *
 * Reglas (en el repositorio, dentro de transacciones): siempre queda un administrador activo
 * (D-7, 409) y desactivar, cambiar rol o negocios o restablecer la contraseña cierran las
 * sesiones del usuario (D-8). Si dos administradores editan a la vez, gana la última escritura y
 * las dos quedan en la auditoría.
 */

const USER_BODY_LIMIT = 16 * 1024;

// Campos de cada formulario (DEF-004): cualquier otro responde 400. Las casillas de negocios
// sin marcar no se envían, así que son opcionales.
const BUSINESS_FIELDS = BUSINESS_IDS.map(businessField);
const USER_FIELDS = Object.freeze(['username', 'displayName', 'role', ...BUSINESS_FIELDS]);
const PASSWORD_FIELDS = Object.freeze(['password', 'passwordConfirmation']);
const CREATE_FIELDS = Object.freeze([...USER_FIELDS, ...PASSWORD_FIELDS]);
const NO_FIELDS: readonly string[] = Object.freeze([]);
const STATUS_BODY_LIMIT = 4 * 1024;
const ID_PATTERN = /^[1-9]\d{0,9}$/;

const adminOnly: Permission = (user) => (isAdmin(user) ? null : 'No tienes permiso para gestionar usuarios.');

const LAST_ADMIN_PROBLEM = LAST_ADMIN_MESSAGE;
const USERNAME_TAKEN = USERNAME_TAKEN_MESSAGE;

export function createAdminUsersController(deps: AdminDeps): AdminUsersController {
  const { config, renderer, now, sessions, users, hashParams, logger } = deps;
  const access = createAdminAccess({ config, sessions, users, renderer, now, logger });
  const { sendHtml, seeOther } = access;
  const actorOf = ({ user }: Authenticated): Actor => ({ kind: 'user', id: user.id });

  /** :id válido y existente, o 404. */
  async function targetFrom(ctx: AdminRouterContext): Promise<UserRecord> {
    const { id } = ctx.params;
    if (typeof id !== 'string' || !ID_PATTERN.test(id)) ctx.throw(404);
    const user = await users.findById(Number(id));
    if (!user) ctx.throw(404);
    return user;
  }

  /** Tras un cambio que invalida sus sesiones (D-8), se liberan también de la memoria. */
  function closeSessions(before: UserRecord, after: UserRecord): void {
    if (after.sessionVersion !== before.sessionVersion) sessions.destroyUser(after.id);
  }

  async function renderList(ctx: AdminRouterContext, auth: Authenticated, status: number, extra: { success?: string; problem?: string } = {}) {
    const list = await users.list();
    sendHtml(ctx, status, renderUsersList(renderer, { ...access.pageContext(auth), users: list, timezone: config.timezone, ...extra }));
  }

  function formPage(ctx: AdminRouterContext, auth: Authenticated, status: number, options: Omit<Parameters<typeof renderUserForm>[1], keyof ReturnType<typeof access.pageContext>>) {
    sendHtml(ctx, status, renderUserForm(renderer, { ...access.pageContext(auth), ...options }));
  }

  async function changeStatus(ctx: AdminRouterContext, active: boolean) {
    const auth = await access.post(ctx, { returnTo: USERS_PATH, limit: STATUS_BODY_LIMIT, permission: adminOnly, allowedFields: NO_FIELDS });
    if (!auth) return undefined;
    const target = await targetFrom(ctx);
    try {
      const updated = await users.setActive(target.id, active, actorOf(auth));
      closeSessions(target, updated);
    } catch (err) {
      if (err instanceof LastAdminError) return renderList(ctx, auth, 409, { problem: LAST_ADMIN_PROBLEM });
      throw err;
    }
    logger.info(active ? 'admin_user_reactivated' : 'admin_user_deactivated', { userId: target.id, by: auth.user.id });
    return seeOther(ctx, `${USERS_PATH}?ok=${active ? 'reactivated' : 'deactivated'}`);
  }

  return Object.freeze<AdminUsersController>({
    list(ctx) {
      return access.page(ctx, { returnTo: USERS_PATH, permission: adminOnly }, (auth) => {
        const { ok } = ctx.query;
        const success =
          typeof ok === 'string' && Object.hasOwn(USER_SUCCESS_MESSAGES, ok) ? USER_SUCCESS_MESSAGES[ok as keyof typeof USER_SUCCESS_MESSAGES] : undefined;
        return renderList(ctx, auth, 200, success ? { success } : {});
      });
    },

    newPage(ctx) {
      return access.page(ctx, { returnTo: USERS_PATH, permission: adminOnly }, (auth) => formPage(ctx, auth, 200, { values: EMPTY_USER_FORM }));
    },

    async create(ctx) {
      const auth = await access.post(ctx, { returnTo: NEW_USER_PATH, limit: USER_BODY_LIMIT, permission: adminOnly, allowedFields: CREATE_FIELDS });
      if (!auth) return undefined;
      const values: UserFormValues = readUserForm(auth.fields);
      const { data, errors } = validateUserData(values);
      const passwordErrors = validatePasswordPair(auth.fields.get('password'), auth.fields.get('passwordConfirmation'));
      const allErrors = { ...errors, ...passwordErrors };
      if (!data || Object.keys(allErrors).length > 0) return formPage(ctx, auth, 422, { values, errors: allErrors });

      const passwordHash = await hashPassword(auth.fields.get('password'), hashParams);
      let created: UserRecord;
      try {
        created = await users.create({ ...data, passwordHash }, actorOf(auth));
      } catch (err) {
        if (err instanceof UsernameTakenError) return formPage(ctx, auth, 422, { values, errors: { username: USERNAME_TAKEN } });
        throw err;
      }
      logger.info('admin_user_created', { userId: created.id, role: created.role, by: auth.user.id });
      return seeOther(ctx, `${USERS_PATH}?ok=created`);
    },

    async editPage(ctx) {
      return access.page(ctx, { returnTo: USERS_PATH, permission: adminOnly }, async (auth) => {
        const user = await targetFrom(ctx);
        formPage(ctx, auth, 200, { user, values: userFormValues(user) });
      });
    },

    async update(ctx) {
      const auth = await access.post(ctx, { returnTo: USERS_PATH, limit: USER_BODY_LIMIT, permission: adminOnly, allowedFields: USER_FIELDS });
      if (!auth) return undefined;
      const target = await targetFrom(ctx);
      const values = readUserForm(auth.fields);
      const { data, errors } = validateUserData(values);
      if (!data) return formPage(ctx, auth, 422, { user: target, values, errors });
      try {
        const updated = await users.update(target.id, data, actorOf(auth));
        closeSessions(target, updated);
      } catch (err) {
        if (err instanceof UsernameTakenError) return formPage(ctx, auth, 422, { user: target, values, errors: { username: USERNAME_TAKEN } });
        if (err instanceof LastAdminError) return formPage(ctx, auth, 409, { user: target, values, problem: LAST_ADMIN_PROBLEM });
        if (err instanceof UserNotFoundError) ctx.throw(404);
        throw err;
      }
      logger.info('admin_user_updated', { userId: target.id, by: auth.user.id });
      return seeOther(ctx, `${USERS_PATH}?ok=updated`);
    },

    deactivate: (ctx) => changeStatus(ctx, false),
    reactivate: (ctx) => changeStatus(ctx, true),

    async passwordPage(ctx) {
      return access.page(ctx, { returnTo: USERS_PATH, permission: adminOnly }, async (auth) => {
        const user = await targetFrom(ctx);
        sendHtml(ctx, 200, renderUserPasswordForm(renderer, { ...access.pageContext(auth), user }));
      });
    },

    async resetPassword(ctx) {
      const auth = await access.post(ctx, { returnTo: USERS_PATH, limit: USER_BODY_LIMIT, permission: adminOnly, allowedFields: PASSWORD_FIELDS });
      if (!auth) return undefined;
      const target = await targetFrom(ctx);
      const errors = validatePasswordPair(auth.fields.get('password'), auth.fields.get('passwordConfirmation'));
      if (Object.keys(errors).length > 0) {
        return sendHtml(ctx, 422, renderUserPasswordForm(renderer, { ...access.pageContext(auth), user: target, errors }));
      }
      const passwordHash = await hashPassword(auth.fields.get('password'), hashParams);
      const updated = await users.setPassword(target.id, passwordHash, actorOf(auth), 'password_reset');
      closeSessions(target, updated);
      logger.info('admin_user_password_reset', { userId: target.id, by: auth.user.id });
      return seeOther(ctx, `${USERS_PATH}?ok=password_reset`);
    },
  });
}

