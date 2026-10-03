import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BUSINESS_IDS } from '../config/businesses.js';

/**
 * Semillas versionadas de los datos editables (REQ-F-001, RF-1.4): los datos originales del
 * diseño fuente. Se copian al directorio de datos en la primera ejecución y se usan como
 * referencia de estructura y como último respaldo si los datos guardados están dañados.
 */

const CONTENT_DIR = dirname(fileURLToPath(import.meta.url));

export const SEED_FILES = Object.freeze(
  Object.fromEntries(BUSINESS_IDS.map((businessId) => [businessId, join(CONTENT_DIR, businessId, 'seed.json')])),
);

/**
 * Devuelve una copia nueva del documento semilla de un negocio.
 * @param {'molotes'|'birria'} businessId
 */
export function loadSeedDocument(businessId) {
  if (!Object.hasOwn(SEED_FILES, businessId)) throw new Error(`No hay semilla para el negocio: ${businessId}`);
  return JSON.parse(readFileSync(SEED_FILES[businessId], 'utf8'));
}
