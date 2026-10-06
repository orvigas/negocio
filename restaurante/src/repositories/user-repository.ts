import { BUSINESS_IDS, type BusinessId } from '../config/businesses.ts';
import type { Database } from '../db/client.ts';
import { isUniqueViolation, toUnavailable } from '../db/errors.ts';
import type { Prisma } from '../generated/prisma/client.ts';
import { isRole, usernameKey, type Role, type UserData } from '../services/user-schema.ts';

/**
 * Usuarios de /admin sobre Prisma/SQLite (REQ-F-007).
 *
 * Concentra las reglas que deben cumplirse dentro de una transacción:
 * - D-7: siempre queda al menos un administrador activo (se escribe y se comprueba en la misma
 *   transacción; si no queda ninguno, se revierte). Correcto también frente al comando de consola,
 *   porque SQLite tiene un único escritor.
 * - D-8 (DT-7): desactivar, cambiar rol o negocios y cambiar la contraseña incrementan
 *   `sessionVersion`, que invalida las sesiones abiertas de ese usuario.
 * - D-12 (DT-16): cada operación deja su entrada en `user_audit`, sin contraseñas ni hashes.
 * - D-6: los usuarios no se eliminan.
 *
 * Cualquier error inesperado de la base de datos se convierte en DatabaseUnavailableError (503).
 */

export interface UserRecord {
  id: number;
  username: string;
  displayName: string;
  role: Role;
  active: boolean;
  sessionVersion: number;
  /** Negocios asignados (editor). El administrador tiene todos: ver services/authorization.ts. */
  businesses: BusinessId[];
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

export type Actor = { kind: 'user'; id: number } | { kind: 'console' } | { kind: 'system' };

export const AUDIT_ACTIONS = Object.freeze({
  BOOTSTRAP: 'bootstrap',
  CREATE: 'create',
  UPDATE: 'update',
  DEACTIVATE: 'deactivate',
  REACTIVATE: 'reactivate',
  PASSWORD_RESET: 'password_reset',
  PASSWORD_CHANGE: 'password_change',
  CONSOLE_RECOVERY: 'console_recovery',
});
export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

/** Usuario de acceso ya usado por otra cuenta (sin distinguir mayúsculas). */
export class UsernameTakenError extends Error {
  constructor() {
    super('El usuario ya existe');
    this.name = 'UsernameTakenError';
  }
}

/** La operación dejaría sin administradores activos (D-7). */
export class LastAdminError extends Error {
  constructor() {
    super('Debe quedar al menos un administrador activo');
    this.name = 'LastAdminError';
  }
}

export class UserNotFoundError extends Error {
  constructor() {
    super('Usuario no encontrado');
    this.name = 'UserNotFoundError';
  }
}

const DOMAIN_ERRORS = [UsernameTakenError, LastAdminError, UserNotFoundError];

export interface UserRepository {
  hasUsers(): Promise<boolean>;
  findById(id: number): Promise<UserRecord | null>;
  /** Para el acceso: usuario y hash por usuario de acceso (sin distinguir mayúsculas). */
  findCredentials(username: string): Promise<{ user: UserRecord; passwordHash: string } | null>;
  /** Hash de un usuario (cambio de la propia contraseña). */
  findPasswordHash(id: number): Promise<string | null>;
  list(): Promise<UserRecord[]>;
  create(data: UserData & { passwordHash: string }, actor: Actor): Promise<UserRecord>;
  update(id: number, data: UserData, actor: Actor): Promise<UserRecord>;
  setActive(id: number, active: boolean, actor: Actor): Promise<UserRecord>;
  setPassword(id: number, passwordHash: string, actor: Actor, action: 'password_reset' | 'password_change'): Promise<UserRecord>;
  recordLogin(id: number, at: Date): Promise<void>;
  /** Primer administrador (D-4): solo si no hay ningún usuario. Devuelve null si ya había usuarios. */
  bootstrap(data: { username: string; passwordHash: string }): Promise<UserRecord | null>;
  /** Recuperación por consola (D-5): crea un administrador o reactiva/promueve uno existente. */
  recover(data: { username: string; passwordHash: string }): Promise<{ user: UserRecord; created: boolean }>;
}

const USER_INCLUDE = { businesses: { select: { business: true } } } as const;
type UserRow = Prisma.UserGetPayload<{ include: typeof USER_INCLUDE }>;
type Tx = Prisma.TransactionClient;

function toRecord(row: UserRow): UserRecord {
  // La columna `role` es un enum de Prisma ('admin' | 'editor'); se comprueba por si se editó a mano.
  if (!isRole(row.role)) throw new Error('Rol desconocido en la base de datos');
  const assigned = new Set(row.businesses.map((entry) => entry.business));
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    role: row.role,
    active: row.active,
    sessionVersion: row.sessionVersion,
    businesses: BUSINESS_IDS.filter((businessId) => assigned.has(businessId)),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastLoginAt: row.lastLoginAt,
  };
}

