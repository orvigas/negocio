import type { Context } from 'koa';

import { userListResponseSchema, userResponseSchema, userWriteResponseSchema, type ManagedUser } from '@restaurante/contracts';
import {
  LAST_ADMIN_MESSAGE,
  LastAdminError,
  USERNAME_TAKEN_MESSAGE,
  UserNotFoundError,
  UsernameTakenError,
  hashPassword,
  validatePasswordPair,
  validateUserData,
  type Actor,
  type PasswordHashParams,
  type SessionStore,
  type UserRecord,
  type UserRepository,
} from '@restaurante/core/identity';
import { BUSINESS_IDS, isBusinessId, toZonedIsoString, type BusinessId, type Logger } from '@restaurante/core/shared';

import { ApiHttpError } from '../errors.ts';
import type { AdminAccess, AdminAuth } from './access.ts';
import { createResponder, validationFailed } from './responses.ts';

/**
 * Usuarios de `/api/v1/admin` (REQ-F-040, RF-1 y RF-3 a RF-9), solo para administradores, con las
 * reglas actuales de core y del repositorio (REQ-F-007): D-7 (siempre un administrador activo, 409),
 * D-8 (rol, negocios, estado o contraseña cierran las sesiones del usuario), la auditoría y "gana la
 * última escritura".
 *
 *   GET  /usuarios                   -> { users }
 *   POST /usuarios                   -> 201 { user }
 *   GET  /usuarios/:id               -> { user }
 *   PUT  /usuarios/:id               -> { user, meta }
 *   POST /usuarios/:id/desactivar    -> { user, meta }   (cuerpo {})
 *   POST /usuarios/:id/reactivar     -> { user, meta }   (cuerpo {})
 *   PUT  /usuarios/:id/contrasena    -> { user, meta }
 *
 * Orden (D-19): sesión (401) -> rol administrador (403) -> CSRF en escrituras (403) -> id (404) ->
 * cuerpo (413/415/400, y 422 con un campo desconocido) -> validación (422) -> dominio (409).
 * `meta.ownSessionClosed` dice si se cerraron las sesiones del propio usuario de la sesión.
 * Nunca se registran ni se devuelven contraseñas, hashes ni `sessionVersion`.
 */

type RouteContext = Context & { params: Record<string, string> };
type Handler = (ctx: RouteContext) => Promise<void>;

export interface UserRoutes {
  list: Handler;
  create: Handler;
  get: Handler;
  update: Handler;
  deactivate: Handler;
  reactivate: Handler;
  resetPassword: Handler;
}

const ID_PATTERN = /^[1-9]\d{0,9}$/;
/** Formularios de usuario (contraseñas de hasta 256 caracteres incluidas). */
export const USER_BODY_LIMIT = 16 * 1024;
export const STATUS_BODY_LIMIT = 4 * 1024;

const USER_FIELDS = Object.freeze(['username', 'displayName', 'role', 'businesses']);
const PASSWORD_FIELDS = Object.freeze(['password', 'passwordConfirmation']);
const CREATE_FIELDS = Object.freeze([...USER_FIELDS, ...PASSWORD_FIELDS]);
const NO_FIELDS: readonly string[] = Object.freeze([]);

export const toManagedUser = (user: UserRecord, timeZone: string): ManagedUser => ({
  id: user.id,
  username: user.username,
  displayName: user.displayName,
  role: user.role,
  businesses: [...user.businesses],
  active: user.active,
  lastLoginAt: user.lastLoginAt ? toZonedIsoString(user.lastLoginAt, timeZone) : null,
  createdAt: toZonedIsoString(user.createdAt, timeZone),
  updatedAt: toZonedIsoString(user.updatedAt, timeZone),
});

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

/** Datos del usuario del cuerpo, validados con core; o los errores por campo. */
function userDataOf(body: Record<string, unknown>) {
  const { businesses } = body;
  if (businesses !== undefined && (!Array.isArray(businesses) || businesses.some((business) => !isBusinessId(business)))) {
    return { data: null, errors: { businesses: 'Elige negocios conocidos.' } };
  }
  // Ya comprobado arriba: solo negocios conocidos.
  const chosen = (businesses ?? []) as BusinessId[];
  return validateUserData({
    username: text(body.username),
    displayName: text(body.displayName),
    role: text(body.role),
    businesses: BUSINESS_IDS.filter((business) => chosen.includes(business)),
  });
}

