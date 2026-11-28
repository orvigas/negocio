/** Normalización de los textos del inventario (REQ-F-049, RF-2 y casos límite). */

// Caracteres de control (C0, DEL y C1).
// eslint-disable-next-line no-control-regex -- se buscan justamente los caracteres de control.
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/;
// Los mismos, salvo el salto de línea (descripciones de varias líneas).
// eslint-disable-next-line no-control-regex -- se buscan justamente los caracteres de control.
const CONTROL_CHARS_BUT_NEWLINE = /[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/;

/** Longitud en caracteres (puntos de código), no en unidades UTF-16. */
export const codePoints = (text: string): number => [...text].length;

/** Nombre tal como se guarda: recortado y en NFC. */
export const normalizeName = (raw: string): string => raw.trim().normalize('NFC');

/** Clave de un nombre: sin distinguir mayúsculas (sí distingue acentos). */
export const nameKey = (raw: string): string => normalizeName(raw).toLowerCase();

// Marcas diacríticas combinantes, salvo la tilde de la «ñ» (U+0303 tras n/N), que en español es otra letra.
const ACCENTS_BUT_ENYE = /(?<![nN])\u0303|[\u0300-\u0302\u0304-\u036f]/g;

/**
 * Clave de búsqueda (REQ-F-051, OBS-12 b): sin distinguir mayúsculas ni acentos, pero distingue la
 * «ñ» de la «n», como la colación utf8mb4_es_0900_ai_ci con la que busca MySQL. «Cárne» y «carne»
 * dan la misma clave.
 */
export const searchKey = (raw: string): string => raw.trim().normalize('NFD').replace(ACCENTS_BUT_ENYE, '').normalize('NFC').toLowerCase();

/**
 * Nombre obligatorio de una línea. Devuelve el nombre normalizado o el mensaje de error del campo.
 */
export function readName(raw: unknown, max: number, label = 'el nombre'): { value: string } | { error: string } {
  if (typeof raw !== 'string') return { error: raw === undefined || raw === null ? `Escribe ${label}.` : 'Debe ser texto.' };
  const value = normalizeName(raw);
  if (value === '') return { error: `Escribe ${label}.` };
  if (codePoints(value) > max) return { error: `Máximo ${max} caracteres.` };
  if (CONTROL_CHARS.test(value)) return { error: 'No puede tener caracteres de control.' };
  return { value };
}

/** Texto opcional de varias líneas: vacío o ausente es null. */
export function readOptionalText(raw: unknown, max: number): { value: string | null } | { error: string } {
  if (raw === undefined || raw === null) return { value: null };
  if (typeof raw !== 'string') return { error: 'Debe ser texto.' };
  const value = raw.replace(/\r\n?/g, '\n').trim().normalize('NFC');
  if (value === '') return { value: null };
  if (codePoints(value) > max) return { error: `Máximo ${max} caracteres.` };
  if (CONTROL_CHARS_BUT_NEWLINE.test(value)) return { error: 'No puede tener caracteres de control.' };
  return { value };
}

/** Mayor id de una columna INT de MySQL. */
const MAX_ID = 2_147_483_647;

/** Identificador positivo (número o texto de dígitos) o null si no lo es. */
export function readId(raw: unknown): number | null {
  const value = typeof raw === 'string' && /^[1-9]\d{0,9}$/.test(raw.trim()) ? Number(raw.trim()) : raw;
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1 && value <= MAX_ID ? value : null;
}
