import type { AdminApiClient, AdminApiResult } from '@restaurante/contracts';
import { assertSameOrigin, readFormBody, type Logger, type SafeHtml } from '@restaurante/web';

import type { InventoryConfig } from '../config.ts';
import { clearSessionId } from '../session.ts';
import type { PageContext, Views } from '../views/index.ts';
import {
  BUSINESS_FIELDS,
  EMPTY_USER_FORM,
  NEW_USER_PATH,
  USERS_PATH,
  readUserForm,
  userEditPath,
  userFormValues,
  userPasswordPath,
  type UserFormValues,
} from '../views/users.ts';
import { createControllerKit, type Ctx, type Session } from './common.ts';

/**
 * Usuarios del admin nuevo (REQ-F-040, RF-1 y RF-3 a RF-9), solo para administradores. Cada acción la
 * decide la API (`/api/v1/admin/usuarios`, con las reglas de REQ-F-007), a la que se reenvía la sesión
 * (D-1) y el token CSRF del campo `_csrf` (D-2):
 *
 * - GET: sesión (si no vale, 303 al acceso con `next`) -> rol administrador (403 sin datos y sin pedir
 *   usuarios a la API) -> datos.
 * - POST: mismo origen (403) -> lista cerrada de campos (400) -> sesión -> rol -> la API (CSRF, 422 por
 *   campo, 409 del último administrador). Después, 303 (PRG). Si se cerró la propia sesión
 *   (`meta.ownSessionClosed`), al acceso con un aviso.
 * - Con la API caída: 503 con lo escrito conservado, salvo las contraseñas (RF-15).
 */

type Handler = (ctx: Ctx) => Promise<void>;

