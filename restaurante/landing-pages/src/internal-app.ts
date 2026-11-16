import Koa from 'koa';

import { safeEqualStrings } from '@restaurante/core/identity';
import { errorProp, isBusinessId, silentLogger, type Logger } from '@restaurante/core/shared';
import { readJsonBody } from '@restaurante/web';

import type { LandingProducts } from './services/landing-products.ts';

/**
 * Puerto interno de landing-pages (REQ-F-039, RF-12 a RF-14): solo el aviso de la API tras cada
 * escritura confirmada de productos. Desde REQ-F-042 el bot vive en la api (con su propia caché, ya
 * recargada por la escritura): el aviso solo invalida la caché de la landing.
 *
 *   POST /internal/v1/productos-cambiados  { "business": "molotes" | "birria" }
 *   Authorization: Bearer <INTERNAL_NOTIFY_TOKEN>
 *   -> 200 { landing }  (true si la landing ya tiene los datos nuevos)
 *
 * - Se sirve en INTERNAL_PORT, nunca en el puerto de la app: Traefik solo enruta al de la app, así que
 *   el aviso no es accesible desde internet. Una petición con X-Forwarded-For (pasó por un proxy)
 *   recibe 404, igual que cualquier otra ruta.
 * - Sin credencial o con una incorrecta: 401 y no se invalida nada (RF-14).
 * - El log nunca lleva la credencial.
 */

export const INTERNAL_NOTIFY_PATH = '/internal/v1/productos-cambiados';
const BEARER = /^Bearer (\S+)$/;

export interface InternalAppOptions {
  token: string;
  landingProducts: Pick<LandingProducts, 'invalidate' | 'confirmFresh'>;
  logger?: Logger;
}

function sendError(ctx: Koa.Context, status: number, code: string, message: string): void {
  ctx.status = status;
  ctx.body = { error: { code, message } };
}

export function createInternalApp({ token, landingProducts, logger = silentLogger }: InternalAppOptions): Koa {
  if (typeof token !== 'string' || token === '') throw new TypeError('createInternalApp requiere la credencial');
  const app = new Koa();
  app.silent = true;

  app.use(async (ctx, next) => {
    ctx.set('Cache-Control', 'no-store');
    try {
      await next();
    } catch (err) {
      const status = errorProp(err, 'status');
      if (typeof status === 'number' && status >= 400 && status < 500 && errorProp(err, 'expose') === true) {
        const code = errorProp(err, 'code');
        return sendError(ctx, status, typeof code === 'string' ? code : 'BAD_REQUEST', String(errorProp(err, 'message')));
      }
      logger.error('internal_request_error', { path: ctx.path, name: errorProp(err, 'name'), code: errorProp(err, 'code') });
      return sendError(ctx, 500, 'INTERNAL_ERROR', 'Error interno.');
    }
    return undefined;
  });

  app.use(async (ctx) => {
    if (ctx.path !== INTERNAL_NOTIFY_PATH || ctx.method !== 'POST' || ctx.get('X-Forwarded-For') !== '') {
      return sendError(ctx, 404, 'NOT_FOUND', 'Recurso no encontrado.');
    }
    const received = BEARER.exec(ctx.get('Authorization'))?.[1];
    if (received === undefined || !safeEqualStrings(received, token)) {
      logger.warn('internal_notify_rejected', { reason: received === undefined ? 'missing' : 'invalid' });
      return sendError(ctx, 401, 'INVALID_CREDENTIALS', 'Credencial no válida.');
    }
    const body = await readJsonBody(ctx, { limit: 1024 });
    const business = body !== null && typeof body === 'object' ? (body as Record<string, unknown>).business : undefined;
    if (!isBusinessId(business)) return sendError(ctx, 400, 'INVALID_BUSINESS', 'Negocio desconocido.');

    // La landing espera los datos nuevos en su siguiente visita.
    landingProducts.invalidate(business);
    const landing = await landingProducts.confirmFresh(business);
    logger.info('products_change_notified', { business, landing });
    ctx.body = { landing };
    return undefined;
  });

  return app;
}
