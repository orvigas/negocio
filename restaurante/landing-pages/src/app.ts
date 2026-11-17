import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import Koa from 'koa';
import helmet from 'koa-helmet';
import serve from 'koa-static';

import { silentLogger, type Logger } from '@restaurante/core/shared';
import { createRenderer } from '@restaurante/web';

import type { Config } from './config/env.ts';
import { createAdminMoved } from './middleware/admin-moved.ts';
import { createErrorHandler } from './middleware/error-handler.ts';
import { createRequestLogger } from './middleware/request-logger.ts';
import { createRouter } from './routes/index.ts';
import type { LandingPage } from './services/landing-page.ts';
import type { LandingProducts } from './services/landing-products.ts';

const SRC_DIR = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_VIEWS_DIR = join(SRC_DIR, 'views');
export const DEFAULT_PUBLIC_DIR = join(SRC_DIR, '..', 'public');

export interface AppOptions {
  config: Config;
  /**
   * Productos de las landings, de la API propia (REQ-F-038). Su caché la invalida el aviso interno de
   * la API (internal-app.ts) o, sin él, la recarga de 60 s.
   */
  landingProducts: LandingProducts;
  /** Datos de página de las landings, de la API propia (REQ-F-044, RF-5). */
  landingPage: LandingPage;
  logger?: Logger;
  now?: () => Date;
  viewsDir?: string;
  publicDir?: string;
}

/** Construye la app Koa sin abrir puertos (testeable). Sin base de datos ni administración (REQ-F-045). */
export function createApp({
  config,
  landingProducts,
  landingPage,
  logger = silentLogger,
  now = () => new Date(),
  viewsDir = DEFAULT_VIEWS_DIR,
  publicDir = DEFAULT_PUBLIC_DIR,
}: AppOptions): Koa {
  if (!config) throw new TypeError('createApp requiere la configuración');
  if (typeof landingProducts?.get !== 'function' || typeof landingProducts.invalidate !== 'function') {
    throw new TypeError('createApp requiere los productos de las landings (landingProducts)');
  }
  if (typeof landingPage?.get !== 'function' || typeof landingPage.invalidate !== 'function') {
    throw new TypeError('createApp requiere los datos de página de las landings (landingPage)');
  }

  const app = new Koa();
  app.env = config.nodeEnv;
  // Detrás del proxy con TLS (Traefik en producción, REQ-F-016): respeta X-Forwarded-Proto/For
  // (HTTPS e IP real del visitante).
  app.proxy = config.trustProxy;
  // Solo se confía en la última IP de X-Forwarded-For (la que añade el proxy).
  app.maxIpsCount = 1;
  // Los errores se registran en el middleware centralizado; evita el log duplicado de Koa.
  app.silent = true;

  // Plantillas cargadas una sola vez al construir la app.
  const renderer = createRenderer({ viewsDir });
  const router = createRouter({ config, renderer, now, landingProducts, landingPage, publicDir, logger });

  app.use(createRequestLogger({ logger }));
  app.use(createErrorHandler({ logger, exposeStack: config.nodeEnv === 'development' }));
  // CSP por defecto de Helmet más un único origen de iframes: el mapa embebido de la sucursal,
  // en ambas landings (REQ-F-031, R-17; REQ-F-032, R-4). Ninguna otra directiva cambia.
  app.use(helmet({ contentSecurityPolicy: { directives: { 'frame-src': ['https://www.google.com'] } } }));
  app.use(createAdminMoved({ config }));
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
