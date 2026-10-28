import type Koa from 'koa';
import type { Middleware } from 'koa';

import type { ApiError } from '@restaurante/contracts';
import { DatabaseUnavailableError, errorProp, type Logger } from '@restaurante/core/shared';

/**
 * Errores de la API con el formato { error: { code, message } } (REQ-F-038; `.claude/rules/manejo-de-errores.md`).
 * Nunca stack, SQL ni credenciales; el log solo lleva el nombre y el código del error.
 */

export class ApiHttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly headers: Readonly<Record<string, string>>;

  constructor(status: number, code: string, message: string, headers: Record<string, string> = {}) {
    super(message);
    this.name = 'ApiHttpError';
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}

export function sendError(ctx: Koa.Context, status: number, code: string, message: string): void {
  const body: ApiError = { error: { code, message } };
  ctx.status = status;
  ctx.body = body;
}

/** Error 4xx de `ctx.throw` (lectura del cuerpo con @restaurante/web): su mensaje es para el cliente. */
function exposedClientError(err: unknown): { status: number; code: string; message: string } | null {
  const status = errorProp(err, 'status');
  if (typeof status !== 'number' || status < 400 || status > 499 || errorProp(err, 'expose') !== true) return null;
  const code = errorProp(err, 'code');
  return { status, code: typeof code === 'string' ? code : 'BAD_REQUEST', message: String(errorProp(err, 'message')) };
}

export function createErrorHandler(logger: Logger): Middleware {
  return async function errorHandler(ctx, next) {
    try {
      await next();
      if (ctx.body == null && ctx.status === 404) throw new ApiHttpError(404, 'NOT_FOUND', 'Recurso no encontrado.');
      // 405 del router de administración (allowedMethods ya puso Allow).
      if (ctx.body == null && ctx.status === 405) throw new ApiHttpError(405, 'METHOD_NOT_ALLOWED', 'Método no permitido.');
    } catch (err) {
      if (err instanceof ApiHttpError) {
        for (const [name, value] of Object.entries(err.headers)) ctx.set(name, value);
        sendError(ctx, err.status, err.code, err.message);
        return;
      }
      const client = exposedClientError(err);
      if (client) {
        sendError(ctx, client.status, client.code, client.message);
        return;
      }
      if (err instanceof DatabaseUnavailableError) {
        logger.error('request_error', { method: ctx.method, path: ctx.path, status: 503, name: err.name, code: errorProp(err.details, 'code') });
        sendError(ctx, 503, 'DATABASE_UNAVAILABLE', 'Servicio no disponible temporalmente.');
        return;
      }
      logger.error('request_error', { method: ctx.method, path: ctx.path, status: 500, name: errorProp(err, 'name'), code: errorProp(err, 'code') });
      sendError(ctx, 500, 'INTERNAL_ERROR', 'Error interno.');
    }
  };
}
