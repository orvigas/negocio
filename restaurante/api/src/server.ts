import { once } from 'node:events';

import { createProductRepository } from '@restaurante/core/catalog';
import { errorProp } from '@restaurante/core/shared';
import { createPrismaClient } from '@restaurante/db/client';
import { createPrismaProductStore } from '@restaurante/db/prisma-product-store';
import { createUserRepository } from '@restaurante/db/user-repository';
import { probeOf, queryOf, verifyDatabase } from '@restaurante/db/verify';
import { createImageChecker, createLogger, serializeError } from '@restaurante/web';

import { createAdminRoutes } from './admin/index.ts';
import { createApiApp } from './app.ts';
import { ApiConfigError, loadApiConfig } from './config.ts';
import { createLandingNotifier } from './notifier.ts';

/**
 * Arranque de la API (REQ-F-038 y REQ-F-039). Verifica la conexión y el estado de las migraciones
 * (los mismos reintentos y códigos que landing-pages), pero nunca migra ni importa semillas (O-1: la
 * importación es solo de landing-pages). Desde REQ-F-039 escribe los productos (/api/v1/admin, con el
 * usuario solo DML) y avisa de cada escritura a landing-pages por la red interna. En producción vive
 * en la red interna de Docker, sin puertos publicados ni router de Traefik.
 */

const logger = createLogger();

let config;
try {
  config = loadApiConfig();
} catch (err) {
  if (err instanceof ApiConfigError) {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  }
  throw err;
}

const prisma = createPrismaClient(config.database);
try {
  await verifyDatabase({ probe: probeOf(config.database), query: queryOf(prisma), logger, allowNewerSchema: config.allowNewerSchema });
} catch (err) {
  logger.error('database_init_failed', { code: errorProp(err, 'code'), migration: errorProp(err, 'migration'), object: errorProp(err, 'object') });
  process.stderr.write(
    `No se pudo usar la base de datos (${String(errorProp(err, 'code'))}): revisa DATABASE_URL, que MySQL esté en marcha y que las migraciones estén aplicadas.\n`,
  );
  await prisma.$disconnect();
  process.exit(1);
}

const store = createPrismaProductStore({ prisma });
const products = createProductRepository({ store, imageExists: createImageChecker(config.productImagesDir), logger });
try {
  // Sin fuentes: solo carga la caché, sin importar semillas (REQ-F-039).
  await products.init();
} catch (err) {
  logger.error('database_init_failed', { code: errorProp(err, 'code'), name: errorProp(err, 'name') });
  process.stderr.write('No se pudieron leer los productos de la base de datos.\n');
  await prisma.$disconnect();
  process.exit(1);
}
if (!config.landingNotify) logger.warn('products_notify_disabled', { reason: 'LANDING_INTERNAL_URL sin configurar' });
const notifier = createLandingNotifier({ url: config.landingNotify?.url, token: config.landingNotify?.token, logger });
const admin = createAdminRoutes({ users: createUserRepository({ prisma }), products, notifier, timeZone: config.timezone, logger });
const app = createApiApp({ store, admin, logger });
const server = app.listen(config.port, config.host);
try {
  await once(server, 'listening');
} catch (err) {
  const code = errorProp(err, 'code');
  logger.error('server_listen_failed', { code });
  process.stderr.write(`No se pudo escuchar en la dirección y el puerto configurados (${String(code)}): revisa HOST y PORT.\n`);
  await prisma.$disconnect();
  process.exit(1);
}
logger.info('server_started', { service: 'api', host: config.host, port: config.port, nodeEnv: config.nodeEnv, allowNewerSchema: config.allowNewerSchema });

function shutdown(signal: NodeJS.Signals): void {
  logger.info('server_stopping', { service: 'api', signal });
  server.close((err) => {
    void prisma.$disconnect().finally(() => {
      if (err) {
        logger.error('server_stop_failed', { err: serializeError(err) });
        process.exit(1);
      }
      process.exit(0);
    });
  });
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
