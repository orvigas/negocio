import { once } from 'node:events';

import { createPublicApiClient } from '@restaurante/contracts';
import { errorProp } from '@restaurante/core/shared';
import { createLogger, serializeError } from '@restaurante/web';

import { createApp } from './app.ts';
import { ConfigError, loadConfig } from './config/env.ts';
import { createInternalApp } from './internal-app.ts';
import { createLandingPage, loadSeedPages } from './services/landing-page.ts';
import { LANDING_PRODUCTS_DEFAULTS, createLandingProducts, loadSeedProducts } from './services/landing-products.ts';

const logger = createLogger();

let config;
try {
  config = loadConfig();
} catch (err) {
  if (err instanceof ConfigError) {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  }
  throw err;
}

// Productos y datos de página de las landings (REQ-F-038 y REQ-F-044): de la API propia
// (API_INTERNAL_URL), con caché en memoria, última copia buena y, sin ninguna, la semilla de
// content/seeds.ts. La primera carga nunca impide arrancar: sin API, las landings sirven la semilla y
// lo registran (CA-6 de REQ-F-038; CA-7).
const client = createPublicApiClient({ baseUrl: config.apiInternalUrl, timeoutMs: LANDING_PRODUCTS_DEFAULTS.timeoutMs });
const landingProducts = createLandingProducts({ client, seeds: loadSeedProducts(), logger });
const landingPage = createLandingPage({ client, seeds: loadSeedPages(), logger });
await Promise.all([landingProducts.warmUp(), landingPage.warmUp()]);

const app = createApp({ config, landingProducts, landingPage, logger });
// Escucha solo en HOST (REQ-F-015; 127.0.0.1 por defecto). Si la dirección no existe en la máquina
// o el puerto está ocupado, termina con 1 y un mensaje claro, sin repetir los valores.
const server = app.listen(config.port, config.host);
try {
  await once(server, 'listening');
} catch (err) {
  const code = errorProp(err, 'code');
  logger.error('server_listen_failed', { code });
  process.stderr.write(
    `No se pudo escuchar en la dirección y el puerto configurados (${String(code)}): revisa que HOST sea una IP de esta máquina y que PORT esté libre.\n`,
  );
  process.exit(1);
}
// Aviso interno de la API (REQ-F-039, RF-13): solo con INTERNAL_NOTIFY_TOKEN (obligatoria en
// producción), en su propio puerto, que Traefik no enruta. Escucha en la misma dirección que la app.
let internalServer: ReturnType<typeof app.listen> | null = null;
if (config.internalNotify) {
  internalServer = createInternalApp({ token: config.internalNotify.token, landingProducts, landingPage, logger }).listen(config.internalNotify.port, config.host);
  try {
    await once(internalServer, 'listening');
  } catch (err) {
    const code = errorProp(err, 'code');
    logger.error('server_listen_failed', { code, server: 'internal' });
    process.stderr.write(`No se pudo escuchar en el puerto interno (${String(code)}): revisa que INTERNAL_PORT esté libre.\n`);
    process.exit(1);
  }
}

logger.info('server_started', {
  host: config.host,
  port: config.port,
  nodeEnv: config.nodeEnv,
  timezone: config.timezone,
  trustProxy: config.trustProxy,
  internalPort: config.internalNotify?.port ?? null,
  adminMoved: config.adminNewUrl !== undefined,
});

function shutdown(signal: NodeJS.Signals): void {
  logger.info('server_stopping', { signal });
  internalServer?.close();
  server.close((err) => {
    if (err) {
      logger.error('server_stop_failed', { err: serializeError(err) });
      process.exit(1);
    }
    process.exit(0);
  });
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
