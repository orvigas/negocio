import Koa, { type Middleware } from 'koa';

import { ADMIN_API_PREFIX, isPublicBusinessId, productsResponseSchemas } from '@restaurante/contracts';
import { toPublished, type ProductStore } from '@restaurante/core/catalog';
import { isBusinessId, silentLogger, type Logger } from '@restaurante/core/shared';

import { createAdminRouter } from './admin/router.ts';
import type { ProductRoutes } from './admin/product-routes.ts';
import type { SessionRoutes } from './admin/session-routes.ts';
import { ApiHttpError, createErrorHandler } from './errors.ts';

/**
 * App de la API (REQ-F-038, RF-1; REQ-F-039). Construida sin abrir puertos (testeable).
 *
 *   GET|HEAD /api/v1/public/{molotes|birria}/productos -> 200 { data } (contrato de contracts)
 *   /api/v1/admin/...                                  -> administración (src/admin/router.ts),
 *                                                         solo si se pasan sus rutas (`admin`)
 *
 * La API solo es alcanzable desde la red interna (sin puertos publicados ni router de Traefik): por
 * eso confía en `X-Forwarded-For` (`proxy`, último valor), que pone el admin con la IP del visitante.
 *
 * - Sin caché propia: cada petición lee el estado confirmado en la base (CA-3 de REQ-F-038).
 * - Errores con el formato { error: { code, message } }: 404 (negocio u otra ruta), 405 (otro
 *   método, con Allow), 503 (base no disponible) y 500. Nunca stack, SQL ni credenciales; el log
 *   solo lleva el nombre y el código del error.
 */

const PRODUCTS_PATH = /^\/api\/v1\/public\/([^/]+)\/productos$/;
const ALLOWED_METHODS = 'GET, HEAD';

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
  /** Store de productos (Prisma en producción, memoria en las pruebas). La parte pública solo lo lee. */
  store: Pick<ProductStore, 'listBusiness'>;
  /** Rutas de administración (REQ-F-039); sin ellas, /api/v1/admin responde 404. */
  admin?: { session: SessionRoutes; products: ProductRoutes } | undefined;
  logger?: Logger;
}

const isAdminPath = (path: string): boolean => path === ADMIN_API_PREFIX || path.startsWith(`${ADMIN_API_PREFIX}/`);

export function createApiApp({ store, admin, logger = silentLogger }: ApiAppOptions): Koa {
  if (typeof store?.listBusiness !== 'function') throw new TypeError('createApiApp requiere el store de productos');
  const app = new Koa();
  // Los errores se registran en el manejador central, sin el mensaje (podría contener datos).
  app.silent = true;
  // Solo red interna: la IP del visitante es el último valor de X-Forwarded-For (lo pone el admin).
  app.proxy = true;
  app.maxIpsCount = 1;

  app.use(createRequestLogger(logger));
  app.use(createErrorHandler(logger));
  app.use(async (ctx, next) => {
    ctx.set('Cache-Control', 'no-store');
    ctx.set('X-Content-Type-Options', 'nosniff');
    await next();
  });
  if (admin) {
    // El router solo atiende su prefijo; el resto de rutas sigue al manejador público.
    const router = createAdminRouter(admin);
    app.use(router.routes());
    app.use(router.allowedMethods());
  }
  app.use(async (ctx) => {
    // Rutas de administración sin coincidencia: 404 sin cuerpo, para que allowedMethods responda 405
    // si la ruta existe con otro método (y, si no, el manejador central responda 404).
    if (isAdminPath(ctx.path)) return;
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
