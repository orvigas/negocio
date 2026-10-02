import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import Koa from 'koa';
import helmet from 'koa-helmet';
import serve from 'koa-static';

import { createErrorHandler } from './middleware/error-handler.js';
import { createRequestLogger } from './middleware/request-logger.js';
import { createRouter } from './routes/index.js';
import { silentLogger } from './utils/logger.js';
import { createRenderer } from './views/render.js';

const SRC_DIR = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_VIEWS_DIR = join(SRC_DIR, 'views');
export const DEFAULT_PUBLIC_DIR = join(SRC_DIR, '..', 'public');

/**
 * Construye la app Koa sin abrir puertos (testeable con Supertest).
 *
 * @param {{
 *   config: ReturnType<typeof import('./config/env.js').loadConfig>,
 *   logger?: object,
 *   now?: () => Date,
 *   viewsDir?: string,
 *   publicDir?: string,
 * }} options
 */
export function createApp({
  config,
  logger = silentLogger,
  now = () => new Date(),
  viewsDir = DEFAULT_VIEWS_DIR,
  publicDir = DEFAULT_PUBLIC_DIR,
}) {
  if (!config) throw new TypeError('createApp requiere la configuración');

  const app = new Koa();
  app.env = config.nodeEnv;
  // Los errores se registran en el middleware centralizado; evita el log duplicado de Koa.
  app.silent = true;

  // Plantillas cargadas una sola vez al construir la app.
  const renderer = createRenderer({ viewsDir });
  const router = createRouter({ config, renderer, now });

  app.use(createRequestLogger({ logger }));
  app.use(createErrorHandler({ logger, exposeStack: config.nodeEnv === 'development' }));
  app.use(helmet());
  app.use(
    serve(publicDir, {
      index: false,
      maxage: config.isProduction ? 60 * 60 * 1000 : 0,
    }),
  );
  app.use(router.routes());
  app.use(router.allowedMethods());

  return app;
}
