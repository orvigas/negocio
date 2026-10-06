import Router from '@koa/router';

import { createAdminProductsApi } from '../controllers/admin-products-api.ts';
import type { AdminDeps } from '../controllers/admin.ts';
import type { AdminState } from '../middleware/admin-guard.ts';

/**
 * API JSON de productos (REQ-F-008, RF-5 y DT-10). Todas las rutas exigen sesión; las escrituras,
 * además, el token CSRF en la cabecera X-CSRF-Token (se obtiene con GET /admin/api/sesion).
 *
 * GET    /admin/api/sesion                              -> usuario y token CSRF
 * GET    /admin/api/:negocio/productos                  -> listar (?eliminados=1, ?categoria=platillo|bebida)
 * POST   /admin/api/:negocio/productos                  -> crear (201)
 * PUT    /admin/api/:negocio/productos/orden            -> reordenar una categoría completa
 * GET    /admin/api/:negocio/productos/:id              -> ver
 * PUT    /admin/api/:negocio/productos/:id              -> actualizar (reemplazo completo, con `version`)
 * DELETE /admin/api/:negocio/productos/:id?version=N    -> eliminar (borrado lógico)
 * POST   /admin/api/:negocio/productos/:id/recuperar    -> recuperar ({ version })
 */
export function createAdminApiRouter(deps: AdminDeps): Router<AdminState> {
  const api = createAdminProductsApi(deps);
  const router = new Router<AdminState>({ prefix: '/api' });

  router.get('/sesion', api.session);
  router.get('/:business/productos', api.list);
  router.post('/:business/productos', api.create);
  // Ruta fija antes de /:id.
  router.put('/:business/productos/orden', api.reorder);
  router.get('/:business/productos/:id', api.get);
  router.put('/:business/productos/:id', api.update);
  router.delete('/:business/productos/:id', api.remove);
  router.post('/:business/productos/:id/recuperar', api.restore);

  return router;
}
