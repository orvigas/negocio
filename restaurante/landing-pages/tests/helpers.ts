import type { BusinessId, LogFields, LogLevel, Logger } from '@restaurante/core/shared';
import type { MenuDataByBusiness, MenuDocument } from '@restaurante/core/catalog';

import { loadConfig, type Config, type Env } from '../src/config/env.ts';
import { loadSeedDocument } from '../src/content/seeds.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any justificado: las pruebas corrompen los datos a propósito (tipos, campos y estructura inválidos).
export type CorruptibleData = any;

/** Entorno válido mínimo para pruebas. Los números son ficticios. */
export const VALID_ENV = Object.freeze({
  NODE_ENV: 'test',
  PORT: '3000',
  BUSINESS_TIMEZONE: 'America/Mexico_City',
  WHATSAPP_MOLOTES: '5210000000001',
  WHATSAPP_MOLOTES_MESSAGE: 'Hola, quiero hacer un pedido de molotes',
  WHATSAPP_BIRRIA: '5210000000002',
  WHATSAPP_BIRRIA_MESSAGE: 'Hola, quiero hacer un pedido de birria',
  // Obligatoria (REQ-F-038). Un puerto cerrado: un servidor de prueba arranca sin API (sirve la
  // semilla) y nunca habla con una API local del desarrollador; las pruebas de la API usan el doble.
  API_INTERNAL_URL: 'http://127.0.0.1:9',
  // Aviso interno de la API (REQ-F-039). Solo la usa server.ts (abre el puerto interno).
  INTERNAL_NOTIFY_TOKEN: 'internal-notify-token-de-prueba-0123456789',
});

export function makeConfig(overrides: Env = {}): Config {
  return loadConfig({ ...VALID_ENV, ...overrides });
}

/** Semillas leídas una sola vez (copias nuevas en cada llamada a seedData). */
// Semillas versionadas: content.test y el propio repositorio las validan contra el esquema.
const SEEDS = Object.freeze({
  molotes: loadSeedDocument('molotes') as MenuDocument<'molotes'>,
  birria: loadSeedDocument('birria') as MenuDocument<'birria'>,
});

/** Copia de los datos editables de la semilla de un negocio. */
export const seedData = <Id extends BusinessId>(businessId: Id): MenuDataByBusiness[Id] =>
  structuredClone(SEEDS[businessId].data as MenuDataByBusiness[Id]);
export const seedDocuments = () => structuredClone(SEEDS);

/** Logger que acumula las líneas para inspeccionarlas (p. ej. que no haya contraseñas). */
export type RecordingLogger = Logger & { lines: (LogFields & { level: LogLevel; msg: string })[] };

export function makeRecordingLogger(): RecordingLogger {
  const lines: RecordingLogger['lines'] = [];
  const log = (level: LogLevel) => (msg: string, fields: LogFields = {}) => lines.push({ level, msg, ...fields });
  return { lines, debug: log('debug'), info: log('info'), warn: log('warn'), error: log('error') };
}
