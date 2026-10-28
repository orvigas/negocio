import { setTimeout as sleepTimer } from 'node:timers/promises';

import type { Freshness } from '@restaurante/contracts';
import { silentLogger, type BusinessId, type Logger } from '@restaurante/core/shared';

/**
 * Aviso interno a landing-pages tras cada escritura confirmada de productos (REQ-F-039, RF-12 a
 * RF-14). `POST <LANDING_INTERNAL_URL>/internal/v1/productos-cambiados` con `{ business }` y la
 * credencial compartida en `Authorization: Bearer <INTERNAL_NOTIFY_TOKEN>`. landing-pages invalida la
 * caché de la landing, recarga el catálogo del bot y responde `{ landing, bot }`.
 *
 * - La escritura espera como mucho `firstWaitMs` (2 s) al primer intento para decir la verdad sobre
 *   la frescura: `confirmed` solo si landing-pages confirmó la landing y el bot; si no, `pending`.
 * - Un fallo nunca afecta a la escritura: se registra (`products_notify_failed`) y se reintenta en
 *   segundo plano tras 1 s, 5 s y 30 s; al agotarlos, `products_notify_gave_up` y queda la red de
 *   seguridad de 60 s (caché de las landings y recarga del bot).
 * - Una escritura del mismo negocio con un intento en vuelo o reintentos pendientes no lanza un aviso
 *   en paralelo: la cubre el siguiente intento que empiece después de ella (el aviso solo lleva el
 *   negocio). Si el intento en vuelo termina bien, se lanza uno nuevo para ella (DEF-001 de QA).
 * - Un 4xx (credencial rechazada, configuración errónea) no se reintenta.
 * - El token nunca va al log.
 */

export const NOTIFY_PATH = '/internal/v1/productos-cambiados';
export const NOTIFY_DEFAULTS = Object.freeze({ firstWaitMs: 2000, timeoutMs: 1500, retryDelaysMs: [1000, 5000, 30_000] as readonly number[] });

export type NotifyFetch = (input: string, init: RequestInit) => Promise<Response>;

export interface LandingNotifier {
  /** Avisa del cambio de un negocio y dice si la landing y el bot ya lo tienen. Nunca lanza. */
  notify(business: BusinessId): Promise<Freshness>;
}

export interface LandingNotifierOptions {
  /** Base del puerto interno de landing-pages (p. ej. http://app:3002). Sin ella no se avisa. */
  url?: string | undefined;
  token?: string | undefined;
  fetch?: NotifyFetch;
  logger?: Logger;
  firstWaitMs?: number;
  timeoutMs?: number;
  retryDelaysMs?: readonly number[];
  /** Espera (inyectable en las pruebas); por defecto, un temporizador que no retiene el proceso. */
  sleep?: (ms: number) => Promise<void>;
}

type Attempt = { kind: 'confirmed' } | { kind: 'delivered' } | { kind: 'retry'; reason: string; status?: number } | { kind: 'rejected'; status: number };

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

export function createLandingNotifier({
  url,
  token,
  fetch = (input, init) => globalThis.fetch(input, init),
  logger = silentLogger,
  firstWaitMs = NOTIFY_DEFAULTS.firstWaitMs,
  timeoutMs = NOTIFY_DEFAULTS.timeoutMs,
  retryDelaysMs = NOTIFY_DEFAULTS.retryDelaysMs,
  sleep = (ms) => sleepTimer(ms, undefined, { ref: false }),
}: LandingNotifierOptions = {}): LandingNotifier {
  const endpoint = url ? new URL(NOTIFY_PATH, url).toString() : null;

  async function attempt(business: BusinessId): Promise<Attempt> {
    let response: Response;
    try {
      response = await fetch(endpoint as string, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${String(token)}` },
        body: JSON.stringify({ business }),
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      return { kind: 'retry', reason: name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'network' };
    }
    if (response.status >= 500) {
      await response.body?.cancel();
      return { kind: 'retry', reason: 'http_status', status: response.status };
    }
    if (response.status !== 200) {
      await response.body?.cancel();
      return { kind: 'rejected', status: response.status };
    }
    const body: unknown = await response.json().catch(() => null);
    return isRecord(body) && body.landing === true && body.bot === true ? { kind: 'confirmed' } : { kind: 'delivered' };
  }

  /**
   * Avisos pendientes por negocio (DEF-001 de QA): cada escritura espera el resultado del primer
   * intento que empiece después de ella. Si llega mientras hay un intento en vuelo, queda en espera y
   * la cubre el siguiente intento (un reintento o, si el intento en vuelo terminó, uno nuevo). Así su
   * `freshness` es veraz y el cambio no depende de la recarga de 60 s.
   */
  const waiting = new Map<BusinessId, ((result: Attempt) => void)[]>();
  const running = new Set<BusinessId>();

  async function loop(business: BusinessId): Promise<void> {
    running.add(business);
    try {
      let index = 0;
      for (;;) {
        const batch = waiting.get(business) ?? [];
        waiting.set(business, []);
        const result = await attempt(business);
        for (const resolve of batch) resolve(result);
        const pending = (waiting.get(business) ?? []).length > 0;
        if (result.kind === 'retry') {
          logger.warn('products_notify_failed', { business, attempt: index + 1, reason: result.reason, ...(result.status === undefined ? {} : { status: result.status }) });
          const delay = retryDelaysMs[index];
          if (delay === undefined) {
            logger.error('products_notify_gave_up', { business, attempts: index + 1 });
            // Las escrituras que esperaban otro intento quedan pendientes: red de seguridad de 60 s.
            for (const resolve of waiting.get(business) ?? []) resolve(result);
            waiting.set(business, []);
            return;
          }
          await sleep(delay);
          index += 1;
          continue;
        }
        if (result.kind === 'rejected') logger.error('products_notify_failed', { business, attempt: index + 1, reason: 'rejected', status: result.status });
        else if (index > 0) logger.info('products_notify_recovered', { business, attempt: index + 1 });
        // Escrituras llegadas durante el intento: otro aviso, con su propia cuenta de reintentos.
        if (!pending) return;
        index = 0;
      }
    } finally {
      running.delete(business);
    }
  }

  return Object.freeze<LandingNotifier>({
    async notify(business) {
      if (!endpoint || !token) return 'pending';
      const next = new Promise<Attempt>((resolve) => {
        waiting.set(business, [...(waiting.get(business) ?? []), resolve]);
      });
      if (!running.has(business)) {
        // Observación de QA (PR 1): un fallo inesperado del bucle nunca queda como rechazo sin manejar.
        loop(business).catch((err: unknown) => logger.error('products_notify_loop_failed', { business, name: err instanceof Error ? err.name : 'unknown' }));
      }
      const result = await Promise.race([next, sleep(firstWaitMs).then(() => null)]);
      return result?.kind === 'confirmed' ? 'confirmed' : 'pending';
    },
  });
}
