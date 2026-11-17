import { createPublicApiClient } from '@restaurante/contracts';
import type { Logger } from '@restaurante/core/shared';

import type { ProductRepository } from '@restaurante/core/catalog';
import { loadSeedPages, type LandingPage, type SeedPages } from '../../src/services/landing-page.ts';
import { createLandingProducts, loadSeedProducts, type LandingProducts, type LandingProductsOptions } from '../../src/services/landing-products.ts';

/**
 * Productos de las landings en las pruebas (REQ-F-038, RF-10): ninguna prueba necesita la API real.
 *
 * - `landingProductsFrom(products)`: adaptador en memoria sobre el repositorio de productos, para las
 *   pruebas que no prueban la API (iconos, errores...). Nunca entra en src/.
 * - El doble HTTP de la API está en products-api-double.ts.
 * - `makeApiLandingProducts(...)`: la caché real de las landings con el cliente real contra el doble.
 */

export function landingProductsFrom(products: Pick<ProductRepository, 'getPublished'>): LandingProducts {
  return Object.freeze<LandingProducts>({
    async warmUp() {},
    async get(business) {
      return products.getPublished(business);
    },
    invalidate() {},
    // El repositorio recarga su caché en cada escritura: siempre al día.
    async confirmFresh() {
      return true;
    },
  });
}

/** Caché real de las landings con el cliente real contra `url` (por defecto, límite de 300 ms). */
export function makeApiLandingProducts({
  url,
  logger,
  timeoutMs = 300,
  ...options
}: { url: string; logger?: Logger; timeoutMs?: number } & Partial<Omit<LandingProductsOptions, 'client' | 'logger'>>): LandingProducts {
  return createLandingProducts({
    client: createPublicApiClient({ baseUrl: url, timeoutMs }),
    seeds: loadSeedProducts(),
    ...(logger ? { logger } : {}),
    ...options,
  });
}

/** Datos de página fijos (la semilla, o los que se pasen) para las pruebas que no editan la página. */
export function fixedLandingPage(pages: Partial<SeedPages> = {}): LandingPage {
  const data = { ...loadSeedPages(), ...pages };
  return Object.freeze<LandingPage>({
    async warmUp() {},
    async get(business) {
      return structuredClone(data[business]);
    },
    invalidate() {},
    async confirmFresh() {
      return true;
    },
  });
}
