import Router from '@koa/router';

import { ADMIN_API_PREFIX } from '@restaurante/contracts';

import type { AccountRoutes } from './account-routes.ts';
import type { BotRoutes } from './bot-routes.ts';
import type { ProductRoutes } from './product-routes.ts';
import type { SessionRoutes } from './session-routes.ts';
import type { UserRoutes } from './user-routes.ts';

/**
 * Rutas de `/api/v1/admin` (REQ-F-039; usuarios y cuenta propia, REQ-F-040; control del bot, REQ-F-043). Una ruta conocida con otro método responde 405 con `Allow`
 * (`allowedMethods`; el cuerpo lo pone el manejador central); una ruta desconocida, 404.
 */
export function createAdminRouter({
  session,
  products,
  users,
  account,
  bot,
}: {
  session: SessionRoutes;
  products: ProductRoutes;
  users: UserRoutes;
  account: AccountRoutes;
  bot: BotRoutes;
}): Router {
  const router = new Router({ prefix: ADMIN_API_PREFIX });

  router.post('/sesion', session.login);
  router.get('/sesion', session.current);
  router.delete('/sesion', session.logout);

  // Usuarios antes que productos: `/usuarios/productos` es un id de usuario mal formado (403 para un
  // editor, 404 para un administrador), no el negocio "usuarios".
  router.get('/usuarios', users.list);
  router.post('/usuarios', users.create);
  router.get('/usuarios/:id', users.get);
  router.put('/usuarios/:id', users.update);
  router.post('/usuarios/:id/desactivar', users.deactivate);
  router.post('/usuarios/:id/reactivar', users.reactivate);
  router.put('/usuarios/:id/contrasena', users.resetPassword);

  router.post('/cuenta/contrasena', account.changePassword);

  router.get('/bot', bot.state);
  router.put('/bot/interruptor', bot.setPaused);
  router.post('/bot/bloqueos', bot.block);
  router.post('/bot/bloqueos/:id/quitar', bot.unblock);
  router.post('/bot/topes/:token/bloquear', bot.blockReached);

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

