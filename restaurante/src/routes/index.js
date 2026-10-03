import Router from '@koa/router';

import { BUSINESS_IDS, BUSINESS_PATHS } from '../config/businesses.js';
import { manifestPath } from '../content/icons.js';
import { createIconsController } from '../controllers/icons.js';
import { createLandingController } from '../controllers/landing.js';
import { createAdminRouter } from './admin.js';

/**
 * GET /           -> landing activa según el día (L-V Molotes, S-D Birria).
 * GET /molotes    -> landing de Moloteando, siempre.
 * GET /birria     -> landing de Birriería El Muñeco, siempre.
 * GET /favicon.ico, /apple-touch-icon.png, /apple-touch-icon-precomposed.png
 *                 -> iconos del negocio activo del día, con revalidación (REQ-F-002).
 * GET /molotes.webmanifest, /birria.webmanifest -> manifest de cada negocio.
 * /admin/...      -> administración de menús (src/routes/admin.js), solo si `admin` existe.
 *
 * @param {{ config: object, renderer: object, now: () => Date, repository: object, publicDir: string, admin?: object }} deps
 *   `admin`: dependencias de la administración (sesiones, límite de intentos, autenticador...);
 *   sin ella (credenciales no configuradas) no se montan sus rutas.
 */
export function createRouter({ admin, publicDir, ...deps }) {
  const router = new Router();
  const icons = createIconsController({ config: deps.config, now: deps.now, publicDir });
  router.get('/', createLandingController(deps));
  for (const businessId of BUSINESS_IDS) {
    router.get(BUSINESS_PATHS[businessId], createLandingController({ ...deps, businessId }));
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