export function createUserRoutes({
  access,
  sessions,
  users,
  timeZone,
  hashParams,
  logger,
}: {
  access: AdminAccess;
  sessions: SessionStore;
  users: UserRepository;
  timeZone: string;
  hashParams?: PasswordHashParams;
  logger: Logger;
}): UserRoutes {
  const { send, closedBody } = createResponder(logger);
  const dto = (user: UserRecord) => toManagedUser(user, timeZone);
  const actorOf = ({ user }: AdminAuth): Actor => ({ kind: 'user', id: user.id });
  const hash = (password: unknown) => (hashParams ? hashPassword(password, hashParams) : hashPassword(password));

  /** :id válido y existente, o 404 (sin datos). */
  async function targetOf(ctx: RouteContext): Promise<UserRecord> {
    const { id } = ctx.params;
    const user = typeof id === 'string' && ID_PATTERN.test(id) ? await users.findById(Number(id)) : null;
    if (!user) throw new ApiHttpError(404, 'USER_NOT_FOUND', 'Usuario no encontrado.');
    return user;
  }

  /**
   * Tras un cambio que invalida sus sesiones (D-8), se liberan también de la memoria de la API (las del
   * /admin actual caen en su siguiente petición por `sessionVersion`).
   */
  function closeSessions(auth: AdminAuth, before: UserRecord, after: UserRecord): boolean {
    if (after.sessionVersion === before.sessionVersion) return false;
    sessions.destroyUser(after.id);
    return after.id === auth.user.id;
  }

  /** Errores de dominio -> 404, 422 y 409. El resto sigue al manejador central (503 o 500). */
  async function run(ctx: RouteContext, task: () => Promise<void>): Promise<void> {
    try {
      await task();
    } catch (err) {
      if (err instanceof UserNotFoundError) throw new ApiHttpError(404, 'USER_NOT_FOUND', 'Usuario no encontrado.');
      if (err instanceof UsernameTakenError) return validationFailed(ctx, { username: USERNAME_TAKEN_MESSAGE });
      if (err instanceof LastAdminError) {
        logger.info('admin_last_admin_rejected', { path: ctx.path, method: ctx.method });
        throw new ApiHttpError(409, 'LAST_ADMIN', LAST_ADMIN_MESSAGE);
      }
      throw err;
    }
  }

  async function changeStatus(ctx: RouteContext, active: boolean): Promise<void> {
    const auth = await access.adminOnly(ctx, { write: true });
    const target = await targetOf(ctx);
    if (!(await closedBody(ctx, NO_FIELDS, STATUS_BODY_LIMIT))) return;
    await run(ctx, async () => {
      const updated = await users.setActive(target.id, active, actorOf(auth));
      const ownSessionClosed = closeSessions(auth, target, updated);
      logger.info(active ? 'admin_user_reactivated' : 'admin_user_deactivated', { userId: target.id, by: auth.user.id });
      send(ctx, userWriteResponseSchema, { user: dto(updated), meta: { ownSessionClosed } });
    });
  }

  return Object.freeze<UserRoutes>({
    async list(ctx) {
      await access.adminOnly(ctx, { write: false });
      send(ctx, userListResponseSchema, { users: (await users.list()).map(dto) });
    },

    async create(ctx) {
      const auth = await access.adminOnly(ctx, { write: true });
      const body = await closedBody(ctx, CREATE_FIELDS, USER_BODY_LIMIT);
      if (!body) return;
      const { data, errors } = userDataOf(body);
      const allErrors: Record<string, string> = { ...errors, ...validatePasswordPair(body.password, body.passwordConfirmation) };
      if (!data || Object.keys(allErrors).length > 0) return validationFailed(ctx, allErrors);
      const passwordHash = await hash(body.password);
      await run(ctx, async () => {
        const created = await users.create({ ...data, passwordHash }, actorOf(auth));
        logger.info('admin_user_created', { userId: created.id, role: created.role, by: auth.user.id });
        send(ctx, userResponseSchema, { user: dto(created) }, 201);
      });
    },

    async get(ctx) {
      await access.adminOnly(ctx, { write: false });
      send(ctx, userResponseSchema, { user: dto(await targetOf(ctx)) });
    },

    async update(ctx) {
      const auth = await access.adminOnly(ctx, { write: true });
      const target = await targetOf(ctx);
      const body = await closedBody(ctx, USER_FIELDS, USER_BODY_LIMIT);
      if (!body) return;
      const { data, errors } = userDataOf(body);
      if (!data) return validationFailed(ctx, errors);
      await run(ctx, async () => {
        const updated = await users.update(target.id, data, actorOf(auth));
        const ownSessionClosed = closeSessions(auth, target, updated);
        logger.info('admin_user_updated', { userId: target.id, by: auth.user.id });
        send(ctx, userWriteResponseSchema, { user: dto(updated), meta: { ownSessionClosed } });
      });
    },

    deactivate: (ctx) => changeStatus(ctx, false),
    reactivate: (ctx) => changeStatus(ctx, true),

    async resetPassword(ctx) {
      const auth = await access.adminOnly(ctx, { write: true });
      const target = await targetOf(ctx);
      const body = await closedBody(ctx, PASSWORD_FIELDS, USER_BODY_LIMIT);
      if (!body) return;
      const errors = validatePasswordPair(body.password, body.passwordConfirmation);
      if (Object.keys(errors).length > 0) return validationFailed(ctx, errors);
      const passwordHash = await hash(body.password);
      await run(ctx, async () => {
        const updated = await users.setPassword(target.id, passwordHash, actorOf(auth), 'password_reset');
        const ownSessionClosed = closeSessions(auth, target, updated);
        logger.info('admin_user_password_reset', { userId: target.id, by: auth.user.id });
        send(ctx, userWriteResponseSchema, { user: dto(updated), meta: { ownSessionClosed } });
      });
    },
  });
}
