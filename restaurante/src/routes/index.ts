import Router from '@koa/router';

import { BUSINESS_IDS, BUSINESS_PATHS } from '../config/businesses.ts';
import type { Config } from '../config/env.ts';
import { manifestPath } from '../content/icons.ts';
import type { AdminDeps } from '../controllers/admin.ts';
import { createIconsController } from '../controllers/icons.ts';
import { createLandingController } from '../controllers/landing.ts';
import type { MenuRepository } from '../repositories/menu-repository.ts';
import type { Renderer } from '../views/render.ts';
import { createAdminRouter } from './admin.ts';

/** Dependencias propias de la administración (las comunes llegan en el resto de `deps`). */
export type AdminRouteDeps = Omit<AdminDeps, 'config' | 'renderer' | 'now' | 'repository'>;

/**
 * GET /           -> landing activa según el día (L-V Molotes, S-D Birria).
 * GET /molotes    -> landing de Moloteando, siempre.
 * GET /birria     -> landing de Birriería El Muñeco, siempre.
 * GET /favicon.ico, /apple-touch-icon.png, /apple-touch-icon-precomposed.png
 *                 -> iconos del negocio activo del día, con revalidación (REQ-F-002).
 * GET /molotes.webmanifest, /birria.webmanifest -> manifest de cada negocio.
 * /admin/...      -> administración de menús (src/routes/admin.ts), solo si `admin` existe.
 *
 * `admin`: dependencias de la administración (sesiones, límite de intentos, autenticador...);
 * sin ella (credenciales no configuradas) no se montan sus rutas.
 */
export function createRouter({
  admin,
  publicDir,
  ...deps
}: {
  config: Config;
  renderer: Renderer;
  now: () => Date;
  repository: MenuRepository;
  publicDir: string;
  admin?: AdminRouteDeps | undefined;
}): Router {
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
