import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import Koa from 'koa';
import helmet from 'koa-helmet';
import serve from 'koa-static';

import type { AdminApiClient } from '@restaurante/contracts';
import { createRenderer, type Logger } from '@restaurante/web';

import type { InventoryConfig } from './config.ts';
import { createAdminController } from './controllers/admin.ts';
import { createErrorHandler } from './middleware/error-handler.ts';
import { createRequestLogger } from './middleware/request-logger.ts';
import { createSecurityHeaders } from './middleware/security.ts';
import { createRouter } from './routes.ts';
import { createViews } from './views/index.ts';

const SRC_DIR = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_VIEWS_DIR = join(SRC_DIR, 'views');
export const DEFAULT_PUBLIC_DIR = join(SRC_DIR, '..', 'public');

const noop = () => {};
const silentLogger: Logger = Object.freeze({ debug: noop, info: noop, warn: noop, error: noop });

export interface InventoryAppOptions {
  config: InventoryConfig;
  api: AdminApiClient;
  logger?: Logger;
  viewsDir?: string;
  publicDir?: string;
}

/**
 * App del admin nuevo (REQ-F-039), construida sin abrir puertos (testeable). CSP estricta: solo
 * recursos propios y las fuentes de Google (como las landings); ningún script en línea.
 */
export function createInventoryApp({ config, api, logger = silentLogger, viewsDir = DEFAULT_VIEWS_DIR, publicDir = DEFAULT_PUBLIC_DIR }: InventoryAppOptions): Koa {
  const app = new Koa();
  app.env = config.nodeEnv;
  // Detrás de Traefik: HTTPS e IP real del visitante de X-Forwarded-* (solo el último valor).
  app.proxy = config.trustProxy;
  app.maxIpsCount = 1;
  app.silent = true;

  const views = createViews(createRenderer({ viewsDir }));
  const router = createRouter(createAdminController({ config, api, views, logger }));

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
  app.use(router.routes());
  app.use(router.allowedMethods());
  return app;
}
