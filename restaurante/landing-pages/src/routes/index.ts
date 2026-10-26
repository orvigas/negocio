import Router from '@koa/router';

import { BUSINESS_IDS, type Logger } from '@restaurante/core/shared';

import { BUSINESS_PATHS } from '../config/business-paths.ts';
import type { Config } from '../config/env.ts';
import { manifestPath } from '../content/icons.ts';
import type { AdminDeps } from '../controllers/admin.ts';
import { createIconsController } from '../controllers/icons.ts';
import { createLandingController } from '../controllers/landing.ts';
import { WEBHOOK_PATH, createWhatsAppWebhook, type WebhookBot } from '../controllers/whatsapp-webhook.ts';
import type { MenuRepository } from '../repositories/menu-repository.ts';
import type { ProductRepository } from '../repositories/product-repository.ts';
import type { LandingProducts } from '../services/landing-products.ts';
import type { Renderer } from '../views/render.ts';
import { createAdminRouter } from './admin.ts';

/** Dependencias propias de la administración (las comunes llegan en el resto de `deps`). */
export type AdminRouteDeps = Omit<AdminDeps, 'config' | 'renderer' | 'now' | 'repository' | 'products'>;

/**
 * GET /           -> landing de Birria El Muñeco, siempre, con el aviso del día (REQ-F-028):
 *                    lunes descanso, de martes a viernes Molotes, fin de semana ninguno.
 * GET /molotes    -> landing de Moloteando, siempre.
 * GET /birria     -> landing de Birria El Muñeco, siempre.
 * GET /favicon.ico, /apple-touch-icon.png, /apple-touch-icon-precomposed.png
 *                 -> iconos de Birria (los de `/`; REQ-F-028), con revalidación (REQ-F-002).
 * GET /molotes.webmanifest, /birria.webmanifest -> manifest de cada negocio.
 * /admin/...      -> administración de menús (src/routes/admin.ts), solo si `admin` existe.
 * GET/POST /webhooks/whatsapp -> webhook del bot de WhatsApp (REQ-F-009); 503 sin `bot`.
 *
 * `admin`: dependencias de la administración (sesiones, límite de intentos, autenticador...);
 * sin ella (credenciales no configuradas) no se montan sus rutas.
 */
export function createRouter({
  admin,
  publicDir,
  bot,
  logger,
  landingProducts,
  ...deps
}: {
  config: Config;
  renderer: Renderer;
  now: () => Date;
  repository: MenuRepository;
  products: ProductRepository;
  /** Productos de las landings, de la API (REQ-F-038). /admin y el bot usan `products`. */
  landingProducts: LandingProducts;
  publicDir: string;
  admin?: AdminRouteDeps | undefined;
  bot?: WebhookBot | undefined;
  logger: Logger;
}): Router {
  const router = new Router();
  const icons = createIconsController({ publicDir });
  router.get('/', createLandingController({ ...deps, landingProducts }));
  for (const businessId of BUSINESS_IDS) {
    router.get(BUSINESS_PATHS[businessId], createLandingController({ ...deps, landingProducts, businessId }));
    router.get(manifestPath(businessId), icons.manifest(businessId));
  }
  router.get('/favicon.ico', icons.favicon);
  router.get(['/apple-touch-icon.png', '/apple-touch-icon-precomposed.png'], icons.appleTouchIcon);
  const webhook = createWhatsAppWebhook({ bot, logger });
  router.get(WEBHOOK_PATH, webhook.verify);
  router.post(WEBHOOK_PATH, webhook.receive);
  if (admin) {
    const adminRouter = createAdminRouter({ ...deps, ...admin });
    router.use(adminRouter.routes(), adminRouter.allowedMethods());
  }
  return router;
}
