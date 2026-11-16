import { once } from 'node:events';

import { createPrismaClient } from '@restaurante/db/client';
import { probeOf, queryOf, verifyDatabase } from '@restaurante/db/verify';
import { createPrismaBotControlStore } from '@restaurante/db/prisma-bot-control-store';
import { createPrismaPageStore } from '@restaurante/db/prisma-page-store';
import { createPrismaProductStore } from '@restaurante/db/prisma-product-store';
import { createUserRepository } from '@restaurante/db/user-repository';
import { createPublicApiClient } from '@restaurante/contracts';
import { errorProp } from '@restaurante/core/shared';
import { createImageChecker, createLogger, serializeError } from '@restaurante/web';

import { createPageRepository, createProductRepository } from '@restaurante/core/catalog';
import { createBotControl } from '@restaurante/core/bot-control';

import { DEFAULT_PUBLIC_DIR, createApp } from './app.ts';
import { ConfigError, loadConfig } from './config/env.ts';
import { createInternalApp } from './internal-app.ts';
import { bootstrapAdmin } from './services/admin-bootstrap.ts';
import { createLandingPage, loadSeedPages } from './services/landing-page.ts';
import { LANDING_PRODUCTS_DEFAULTS, createLandingProducts, loadSeedProducts } from './services/landing-products.ts';
import { PageImportRefusedError, importPages } from './services/page-import.ts';
import { createFileMenuRepository } from './repositories/file-menu-repository.ts';

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

// Base de datos (REQ-F-014, RF-6): la app no migra; verifica conexión (reintentos hasta 60 s),
// credenciales, modo estricto, utf8mb4 y colación, y que las migraciones estén al día. Si falla, el
// servidor no arranca; el log solo lleva códigos (sin SQL, URL, credenciales ni stack).
// DATABASE_ALLOW_NEWER_SCHEMA solo la pone el despliegue al volver a la versión anterior (REQ-F-016, D-1).
const prisma = createPrismaClient(config.database);
try {
  await verifyDatabase({ probe: probeOf(config.database), query: queryOf(prisma), logger, allowNewerSchema: config.allowNewerSchema });
} catch (err) {
  logger.error('database_init_failed', { code: errorProp(err, 'code'), migration: errorProp(err, 'migration'), object: errorProp(err, 'object') });
  process.stderr.write(
    `No se pudo usar la base de datos (${String(errorProp(err, 'code'))}): revisa DATABASE_URL, que MySQL esté en marcha y que las migraciones estén aplicadas (proceso migrate o npm run db:migrate).\n`,
  );
  await prisma.$disconnect();
  process.exit(1);
}
const users = createUserRepository({ prisma });

// Instalación existente (REQ-F-044, D-10): `product_import` con filas al empezar el arranque. Se lee
// antes de preparar DATA_DIR y de importar los productos, porque en una instalación nueva este mismo
// arranque crea esas filas.
const pageStore = createPrismaPageStore({ prisma });
let existing: boolean;
try {
  existing = await pageStore.hasProductImports();
} catch (err) {
  logger.error('database_init_failed', { name: errorProp(err, 'name'), code: errorProp(errorProp(err, 'details'), 'code') });
  process.stderr.write('No se pudo leer el estado de la instalación en la base de datos.\n');
  await prisma.$disconnect();
  process.exit(1);
}

// Datos de DATA_DIR (REQ-F-001; hasta el ticket 6): solo los leen la importación de la página y la de
// productos. Un JSON dañado nunca impide arrancar, pero una carpeta inaccesible sí (fail fast). En
// una instalación existente no se escribe la semilla aunque falten los archivos (D-10).
const repository = createFileMenuRepository({ dataDir: config.dataDir, timezone: config.timezone, logger });
try {
  await repository.init({ seedMissing: !existing });
} catch (err) {
  logger.error('menu_repository_init_failed', { code: errorProp(err, 'code'), name: errorProp(err, 'name') });
  process.stderr.write('No se pudo preparar la carpeta de datos (DATA_DIR): revisa que exista y tenga permisos de escritura.\n');
  await prisma.$disconnect();
  process.exit(1);
}

// Datos de página (REQ-F-044, RF-2 y RF-3): importación única a MySQL, todo o nada para los negocios
// sin marca. Si falla o se niega (CA-20), termina con 1 antes de escuchar: el despliegue vuelve atrás.
try {
  await importPages({ repository, store: pageStore, existing, logger });
} catch (err) {
  if (err instanceof PageImportRefusedError) {
    for (const { business, reason } of err.refusals) logger.error('page_import_failed', { code: err.code, business, reason });
    process.stderr.write(
      'La importación de la página se negó a usar la semilla: faltan o están dañados los JSON de una instalación existente. Restaura DATA_DIR desde un respaldo (ver docs/despliegue.md §6).\n',
    );
  } else {
    logger.error('page_import_failed', { name: errorProp(err, 'name'), code: errorProp(errorProp(err, 'details'), 'code') ?? errorProp(err, 'code') });
    process.stderr.write('No se pudo importar la página a la base de datos: no se importó nada.\n');
  }
  await prisma.$disconnect();
  process.exit(1);
}

