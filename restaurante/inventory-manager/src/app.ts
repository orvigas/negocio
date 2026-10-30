import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import Koa from 'koa';
import helmet from 'koa-helmet';
import serve from 'koa-static';

import type { AdminApiClient } from '@restaurante/contracts';
import { createRenderer, type Logger } from '@restaurante/web';

import type { InventoryConfig } from './config.ts';
import { createAccountController } from './controllers/account.ts';
import { createAdminController } from './controllers/admin.ts';
import { createUsersController } from './controllers/users.ts';
import { createErrorHandler } from './middleware/error-handler.ts';
import { createRequestLogger } from './middleware/request-logger.ts';
import { createSecurityHeaders } from './middleware/security.ts';
import { createRouter } from './routes.ts';
import { createViews } from './views/index.ts';

const SRC_DIR = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_VIEWS_DIR = join(SRC_DIR, 'views');
export const DEFAULT_PUBLIC_DIR = join(SRC_DIR, '..', 'public');
/**
 * Iconos de las landings (favicon por negocio; REQ-F-039, PR 3): se leen de `public/img` de
 * landing-pages, en la misma ruta relativa en el repositorio y en la imagen Docker (que copia solo los
 * iconos, del mismo commit). Así no se duplican binarios en el repositorio.
 */
export const DEFAULT_ICONS_DIR = join(SRC_DIR, '..', '..', 'landing-pages', 'public', 'img');
const ICON_PATH = /^\/img\/(molotes|birria)\/icons\/(favicon\.ico|icon-32\.png)$/;
const ICON_TYPES: Readonly<Record<string, string>> = Object.freeze({ '.ico': 'image/x-icon', '.png': 'image/png' });

const noop = () => {};
const silentLogger: Logger = Object.freeze({ debug: noop, info: noop, warn: noop, error: noop });

export interface InventoryAppOptions {
  config: InventoryConfig;
  api: AdminApiClient;
  logger?: Logger;
  viewsDir?: string;
  publicDir?: string;
  iconsDir?: string;
}

/**
 * App del admin nuevo (REQ-F-039; usuarios y "Mi cuenta", REQ-F-040), construida sin abrir puertos (testeable). CSP estricta: solo
 * recursos propios y las fuentes de Google (como las landings); ningún script en línea.
 */
export function createInventoryApp({
  config,
  api,
  logger = silentLogger,
  viewsDir = DEFAULT_VIEWS_DIR,
  publicDir = DEFAULT_PUBLIC_DIR,
  iconsDir = DEFAULT_ICONS_DIR,
}: InventoryAppOptions): Koa {
  const app = new Koa();
  app.env = config.nodeEnv;
  // Detrás de Traefik: HTTPS e IP real del visitante de X-Forwarded-* (solo el último valor).
  app.proxy = config.trustProxy;
  app.maxIpsCount = 1;
  app.silent = true;

  const views = createViews(createRenderer({ viewsDir }));
  const deps = { config, api, views, logger };
  const router = createRouter({ admin: createAdminController(deps), users: createUsersController(deps), account: createAccountController(deps) });

  app.use(createRequestLogger(logger));
  app.use(createSecurityHeaders({ isProduction: config.isProduction, logger }));
  app.use(createErrorHandler({ views, logger }));
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'"],
          'style-src': ["'self'", 'https://fonts.googleapis.com'],
          'font-src': ['https://fonts.gstatic.com'],
          'img-src': ["'self'", 'data:'],
          'form-action': ["'self'"],
          'frame-ancestors': ["'none'"],
        },
      },
      referrerPolicy: { policy: 'same-origin' },
    }),
  );
  app.use(serve(publicDir, { index: false, maxage: config.isProduction ? 60 * 60 * 1000 : 0 }));
  // Favicon del negocio (lista cerrada de archivos: sin rutas recibidas del cliente).
  app.use(async (ctx, next) => {
    const match = ctx.method === 'GET' || ctx.method === 'HEAD' ? ICON_PATH.exec(ctx.path) : null;
    if (!match) {
      await next();
      return;
    }
    const [, business = '', file = ''] = match;
    const path = join(iconsDir, business, 'icons', file);
    const found = await stat(path).catch(() => null);
    if (!found?.isFile()) {
      await next();
      return;
    }
    ctx.set('Cache-Control', 'public, max-age=86400');
    ctx.type = ICON_TYPES[file.slice(file.lastIndexOf('.'))] ?? 'application/octet-stream';
    ctx.length = found.size;
    ctx.body = createReadStream(path);
  });
  app.use(router.routes());
  app.use(router.allowedMethods());
  return app;
}
