import Router from '@koa/router';

import { ADMIN_API_PREFIX } from '@restaurante/contracts';

import type { ProductRoutes } from './product-routes.ts';
import type { SessionRoutes } from './session-routes.ts';

/**
 * Rutas de `/api/v1/admin` (REQ-F-039). Una ruta conocida con otro método responde 405 con `Allow`
 * (`allowedMethods`; el cuerpo lo pone el manejador central); una ruta desconocida, 404.
 */
export function createAdminRouter({ session, products }: { session: SessionRoutes; products: ProductRoutes }): Router {
  const router = new Router({ prefix: ADMIN_API_PREFIX });

  router.post('/sesion', session.login);
  router.get('/sesion', session.current);
  router.delete('/sesion', session.logout);

  router.get('/:business/productos', products.list);
  router.post('/:business/productos', products.create);
  // Rutas fijas antes de /:id.
  router.get('/:business/productos/campos', products.fields);
  router.put('/:business/productos/orden', products.reorder);
  router.get('/:business/productos/:id', products.get);
  router.put('/:business/productos/:id', products.update);
  router.delete('/:business/productos/:id', products.remove);
  router.post('/:business/productos/:id/recuperar', products.restore);
  router.post('/:business/productos/:id/mover', products.move);

  return router;
}

