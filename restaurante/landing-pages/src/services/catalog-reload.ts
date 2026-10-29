import type { ProductRepository } from '@restaurante/core/catalog';
import { BUSINESS_IDS } from '@restaurante/core/shared';

/**
 * Recarga periódica del catálogo del bot (REQ-F-039, RF-13; confirmado: "Recarga del bot cada 60 s"):
 * red de seguridad si el aviso interno de la API se pierde. Cada `intervalMs` vuelve a leer los
 * productos publicados de los dos negocios; un fallo lo registra el repositorio
 * (`products_cache_refresh_failed`) y conserva la copia anterior. El temporizador no retiene el proceso.
 */

export const CATALOG_RELOAD_MS = 60_000;

export function startCatalogReload({
  products,
  intervalMs = CATALOG_RELOAD_MS,
}: {
  products: Pick<ProductRepository, 'reload'>;
  intervalMs?: number;
}): () => void {
  const timer = setInterval(() => {
    for (const business of BUSINESS_IDS) void products.reload(business);
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
