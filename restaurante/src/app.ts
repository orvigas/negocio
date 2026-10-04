import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import Koa from 'koa';
import helmet from 'koa-helmet';
import serve from 'koa-static';

import type { Config } from './config/env.ts';
import { createAdminGate } from './middleware/admin-guard.ts';
import { createErrorHandler } from './middleware/error-handler.ts';
import { createRequestLogger } from './middleware/request-logger.ts';
import { assertMenuRepository } from './repositories/menu-repository.ts';
import { createRouter } from './routes/index.ts';
import { createAdminAuthenticator } from './services/admin-auth.ts';
import { createImageChecker } from './services/admin-form.ts';
import { createLoginThrottle } from './services/login-throttle.ts';
import { createSessionStore } from './services/session-store.ts';
import { silentLogger, type Logger } from './utils/logger.ts';
import { createRenderer } from './views/render.ts';

const SRC_DIR = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_VIEWS_DIR = join(SRC_DIR, 'views');
export const DEFAULT_PUBLIC_DIR = join(SRC_DIR, '..', 'public');

export interface AppOptions {
  config: Config;
  /** Repositorio de menús ya inicializado (src/repositories/; REQ-F-001, RF-9). Se valida al crear la app. */
  repository: unknown;
  logger?: Logger;
  now?: () => Date;
  viewsDir?: string;
  publicDir?: string;
}

/** Construye la app Koa sin abrir puertos (testeable con Supertest). */
export function createApp({
  config,
  repository,
  logger = silentLogger,
  now = () => new Date(),
  viewsDir = DEFAULT_VIEWS_DIR,
  publicDir = DEFAULT_PUBLIC_DIR,
}: AppOptions): Koa {
  if (!config) throw new TypeError('createApp requiere la configuración');
  const menuRepository = assertMenuRepository(repository);

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
  const router = createRouter({ config, renderer, now, repository: menuRepository, publicDir, admin });

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
