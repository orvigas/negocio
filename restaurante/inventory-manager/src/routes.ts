import Router from '@koa/router';

import type { AccountController } from './controllers/account.ts';
import type { AdminController } from './controllers/admin.ts';
import type { UsersController } from './controllers/users.ts';

/**
 * Rutas del admin nuevo (REQ-F-039). Todas las pantallas funcionan sin JavaScript (POST/redirect/GET).
 *
 * GET  /salud                                  -> 200 (sin llamar a la API: salud del contenedor)
 * GET  /acceso | POST /acceso | POST /salir    -> entrar y salir
 * GET  /                                       -> selector de negocio (o el único permitido)
 * GET  /:negocio/productos                     -> lista por categoría, en orden
 * GET  /:negocio/productos/nuevo | POST /:negocio/productos                 -> alta
 * GET  /:negocio/productos/eliminados          -> eliminados (POST …/:id/recuperar)
 * GET  /:negocio/productos/:id/editar | POST /:negocio/productos/:id         -> edición
 * GET|POST /:negocio/productos/:id/eliminar    -> confirmar y eliminar
 * POST /:negocio/productos/:id/subir | …/bajar -> orden (con JS, fragmento de la lista)
 *
 * Usuarios y "Mi cuenta" (REQ-F-040):
 * GET  /usuarios                               -> lista (solo administradores)
 * GET  /usuarios/nuevo | POST /usuarios        -> alta
 * GET  /usuarios/:id/editar | POST /usuarios/:id -> edición
 * POST /usuarios/:id/desactivar | …/reactivar  -> estado
 * GET|POST /usuarios/:id/contrasena            -> restablecer la contraseña
 * GET|POST /cuenta                             -> cambiar la propia contraseña (cualquier usuario)
 */
export function createRouter({ admin: controller, users, account }: { admin: AdminController; users: UsersController; account: AccountController }): Router {
  const router = new Router();
  router.get('/salud', (ctx) => {
    ctx.type = 'text';
    ctx.body = 'ok';
  });
  router.get('/acceso', controller.loginPage);
  router.post('/acceso', controller.login);
  router.post('/salir', controller.logout);
  router.get('/', controller.home);
  // Usuarios antes que productos: `/usuarios/productos` no es el negocio "usuarios".
  router.get('/usuarios', users.list);
  router.post('/usuarios', users.create);
  router.get('/usuarios/nuevo', users.newPage);
  router.get('/usuarios/:id/editar', users.editPage);
  router.post('/usuarios/:id', users.update);
  router.post('/usuarios/:id/desactivar', users.deactivate);
  router.post('/usuarios/:id/reactivar', users.reactivate);
  router.get('/usuarios/:id/contrasena', users.passwordPage);
  router.post('/usuarios/:id/contrasena', users.resetPassword);
  router.get('/cuenta', account.page);
  router.post('/cuenta', account.changePassword);
  router.get('/:business/productos', controller.products);
  router.post('/:business/productos', controller.create);
  router.get('/:business/productos/nuevo', controller.newProduct);
  router.get('/:business/productos/eliminados', controller.deleted);
  router.get('/:business/productos/:id/editar', controller.editPage);
  router.post('/:business/productos/:id', controller.update);
  router.get('/:business/productos/:id/eliminar', controller.deletePage);
  router.post('/:business/productos/:id/eliminar', controller.remove);
  router.post('/:business/productos/:id/recuperar', controller.restore);
  router.post('/:business/productos/:id/subir', controller.moveUp);
  router.post('/:business/productos/:id/bajar', controller.moveDown);
  return router;
}