export interface UsersController {
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

const USER_BODY_LIMIT = 16 * 1024;
const STATUS_BODY_LIMIT = 4 * 1024;
const PASSWORD_FIELDS = Object.freeze(['password', 'passwordConfirmation']);
const USER_FIELDS = Object.freeze(['_csrf', 'username', 'displayName', 'role', ...BUSINESS_FIELDS]);
const CREATE_FIELDS = Object.freeze([...USER_FIELDS, ...PASSWORD_FIELDS]);
const RESET_FIELDS = Object.freeze(['_csrf', ...PASSWORD_FIELDS]);
const STATUS_FIELDS = Object.freeze(['_csrf']);

/** Mensajes de éxito (`?ok=`, lista cerrada). */
const SUCCESS: Readonly<Record<string, string>> = Object.freeze({
  created: 'Usuario creado: ya puede entrar con su contraseña.',
  updated: 'Cambios guardados.',
  deactivated: 'Usuario desactivado: sus sesiones se cerraron y ya no puede entrar.',
  reactivated: 'Usuario reactivado: ya puede volver a entrar.',
  password_reset: 'Contraseña restablecida: sus sesiones se cerraron.',
});
const UNAVAILABLE = { tone: 'error' as const, title: 'Servicio no disponible.', paragraphs: ['No se pudo conectar con el sistema: no se guardó nada. Lo que escribiste sigue en el formulario (salvo las contraseñas); inténtalo de nuevo en unos minutos.'] };

export function createUsersController({ config, api, views, logger }: { config: InventoryConfig; api: AdminApiClient; views: Views; logger: Logger }): UsersController {
  const kit = createControllerKit({ config, api, views, logger });
  const { send, seeOther, toLogin, toLoginClosed, unavailable, failureReason, isUnavailable, idOf, credentials } = kit;

  function forbidden(ctx: Ctx, context: PageContext): void {
    logger.warn('admin_forbidden', { path: ctx.path, userId: context.user.id });
    send(ctx, 403, views.message({ title: 'Sin permiso', notice: { tone: 'error', title: 'No tienes permiso para gestionar usuarios.' }, context }));
  }

  const notFound = (ctx: Ctx, context?: PageContext) => kit.notFound(ctx, { context, section: 'users', backHref: USERS_PATH, backLabel: 'Volver a usuarios' });

  /** Sesión y rol administrador (RF-1). null si ya respondió. */
  async function adminSession(ctx: Ctx, returnTo: string, onUnavailable?: () => boolean): Promise<Session | null> {
    const auth = await kit.session(ctx, returnTo, onUnavailable);
    if (!auth) return null;
    if (auth.user.role !== 'admin') {
      forbidden(ctx, auth);
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

  /** Respuestas de la API que no son de dominio: 401 -> acceso, 403, 404 y el resto -> 503. */
  function apiFailure(ctx: Ctx, result: AdminApiResult<unknown>, auth: Session, returnTo: string): void {
    if (!result.ok && result.kind === 'http') {
      if (result.status === 401) {
        clearSessionId(ctx, config.isProduction);
        return toLogin(ctx, returnTo);
      }
      if (result.status === 403 && result.error.code === 'FORBIDDEN_ROLE') return forbidden(ctx, auth);
      if (result.status === 403) {
        return send(ctx, 403, views.message({ title: 'Petición no válida', notice: { tone: 'error', title: result.error.message }, context: auth, section: 'users', backHref: USERS_PATH, backLabel: 'Volver a usuarios' }));
      }
      if (result.status === 404) return notFound(ctx, auth);
    }
    return unavailable(ctx, failureReason(result), auth);
  }

  const lastAdminNotice = (message: string): SafeHtml =>
    views.notice({ tone: 'warning', urgent: true, title: message, paragraphs: ['Lo que escribiste sigue en el formulario.'] });
  const isLastAdmin = (result: AdminApiResult<unknown>): result is { ok: false; kind: 'http'; status: number; error: { code: string; message: string } } =>
    !result.ok && result.kind === 'http' && result.status === 409 && result.error.code === 'LAST_ADMIN';
  const fieldErrors = (result: AdminApiResult<unknown>): Record<string, string> | null =>
    !result.ok && result.kind === 'http' && result.status === 422 ? (result.error.fields ?? { '': result.error.message }) : null;

  const userInput = (values: UserFormValues) => ({ username: values.username, displayName: values.displayName, role: values.role, businesses: values.businesses });
  const passwords = (fields: Map<string, string>) => ({ password: fields.get('password') ?? '', passwordConfirmation: fields.get('passwordConfirmation') ?? '' });

  async function renderList(ctx: Ctx, auth: Session, status: number, notices: SafeHtml[]): Promise<void> {
    const result = await api.listUsers(credentials(auth));
    if (!result.ok) return apiFailure(ctx, result, auth, USERS_PATH);
    send(ctx, status, views.usersList(auth, result.data.users, notices));
  }

  async function changeStatus(ctx: Ctx, active: boolean): Promise<void> {
    const fields = await readClosedForm(ctx, STATUS_FIELDS, STATUS_BODY_LIMIT);
    const auth = await adminSession(ctx, USERS_PATH);
    if (!auth) return;
    const id = idOf(ctx);
    if (id === null) return notFound(ctx, auth);
    const result = await api.setUserActive(credentials(auth, fields), id, active);
    if (result.ok) {
      if (result.data.meta.ownSessionClosed) return toLoginClosed(ctx);
      return seeOther(ctx, `${USERS_PATH}?ok=${active ? 'reactivated' : 'deactivated'}`);
    }
    if (isLastAdmin(result)) return renderList(ctx, auth, 409, [views.notice({ tone: 'warning', urgent: true, title: result.error.message })]);
    return apiFailure(ctx, result, auth, USERS_PATH);
  }

  return Object.freeze<UsersController>({
    async list(ctx) {
      const auth = await adminSession(ctx, USERS_PATH);
      if (!auth) return;
      const { ok } = ctx.query;
      const notices = typeof ok === 'string' && Object.hasOwn(SUCCESS, ok) ? [views.notice({ tone: 'success', title: SUCCESS[ok] as string })] : [];
      await renderList(ctx, auth, 200, notices);
    },

    async newPage(ctx) {
      const auth = await adminSession(ctx, NEW_USER_PATH);
      if (!auth) return;
      send(ctx, 200, views.userForm({ context: auth, csrfToken: auth.csrfToken, mode: 'create', values: EMPTY_USER_FORM }));
    },

    async create(ctx) {
      const fields = await readClosedForm(ctx, CREATE_FIELDS, USER_BODY_LIMIT);
      const values = readUserForm(fields);
      const preserved = (auth: Session | null, status: number, extra: { errors?: Record<string, string>; notices?: SafeHtml[] }) =>
        send(ctx, status, views.userForm({ context: auth, csrfToken: auth?.csrfToken ?? fields.get('_csrf') ?? '', mode: 'create', values, ...extra }));
      const auth = await adminSession(ctx, NEW_USER_PATH, () => {
        preserved(null, 503, { notices: [views.notice(UNAVAILABLE)] });
        return true;
      });
      if (!auth) return;
      const result = await api.createUser(credentials(auth, fields), { ...userInput(values), ...passwords(fields) });
      if (result.ok) return seeOther(ctx, `${USERS_PATH}?ok=created`);
      const errors = fieldErrors(result);
      if (errors) return preserved(auth, 422, { errors });
      if (isUnavailable(result)) {
        logger.warn('api_unavailable', { path: ctx.path, reason: failureReason(result) });
        return preserved(auth, 503, { notices: [views.notice(UNAVAILABLE)] });
      }
      return apiFailure(ctx, result, auth, NEW_USER_PATH);
    },

    async editPage(ctx) {
      const auth = await adminSession(ctx, ctx.path);
      if (!auth) return;
      const id = idOf(ctx);
      if (id === null) return notFound(ctx, auth);
      const result = await api.getUser(credentials(auth), id);
      if (!result.ok) return apiFailure(ctx, result, auth, ctx.path);
      const { user } = result.data;
      send(ctx, 200, views.userForm({ context: auth, csrfToken: auth.csrfToken, mode: 'edit', user, values: userFormValues(user) }));
    },

    async update(ctx) {
      const fields = await readClosedForm(ctx, USER_FIELDS, USER_BODY_LIMIT);
      const values = readUserForm(fields);
      const id = idOf(ctx);
      const preserved = (auth: Session | null, status: number, extra: { errors?: Record<string, string>; notices?: SafeHtml[] }) =>
        send(ctx, status, views.userForm({ context: auth, csrfToken: auth?.csrfToken ?? fields.get('_csrf') ?? '', mode: 'edit', id: id ?? 0, values, ...extra }));
      const auth = await adminSession(ctx, id === null ? USERS_PATH : userEditPath(id), () => {
        if (id === null) return false;
        preserved(null, 503, { notices: [views.notice(UNAVAILABLE)] });
        return true;
      });
      if (!auth) return;
      if (id === null) return notFound(ctx, auth);
      const result = await api.updateUser(credentials(auth, fields), id, userInput(values));
      if (result.ok) {
        if (result.data.meta.ownSessionClosed) return toLoginClosed(ctx);
        return seeOther(ctx, `${USERS_PATH}?ok=updated`);
      }
      const errors = fieldErrors(result);
      if (errors) return preserved(auth, 422, { errors });
      if (isLastAdmin(result)) return preserved(auth, 409, { notices: [lastAdminNotice(result.error.message)] });
      if (isUnavailable(result)) {
        logger.warn('api_unavailable', { path: ctx.path, reason: failureReason(result) });
        return preserved(auth, 503, { notices: [views.notice(UNAVAILABLE)] });
      }
      return apiFailure(ctx, result, auth, userEditPath(id));
    },

    deactivate: (ctx) => changeStatus(ctx, false),
    reactivate: (ctx) => changeStatus(ctx, true),

    async passwordPage(ctx) {
      const auth = await adminSession(ctx, ctx.path);
      if (!auth) return;
      const id = idOf(ctx);
      if (id === null) return notFound(ctx, auth);
      const result = await api.getUser(credentials(auth), id);
      if (!result.ok) return apiFailure(ctx, result, auth, ctx.path);
      send(ctx, 200, views.userPassword({ context: auth, csrfToken: auth.csrfToken, id, name: result.data.user.displayName }));
    },

    async resetPassword(ctx) {
      const fields = await readClosedForm(ctx, RESET_FIELDS, USER_BODY_LIMIT);
      const id = idOf(ctx);
      const page = (auth: Session | null, status: number, name: string | null, extra: { errors?: Record<string, string>; notices?: SafeHtml[] }) =>
        send(ctx, status, views.userPassword({ context: auth, csrfToken: auth?.csrfToken ?? fields.get('_csrf') ?? '', id: id ?? 0, name, ...extra }));
      const auth = await adminSession(ctx, id === null ? USERS_PATH : userPasswordPath(id), () => {
        if (id === null) return false;
        page(null, 503, null, { notices: [views.notice(UNAVAILABLE)] });
        return true;
      });
      if (!auth) return;
      if (id === null) return notFound(ctx, auth);
      const result = await api.resetUserPassword(credentials(auth, fields), id, passwords(fields));
      if (result.ok) {
        if (result.data.meta.ownSessionClosed) return toLoginClosed(ctx);
        return seeOther(ctx, `${USERS_PATH}?ok=password_reset`);
      }
      const errors = fieldErrors(result);
      if (errors) {
        // El nombre solo es para el título: si la API no lo da, se usa uno genérico.
        const found = await api.getUser(credentials(auth), id);
        return page(auth, 422, found.ok ? found.data.user.displayName : null, { errors });
      }
      if (isUnavailable(result)) {
        logger.warn('api_unavailable', { path: ctx.path, reason: failureReason(result) });
        return page(auth, 503, null, { notices: [views.notice(UNAVAILABLE)] });
      }
      return apiFailure(ctx, result, auth, userPasswordPath(id));
    },
  });
}
