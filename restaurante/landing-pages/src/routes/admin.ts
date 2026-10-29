import Router from '@koa/router';

import { createAdminAccountController } from '../controllers/admin-account.ts';
import { createAdminBotController } from '../controllers/admin-bot.ts';
import { createAdminUsersController } from '../controllers/admin-users.ts';
import { createAdminProductsController } from '../controllers/admin-products.ts';
import { createAdminController, type AdminDeps } from '../controllers/admin.ts';
import type { AdminState } from '../middleware/admin-guard.ts';
import { createAdminApiRouter } from './admin-api.ts';

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
 * GET  /admin/bot                             -> página "Bot" (REQ-F-025; solo administradores)
 * POST /admin/bot/interruptor                 -> pausar / reanudar el bot
 * POST /admin/bot/bloqueos                    -> bloquear un número
 * POST /admin/bot/bloqueos/:id/quitar         -> quitar un bloqueo
 * POST /admin/bot/topes/:token/bloquear       -> bloquear desde "alcanzaron un tope hoy"
 * GET  /admin/usuarios/:id/contrasena | POST (misma ruta)     -> restablecer la contraseña
 * GET  /admin/:negocio | POST /admin/:negocio -> ver / guardar (incluye la sobrescritura tras conflicto)
 * GET  /admin/:negocio/restaurar-anterior     -> confirmación
 * POST /admin/:negocio/restaurar-anterior     -> restaurar la versión anterior
 * POST /admin/:negocio/restaurar-semilla      -> restaurar la semilla (solo con datos dañados)
 * GET  /admin/:negocio/productos/nuevo       -> nuevo producto (?categoria=; en Birria, ?tipo=)
 * POST /admin/:negocio/productos             -> crear
 * GET  /admin/:negocio/productos/eliminados  -> productos eliminados
 * GET  /admin/:negocio/productos/:id | POST  -> editar (incluye sobrescribir tras conflicto)
 * GET  /admin/:negocio/productos/:id/eliminar | POST -> confirmar y eliminar
 * POST /admin/:negocio/productos/:id/recuperar | …/subir | …/bajar
 * /admin/api/...                              -> API JSON de productos (src/routes/admin-api.ts)
 */
export function createAdminRouter(deps: AdminDeps): Router<AdminState> {
  const controller = createAdminController(deps);
  const usersController = createAdminUsersController(deps);
  const account = createAdminAccountController(deps);
  const router = new Router<AdminState>({ prefix: '/admin' });

  // API JSON de productos (REQ-F-008): antes de /:business.
  const api = createAdminApiRouter(deps);
  router.use(api.routes(), api.allowedMethods());

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
  const botController = createAdminBotController(deps);
  router.get('/bot', botController.page);
  router.post('/bot/interruptor', botController.toggle);
  router.post('/bot/bloqueos', botController.block);
  router.post('/bot/bloqueos/:id/quitar', botController.unblock);
  router.post('/bot/topes/:token/bloquear', botController.blockReached);
  const productsController = createAdminProductsController(deps);
  router.get('/:business/productos/nuevo', productsController.newPage);
  router.post('/:business/productos', productsController.create);
  router.get('/:business/productos/eliminados', productsController.deletedPage);
  router.get('/:business/productos/:id', productsController.editPage);
  router.post('/:business/productos/:id', productsController.update);
  router.get('/:business/productos/:id/eliminar', productsController.deletePage);
  router.post('/:business/productos/:id/eliminar', productsController.remove);
  router.post('/:business/productos/:id/recuperar', productsController.restore);
  router.post('/:business/productos/:id/subir', productsController.moveUp);
  router.post('/:business/productos/:id/bajar', productsController.moveDown);
  router.get('/:business', controller.businessPage);
  router.post('/:business', controller.save);
  router.get('/:business/restaurar-anterior', controller.restorePreviousPage);
  router.post('/:business/restaurar-anterior', controller.restorePrevious);
  router.post('/:business/restaurar-semilla', controller.restoreSeed);

  return router;
}
