/**
 * Límite de intentos de acceso por origen (IP), P-3: 5 fallos bloquean 15 minutos.
 * En memoria (una sola instancia). Los fallos sin bloqueo caducan tras la misma ventana.
 */

export const MAX_FAILURES = 5;
export const LOCK_MS = 15 * 60 * 1000;
export const MAX_TRACKED = 1000;

export interface LoginThrottle {
  status(origin: string): { locked: boolean; retryAfterSeconds: number };
  recordFailure(origin: string): boolean;
  recordSuccess(origin: string): void;
}

interface ThrottleEntry {
  failures: number;
  firstFailure: number;
  lockedUntil: number;
}

export function createLoginThrottle({
  now = () => new Date(),
  maxFailures = MAX_FAILURES,
  lockMs = LOCK_MS,
  maxTracked = MAX_TRACKED,
}: { now?: () => Date; maxFailures?: number; lockMs?: number; maxTracked?: number } = {}): LoginThrottle {
  const entries = new Map<string, ThrottleEntry>();
  const timestamp = () => now().getTime();

  function current(origin: string): ThrottleEntry | null {
    const entry = entries.get(origin);
    if (!entry) return null;
    const time = timestamp();
    const expired = entry.lockedUntil > 0 ? entry.lockedUntil <= time : entry.firstFailure + lockMs <= time;
    if (expired) {
      entries.delete(origin);
      return null;
    }
    return entry;
  }

  return Object.freeze({
    status(origin: string) {
      const entry = current(origin);
      if (!entry || entry.lockedUntil === 0) return { locked: false, retryAfterSeconds: 0 };
      return { locked: true, retryAfterSeconds: Math.ceil((entry.lockedUntil - timestamp()) / 1000) };
    },

    /** Registra un fallo; devuelve true si con él queda bloqueado. */
    recordFailure(origin: string) {
      let entry = current(origin);
      if (!entry) {
        // Con el tope alcanzado hay al menos una entrada: la primera clave es la más antigua.
        if (entries.size >= maxTracked) entries.delete(entries.keys().next().value as string);
        entry = { failures: 0, firstFailure: timestamp(), lockedUntil: 0 };
        entries.set(origin, entry);
      }
      entry.failures += 1;
      if (entry.failures >= maxFailures) entry.lockedUntil = timestamp() + lockMs;
      return entry.lockedUntil > 0;
    },

    recordSuccess(origin: string) {
      entries.delete(origin);
    },
  });
}
