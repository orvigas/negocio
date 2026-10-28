import Router from '@koa/router';

import type { AdminController } from './controllers/admin.ts';

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
 */
export function createRouter(controller: AdminController): Router {
  const router = new Router();
  router.get('/salud', (ctx) => {
    ctx.type = 'text';
    ctx.body = 'ok';
  });
  router.get('/acceso', controller.loginPage);
  router.post('/acceso', controller.login);
  router.post('/salir', controller.logout);
  router.get('/', controller.home);
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
