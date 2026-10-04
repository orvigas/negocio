import type { BusinessId } from '../src/config/businesses.ts';
import { loadConfig, type Config, type Env } from '../src/config/env.ts';
import { loadSeedDocument } from '../src/content/seeds.ts';
import { createMemoryMenuRepository } from '../src/repositories/memory-menu-repository.ts';
import type { MenuDataByBusiness, MenuDocument } from '../src/services/menu-schema.ts';
import type { LogFields, Logger, LogLevel } from '../src/utils/logger.ts';

// any justificado: las pruebas corrompen los datos a propósito (tipos, campos y estructura inválidos).
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

/** Repositorio en memoria ya inicializado (CA-38: sin leer archivos de datos). */
export async function makeRepository(options: Parameters<typeof createMemoryMenuRepository>[0] = {}) {
  const repository = createMemoryMenuRepository({ seeds: seedDocuments(), ...options });
  await repository.init();
  return repository;
}

/** Logger que acumula las líneas para inspeccionarlas (p. ej. que no haya contraseñas). */
export type RecordingLogger = Logger & { lines: (LogFields & { level: LogLevel; msg: string })[] };

export function makeRecordingLogger(): RecordingLogger {
  const lines: RecordingLogger['lines'] = [];
  const log = (level: LogLevel) => (msg: string, fields: LogFields = {}) => lines.push({ level, msg, ...fields });
  return { lines, debug: log('debug'), info: log('info'), warn: log('warn'), error: log('error') };
}
