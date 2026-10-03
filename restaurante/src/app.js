import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import Koa from 'koa';
import helmet from 'koa-helmet';
import serve from 'koa-static';

import { createAdminGate } from './middleware/admin-guard.js';
import { createErrorHandler } from './middleware/error-handler.js';
import { createRequestLogger } from './middleware/request-logger.js';
import { assertMenuRepository } from './repositories/menu-repository.js';
import { createRouter } from './routes/index.js';
import { createAdminAuthenticator } from './services/admin-auth.js';
import { createImageChecker } from './services/admin-form.js';
import { createLoginThrottle } from './services/login-throttle.js';
import { createSessionStore } from './services/session-store.js';
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
 *   repository: object,
 *   logger?: object,
 *   now?: () => Date,
 *   viewsDir?: string,
 *   publicDir?: string,
 * }} options `repository`: repositorio de menús ya inicializado (src/repositories/; REQ-F-001, RF-9).
 */
export function createApp({
  config,
  repository,
  logger = silentLogger,
  now = () => new Date(),
  viewsDir = DEFAULT_VIEWS_DIR,
  publicDir = DEFAULT_PUBLIC_DIR,
}) {
  if (!config) throw new TypeError('createApp requiere la configuración');
  assertMenuRepository(repository);

  const app = new Koa();
  app.env = config.nodeEnv;
  // Detrás de nginx con TLS: respeta X-Forwarded-Proto/For (HTTPS e IP real del visitante).
  app.proxy = config.trustProxy;
  // Solo se confía en la última IP de X-Forwarded-For (la que añade nginx): el cliente no
  // puede falsearla para esquivar el límite de intentos de acceso.
  app.maxIpsCount = 1;
  // Los errores se registran en el middleware centralizado; evita el log duplicado de Koa.
  app.silent = true;

  // Plantillas cargadas una sola vez al construir la app.
  const renderer = createRenderer({ viewsDir });
  // Administración de menús: solo con credenciales configuradas (DT-7).
  const admin = config.admin.enabled
    ? {
        logger,
        sessions: createSessionStore({ now }),
        throttle: createLoginThrottle({ now }),
        authenticator: createAdminAuthenticator(config.admin),
        imageExists: createImageChecker(publicDir),
      }
    : undefined;
  const router = createRouter({ config, renderer, now, repository, publicDir, admin });

  app.use(createRequestLogger({ logger }));
  app.use(createErrorHandler({ logger, exposeStack: config.nodeEnv === 'development' }));
  app.use(helmet());
  app.use(createAdminGate({ config, logger }));
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
