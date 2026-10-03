/**
 * Límite de intentos de acceso por origen (IP), P-3: 5 fallos bloquean 15 minutos.
 * En memoria (una sola instancia). Los fallos sin bloqueo caducan tras la misma ventana.
 */

export const MAX_FAILURES = 5;
export const LOCK_MS = 15 * 60 * 1000;
export const MAX_TRACKED = 1000;

/**
 * @param {{ now?: () => Date, maxFailures?: number, lockMs?: number, maxTracked?: number }} [options]
 */
export function createLoginThrottle({
  now = () => new Date(),
  maxFailures = MAX_FAILURES,
  lockMs = LOCK_MS,
  maxTracked = MAX_TRACKED,
} = {}) {
  /** @type {Map<string, { failures: number, firstFailure: number, lockedUntil: number }>} */
  const entries = new Map();
  const timestamp = () => now().getTime();

  function current(origin) {
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
    /** @returns {{ locked: boolean, retryAfterSeconds: number }} */
    status(origin) {
      const entry = current(origin);
      if (!entry || entry.lockedUntil === 0) return { locked: false, retryAfterSeconds: 0 };
      return { locked: true, retryAfterSeconds: Math.ceil((entry.lockedUntil - timestamp()) / 1000) };
    },

    /** Registra un fallo; devuelve true si con él queda bloqueado. */
    recordFailure(origin) {
      let entry = current(origin);
      if (!entry) {
        if (entries.size >= maxTracked) entries.delete(entries.keys().next().value);
        entry = { failures: 0, firstFailure: timestamp(), lockedUntil: 0 };
        entries.set(origin, entry);
      }
      entry.failures += 1;
      if (entry.failures >= maxFailures) entry.lockedUntil = timestamp() + lockMs;
      return entry.lockedUntil > 0;
    },

    recordSuccess(origin) {
      entries.delete(origin);
    },
  });
}
