import { IMPORT_MAX_BYTES, type ImportIssue, type ImportReport } from '@restaurante/core/inventory';

import { DEV_SEED_HOSTS } from './inventory-dev-seed.ts';

/**
 * Piezas del comando de la importación única (REQ-F-050, A5; `scripts/inventory-import.ts`), sin E/S
 * de base de datos para poder probarlas: argumentos, salvaguardas, lectura acotada del JSON y el
 * informe. El informe solo lleva conteos y, por problema, la fila del origen, el campo y el mensaje:
 * nunca nombres, cantidades, costos ni el contenido del archivo.
 */

export const IMPORT_USAGE = 'Uso: npm run inventory:import -- --archivo <ruta|-> [--escribir] [--produccion]';

export interface ImportArgs {
  /** Ruta del JSON, o '-' para leerlo de la entrada estándar (producción: sin copiarlo al contenedor). */
  file: string;
  /** Sin esta bandera, ensayo: valida e informa sin escribir. */
  write: boolean;
  /** Confirma que el destino es la base de producción (NODE_ENV=production). */
  production: boolean;
}

export function parseImportArgs(argv: readonly string[]): { ok: true; args: ImportArgs } | { ok: false; message: string } {
  let file: string | null = null;
  let write = false;
  let production = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--escribir') write = true;
    else if (arg === '--produccion') production = true;
    else if (arg === '--archivo') {
      // DEF-006: un segundo --archivo es ambiguo (¿cuál se importa?): se rechaza con el uso.
      if (file !== null) return { ok: false, message: `--archivo repetido: indica un solo archivo. ${IMPORT_USAGE}` };
      const value = argv[index + 1];
      if (value === undefined || value === '' || (value.startsWith('--') && value !== '-')) return { ok: false, message: `Falta la ruta de --archivo. ${IMPORT_USAGE}` };
      file = value;
      index += 1;
    } else return { ok: false, message: `Argumento desconocido. ${IMPORT_USAGE}` };
  }
  if (file === null) return { ok: false, message: `Falta --archivo. ${IMPORT_USAGE}` };
  return { ok: true, args: { file, write, production } };
}

/**
 * Motivo por el que no se puede importar con esta configuración; null si se puede.
 * - Con NODE_ENV=production hace falta --produccion (el contenedor `api` siempre es production).
 * - --produccion solo vale con NODE_ENV=production.
 * - Fuera de producción, solo contra una base local (los mismos hosts que la semilla de desarrollo).
 */
export function importRefusal({ nodeEnv, host, production }: { nodeEnv: string | undefined; host: string; production: boolean }): string | null {
  if (nodeEnv === 'production' && !production) return 'Con NODE_ENV=production la importación exige --produccion.';
  if (nodeEnv !== 'production' && production) return '--produccion solo se usa con NODE_ENV=production (el contenedor api del VPS).';
  if (nodeEnv !== 'production' && !DEV_SEED_HOSTS.includes(host)) return `Fuera de producción la importación solo se ejecuta contra una base local (${DEV_SEED_HOSTS.join(', ')}).`;
  return null;
}

/** El archivo ficticio de las pruebas nunca se importa en producción. */
export const fictitiousRefusal = ({ production, ficticio }: { production: boolean; ficticio: boolean }): string | null =>
  production && ficticio ? 'El archivo está marcado como ficticio ("ficticio": true): no se importa en producción.' : null;

/** Lee como mucho `maxBytes` de una fuente de trozos; más, es error. */
export async function readLimited(chunks: AsyncIterable<Uint8Array | string>, maxBytes = IMPORT_MAX_BYTES): Promise<{ ok: true; text: string } | { ok: false; message: string }> {
  const parts: Buffer[] = [];
  let size = 0;
  for await (const chunk of chunks) {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) return { ok: false, message: `El archivo pasa de ${Math.floor(maxBytes / (1024 * 1024))} MB.` };
    parts.push(buffer);
  }
  return { ok: true, text: Buffer.concat(parts).toString('utf8') };
}

/** JSON estricto (sin comentarios ni comas sobrantes). El error no repite el contenido. */
export function parseJson(text: string): { ok: true; data: unknown } | { ok: false; message: string } {
  try {
    return { ok: true, data: JSON.parse(text.replace(/^\uFEFF/, '')) as unknown };
  } catch {
    return { ok: false, message: 'El archivo no es un JSON válido.' };
  }
}

const issueLine = ({ fila, campo, mensaje }: ImportIssue): string => `  - ${fila}${campo === '' ? '' : ` [${campo}]`}: ${mensaje}`;

/** Informe para la consola: conteos y, por problema, fila, campo y mensaje. */
export function formatImportReport(report: ImportReport): string {
  const { created, omitted } = report;
  const verb = report.written ? 'Creados' : 'Se crearían';
  const lines = [
    `Importación (${report.mode}${report.ficticio ? ', archivo ficticio' : ''}): ${report.written ? 'escrita' : 'sin escribir nada'}.`,
    `${verb}: categorías ${created.categorias}, artículos ${created.articulos}, variantes ${created.variantes}, recetas ${created.recetas}, líneas ${created.lineas}.`,
    `Omitidos (ya existen iguales): categorías ${omitted.categorias}, artículos ${omitted.articulos}, variantes ${omitted.variantes}, recetas ${omitted.recetas}.`,
    `Errores: ${report.errors.length}. Conflictos: ${report.conflicts.length}. Avisos: ${report.warnings.length}.`,
  ];
  if (report.errors.length > 0) lines.push('Errores:', ...report.errors.map(issueLine));
  if (report.conflicts.length > 0) lines.push('Conflictos (no se sobrescribe nada):', ...report.conflicts.map(issueLine));
  if (report.warnings.length > 0) lines.push('Avisos:', ...report.warnings.map(issueLine));
  if (report.errors.length > 0 || report.conflicts.length > 0) lines.push('No se escribió nada: corrige el archivo y vuelve a ensayar.');
  else if (!report.written) lines.push('Ensayo sin problemas: repite con --escribir para importar.');
  return `${lines.join('\n')}\n`;
}

/** Código de salida: 0 sin errores ni conflictos; 1 si los hay. */
export const importExitCode = (report: ImportReport): number => (report.errors.length > 0 || report.conflicts.length > 0 ? 1 : 0);