const actorFields = (actor: Actor) => ({
  actorId: actor.kind === 'user' ? actor.id : null,
  actorKind: actor.kind,
});

type Changes = Record<string, { from: unknown; to: unknown }>;

function diffUser(before: UserRecord, after: UserData): Changes {
  const changes: Changes = {};
  const compare = (field: string, from: unknown, to: unknown) => {
    if (JSON.stringify(from) !== JSON.stringify(to)) changes[field] = { from, to };
  };
  compare('username', before.username, after.username);
  compare('displayName', before.displayName, after.displayName);
  compare('role', before.role, after.role);
  compare('businesses', before.businesses, after.role === 'admin' ? [] : after.businesses);
  return changes;
}

/** Valores iniciales de un usuario creado (sin contraseña ni hash). */
function creationChanges(user: UserRecord): Changes {
  return {
    username: { from: null, to: user.username },
    displayName: { from: null, to: user.displayName },
    role: { from: null, to: user.role },
    businesses: { from: null, to: user.businesses },
  };
}

async function audit(tx: Tx, action: AuditAction, actor: Actor, targetId: number, changes?: Changes): Promise<void> {
  await tx.userAudit.create({
    data: {
      action,
      ...actorFields(actor),
      targetId,
      changes: changes && Object.keys(changes).length > 0 ? JSON.stringify(changes) : null,
    },
  });
}

/** D-7: si tras la escritura no queda ningún administrador activo, revierte la transacción. */
async function assertActiveAdmin(tx: Tx): Promise<void> {
  const admins = await tx.user.count({ where: { role: 'admin', active: true } });
  if (admins === 0) throw new LastAdminError();
}

