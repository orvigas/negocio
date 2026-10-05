import Router from '@koa/router';

import { createAdminAccountController } from '../controllers/admin-account.ts';
import { createAdminUsersController } from '../controllers/admin-users.ts';
import { createAdminController, type AdminDeps } from '../controllers/admin.ts';
import type { AdminState } from '../middleware/admin-guard.ts';

/**
 * Rutas de administración (REQ-F-001 y REQ-F-007). Las cabeceras noindex/no-store, la
 * disponibilidad y el HTTPS obligatorio en producción los aplica antes src/middleware/admin-guard.ts.
 *
 * GET  /admin                                 -> inicio (solo lo permitido al usuario)
 * GET  /admin/login | POST /admin/login       -> acceso
 * POST /admin/logout                          -> cierre de sesión
 * GET  /admin/cuenta | POST /admin/cuenta     -> Mi cuenta: cambiar la propia contraseña
 * GET  /admin/usuarios                        -> lista de usuarios (solo administradores)
 * GET  /admin/usuarios/nuevo | POST /admin/usuarios          -> crear
 * GET  /admin/usuarios/:id | POST /admin/usuarios/:id         -> editar
 * POST /admin/usuarios/:id/desactivar | …/reactivar           -> desactivar / reactivar
 * GET  /admin/usuarios/:id/contrasena | POST (misma ruta)     -> restablecer la contraseña
 * GET  /admin/:negocio | POST /admin/:negocio -> ver / guardar (incluye la sobrescritura tras conflicto)
 * GET  /admin/:negocio/restaurar-anterior     -> confirmación
 * POST /admin/:negocio/restaurar-anterior     -> restaurar la versión anterior
 * POST /admin/:negocio/restaurar-semilla      -> restaurar la semilla (solo con datos dañados)
 */
export function createAdminRouter(deps: AdminDeps): Router<AdminState> {
  const controller = createAdminController(deps);
  const usersController = createAdminUsersController(deps);
  const account = createAdminAccountController(deps);
  const router = new Router<AdminState>({ prefix: '/admin' });

  router.get('/', controller.index);
  router.get('/login', controller.loginPage);
  router.post('/login', controller.login);
  router.post('/logout', controller.logout);
  // Rutas fijas antes de /:business (que responde 404 a lo que no sea un negocio).
  router.get('/cuenta', account.page);
  router.post('/cuenta', account.changePassword);
  router.get('/usuarios', usersController.list);
  router.post('/usuarios', usersController.create);
  router.get('/usuarios/nuevo', usersController.newPage);
  router.get('/usuarios/:id', usersController.editPage);
  router.post('/usuarios/:id', usersController.update);
  router.post('/usuarios/:id/desactivar', usersController.deactivate);
  router.post('/usuarios/:id/reactivar', usersController.reactivate);
  router.get('/usuarios/:id/contrasena', usersController.passwordPage);
  router.post('/usuarios/:id/contrasena', usersController.resetPassword);
  router.get('/:business', controller.businessPage);
  router.post('/:business', controller.save);
  router.get('/:business/restaurar-anterior', controller.restorePreviousPage);
  router.post('/:business/restaurar-anterior', controller.restorePrevious);
  router.post('/:business/restaurar-semilla', controller.restoreSeed);

  return router;
}
