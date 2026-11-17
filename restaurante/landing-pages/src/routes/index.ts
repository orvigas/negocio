import Router from '@koa/router';

import { BUSINESS_IDS, type Logger } from '@restaurante/core/shared';
import type { Renderer } from '@restaurante/web';

import { BUSINESS_PATHS } from '../config/business-paths.ts';
import type { Config } from '../config/env.ts';
import { manifestPath } from '../content/icons.ts';
import { createIconsController } from '../controllers/icons.ts';
import { createLandingController } from '../controllers/landing.ts';
import { loadSeedMenus } from '../services/landing-page.ts';
import type { LandingPage } from '../services/landing-page.ts';
import type { LandingProducts } from '../services/landing-products.ts';

/**
 * GET /           -> landing de Birria El Muñeco, siempre, con el aviso del día (REQ-F-028):
 *                    lunes descanso, de martes a viernes Molotes, fin de semana ninguno.
 * GET /molotes    -> landing de Moloteando, siempre.
 * GET /birria     -> landing de Birria El Muñeco, siempre.
 * GET /favicon.ico, /apple-touch-icon.png, /apple-touch-icon-precomposed.png
 *                 -> iconos de Birria (los de `/`; REQ-F-028), con revalidación (REQ-F-002).
 * GET /molotes.webmanifest, /birria.webmanifest -> manifest de cada negocio.
 * /admin y /admin/* -> los atiende el middleware admin-moved (REQ-F-045): 302 al admin nuevo, 410 o 404.
 * El webhook del bot de WhatsApp (/webhooks/whatsapp) lo atiende la api desde REQ-F-042: aquí, 404.
 */
export function createRouter({
  publicDir,
  landingProducts,
  landingPage,
  ...deps
}: {
  config: Config;
  renderer: Renderer;
  now: () => Date;
  /** Productos de las landings, de la API (REQ-F-038). */
  landingProducts: LandingProducts;
  /** Datos de página de las landings, de la API (REQ-F-044). */
  landingPage: LandingPage;
  publicDir: string;
  logger: Logger;
}): Router {
  const router = new Router();
  const icons = createIconsController({ publicDir });
  const seeds = loadSeedMenus();
  router.get('/', createLandingController({ ...deps, landingProducts, landingPage, seeds }));
  for (const businessId of BUSINESS_IDS) {
    router.get(BUSINESS_PATHS[businessId], createLandingController({ ...deps, landingProducts, landingPage, seeds, businessId }));
    router.get(manifestPath(businessId), icons.manifest(businessId));
  }
  router.get('/favicon.ico', icons.favicon);
  router.get(['/apple-touch-icon.png', '/apple-touch-icon-precomposed.png'], icons.appleTouchIcon);
  return router;
}
