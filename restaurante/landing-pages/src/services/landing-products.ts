import { publicProductsSchemas, type PublicApiClient, type PublicApiFailure, type PublicProducts } from '@restaurante/contracts';
import type { MenuDataByBusiness } from '@restaurante/core/catalog';
import { BUSINESS, BUSINESS_IDS, errorProp, silentLogger, type BusinessId, type Logger } from '@restaurante/core/shared';

import { loadSeedDocument } from '../content/seeds.ts';

/**
 * Productos de las landings desde la API (REQ-F-038, RF-4 a RF-6). Código de las landings: no lee la
 * base de datos ni el repositorio de productos (regla de lint de RF-8); solo el cliente de contracts.
 *
 * Preferencia (RN-3): datos frescos de la API -> última copia buena en memoria -> semilla de
 * `content/seeds.ts`. `get` nunca lanza: un fallo de la API no produce un 5xx (RF-5).
 *
 * - Fresco (cargado en la generación vigente y con menos de `ttlMs`): se sirve sin E/S.
 * - Invalidado (una escritura de /admin subió la generación; RF-6): la visita espera el refresco
 *   (como mucho el límite del cliente) y ve el cambio "al instante". Un vuelo iniciado antes de la
 *   invalidación no cuenta: puede haber leído antes del commit.
 * - TTL vencido o en fallo: se sirve lo que hay y se refresca en segundo plano
 *   (stale-while-revalidate), como mucho cada `retryMs` mientras la API falle.
 * - Un vuelo por negocio y generación: las visitas simultáneas comparten la misma petición.
 * - Log sin URL ni datos: `landing_products_loaded`, `landing_products_fallback` (primer fallo de
 *   una racha y, después, como mucho uno cada `logEveryMs`) y `landing_products_recovered`.
 */

export const LANDING_PRODUCTS_DEFAULTS = Object.freeze({ timeoutMs: 1500, ttlMs: 60_000, retryMs: 5_000, logEveryMs: 60_000 });

export type SeedProducts = { [Id in BusinessId]: PublicProducts[Id] };

export interface LandingProducts {
  /** Primera carga de los dos negocios al arrancar; nunca falla (sin API se queda la semilla). */
  warmUp(): Promise<void>;
  get<Id extends BusinessId>(business: Id): Promise<PublicProducts[Id]>;
  /** Marca los datos del negocio como viejos: la siguiente visita espera los nuevos. */
  invalidate(business: BusinessId): void;
  /**
   * Espera (como mucho el límite del cliente) a que la caché tenga los datos vigentes del negocio y
   * dice si los tiene: false si la API no respondió bien. Lo usa /admin para no afirmar que la
   * landing ya muestra un cambio que no ha podido cargar (DEF-003 de REQ-F-038).
   */
  confirmFresh(business: BusinessId): Promise<boolean>;
}

export interface LandingProductsOptions {
  client: PublicApiClient;
  seeds: SeedProducts;
  logger?: Logger;
  /** Reloj en milisegundos (inyectable en las pruebas). */
  now?: () => number;
  ttlMs?: number;
  retryMs?: number;
  logEveryMs?: number;
}

interface Entry {
  data: PublicProducts[BusinessId];
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

/** Listas v1 de la semilla de cada negocio, validadas con el contrato (fallo rápido al arrancar). */
export function loadSeedProducts(): SeedProducts {
  const lists = (business: BusinessId, key: 'menu' | 'drinks'): unknown => errorProp(errorProp(errorProp(loadSeedDocument(business), 'data'), key), 'items');
  return Object.freeze({
    molotes: publicProductsSchemas.molotes.parse({ menu: lists(BUSINESS.MOLOTES, 'menu'), drinks: lists(BUSINESS.MOLOTES, 'drinks') }),
    birria: publicProductsSchemas.birria.parse({ menu: lists(BUSINESS.BIRRIA, 'menu') }),
  });
}

export function createLandingProducts({
  client,
  seeds,
  logger = silentLogger,
  now = () => Date.now(),
  ttlMs = LANDING_PRODUCTS_DEFAULTS.ttlMs,
  retryMs = LANDING_PRODUCTS_DEFAULTS.retryMs,
  logEveryMs = LANDING_PRODUCTS_DEFAULTS.logEveryMs,
}: LandingProductsOptions): LandingProducts {
  if (typeof client?.getProducts !== 'function') throw new TypeError('createLandingProducts requiere el cliente de la API');
  for (const business of BUSINESS_IDS) {
    if (!seeds?.[business]) throw new TypeError(`createLandingProducts requiere la semilla de ${business}`);
  }

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
      logger.warn('landing_products_fallback', {
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
      const result = await client.getProducts(business);
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
      if (entry.failures > 0) logger.info('landing_products_recovered', { business, failures: entry.failures });
      else if (first) logger.info('landing_products_loaded', { business, source: 'api' });
      entry.failures = 0;
      entry.failedAt = null;
      entry.lastLogAt = null;
    } catch (err) {
      // El cliente no lanza; esto cubre un fallo inesperado (p. ej. del logger).
      onFailure(business, entry, generation, 'network', undefined);
      logger.error('landing_products_refresh_failed', { business, name: errorProp(err, 'name') });
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

  async function get<Id extends BusinessId>(business: Id): Promise<PublicProducts[Id]> {
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
    return entry.data as PublicProducts[Id];
  }

  return Object.freeze<LandingProducts>({
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

/**
 * Datos de la landing: hero, destacado y promociones del JSON (REQ-F-001) con las listas de
 * productos de la API (Q-3 A de REQ-F-008: las listas del JSON ya no se usan). Movida desde
 * repositories/product-repository.ts (REQ-F-038).
 */
export function withProducts<Id extends BusinessId>(business: Id, data: MenuDataByBusiness[Id], products: PublicProducts[Id]): MenuDataByBusiness[Id] {
  if (business === BUSINESS.MOLOTES) {
    // Negocio Molotes: datos y listas tienen la forma de Molotes.
    const molotes = data as MenuDataByBusiness['molotes'];
    const lists = products as PublicProducts['molotes'];
    const merged: MenuDataByBusiness['molotes'] = { ...molotes, menu: { ...molotes.menu, items: lists.menu }, drinks: { ...molotes.drinks, items: lists.drinks } };
    return merged as MenuDataByBusiness[Id];
  }
  const birria = data as MenuDataByBusiness['birria'];
  const merged: MenuDataByBusiness['birria'] = { ...birria, menu: { ...birria.menu, items: (products as PublicProducts['birria']).menu } };
  return merged as MenuDataByBusiness[Id];
}
