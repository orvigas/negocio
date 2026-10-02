/**
 * Registra cada request con método, ruta (sin query string, que podría contener
 * datos sensibles), estado y duración.
 */
export function createRequestLogger({ logger }) {
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
      });
    }
  };
}
