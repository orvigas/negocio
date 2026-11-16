import { publicProductsSchemas, type PublicApiClient, type PublicProducts } from '@restaurante/contracts';
import type { MenuDataByBusiness } from '@restaurante/core/catalog';
import { BUSINESS, BUSINESS_IDS, errorProp, type BusinessId, type Logger } from '@restaurante/core/shared';

import { loadSeedDocument } from '../content/seeds.ts';
import { LANDING_CACHE_DEFAULTS, createLandingCache, type LandingCache } from './landing-cache.ts';

/**
 * Productos de las landings desde la API (REQ-F-038, RF-4 a RF-6). Código de las landings: no lee la
 * base de datos ni el repositorio de productos (regla de lint de RF-8); solo el cliente de contracts.
 *
 * Las reglas de frescura, invalidación, un vuelo, última copia buena y semilla son las de la caché
 * común (landing-cache.ts; REQ-F-044). Log sin URL ni datos: `landing_products_loaded`,
 * `landing_products_fallback` (primer fallo de una racha y, después, como mucho uno cada
 * `logEveryMs`) y `landing_products_recovered`.
 */

export const LANDING_PRODUCTS_DEFAULTS = LANDING_CACHE_DEFAULTS;

export type SeedProducts = { [Id in BusinessId]: PublicProducts[Id] };

export type LandingProducts = LandingCache<SeedProducts>;

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

/** Listas v1 de la semilla de cada negocio, validadas con el contrato (fallo rápido al arrancar). */
export function loadSeedProducts(): SeedProducts {
  const lists = (business: BusinessId, key: 'menu' | 'drinks'): unknown => errorProp(errorProp(errorProp(loadSeedDocument(business), 'data'), key), 'items');
  return Object.freeze({
    molotes: publicProductsSchemas.molotes.parse({ menu: lists(BUSINESS.MOLOTES, 'menu'), drinks: lists(BUSINESS.MOLOTES, 'drinks') }),
    birria: publicProductsSchemas.birria.parse({ menu: lists(BUSINESS.BIRRIA, 'menu') }),
  });
}

export function createLandingProducts({ client, seeds, ...options }: LandingProductsOptions): LandingProducts {
  if (typeof client?.getProducts !== 'function') throw new TypeError('createLandingProducts requiere el cliente de la API');
  for (const business of BUSINESS_IDS) {
    if (!seeds?.[business]) throw new TypeError(`createLandingProducts requiere la semilla de ${business}`);
  }
  return createLandingCache<SeedProducts>({
    ...options,
    load: (business) => client.getProducts(business),
    seeds,
    names: {
      loaded: 'landing_products_loaded',
      fallback: 'landing_products_fallback',
      recovered: 'landing_products_recovered',
      refreshFailed: 'landing_products_refresh_failed',
    },
  });
}

/**
 * Datos de la landing con las listas de productos de la API (Q-3 A de REQ-F-008: las listas del JSON
 * ya no se usan). Movida desde repositories/product-repository.ts (REQ-F-038).
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
