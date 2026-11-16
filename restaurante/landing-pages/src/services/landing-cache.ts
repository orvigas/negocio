import type { PublicApiFailure, PublicApiFetched } from '@restaurante/contracts';
import { BUSINESS_IDS, errorProp, silentLogger, type BusinessId, type Logger } from '@restaurante/core/shared';

/**
 * Caché de un recurso de la API propia para las landings (REQ-F-038, RF-4 a RF-6; REQ-F-044, RF-5).
 * La usan los productos (landing-products.ts) y los datos de página (landing-page.ts). Código de las
 * landings: no lee la base de datos ni un repositorio, solo el cliente de contracts.
 *
 * Preferencia (RN-3): datos frescos de la API -> última copia buena en memoria -> semilla. `get` nunca
 * lanza: un fallo de la API no produce un 5xx (RF-5).
 *
 * - Fresco (cargado en la generación vigente y con menos de `ttlMs`): se sirve sin E/S.
 * - Invalidado (una escritura subió la generación; RF-6): la visita espera el refresco (como mucho el
 *   límite del cliente) y ve el cambio "al instante". Un vuelo iniciado antes de la invalidación no
 *   cuenta: puede haber leído antes del commit.
 * - TTL vencido o en fallo: se sirve lo que hay y se refresca en segundo plano
 *   (stale-while-revalidate), como mucho cada `retryMs` mientras la API falle.
 * - Un vuelo por negocio y generación: las visitas simultáneas comparten la misma petición.
 * - Un fallo nunca sustituye una copia buena; la semilla nunca se marca como fresca.
 * - Log sin URL ni datos, con los nombres de cada recurso (`names`): cargado, respaldo (primer fallo de
 *   una racha y, después, como mucho uno cada `logEveryMs`), recuperado y fallo inesperado.
 */

export const LANDING_CACHE_DEFAULTS = Object.freeze({ timeoutMs: 1500, ttlMs: 60_000, retryMs: 5_000, logEveryMs: 60_000 });

export type ByBusiness = { [Id in BusinessId]: unknown };

export interface LandingCache<Data extends ByBusiness> {
  /** Primera carga de los dos negocios al arrancar; nunca falla (sin API se queda la semilla). */
  warmUp(): Promise<void>;
  get<Id extends BusinessId>(business: Id): Promise<Data[Id]>;
  /** Marca los datos del negocio como viejos: la siguiente visita espera los nuevos. */
  invalidate(business: BusinessId): void;
  /**
   * Espera (como mucho el límite del cliente) a que la caché tenga los datos vigentes del negocio y
   * dice si los tiene: false si la API no respondió bien (DEF-003 de REQ-F-038).
   */
  confirmFresh(business: BusinessId): Promise<boolean>;
}

/** Nombres de los eventos de log de un recurso (cada envoltorio conserva los suyos). */
export interface LandingCacheLogNames {
  loaded: string;
  fallback: string;
  recovered: string;
  refreshFailed: string;
}

export interface LandingCacheOptions<Data extends ByBusiness> {
  load: <Id extends BusinessId>(business: Id) => Promise<PublicApiFetched<Data[Id]>>;
  seeds: Data;
  names: LandingCacheLogNames;
  logger?: Logger;
  /** Reloj en milisegundos (inyectable en las pruebas). */
  now?: () => number;
  ttlMs?: number;
  retryMs?: number;
  logEveryMs?: number;
}

interface Entry {
  /** Datos del negocio de la entrada (`Data[negocio]`). */
  data: unknown;
  /** Sube con cada invalidación. */
  generation: number;
  /** Generación de los datos servidos (-1: aún no llegó nada de la API). */
  loadedGeneration: number;
  loadedAt: number;
  failedAt: number | null;
  failedGeneration: number;
  failures: number;
  lastLogAt: number | null;
  inflight: { generation: number; promise: Promise<void> } | null;
}

