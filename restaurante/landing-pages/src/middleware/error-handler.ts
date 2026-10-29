import { STATUS_CODES } from 'node:http';

import type { Middleware } from 'koa';

import { errorProp, type Logger } from '@restaurante/core/shared';
import { serializeError } from '@restaurante/web';

/**
 * Manejo centralizado de errores y de respuestas de error sin cuerpo (404, 405, 501).
 * Respuesta: { error: { code, message } }.
 * - Errores 5xx: mensaje genérico; nunca se exponen detalles internos.
 * - El stack solo se incluye si `exposeStack` es true (nunca en producción).
 */

const DEFAULT_CODES: Readonly<Record<number, string>> = Object.freeze({
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  406: 'NOT_ACCEPTABLE',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL_ERROR',
  501: 'NOT_IMPLEMENTED',
  503: 'SERVICE_UNAVAILABLE',
});

const CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/;

function normalizeStatus(status: unknown): number {
  return typeof status === 'number' && Number.isInteger(status) && status >= 400 && status <= 599 ? status : 500;
}

function resolveCode(err: unknown, status: number): string {
  const code = errorProp(err, 'code');
  if (status < 500 && typeof code === 'string' && CODE_PATTERN.test(code)) return code;
  return DEFAULT_CODES[status] ?? (status < 500 ? 'CLIENT_ERROR' : 'INTERNAL_ERROR');
}

export function createErrorHandler({ logger, exposeStack = false }: { logger: Logger; exposeStack?: boolean }): Middleware {
  return async function errorHandler(ctx, next) {
    try {
      await next();
      // Respuestas de error sin cuerpo (404 final, 405/501 del router) -> formato común.
      if (ctx.status >= 400 && ctx.body == null) ctx.throw(ctx.status);
    } catch (err) {
      const status = normalizeStatus(errorProp(err, 'status') ?? errorProp(err, 'statusCode'));
      const isClientError = status < 500;
      const message = isClientError && errorProp(err, 'expose') ? errorProp(err, 'message') : STATUS_CODES[status];

      const logFields = { method: ctx.method, path: ctx.path, status };
      if (isClientError) {
        logger.warn('request_error', logFields);
      } else {
        logger.error('request_error', { ...logFields, err: serializeError(err) });
      }

      const headers = errorProp(err, 'headers');
      if (isClientError && headers && typeof headers === 'object') {
        // Cabeceras de un HttpError de Koa (p. ej. Retry-After): objeto nombre -> valor.
        ctx.set(headers as Record<string, string | string[]>);
      }
      ctx.status = status;
      ctx.type = 'json';
      ctx.body = {
        error: {
          code: resolveCode(err, status),
          message,
          ...(exposeStack && err instanceof Error ? { stack: err.stack } : {}),
        },
      };
    }
  };
}
