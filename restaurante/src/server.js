import { createApp } from './app.js';
import { ConfigError, loadConfig } from './config/env.js';
import { createFileMenuRepository } from './repositories/file-menu-repository.js';
import { createLogger, serializeError } from './utils/logger.js';

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
  logger.error('menu_repository_init_failed', { code: err?.code, name: err?.name });
  process.stderr.write('No se pudo preparar la carpeta de datos (DATA_DIR): revisa que exista y tenga permisos de escritura.\n');
  process.exit(1);
}

if (!config.admin.enabled) {
  logger.warn('admin_disabled', { reason: 'credentials_missing' });
}

const app = createApp({ config, repository, logger });
const server = app.listen(config.port, () => {
  logger.info('server_started', {
    port: config.port,
    nodeEnv: config.nodeEnv,
    timezone: config.timezone,
    adminEnabled: config.admin.enabled,
    trustProxy: config.trustProxy,
  });
});

function shutdown(signal) {
  logger.info('server_stopping', { signal });
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