export function createUserRepository({ prisma, now = () => new Date() }: { prisma: Database; now?: () => Date }): UserRepository {
  if (!prisma) throw new TypeError('createUserRepository requiere el cliente de la base de datos');

  /** Ejecuta una operación y traduce los errores (P2002 -> UsernameTakenError; inesperados -> 503). */
  async function run<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (err) {
      if (DOMAIN_ERRORS.some((ErrorClass) => err instanceof ErrorClass)) throw err;
      if (isUniqueViolation(err)) throw new UsernameTakenError();
      throw toUnavailable(err);
    }
  }

  async function load(tx: Tx, id: number): Promise<UserRecord> {
    const row = await tx.user.findUnique({ where: { id }, include: USER_INCLUDE });
    if (!row) throw new UserNotFoundError();
    return toRecord(row);
  }

  async function createUser(tx: Tx, data: UserData & { passwordHash: string }): Promise<UserRecord> {
    const row = await tx.user.create({
      data: {
        username: data.username,
        usernameKey: usernameKey(data.username),
        displayName: data.displayName,
        role: data.role,
        passwordHash: data.passwordHash,
        updatedAt: now(),
        createdAt: now(),
        businesses: { create: data.role === 'admin' ? [] : data.businesses.map((business) => ({ business })) },
      },
      include: USER_INCLUDE,
    });
    return toRecord(row);
  }

  return Object.freeze<UserRepository>({
    hasUsers: () => run(async () => (await prisma.user.count()) > 0),

    findById: (id) =>
      run(async () => {
        const row = await prisma.user.findUnique({ where: { id }, include: USER_INCLUDE });
        return row ? toRecord(row) : null;
      }),

    findCredentials: (username) =>
      run(async () => {
        const row = await prisma.user.findUnique({ where: { usernameKey: usernameKey(username) }, include: USER_INCLUDE });
        return row ? { user: toRecord(row), passwordHash: row.passwordHash } : null;
      }),

    findPasswordHash: (id) =>
      run(async () => (await prisma.user.findUnique({ where: { id }, select: { passwordHash: true } }))?.passwordHash ?? null),

    list: () =>
      run(async () => {
        const rows = await prisma.user.findMany({ include: USER_INCLUDE, orderBy: [{ active: 'desc' }, { usernameKey: 'asc' }] });
        return rows.map(toRecord);
      }),

    create: (data, actor) =>
      run(() =>
        prisma.$transaction(async (tx) => {
          const user = await createUser(tx, data);
          await audit(tx, AUDIT_ACTIONS.CREATE, actor, user.id, creationChanges(user));
          return user;
        }),
      ),

    update: (id, data, actor) =>
      run(() =>
        prisma.$transaction(async (tx) => {
          const before = await load(tx, id);
          const changes = diffUser(before, data);
          // D-8: cambiar el rol o los negocios cierra las sesiones del usuario.
          const closesSessions = 'role' in changes || 'businesses' in changes;
          await tx.user.update({
            where: { id },
            data: {
              username: data.username,
              usernameKey: usernameKey(data.username),
              displayName: data.displayName,
              role: data.role,
              updatedAt: now(),
              ...(closesSessions ? { sessionVersion: { increment: 1 } } : {}),
            },
          });
          if ('businesses' in changes) {
            await tx.userBusiness.deleteMany({ where: { userId: id } });
            if (data.role === 'editor') {
              await tx.userBusiness.createMany({ data: data.businesses.map((business) => ({ userId: id, business })) });
            }
          }
          await assertActiveAdmin(tx);
          if (Object.keys(changes).length > 0) await audit(tx, AUDIT_ACTIONS.UPDATE, actor, id, changes);
          return load(tx, id);
        }),
      ),

    setActive: (id, active, actor) =>
      run(() =>
        prisma.$transaction(async (tx) => {
          const before = await load(tx, id);
          if (before.active === active) return before;
          await tx.user.update({
            where: { id },
            // D-8: desactivar cierra sus sesiones (reactivar no hace falta, pero mantiene la regla simple).
            data: { active, updatedAt: now(), sessionVersion: { increment: 1 } },
          });
          await assertActiveAdmin(tx);
          await audit(tx, active ? AUDIT_ACTIONS.REACTIVATE : AUDIT_ACTIONS.DEACTIVATE, actor, id, {
            active: { from: before.active, to: active },
          });
          return load(tx, id);
        }),
      ),

    setPassword: (id, passwordHash, actor, action) =>
      run(() =>
        prisma.$transaction(async (tx) => {
          await load(tx, id);
          await tx.user.update({ where: { id }, data: { passwordHash, updatedAt: now(), sessionVersion: { increment: 1 } } });
          await audit(tx, action, actor, id);
          return load(tx, id);
        }),
      ),

    recordLogin: (id, at) =>
      run(async () => {
        await prisma.user.update({ where: { id }, data: { lastLoginAt: at } });
      }),

    bootstrap: ({ username, passwordHash }) =>
      run(() =>
        prisma.$transaction(async (tx) => {
          if ((await tx.user.count()) > 0) return null;
          const user = await createUser(tx, { username, displayName: username, role: 'admin', businesses: [], passwordHash });
          await audit(tx, AUDIT_ACTIONS.BOOTSTRAP, { kind: 'system' }, user.id);
          return user;
        }),
      ),

    recover: ({ username, passwordHash }) =>
      run(() =>
        prisma.$transaction(async (tx) => {
          const existing = await tx.user.findUnique({ where: { usernameKey: usernameKey(username) }, include: USER_INCLUDE });
          const actor: Actor = { kind: 'console' };
          if (!existing) {
            const user = await createUser(tx, { username, displayName: username, role: 'admin', businesses: [], passwordHash });
            await audit(tx, AUDIT_ACTIONS.CONSOLE_RECOVERY, actor, user.id, { created: { from: false, to: true } });
            return { user, created: true };
          }
          const before = toRecord(existing);
          await tx.user.update({
            where: { id: before.id },
            data: { role: 'admin', active: true, passwordHash, updatedAt: now(), sessionVersion: { increment: 1 } },
          });
          await tx.userBusiness.deleteMany({ where: { userId: before.id } });
          const changes: Changes = {};
          if (before.role !== 'admin') changes.role = { from: before.role, to: 'admin' };
          if (before.businesses.length > 0) changes.businesses = { from: before.businesses, to: [] };
          if (!before.active) changes.active = { from: false, to: true };
          await audit(tx, AUDIT_ACTIONS.CONSOLE_RECOVERY, actor, before.id, changes);
          return { user: await load(tx, before.id), created: false };
        }),
      ),
  });
}
