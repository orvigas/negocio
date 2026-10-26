import type { BusinessId } from '../shared/index.ts';
import type { Role, UserData } from './user-schema.ts';

/**
 * Contrato del repositorio de usuarios de /admin (REQ-F-007 y REQ-F-014): tipos, acciones de
 * auditoría y errores de dominio. La implementación Prisma está en packages/db (REQ-F-037).
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
