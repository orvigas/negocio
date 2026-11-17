import type { Middleware } from 'koa';

import type { Config } from '../config/env.ts';

/**
 * El /admin de las landings se retiró (REQ-F-045, RF-1 y RN-1): la administración vive en el admin
 * nuevo (inventory-manager, ADMIN_NEW_URL).
 *
 * - GET y HEAD de /admin y /admin/* → 302 a la raíz del admin nuevo, siempre el mismo destino (sin la
 *   ruta ni la query de la petición: no hay redirección abierta). Temporal, para que una vuelta atrás
 *   no quede tapada por la caché del navegador.
 * - Cualquier otro método → 410, sin leer el cuerpo ni escribir nada.
 * - Sin ADMIN_NEW_URL (en local) → sigue al router, que responde 404.
 *
 * Nunca pone ni lee cookies.
 */
const ADMIN_PREFIX = '/admin';
const isAdminPath = (path: string): boolean => path === ADMIN_PREFIX || path.startsWith(`${ADMIN_PREFIX}/`);

export function createAdminMoved({ config }: { config: Pick<Config, 'adminNewUrl'> }): Middleware {
  const target = config.adminNewUrl === undefined ? undefined : `${config.adminNewUrl}/`;

  return async function adminMoved(ctx, next) {
    if (target === undefined || !isAdminPath(ctx.path)) {
      await next();
      return;
    }
    ctx.set('Cache-Control', 'no-store');
    ctx.set('X-Robots-Tag', 'noindex, nofollow');
    if (ctx.method === 'GET' || ctx.method === 'HEAD') {
      ctx.status = 302;
      ctx.set('Location', target);
      return;
    }
    ctx.status = 410;
    ctx.type = 'json';
    ctx.body = { error: { code: 'ADMIN_MOVED', message: 'La administración se mudó al admin nuevo.' } };
  };
}
