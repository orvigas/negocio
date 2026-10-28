import type { Middleware } from 'koa';

import type { Logger } from '@restaurante/web';

/**
 * Cabeceras del admin nuevo (REQ-F-039, RF-5 y CA-16): ninguna respuesta se indexa (`noindex`) y
 * ninguna respuesta dinámica se guarda en caché (`no-store`: el botón atrás tras salir no muestra
 * datos). Los CSS y JS estáticos, sin datos, sí se cachean (koa-static pone su `max-age`). En
 * producción solo por HTTPS (con TRUST_PROXY, Koa lee X-Forwarded-Proto de Traefik).
 */
/** Salud del contenedor (src/routes.ts). */
export const HEALTH_PATH = '/salud';

export function createSecurityHeaders({ isProduction, logger }: { isProduction: boolean; logger: Logger }): Middleware {
  return async function securityHeaders(ctx, next) {
    ctx.set('X-Robots-Tag', 'noindex, nofollow');
    ctx.set('Cache-Control', 'no-store');
    // Con `same-origin` el navegador envía el Origin real en los POST (primera capa contra CSRF).
    ctx.set('Referrer-Policy', 'same-origin');
    // `/salud` responde también sin TLS: el HEALTHCHECK del contenedor habla por HTTP con 127.0.0.1
    // (DEF-005 de QA). No devuelve datos.
    if (isProduction && !ctx.secure && ctx.path !== HEALTH_PATH) {
      logger.warn('admin_requires_https', { path: ctx.path });
      ctx.status = 503;
      ctx.type = 'text';
      ctx.body = 'Administración disponible solo por HTTPS.';
      return;
    }
    await next();
  };
}
