import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import Koa from 'koa';
import helmet from 'koa-helmet';
import serve from 'koa-static';

import type { ProductRepository } from '@restaurante/core/catalog';
import {
  SCRYPT_DEFAULTS,
  createLoginThrottle,
  createSessionStore,
  createUserAuthenticator,
  type PasswordHashParams,
  type UserRepository,
} from '@restaurante/core/identity';
import { getActiveBusinessId } from '@restaurante/core/schedule';
import { silentLogger, type Logger } from '@restaurante/core/shared';
import { createImageChecker, createRenderer } from '@restaurante/web';
import { type BotControl } from '@restaurante/core/bot-control';

import type { Config } from './config/env.ts';
import { createAdminGate } from './middleware/admin-guard.ts';
import { createErrorHandler } from './middleware/error-handler.ts';
import { createRequestLogger } from './middleware/request-logger.ts';
import { assertMenuRepository } from './repositories/menu-repository.ts';
import { createRouter } from './routes/index.ts';
import type { LandingProducts } from './services/landing-products.ts';
import { renderAdminUnavailable } from './views/admin/index.ts';

const SRC_DIR = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_VIEWS_DIR = join(SRC_DIR, 'views');
export const DEFAULT_PUBLIC_DIR = join(SRC_DIR, '..', 'public');

export interface AppOptions {
  config: Config;
  /** Repositorio de menús ya inicializado (src/repositories/; REQ-F-001, RF-9). Se valida al crear la app. */
  repository: unknown;
  /** Productos (REQ-F-008), ya inicializados: importación hecha y caché cargada. Para /admin. */
  products: ProductRepository;
  /**
   * Productos de las landings, de la API propia (REQ-F-038). La app suscribe su invalidación a las
   * escrituras de `products` (RF-6): cada cambio de /admin se ve en la siguiente visita.
   */
  landingProducts: LandingProducts;
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
   * Página "Bot" de /admin (REQ-F-025; modo panel desde REQ-F-042: el bot vive en la api). Sin ella,
   * /admin/bot responde 503.
   */
  botControl?: BotControl | undefined;
  viewsDir?: string;
  publicDir?: string;
}

/** Construye la app Koa sin abrir puertos (testeable con Supertest). */
export function createApp({
  config,
  repository,
  products,
  landingProducts,
  users,
  hashParams = SCRYPT_DEFAULTS,
  logger = silentLogger,
  now = () => new Date(),
  botControl,
  viewsDir = DEFAULT_VIEWS_DIR,
  publicDir = DEFAULT_PUBLIC_DIR,
}: AppOptions): Koa {
  if (!config) throw new TypeError('createApp requiere la configuración');
  const menuRepository = assertMenuRepository(repository);
  if (typeof products?.getPublished !== 'function') throw new TypeError('createApp requiere el repositorio de productos');
  if (typeof landingProducts?.get !== 'function' || typeof landingProducts.invalidate !== 'function') {
    throw new TypeError('createApp requiere los productos de las landings (landingProducts)');
  }
  // RF-6 (REQ-F-038): cada escritura confirmada de productos invalida la caché de las landings.
  products.onChange((business) => landingProducts.invalidate(business));

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
        botProvider: config.botPanel?.provider,
        landingProducts,
      }
    : undefined;
  const renderUnavailable = () =>
    renderAdminUnavailable(renderer, { faviconBusinessId: getActiveBusinessId({ now: now(), timeZone: config.timezone }) }).toString();
  const router = createRouter({ config, renderer, now, repository: menuRepository, products, landingProducts, publicDir, admin, logger });

  app.use(createRequestLogger({ logger }));
  app.use(createErrorHandler({ logger, exposeStack: config.nodeEnv === 'development' }));
  // CSP por defecto de Helmet más un único origen de iframes: el mapa embebido de la sucursal,
  // en ambas landings (REQ-F-031, R-17; REQ-F-032, R-4). Ninguna otra directiva cambia.
  app.use(helmet({ contentSecurityPolicy: { directives: { 'frame-src': ['https://www.google.com'] } } }));
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
