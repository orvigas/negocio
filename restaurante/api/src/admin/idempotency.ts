import { createHash } from 'node:crypto';

/**
 * Altas idempotentes (REQ-F-039, caso límite "doble envío"): el formulario del admin lleva una clave
 * aleatoria (`Idempotency-Key`) y, si la misma clave del mismo usuario en el mismo ámbito (el negocio,
 * DEF-002 de QA) se repite con el mismo cuerpo, la API devuelve el resultado del primer envío sin
 * crear otro producto. Con otro cuerpo, `IdempotencyKeyReusedError` (la API responde 422, como
 * recomienda el borrador IETF "The Idempotency-Key HTTP Header Field"): nunca se devuelve un
 * resultado que no corresponde a lo enviado. En memoria (una sola instancia, como las
 * sesiones): 10 minutos y como mucho 500 claves; un envío en curso se comparte (la promesa).
 * Si el primer envío falla, la clave se olvida y se puede volver a intentar.
 */

export const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;
export const IDEMPOTENCY_MAX_KEYS = 500;

/** La clave ya se usó con otro cuerpo. */
export class IdempotencyKeyReusedError extends Error {
  constructor() {
    super('La clave de idempotencia ya se usó con otros datos');
    this.name = 'IdempotencyKeyReusedError';
  }
}

/** Huella del cuerpo recibido (JSON tal como llegó, ya parseado). */
export const fingerprintOf = (body: unknown): string => createHash('sha256').update(JSON.stringify(body) ?? '').digest('base64url');

export interface IdempotencyRequest {
  userId: number;
  /** Ámbito de la clave (el negocio). */
  scope: string;
  key: string;
  fingerprint: string;
}

export interface IdempotencyStore<T> {
  /** Ejecuta `task` una sola vez por (usuario, ámbito, clave) mientras dure la ventana. */
  run(request: IdempotencyRequest, task: () => Promise<T>): Promise<{ value: T; replayed: boolean }>;
}

interface Entry<T> {
  promise: Promise<T>;
  fingerprint: string;
  at: number;
}

export function createIdempotencyStore<T>({
  now = () => Date.now(),
  ttlMs = IDEMPOTENCY_TTL_MS,
  maxKeys = IDEMPOTENCY_MAX_KEYS,
}: { now?: () => number; ttlMs?: number; maxKeys?: number } = {}): IdempotencyStore<T> {
  const entries = new Map<string, Entry<T>>();

  function sweep(time: number): void {
    for (const [key, entry] of entries) if (time - entry.at >= ttlMs) entries.delete(key);
  }

  return Object.freeze({
    async run({ userId, scope, key, fingerprint }: IdempotencyRequest, task: () => Promise<T>) {
      const time = now();
      sweep(time);
      const id = JSON.stringify([userId, scope, key]);
      const existing = entries.get(id);
      if (existing) {
        if (existing.fingerprint !== fingerprint) throw new IdempotencyKeyReusedError();
        return { value: await existing.promise, replayed: true };
      }
      // Con el tope alcanzado hay al menos una entrada: la primera clave es la más antigua.
      while (entries.size >= maxKeys) entries.delete(entries.keys().next().value as string);
      const promise = task();
      entries.set(id, { promise, fingerprint, at: time });
      try {
        return { value: await promise, replayed: false };
      } catch (err) {
        if (entries.get(id)?.promise === promise) entries.delete(id);
        throw err;
      }
    },
  });
}
