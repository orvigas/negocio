import Router from '@koa/router';

import { createAdminController } from '../controllers/admin.js';

/**
 * Rutas de administración (REQ-F-001). Las cabeceras noindex/no-store, la disponibilidad
 * y el HTTPS obligatorio en producción los aplica antes src/middleware/admin-guard.js.
 *
 * GET  /admin                                 -> 303 a /admin/molotes
 * GET  /admin/login | POST /admin/login       -> acceso
 * POST /admin/logout                          -> cierre de sesión
 * GET  /admin/:negocio | POST /admin/:negocio -> ver / guardar (incluye la sobrescritura tras conflicto)
 * GET  /admin/:negocio/restaurar-anterior     -> confirmación
 * POST /admin/:negocio/restaurar-anterior     -> restaurar la versión anterior
 * POST /admin/:negocio/restaurar-semilla      -> restaurar la semilla (solo con datos dañados)
 *
 * @param {Parameters<typeof createAdminController>[0]} deps
 */
export function createAdminRouter(deps) {
  const controller = createAdminController(deps);
  const router = new Router({ prefix: '/admin' });

  router.get('/', controller.index);
  router.get('/login', controller.loginPage);
  router.post('/login', controller.login);
  router.post('/logout', controller.logout);
  router.get('/:business', controller.businessPage);
  router.post('/:business', controller.save);
  router.get('/:business/restaurar-anterior', controller.restorePreviousPage);
  router.post('/:business/restaurar-anterior', controller.restorePrevious);
  router.post('/:business/restaurar-semilla', controller.restoreSeed);

  return router;
}
