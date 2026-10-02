import { createApp } from './app.js';
import { ConfigError, loadConfig } from './config/env.js';
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

const app = createApp({ config, logger });
const server = app.listen(config.port, () => {
  logger.info('server_started', { port: config.port, nodeEnv: config.nodeEnv, timezone: config.timezone });
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
