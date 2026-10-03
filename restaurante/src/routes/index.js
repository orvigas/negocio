import Router from '@koa/router';

import { BUSINESS_IDS, BUSINESS_PATHS } from '../config/businesses.js';
import { createLandingController } from '../controllers/landing.js';
import { createAdminRouter } from './admin.js';

/**
 * GET /           -> landing activa según el día (L-V Molotes, S-D Birria).
 * GET /molotes    -> landing de Moloteando, siempre.
 * GET /birria     -> landing de Birriería El Muñeco, siempre.
 * /admin/...      -> administración de menús (src/routes/admin.js), solo si `admin` existe.
 *
 * @param {{ config: object, renderer: object, now: () => Date, repository: object, admin?: object }} deps
 *   `admin`: dependencias de la administración (sesiones, límite de intentos, autenticador...);
 *   sin ella (credenciales no configuradas) no se montan sus rutas.
 */
export function createRouter({ admin, ...deps }) {
  const router = new Router();
  router.get('/', createLandingController(deps));
  for (const businessId of BUSINESS_IDS) {
    router.get(BUSINESS_PATHS[businessId], createLandingController({ ...deps, businessId }));
  }
  if (admin) {
    const adminRouter = createAdminRouter({ ...deps, ...admin });
    router.use(adminRouter.routes(), adminRouter.allowedMethods());
  }
  return router;
}
