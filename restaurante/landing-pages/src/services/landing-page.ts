import { publicPageSchemas, type PublicApiClient, type PublicPage } from '@restaurante/contracts';
import { mergePageData, pickPageData, validateMenuDocument, type MenuDataByBusiness, type MenuDocument } from '@restaurante/core/catalog';
import { BUSINESS, BUSINESS_IDS, type BusinessId, type Logger } from '@restaurante/core/shared';

import { loadSeedDocument } from '../content/seeds.ts';
import { createLandingCache, type LandingCache } from './landing-cache.ts';

/**
 * Datos de página de las landings desde la API (REQ-F-044, RF-5): hero, texto destacado y promociones.
 * Mismas reglas que los productos (caché común de landing-cache.ts): frescura de 60 s, un vuelo por
 * negocio, invalidación tras cada escritura, última copia buena y, sin copia, la semilla. Un 503
 * `PAGE_UNAVAILABLE` es un fallo más: nunca sustituye una copia buena. Código de las landings: solo el
 * cliente de contracts. Log: `landing_page_loaded`, `landing_page_fallback` y `landing_page_recovered`.
 */

export type SeedMenus = { [Id in BusinessId]: MenuDataByBusiness[Id] };
export type SeedPages = { [Id in BusinessId]: PublicPage[Id] };

export type LandingPage = LandingCache<SeedPages>;

export interface LandingPageOptions {
  client: PublicApiClient;
  seeds: SeedPages;
  logger?: Logger;
  /** Reloj en milisegundos (inyectable en las pruebas). */
  now?: () => number;
  ttlMs?: number;
  retryMs?: number;
  logEveryMs?: number;
}

/**
 * Datos completos de la semilla de cada negocio, validados (fallo rápido al arrancar). El resto del
 * documento (textos que no son de página y listas congeladas) sale de aquí; la página, de la API.
 */
export function loadSeedMenus(): SeedMenus {
  const menuOf = <Id extends BusinessId>(business: Id): MenuDataByBusiness[Id] => {
    const document = loadSeedDocument(business);
    const data = (document as { data?: unknown } | null)?.data;
    const issues = validateMenuDocument(business, document, data);
    if (issues.length > 0) throw new TypeError(`La semilla de ${business} no es válida: ${issues[0]?.path ?? ''}`);
    // validateMenuDocument no encontró problemas: es un documento del negocio.
    return (document as MenuDocument<Id>).data;
  };
  return Object.freeze({ molotes: menuOf(BUSINESS.MOLOTES), birria: menuOf(BUSINESS.BIRRIA) });
}

/** Datos de página de la semilla, validados con el contrato. */
export function loadSeedPages(menus: SeedMenus = loadSeedMenus()): SeedPages {
  return Object.freeze({
    molotes: publicPageSchemas.molotes.parse(pickPageData(BUSINESS.MOLOTES, menus.molotes)),
    birria: publicPageSchemas.birria.parse(pickPageData(BUSINESS.BIRRIA, menus.birria)),
  });
}

/** Documento que pinta la landing: la semilla con los datos de página vigentes. */
export function withPage<Id extends BusinessId>(business: Id, seed: MenuDataByBusiness[Id], page: PublicPage[Id]): MenuDataByBusiness[Id] {
  // El contrato público y los datos de página de core tienen la misma forma (contract-types.test.ts de api).
  return mergePageData(business, seed, page);
}

export function createLandingPage({ client, seeds, ...options }: LandingPageOptions): LandingPage {
  if (typeof client?.getPage !== 'function') throw new TypeError('createLandingPage requiere el cliente de la API');
  for (const business of BUSINESS_IDS) {
    if (!seeds?.[business]) throw new TypeError(`createLandingPage requiere la semilla de ${business}`);
  }
  return createLandingCache<SeedPages>({
    ...options,
    load: (business) => client.getPage(business),
    seeds,
    names: {
      loaded: 'landing_page_loaded',
      fallback: 'landing_page_fallback',
      recovered: 'landing_page_recovered',
      refreshFailed: 'landing_page_refresh_failed',
    },
  });
}
