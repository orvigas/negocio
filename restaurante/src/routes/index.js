import Router from '@koa/router';

import { BUSINESS_IDS, BUSINESS_PATHS } from '../config/businesses.js';
import { createLandingController } from '../controllers/landing.js';

/**
 * GET /           -> landing activa según el día (L-V Molotes, S-D Birria).
 * GET /molotes    -> landing de Moloteando, siempre.
 * GET /birria     -> landing de Birriería El Muñeco, siempre.
 *
 * @param {{ config: object, renderer: object, now: () => Date, }} deps
 */
export function createRouter(deps) {
  const router = new Router();
  router.get('/', createLandingController(deps));
  for (const businessId of BUSINESS_IDS) {
    router.get(BUSINESS_PATHS[businessId], createLandingController({ ...deps, businessId }));
  }
  return router;
}
