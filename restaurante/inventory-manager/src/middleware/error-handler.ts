import type { Middleware } from 'koa';

import type { Logger } from '@restaurante/web';

import type { Views } from '../views/index.ts';

/**
 * Errores como páginas HTML sin trazas ni detalles internos (`.claude/rules/manejo-de-errores.md`):
 * 403 (mismo origen), 400/413/415 (formulario), 404 (ruta desconocida) y 500. El log solo lleva el
 * nombre y el código del error.
 */
export function createErrorHandler({ views, logger }: { views: Views; logger: Logger }): Middleware {
  return async function errorHandler(ctx, next) {
    try {
      await next();
      if (ctx.status === 404 && ctx.body == null) {
        ctx.status = 404;
        ctx.type = 'html';
        ctx.body = views.message({ title: 'No encontrado', notice: { tone: 'warning', title: 'No encontramos lo que buscas.' } }).toString();
      }
    } catch (err) {
      const status = typeof (err as { status?: unknown }).status === 'number' ? (err as { status: number }).status : 500;
      const expose = (err as { expose?: unknown }).expose === true && status < 500;
      if (status >= 500) logger.error('request_error', { method: ctx.method, path: ctx.path, status, name: err instanceof Error ? err.name : 'unknown' });
      else logger.warn('request_error', { method: ctx.method, path: ctx.path, status });
      ctx.status = status >= 400 && status < 600 ? status : 500;
      ctx.type = 'html';
      const title = status === 403 ? 'Petición no válida' : status < 500 ? 'No se pudo procesar' : 'Error interno';
      const message = expose && err instanceof Error ? err.message : 'Ocurrió un error inesperado. Inténtalo de nuevo.';
      ctx.body = views.message({ title, notice: { tone: 'error', title: message } }).toString();
    }
  };
}
