import { once } from 'node:events';

import { createLogger, errorProp, serializeError } from '@restaurante/core/shared';
import { createPrismaClient } from '@restaurante/db/client';
import { createPrismaProductStore } from '@restaurante/db/prisma-product-store';
import { probeOf, queryOf, verifyDatabase } from '@restaurante/db/verify';

import { createApiApp } from './app.ts';
import { ApiConfigError, loadApiConfig } from './config.ts';

/**
 * Arranque de la API (REQ-F-038). Solo lee la base: verifica la conexión y el estado de las
 * migraciones (los mismos reintentos y códigos que landing-pages), pero nunca migra, nunca importa
 * semillas ni escribe (O-1: la importación es solo de landing-pages). En producción vive en la red
 * interna de Docker, sin puertos publicados ni router de Traefik.
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

const app = createApiApp({ store: createPrismaProductStore({ prisma }), logger });
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
