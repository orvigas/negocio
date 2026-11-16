import Router from '@koa/router';

import { BUSINESS_IDS, type Logger } from '@restaurante/core/shared';
import type { ProductRepository } from '@restaurante/core/catalog';
import type { Renderer } from '@restaurante/web';

import { BUSINESS_PATHS } from '../config/business-paths.ts';
import type { Config } from '../config/env.ts';
import { manifestPath } from '../content/icons.ts';
import type { AdminDeps } from '../controllers/admin.ts';
import { createIconsController } from '../controllers/icons.ts';
import { createLandingController } from '../controllers/landing.ts';
import { loadSeedMenus } from '../services/landing-page.ts';
import type { LandingPage } from '../services/landing-page.ts';
import type { LandingProducts } from '../services/landing-products.ts';
import { createAdminRouter } from './admin.ts';

/** Dependencias propias de la administración (las comunes llegan en el resto de `deps`). */
export type AdminRouteDeps = Omit<AdminDeps, 'config' | 'renderer' | 'now' | 'products'>;

/**
 * GET /           -> landing de Birria El Muñeco, siempre, con el aviso del día (REQ-F-028):
 *                    lunes descanso, de martes a viernes Molotes, fin de semana ninguno.
 * GET /molotes    -> landing de Moloteando, siempre.
 * GET /birria     -> landing de Birria El Muñeco, siempre.
 * GET /favicon.ico, /apple-touch-icon.png, /apple-touch-icon-precomposed.png
 *                 -> iconos de Birria (los de `/`; REQ-F-028), con revalidación (REQ-F-002).
 * GET /molotes.webmanifest, /birria.webmanifest -> manifest de cada negocio.
 * /admin/...      -> administración de menús (src/routes/admin.ts), solo si `admin` existe.
 * El webhook del bot de WhatsApp (/webhooks/whatsapp) lo atiende la api desde REQ-F-042: aquí, 404.
 *
 * `admin`: dependencias de la administración (sesiones, límite de intentos, autenticador...);
 * sin ella (credenciales no configuradas) no se montan sus rutas.
 */
export function createRouter({
  admin,
  publicDir,
  landingProducts,
  landingPage,
  ...deps
}: {
  config: Config;
  renderer: Renderer;
  now: () => Date;
  products: ProductRepository;
  /** Productos de las landings, de la API (REQ-F-038). /admin usa `products`. */
  landingProducts: LandingProducts;
  /** Datos de página de las landings, de la API (REQ-F-044). /admin usa `pages`. */
  landingPage: LandingPage;
  publicDir: string;
  admin?: AdminRouteDeps | undefined;
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
  if (admin) {
    const adminRouter = createAdminRouter({ ...deps, ...admin });
    router.use(adminRouter.routes(), adminRouter.allowedMethods());
  }
  return router;
}