export function createLandingCache<Data extends ByBusiness>({
  load: fetchData,
  seeds,
  names,
  logger = silentLogger,
  now = () => Date.now(),
  ttlMs = LANDING_CACHE_DEFAULTS.ttlMs,
  retryMs = LANDING_CACHE_DEFAULTS.retryMs,
  logEveryMs = LANDING_CACHE_DEFAULTS.logEveryMs,
}: LandingCacheOptions<Data>): LandingCache<Data> {
  const entries = new Map<BusinessId, Entry>(
    BUSINESS_IDS.map((business) => [
      business,
      { data: seeds[business], generation: 0, loadedGeneration: -1, loadedAt: 0, failedAt: null, failedGeneration: -1, failures: 0, lastLogAt: null, inflight: null },
    ]),
  );

  function entryOf(business: BusinessId): Entry {
    const entry = entries.get(business);
    if (!entry) throw new TypeError(`Negocio desconocido: ${String(business)}`);
    return entry;
  }

  function onFailure(business: BusinessId, entry: Entry, generation: number, reason: PublicApiFailure, status: number | undefined): void {
    const at = now();
    entry.failures += 1;
    entry.failedAt = at;
    entry.failedGeneration = Math.max(entry.failedGeneration, generation);
    if (entry.failures === 1 || entry.lastLogAt === null || at - entry.lastLogAt >= logEveryMs) {
      entry.lastLogAt = at;
      logger.warn(names.fallback, {
        business,
        reason,
        ...(status === undefined ? {} : { status }),
        source: entry.loadedGeneration >= 0 ? 'last_good' : 'seed',
        failures: entry.failures,
      });
    }
  }

  async function load(business: BusinessId, entry: Entry, generation: number): Promise<void> {
    try {
      const result = await fetchData(business);
      if (!result.ok) {
        onFailure(business, entry, generation, result.reason, result.status);
        return;
      }
      // Un vuelo más viejo que termina tarde no pisa datos más nuevos.
      if (generation < entry.loadedGeneration) return;
      const first = entry.loadedGeneration < 0;
      entry.data = result.data;
      entry.loadedGeneration = generation;
      entry.loadedAt = now();
      if (entry.failures > 0) logger.info(names.recovered, { business, failures: entry.failures });
      else if (first) logger.info(names.loaded, { business, source: 'api' });
      entry.failures = 0;
      entry.failedAt = null;
      entry.lastLogAt = null;
    } catch (err) {
      // El cliente no lanza; esto cubre un fallo inesperado (p. ej. del logger).
      onFailure(business, entry, generation, 'network', undefined);
      logger.error(names.refreshFailed, { business, name: errorProp(err, 'name') });
    }
  }

  /** Vuelo de la generación vigente (lo comparte quien llegue mientras está en curso). */
  function refresh(business: BusinessId, entry: Entry): Promise<void> {
    const { generation } = entry;
    if (entry.inflight && entry.inflight.generation === generation) return entry.inflight.promise;
    const promise = load(business, entry, generation).finally(() => {
      if (entry.inflight?.promise === promise) entry.inflight = null;
    });
    entry.inflight = { generation, promise };
    return promise;
  }

  async function get<Id extends BusinessId>(business: Id): Promise<Data[Id]> {
    const entry = entryOf(business);
    const pending = entry.generation > entry.loadedGeneration;
    const failedSince = entry.failedAt !== null && entry.failedGeneration >= entry.generation;
    if (pending && !failedSince) {
      await refresh(business, entry);
    } else {
      const expired = entry.loadedGeneration < 0 || pending || now() - entry.loadedAt >= ttlMs;
      const mayRetry = entry.failedAt === null || now() - entry.failedAt >= retryMs;
      if (expired && mayRetry) void refresh(business, entry);
    }
    // Cada entrada guarda la forma de su negocio (la valida el contrato del cliente o la semilla).
    return entry.data;
  }

  return Object.freeze<LandingCache<Data>>({
    async warmUp() {
      await Promise.all(BUSINESS_IDS.map((business) => refresh(business, entryOf(business))));
    },
    get,
    invalidate(business) {
      entryOf(business).generation += 1;
    },
    async confirmFresh(business) {
      const entry = entryOf(business);
      if (entry.loadedGeneration < entry.generation) await refresh(business, entry);
      return entry.loadedGeneration >= entry.generation;
    },
  });
}
