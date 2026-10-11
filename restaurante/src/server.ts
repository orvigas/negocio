import { once } from 'node:events';

import { DEFAULT_PUBLIC_DIR, createApp } from './app.ts';
import { ConfigError, loadConfig } from './config/env.ts';
import { createPrismaClient } from './db/client.ts';
import { probeOf, queryOf, verifyDatabase } from './db/verify.ts';
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

// Base de datos (REQ-F-014, RF-6): la app no migra; verifica conexión (reintentos hasta 60 s),
// credenciales, modo estricto, utf8mb4 y colación, y que las migraciones estén al día. Si falla, el
// servidor no arranca; el log solo lleva códigos (sin SQL, URL, credenciales ni stack).
const prisma = createPrismaClient(config.database);
try {
  await verifyDatabase({ probe: probeOf(config.database), query: queryOf(prisma), logger });
} catch (err) {
  logger.error('database_init_failed', { code: errorProp(err, 'code'), migration: errorProp(err, 'migration'), object: errorProp(err, 'object') });
  process.stderr.write(
    `No se pudo usar la base de datos (${String(errorProp(err, 'code'))}): revisa DATABASE_URL, que MySQL esté en marcha y que las migraciones estén aplicadas (proceso migrate o npm run db:migrate).\n`,
  );
  await prisma.$disconnect();
  process.exit(1);
}
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
  process.stderr.write('No se pudieron preparar los productos en la base de datos.\n');
  await prisma.$disconnect();
  process.exit(1);
}

const app = createApp({ config, repository, products, users, logger });
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
logger.info('server_started', {
  host: config.host,
  port: config.port,
  nodeEnv: config.nodeEnv,
  timezone: config.timezone,
  adminStatus,
  whatsappBot: config.whatsappBot ? 'enabled' : 'disabled',
  trustProxy: config.trustProxy,
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
