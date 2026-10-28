import type { Middleware } from 'koa';

import type { Logger } from '@restaurante/web';

/**
 * Una línea por petición: método, ruta (sin query), estado, duración e IP. Nunca cookies, cabeceras
 * de autorización, cuerpos ni tokens (CA-16).
 */
export function createRequestLogger(logger: Logger): Middleware {
  return async function requestLogger(ctx, next) {
    const start = performance.now();
    try {
      await next();
    } finally {
      logger.info('request', { method: ctx.method, path: ctx.path, status: ctx.status, durationMs: Math.round((performance.now() - start) * 100) / 100, ip: ctx.ip });
    }
  };
}
