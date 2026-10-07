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
import type { ProductRepository } from './repositories/product-repository.ts';
import type { UserRepository } from './repositories/user-repository.ts';
import { createRouter } from './routes/index.ts';
import { SCRYPT_DEFAULTS, createUserAuthenticator, type PasswordHashParams } from './services/admin-auth.ts';
import { createImageChecker } from './services/admin-form.ts';
import { getActiveBusinessId } from './services/business-schedule.ts';
import { createLoginThrottle } from './services/login-throttle.ts';
import { createSessionStore } from './services/session-store.ts';
import { createWhatsAppBot, type WhatsAppBot } from './services/whatsapp-bot/bot.ts';
import { createCloudApiClient, type FetchLike } from './services/whatsapp-bot/cloud-api.ts';
import { silentLogger, type Logger } from './utils/logger.ts';
import { renderAdminUnavailable } from './views/admin/index.ts';
import { createRenderer } from './views/render.ts';

const SRC_DIR = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_VIEWS_DIR = join(SRC_DIR, 'views');
export const DEFAULT_PUBLIC_DIR = join(SRC_DIR, '..', 'public');

export interface AppOptions {
  config: Config;
  /** Repositorio de menús ya inicializado (src/repositories/; REQ-F-001, RF-9). Se valida al crear la app. */
  repository: unknown;
  /** Productos (REQ-F-008), ya inicializados: importación hecha y caché cargada. */
  products: ProductRepository;
  /**
   * Usuarios de /admin (REQ-F-007). Sin ellos, la administración no se monta y /admin responde
   * 503 (p. ej. en las pruebas de las landings).
   */
  users?: UserRepository | undefined;
  /** Costo de scrypt para contraseñas nuevas (por defecto SCRYPT_DEFAULTS; las pruebas lo bajan). */
  hashParams?: PasswordHashParams;
  logger?: Logger;
  now?: () => Date;
  /**
   * Bot de WhatsApp ya construido (REQ-F-009; las pruebas lo crean con el doble de la Cloud API).
   * Sin él, si `config.whatsappBot` existe, se crea con `cloudApiFetch` (por defecto, `fetch`).
   */
  whatsappBot?: WhatsAppBot | undefined;
  cloudApiFetch?: FetchLike;
  viewsDir?: string;
  publicDir?: string;
}

/** Construye la app Koa sin abrir puertos (testeable con Supertest). */
export function createApp({
  config,
  repository,
  products,
  users,
  hashParams = SCRYPT_DEFAULTS,
  logger = silentLogger,
  now = () => new Date(),
  whatsappBot,
  cloudApiFetch = (url, init) => fetch(url, init),
  viewsDir = DEFAULT_VIEWS_DIR,
  publicDir = DEFAULT_PUBLIC_DIR,
}: AppOptions): Koa {
  if (!config) throw new TypeError('createApp requiere la configuración');
  const menuRepository = assertMenuRepository(repository);
  if (typeof products?.getPublished !== 'function') throw new TypeError('createApp requiere el repositorio de productos');

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
  // Administración: cuentas personales en la base de datos (REQ-F-007).
  const admin = users
    ? {
        logger,
        users,
        hashParams,
        sessions: createSessionStore({ now }),
        throttle: createLoginThrottle({ now }),
        authenticator: createUserAuthenticator({ users, hashParams }),
        imageExists: createImageChecker(publicDir),
      }
    : undefined;
  const renderUnavailable = () =>
    renderAdminUnavailable(renderer, { faviconBusinessId: getActiveBusinessId({ now: now(), timeZone: config.timezone }) }).toString();
  // Bot de WhatsApp (REQ-F-009): solo con su configuración; sin ella, el webhook responde 503.
  const bot =
    whatsappBot ??
    (config.whatsappBot
      ? createWhatsAppBot({
          config: config.whatsappBot,
          timeZone: config.timezone,
          products,
          client: createCloudApiClient({ config: config.whatsappBot, fetch: cloudApiFetch, logger }),
          logger,
          now,
        })
      : undefined);
  const router = createRouter({ config, renderer, now, repository: menuRepository, products, publicDir, admin, bot, logger });

  app.use(createRequestLogger({ logger }));
  app.use(createErrorHandler({ logger, exposeStack: config.nodeEnv === 'development' }));
  app.use(helmet());
  app.use(createAdminGate({ config, logger, users, renderUnavailable }));
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
