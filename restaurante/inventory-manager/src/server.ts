import { once } from 'node:events';

import { createAdminApiClient } from '@restaurante/contracts';
import { createLogger, serializeError } from '@restaurante/web';

import { createInventoryApp } from './app.ts';
import { InventoryConfigError, loadInventoryConfig } from './config.ts';

/**
 * Arranque del admin nuevo (REQ-F-039). No tiene base de datos: todo lo pide a la API por la red
 * interna (API_INTERNAL_URL). Arranca aunque la API no responda; cada pantalla lo avisa (RF-10).
 */

/** Límite de cada llamada a la API. */
const API_TIMEOUT_MS = 5000;

const logger = createLogger();

let config;
try {
  config = loadInventoryConfig();
} catch (err) {
  if (err instanceof InventoryConfigError) {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  }
  throw err;
}

const api = createAdminApiClient({ baseUrl: config.apiInternalUrl, timeoutMs: API_TIMEOUT_MS });
const server = createInventoryApp({ config, api, logger }).listen(config.port, config.host);
try {
  await once(server, 'listening');
} catch (err) {
  const code = (err as { code?: unknown }).code;
  logger.error('server_listen_failed', { code });
  process.stderr.write(`No se pudo escuchar en la dirección y el puerto configurados (${String(code)}): revisa HOST y PORT.\n`);
  process.exit(1);
}
logger.info('server_started', { service: 'inventory-manager', host: config.host, port: config.port, nodeEnv: config.nodeEnv, trustProxy: config.trustProxy });

function shutdown(signal: NodeJS.Signals): void {
  logger.info('server_stopping', { service: 'inventory-manager', signal });
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
