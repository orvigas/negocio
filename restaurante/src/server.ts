import { DEFAULT_PUBLIC_DIR, createApp } from './app.ts';
import { ConfigError, loadConfig } from './config/env.ts';
import { openDatabase } from './db/client.ts';
import { createPrismaProductStore } from './repositories/prisma-product-store.ts';
import { createProductRepository } from './repositories/product-repository.ts';
import { createUserRepository } from './repositories/user-repository.ts';
import { createImageChecker } from './services/admin-form.ts';
import { bootstrapAdmin } from './services/admin-bootstrap.ts';
import { createFileMenuRepository } from './repositories/file-menu-repository.ts';
import { errorProp } from './utils/errors.ts';
import { createLogger, serializeError } from './utils/logger.ts';

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

// Datos editables (REQ-F-001): primera ejecución o datos dañados se resuelven aquí; los datos
// dañados nunca impiden arrancar, pero una carpeta de datos inaccesible sí (fail fast).
const repository = createFileMenuRepository({ dataDir: config.dataDir, timezone: config.timezone, logger });
try {
  await repository.init();
} catch (err) {
  logger.error('menu_repository_init_failed', { code: errorProp(err, 'code'), name: errorProp(err, 'name') });
  process.stderr.write('No se pudo preparar la carpeta de datos (DATA_DIR): revisa que exista y tenga permisos de escritura.\n');
  process.exit(1);
}

// Base de datos (REQ-F-007, R-2): escritura, integridad y migraciones pendientes. Si falla, el
// servidor no arranca; el log solo lleva códigos (sin SQL, rutas ni stack).
let database;
try {
  database = await openDatabase({ dataDir: config.dataDir });
} catch (err) {
  logger.error('database_init_failed', { code: errorProp(err, 'code'), migration: errorProp(err, 'migration') });
  process.stderr.write(
    'No se pudo preparar la base de datos en DATA_DIR: revisa permisos de escritura, espacio libre y que el archivo no esté dañado.\n',
  );
  process.exit(1);
}
if (database.applied.length > 0) logger.info('database_migrated', { applied: database.applied });
const { prisma } = database;
const users = createUserRepository({ prisma });

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
// menús al arrancar (current.json, previous.json o la semilla) y caché de las landings. Si la
// base de datos falla aquí, el servidor no arranca (D-15).
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
  process.stderr.write('No se pudieron preparar los productos en la base de datos de DATA_DIR.\n');
  await prisma.$disconnect();
  process.exit(1);
}

const app = createApp({ config, repository, products, users, logger });
const server = app.listen(config.port, () => {
  logger.info('server_started', {
    port: config.port,
    nodeEnv: config.nodeEnv,
    timezone: config.timezone,
    adminStatus,
    trustProxy: config.trustProxy,
  });
});

function shutdown(signal: NodeJS.Signals): void {
  logger.info('server_stopping', { signal });
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
