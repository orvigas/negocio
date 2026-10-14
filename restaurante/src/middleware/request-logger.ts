/**
 * Registra cada request con método, ruta (sin query string, que podría contener
 * datos sensibles), estado, duración, IP del cliente y esquema (REQ-F-016, D-4).
 *
 * Con TRUST_PROXY=true, `ctx.ip` y `ctx.protocol` salen de X-Forwarded-For (solo la última IP,
 * la que añade el proxy: `maxIpsCount = 1` en app.ts) y de X-Forwarded-Proto. Sin proxy de
 * confianza son la IP del socket y `http`. La IP es un dato personal: en producción la retención
 * la limita la rotación de logs de Docker (deploy/compose.prod.yaml).
 */
import type { Middleware } from 'koa';

import type { Logger } from '../utils/logger.ts';

export function createRequestLogger({ logger }: { logger: Logger }): Middleware {
  return async function requestLogger(ctx, next) {
    const start = performance.now();
    try {
      await next();
    } finally {
      logger.info('request', {
        method: ctx.method,
        path: ctx.path,
        status: ctx.status,
        durationMs: Math.round((performance.now() - start) * 100) / 100,
        ip: ctx.ip,
        protocol: ctx.protocol,
      });
    }
  };
}
