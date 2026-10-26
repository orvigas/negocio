import { randomBytes } from 'node:crypto';

/**
 * Sesiones de administración en memoria (una sola instancia, RT-2).
 * - Id opaco aleatorio de 256 bits: no hace falta firmarlo, se valida contra este almacén.
 * - Caducidad por inactividad de 2 horas (P-3), renovada en cada petición autenticada.
 * - Un token CSRF por sesión.
 * - Tope de sesiones simultáneas: al superarlo se descarta la menos reciente.
 * - Cada sesión pertenece a un usuario y recuerda su `sessionVersion` al entrar (REQ-F-007,
 *   DT-7): si en la base de datos cambia, la sesión deja de valer (lo comprueba el guard).
 */

export const SESSION_IDLE_MS = 2 * 60 * 60 * 1000;
export const MAX_SESSIONS = 50;

const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const newToken = () => randomBytes(32).toString('base64url');

export interface SessionOwner {
  userId: number;
  sessionVersion: number;
}

export interface SessionInfo extends SessionOwner {
  id: string;
  csrfToken: string;
}

export interface SessionStore {
  create(owner: SessionOwner): SessionInfo;
  touch(id: unknown): SessionInfo | null;
  destroy(id: string): void;
  /** Cierra todas las sesiones de un usuario, salvo `exceptId`. */
  destroyUser(userId: number, exceptId?: string): void;
  readonly size: number;
}

interface StoredSession extends SessionOwner {
  csrfToken: string;
  lastSeen: number;
}

export function createSessionStore({
  now = () => new Date(),
  idleMs = SESSION_IDLE_MS,
  maxSessions = MAX_SESSIONS,
}: { now?: () => Date; idleMs?: number; maxSessions?: number } = {}): SessionStore {
  const sessions = new Map<string, StoredSession>();
  const timestamp = () => now().getTime();

  function sweep() {
    const limit = timestamp() - idleMs;
    for (const [id, session] of sessions) if (session.lastSeen <= limit) sessions.delete(id);
  }

  return Object.freeze({
    /** Crea una sesión nueva (siempre un id nuevo: evita la fijación de sesión). */
    create({ userId, sessionVersion }: SessionOwner) {
      sweep();
      // Con el tope alcanzado hay al menos una sesión: la primera clave es la menos reciente.
      while (sessions.size >= maxSessions) sessions.delete(sessions.keys().next().value as string);
      const id = newToken();
      const session: StoredSession = { csrfToken: newToken(), lastSeen: timestamp(), userId, sessionVersion };
      sessions.set(id, session);
      return { id, csrfToken: session.csrfToken, userId, sessionVersion };
    },

    /** Devuelve la sesión vigente y renueva su actividad, o null si no existe o caducó. */
    touch(id: unknown) {
      if (typeof id !== 'string' || !SESSION_ID_PATTERN.test(id)) return null;
      const session = sessions.get(id);
      if (!session) return null;
      if (timestamp() - session.lastSeen >= idleMs) {
        sessions.delete(id);
        return null;
      }
      session.lastSeen = timestamp();
      // Reinsertar mantiene el orden por actividad para el descarte por tope.
      sessions.delete(id);
      sessions.set(id, session);
      return { id, csrfToken: session.csrfToken, userId: session.userId, sessionVersion: session.sessionVersion };
    },

    destroy(id: string) {
      sessions.delete(id);
    },

    destroyUser(userId: number, exceptId?: string) {
      for (const [id, session] of sessions) if (session.userId === userId && id !== exceptId) sessions.delete(id);
    },

    get size() {
      return sessions.size;
    },
  });
}
