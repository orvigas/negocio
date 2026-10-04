import { randomBytes } from 'node:crypto';

/**
 * Sesiones de administración en memoria (una sola instancia, RT-2).
 * - Id opaco aleatorio de 256 bits: no hace falta firmarlo, se valida contra este almacén.
 * - Caducidad por inactividad de 2 horas (P-3), renovada en cada petición autenticada.
 * - Un token CSRF por sesión.
 * - Tope de sesiones simultáneas: al superarlo se descarta la menos reciente.
 */

export const SESSION_IDLE_MS = 2 * 60 * 60 * 1000;
export const MAX_SESSIONS = 50;

const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const newToken = () => randomBytes(32).toString('base64url');

export interface SessionInfo {
  id: string;
  csrfToken: string;
}

export interface SessionStore {
  create(): SessionInfo;
  touch(id: unknown): SessionInfo | null;
  destroy(id: string): void;
  readonly size: number;
}

export function createSessionStore({
  now = () => new Date(),
  idleMs = SESSION_IDLE_MS,
  maxSessions = MAX_SESSIONS,
}: { now?: () => Date; idleMs?: number; maxSessions?: number } = {}): SessionStore {
  const sessions = new Map<string, { csrfToken: string; lastSeen: number }>();
  const timestamp = () => now().getTime();

  function sweep() {
    const limit = timestamp() - idleMs;
    for (const [id, session] of sessions) if (session.lastSeen <= limit) sessions.delete(id);
  }

  return Object.freeze({
    /** Crea una sesión nueva (siempre un id nuevo: evita la fijación de sesión). */
    create() {
      sweep();
      // Con el tope alcanzado hay al menos una sesión: la primera clave es la menos reciente.
      while (sessions.size >= maxSessions) sessions.delete(sessions.keys().next().value as string);
      const id = newToken();
      const session = { csrfToken: newToken(), lastSeen: timestamp() };
      sessions.set(id, session);
      return { id, csrfToken: session.csrfToken };
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
      return { id, csrfToken: session.csrfToken };
    },

    destroy(id: string) {
      sessions.delete(id);
    },

    get size() {
      return sessions.size;
    },
  });
}