// Primer administrador desde ADMIN_USER/ADMIN_PASSWORD_HASH, solo si no hay usuarios (D-4, D-13).
let adminStatus;
try {
  adminStatus = await bootstrapAdmin({ users, bootstrap: config.adminBootstrap, logger });
} catch (err) {
  logger.error('admin_bootstrap_failed', { name: errorProp(err, 'name') });
  process.stderr.write('No se pudo preparar el primer administrador en la base de datos.\n');
  await prisma.$disconnect();
  process.exit(1);
}

// Productos (REQ-F-008): importación única desde el documento que publicó el repositorio de
// menús al arrancar (current.json, previous.json o la semilla) y caché de /admin. Si la base de
// datos falla aquí, el servidor no arranca (D-15).
const products = createProductRepository({
  store: createPrismaProductStore({ prisma }),
  imageExists: createImageChecker(DEFAULT_PUBLIC_DIR),
  logger,
});
try {
  await products.init({
    molotes: await repository.getStartupSource('molotes'),
    birria: await repository.getStartupSource('birria'),
  });
} catch (err) {
  logger.error('products_init_failed', { name: errorProp(err, 'name'), code: errorProp(errorProp(err, 'details'), 'code') ?? errorProp(err, 'code') });
  process.stderr.write('No se pudieron preparar los productos en la base de datos.\n');
  await prisma.$disconnect();
  process.exit(1);
}

// Página "Bot" de /admin (REQ-F-025; modo panel desde REQ-F-042): el bot vive en la api. Aquí solo
// se gestionan la pausa y los bloqueos (en la base, que la api refresca cada BOT_CONTROL_REFRESH_SECONDS)
// y se leen de la base el uso y el gasto. Sin mantenimiento: lo ejecuta la api (RF-11). Si la carga
// inicial falla, el servidor no arranca.
const botControl = createBotControl({
  store: createPrismaBotControlStore({ prisma }),
  keys: config.botKeys,
  limits: config.botLimits,
  timeZone: config.timezone,
  staff: config.botPanel ? Object.values(config.botPanel.staff) : [],
  logger,
  mode: 'panel',
});
try {
  await botControl.init();
} catch (err) {
  logger.error('bot_control_init_failed', { name: errorProp(err, 'name'), code: errorProp(errorProp(err, 'details'), 'code') });
  process.stderr.write('No se pudo preparar la protección del bot en la base de datos.\n');
  await prisma.$disconnect();
  process.exit(1);
}

// Productos y datos de página de las landings (REQ-F-038 y REQ-F-044): de la API propia
// (API_INTERNAL_URL), con caché en memoria, última copia buena y, sin ninguna, la semilla de
// content/seeds.ts. La primera carga nunca impide arrancar: sin API, las landings sirven la semilla y
// lo registran (CA-6 de REQ-F-038; CA-7).
const client = createPublicApiClient({ baseUrl: config.apiInternalUrl, timeoutMs: LANDING_PRODUCTS_DEFAULTS.timeoutMs });
const landingProducts = createLandingProducts({ client, seeds: loadSeedProducts(), logger });
const landingPage = createLandingPage({ client, seeds: loadSeedPages(), logger });
await Promise.all([landingProducts.warmUp(), landingPage.warmUp()]);

// /admin lee la página de MySQL (REQ-F-044, RF-10): solo lectura con ADMIN_NEW_URL; sin ella, escribe ahí (D-6).
const pages = createPageRepository({ store: pageStore, timeZone: config.timezone, logger });
const app = createApp({ config, products, landingProducts, landingPage, pages, users, logger, botControl });
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
  await prisma.$disconnect();
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
    await prisma.$disconnect();
    process.exit(1);
  }
}

logger.info('server_started', {
  host: config.host,
  port: config.port,
  nodeEnv: config.nodeEnv,
  timezone: config.timezone,
  adminStatus,
  botPanel: config.botPanel ? config.botPanel.provider : 'disabled',
  trustProxy: config.trustProxy,
  allowNewerSchema: config.allowNewerSchema,
  internalPort: config.internalNotify?.port ?? null,
  productsReadOnly: config.adminNewUrl !== undefined,
  pageReadOnly: config.adminNewUrl !== undefined,
});

function shutdown(signal: NodeJS.Signals): void {
  logger.info('server_stopping', { signal });
  internalServer?.close();
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
