import { loadConfig } from '../src/config/env.js';
import { loadSeedDocument } from '../src/content/seeds.js';
import { createMemoryMenuRepository } from '../src/repositories/memory-menu-repository.js';

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

export function makeConfig(overrides = {}) {
  return loadConfig({ ...VALID_ENV, ...overrides });
}

/** Semillas leídas una sola vez (copias nuevas en cada llamada a seedData). */
const SEEDS = Object.freeze({ molotes: loadSeedDocument('molotes'), birria: loadSeedDocument('birria') });

/** Copia de los datos editables de la semilla de un negocio. */
export const seedData = (businessId) => structuredClone(SEEDS[businessId].data);
export const seedDocuments = () => structuredClone(SEEDS);

/**
 * Repositorio en memoria ya inicializado (CA-38: sin leer archivos de datos).
 * @param {Parameters<typeof createMemoryMenuRepository>[0]} [options]
 */
export async function makeRepository(options = {}) {
  const repository = createMemoryMenuRepository({ seeds: seedDocuments(), ...options });
  await repository.init();
  return repository;
}

/** Logger que acumula las líneas para inspeccionarlas (p. ej. que no haya contraseñas). */
export function makeRecordingLogger() {
  const lines = [];
  const log = (level) => (msg, fields = {}) => lines.push({ level, msg, ...fields });
  return { lines, debug: log('debug'), info: log('info'), warn: log('warn'), error: log('error') };
}
