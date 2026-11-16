import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BUSINESS_IDS, type BusinessId } from '../shared/index.ts';

/**
 * Semillas versionadas de cada negocio (REQ-F-001, RF-1.4): los datos originales del diseño fuente.
 * En core desde REQ-F-045 (antes en landing-pages/src/content/<negocio>/seed.json): las usan la `api`,
 * que prepara una instalación nueva (productos y página), y las landings, como último respaldo cuando
 * la API no responde. Sus listas de productos están congeladas desde REQ-F-008: no se editan.
 */

const SEEDS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'seeds');

// `fromEntries` pierde las claves; el objeto se construye con todos los BUSINESS_IDS.
export const SEED_FILES = Object.freeze(
  Object.fromEntries(BUSINESS_IDS.map((businessId) => [businessId, join(SEEDS_DIR, `${businessId}.json`)])),
) as Readonly<Record<BusinessId, string>>;

/**
 * Devuelve una copia nueva del documento semilla de un negocio. Sin validar (`unknown`):
 * quien la usa la valida con menu-schema.
 */
export function loadSeedDocument(businessId: BusinessId): unknown {
  if (!Object.hasOwn(SEED_FILES, businessId)) throw new Error(`No hay semilla para el negocio: ${businessId}`);
  return JSON.parse(readFileSync(SEED_FILES[businessId], 'utf8'));
}
