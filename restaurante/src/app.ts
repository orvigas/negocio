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
import type { BotControl } from './services/bot-control.ts';
import { getActiveBusinessId } from './services/business-schedule.ts';
import { createLoginThrottle } from './services/login-throttle.ts';
import { createSessionStore } from './services/session-store.ts';
import { createBotOrchestrator, type BotOrchestrator } from './services/whatsapp-bot/orchestrator.ts';
import { createBotProtection } from './services/whatsapp-bot/protection/protection.ts';
import { createChatBot, type FetchLike } from './services/whatsapp-bot/providers/select.ts';
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
   * Bot de WhatsApp ya construido (REQ-F-009; las pruebas lo crean con el doble del proveedor).
   * Sin él, si `config.whatsappBot` existe, se crea con el proveedor configurado (REQ-F-012) y
   * `providerFetch` (por defecto, `fetch`).
   */
  bot?: BotOrchestrator | undefined;
  /**
   * Protección del bot y página "Bot" de /admin (REQ-F-025). Obligatoria si el bot se crea desde
   * la configuración; sin ella, /admin/bot responde 503.
   */
  botControl?: BotControl | undefined;
  providerFetch?: FetchLike;
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
  bot: injectedBot,
  botControl,
  providerFetch = (url, init) => fetch(url, init),
  viewsDir = DEFAULT_VIEWS_DIR,
  publicDir = DEFAULT_PUBLIC_DIR,
}: AppOptions): Koa {
  if (!config) throw new TypeError('createApp requiere la configuración');
  const menuRepository = assertMenuRepository(repository);
  if (typeof products?.getPublished !== 'function') throw new TypeError('createApp requiere el repositorio de productos');

  const app = new Koa();
  app.env = config.nodeEnv;
  // Detrás del proxy con TLS (Traefik en producción, REQ-F-016): respeta X-Forwarded-Proto/For
  // (HTTPS e IP real del visitante).
  app.proxy = config.trustProxy;
  // Solo se confía en la última IP de X-Forwarded-For (la que añade el proxy): el cliente no
  // puede falsearla para esquivar el límite de intentos de acceso.
  app.maxIpsCount = 1;
  // Los errores se registran en el middleware centralizado; evita el log duplicado de Koa.
  app.silent = true;

  // Plantillas cargadas una sola vez al construir la app.
  const renderer = createRenderer({ viewsDir });
  // Administración: cuentas personales en la base de datos (REQ-F-007).
  if (!injectedBot && config.whatsappBot && !botControl) throw new TypeError('createApp requiere botControl para crear el bot (REQ-F-025)');
  const admin = users
    ? {
        logger,
        users,
        hashParams,
        sessions: createSessionStore({ now }),
        throttle: createLoginThrottle({ now }),
        authenticator: createUserAuthenticator({ users, hashParams }),
        imageExists: createImageChecker(publicDir),
        botControl,
        botProvider: injectedBot?.chatBot.provider ?? config.whatsappBot?.provider,
      }
    : undefined;
  const renderUnavailable = () =>
    renderAdminUnavailable(renderer, { faviconBusinessId: getActiveBusinessId({ now: now(), timeZone: config.timezone }) }).toString();
  // Bot de WhatsApp (REQ-F-009): solo con su configuración; sin ella, el webhook responde 503.
  // El proveedor (Meta o Twilio) se elige en providers/select.ts (REQ-F-012, RF-1.3).
  const bot =
    injectedBot ??
    (config.whatsappBot
      ? createBotOrchestrator({
          chatBot: createChatBot(config.whatsappBot, { fetch: providerFetch, logger }),
          staff: config.whatsappBot.staff,
          timeZone: config.timezone,
          products,
          logger,
          now,
          // REQ-F-025 (D-T10): el bot creado desde la configuración siempre lleva la protección.
          protection: botControl ? createBotProtection({ control: botControl, limits: config.botLimits, timeZone: config.timezone, logger }) : undefined,
        })
      : undefined);
  // D-13 (REQ-F-012): solo el proveedor, ningún otro valor.
  if (bot) logger.info('bot_provider_selected', { provider: bot.chatBot.provider });
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
