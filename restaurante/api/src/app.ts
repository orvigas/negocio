import Koa, { type Middleware } from 'koa';

import { isPublicBusinessId, productsResponseSchemas, type ApiError } from '@restaurante/contracts';
import { toPublished, type ProductStore } from '@restaurante/core/catalog';
import { DatabaseUnavailableError, errorProp, isBusinessId, silentLogger, type Logger } from '@restaurante/core/shared';

/**
 * App de la API (REQ-F-038, RF-1). Construida sin abrir puertos (testeable).
 *
 *   GET|HEAD /api/v1/public/{molotes|birria}/productos -> 200 { data } (contrato de contracts)
 *
 * - Solo lectura y sin caché propia: cada petición lee el estado confirmado en la base (CA-3).
 * - Errores con el formato { error: { code, message } }: 404 (negocio u otra ruta), 405 (otro
 *   método, con Allow), 503 (base no disponible) y 500. Nunca stack, SQL ni credenciales; el log
 *   solo lleva el nombre y el código del error.
 */

const PRODUCTS_PATH = /^\/api\/v1\/public\/([^/]+)\/productos$/;
const ALLOWED_METHODS = 'GET, HEAD';

class ApiHttpError extends Error {
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

function sendError(ctx: Koa.Context, status: number, code: string, message: string): void {
  const body: ApiError = { error: { code, message } };
  ctx.status = status;
  ctx.body = body;
}

function createErrorHandler(logger: Logger): Middleware {
  return async function errorHandler(ctx, next) {
    try {
      await next();
      if (ctx.body == null && ctx.status === 404) throw new ApiHttpError(404, 'NOT_FOUND', 'Recurso no encontrado.');
    } catch (err) {
      if (err instanceof ApiHttpError) {
        for (const [name, value] of Object.entries(err.headers)) ctx.set(name, value);
        sendError(ctx, err.status, err.code, err.message);
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

function createRequestLogger(logger: Logger): Middleware {
  return async function requestLogger(ctx, next) {
    const start = performance.now();
    try {
      await next();
    } finally {
      logger.info('request', { method: ctx.method, path: ctx.path, status: ctx.status, durationMs: Math.round((performance.now() - start) * 100) / 100 });
    }
  };
}

export interface ApiAppOptions {
  /** Store de productos (Prisma en producción, memoria en las pruebas). Solo se lee. */
  store: Pick<ProductStore, 'listBusiness'>;
  logger?: Logger;
}

export function createApiApp({ store, logger = silentLogger }: ApiAppOptions): Koa {
  if (typeof store?.listBusiness !== 'function') throw new TypeError('createApiApp requiere el store de productos');
  const app = new Koa();
  // Los errores se registran en el manejador central, sin el mensaje (podría contener datos).
  app.silent = true;

  app.use(createRequestLogger(logger));
  app.use(createErrorHandler(logger));
  app.use(async (ctx, next) => {
    ctx.set('Cache-Control', 'no-store');
    ctx.set('X-Content-Type-Options', 'nosniff');
    await next();
  });
  app.use(async (ctx) => {
    const match = PRODUCTS_PATH.exec(ctx.path);
    if (!match) throw new ApiHttpError(404, 'NOT_FOUND', 'Recurso no encontrado.');
    if (ctx.method !== 'GET' && ctx.method !== 'HEAD') {
      throw new ApiHttpError(405, 'METHOD_NOT_ALLOWED', 'Método no permitido.', { Allow: ALLOWED_METHODS });
    }
    const business = match[1];
    if (!isPublicBusinessId(business) || !isBusinessId(business)) throw new ApiHttpError(404, 'BUSINESS_NOT_FOUND', 'Negocio desconocido.');
    const published = toPublished(business, await store.listBusiness(business));
    const parsed = productsResponseSchemas[business].safeParse({ data: published });
    if (!parsed.success) {
      logger.error('products_response_invalid', { business, issues: parsed.error.issues.length });
      throw new Error('La respuesta no cumple el contrato');
    }
    ctx.type = 'application/json; charset=utf-8';
    ctx.body = parsed.data;
  });
  return app;
}
