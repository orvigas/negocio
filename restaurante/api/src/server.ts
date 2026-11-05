import { once } from 'node:events';

import { createBotControl } from '@restaurante/core/bot-control';
import { createProductRepository } from '@restaurante/core/catalog';
import { errorProp } from '@restaurante/core/shared';
import { createPrismaClient } from '@restaurante/db/client';
import { createPrismaBotControlStore } from '@restaurante/db/prisma-bot-control-store';
import { createPrismaProductStore } from '@restaurante/db/prisma-product-store';
import { createUserRepository } from '@restaurante/db/user-repository';
import { probeOf, queryOf, verifyDatabase } from '@restaurante/db/verify';
import { createImageChecker, createLogger, serializeError } from '@restaurante/web';

import { createAdminRoutes } from './admin/index.ts';
import { createApiApp } from './app.ts';
import { startCatalogReload } from './bot/catalog-reload.ts';
import { startBotControlTimers } from './bot/control-timers.ts';
import { createBotFromConfig, createBotWebhookApp } from './bot/webhook-app.ts';
import { ApiConfigError, loadApiConfig } from './config.ts';
import { createLandingNotifier } from './notifier.ts';

/**
 * Arranque de la API (REQ-F-038 y REQ-F-039). Verifica la conexión y el estado de las migraciones
 * (los mismos reintentos y códigos que landing-pages), pero nunca migra ni importa semillas (O-1: la
 * importación es solo de landing-pages). Desde REQ-F-039 escribe los productos (/api/v1/admin, con el
 * usuario solo DML) y avisa de cada escritura a landing-pages por la red interna. Desde REQ-F-042
 * ejecuta el bot de WhatsApp: su webhook se sirve en WEBHOOK_PORT, el único puerto que publica Traefik
 * (solo /webhooks/whatsapp); PORT sigue siendo de la red interna.
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

// Protección del bot (REQ-F-025): lista negra, interruptor y contadores desde la base. Se prepara
// aunque el bot esté desactivado: el mantenimiento corre solo aquí (REQ-F-042, RF-11). Si la carga
// inicial falla, la api no arranca; después, el bot sigue con la última copia conocida.
const botControl = createBotControl({
  store: createPrismaBotControlStore({ prisma }),
  keys: config.botKeys,
  limits: config.botLimits,
  timeZone: config.timezone,
  staff: config.whatsappBot ? Object.values(config.whatsappBot.staff) : [],
  logger,
});
try {
  await botControl.init();
} catch (err) {
  logger.error('bot_control_init_failed', { name: errorProp(err, 'name'), code: errorProp(errorProp(err, 'details'), 'code') });
  process.stderr.write('No se pudo preparar la protección del bot en la base de datos.\n');
  await prisma.$disconnect();
  process.exit(1);
}
// Mantenimiento al arrancar y cada hora; refresco de la pausa y los bloqueos cada refreshMs (RF-9).
await botControl.maintenance();
const stopControlTimers = startBotControlTimers({ botControl, refreshMs: config.botLimits.refreshMs });
// El bot usa la misma caché de productos que /api/v1/admin (RF-10); la recarga de 60 s es la red de seguridad.
const bot = createBotFromConfig({ config: config.whatsappBot, limits: config.botLimits, timeZone: config.timezone, products, botControl, logger });
const stopCatalogReload = startCatalogReload({ products });

const admin = createAdminRoutes({
  users: createUserRepository({ prisma }),
  products,
  notifier,
  botControl,
  botProvider: bot?.chatBot.provider ?? null,
  timeZone: config.timezone,
  logger,
});
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
const webhookServer = createBotWebhookApp({ bot, logger }).listen(config.webhookPort, config.host);
try {
  await once(webhookServer, 'listening');
} catch (err) {
  const code = errorProp(err, 'code');
  logger.error('server_listen_failed', { code, server: 'webhook' });
  process.stderr.write(`No se pudo escuchar en el puerto del webhook (${String(code)}): revisa que WEBHOOK_PORT esté libre.\n`);
  await prisma.$disconnect();
  process.exit(1);
}
logger.info('server_started', {
  service: 'api',
  host: config.host,
  port: config.port,
  webhookPort: config.webhookPort,
  nodeEnv: config.nodeEnv,
  allowNewerSchema: config.allowNewerSchema,
  whatsappBot: config.whatsappBot ? 'enabled' : 'disabled',
});

function shutdown(signal: NodeJS.Signals): void {
  logger.info('server_stopping', { service: 'api', signal });
  stopControlTimers();
  stopCatalogReload();
  webhookServer.close();
  server.close((err) => {
    // REQ-F-025: los contadores pendientes se guardan antes de cerrar la conexión.
    void botControl
      .flush()
      .catch(() => undefined)
      .then(() => prisma.$disconnect())
      .finally(() => {
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
