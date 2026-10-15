/**
 * Utilidades de texto del bot de WhatsApp (REQ-F-009). Funciones puras.
 */

/** Límite del cuerpo de un mensaje de texto de la Cloud API. */
export const MAX_MESSAGE_CHARS = 4096;

/** Sustituye los marcadores `{clave}`; un marcador sin valor se deja tal cual. */
export const fill = (template: string, values: Readonly<Record<string, string | number>> = {}): string =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => (Object.hasOwn(values, key) ? String(values[key]) : match));

/**
 * Forma comparable de lo que escribe el cliente (D-10): minúsculas, sin acentos ni signos y con
 * los espacios simplificados. "¡Menú!" -> "menu"; "Muñeco" -> "muneco".
 */
export function normalizeInput(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Texto libre del cliente (nombre, dirección, notas): sin caracteres de control y con los espacios simplificados. */
export const cleanText = (text: string): string =>
  text
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Longitud en puntos de código (un emoji cuenta como uno). */
export const codePointLength = (text: string): number => [...text].length;

/** Número de opción o cantidad: solo dígitos ("2", " 2 ", "#2", "2."); "-1", "2.5" o "abc" no valen. */
export function parseNumber(text: string): number | null {
  const match = /^#?(\d{1,4})\.?$/.exec(text.trim());
  return match?.[1] === undefined ? null : Number(match[1]);
}

/** Parte un texto en mensajes de hasta `max` caracteres, por líneas (una línea más larga se corta). */
export function chunkText(text: string, max = MAX_MESSAGE_CHARS): string[] {
  const chunks: string[] = [];
  let current = '';
  const push = (piece: string): void => {
    if (current === '') current = piece;
    else if (current.length + 1 + piece.length <= max) current = `${current}\n${piece}`;
    else {
      chunks.push(current);
      current = piece;
    }
  };
  for (const line of text.split('\n')) {
    if (line.length <= max) push(line);
    else for (let start = 0; start < line.length; start += max) push(line.slice(start, start + max));
  }
  if (current !== '') chunks.push(current);
  return chunks;
}

// --- Formato de los mensajes al cliente (REQ-F-029) ---------------------------------

/**
 * Sangría de los renglones que continúan un bloque (precios del menú; detalle y cantidad de una
 * línea del pedido). Única fuente: D-1 de REQ-F-029 la fija según cómo la muestra WhatsApp en los
 * teléfonos. Con '' (respaldo de RF-3), las líneas del pedido se separan con un renglón en blanco.
 */
export const INDENT: string = '    ';

/** Ancho visible máximo de un renglón estructurado (REQ-F-029, RF-1; N = 28 por decisión del usuario, D-9). */
export const MAX_LINE_WIDTH = 28;

/** Caracteres que cuentan como sangría al inicio de un renglón. */
const INDENT_CHARS = /^[ \u00A0\u2007]/;
const LEADING_INDENT = /^[ \u00A0\u2007]{1,4}/;
const FORMAT_MARKERS = /[*_~]/g;
const PICTOGRAPHIC = /\p{Extended_Pictographic}/u;
const graphemes = new Intl.Segmenter('es', { granularity: 'grapheme' });

const graphemesOf = (text: string): string[] => Array.from(graphemes.segment(text), (part) => part.segment);

/**
 * Ancho visible de un renglón (REQ-F-029): sin la sangría inicial (hasta 4) ni los marcadores de
 * formato de WhatsApp (`*`, `_`, `~`); cada emoji cuenta 2 y cualquier otro carácter, 1.
 */
export function visibleWidth(line: string): number {
  const text = line.replace(LEADING_INDENT, '').replace(FORMAT_MARKERS, '');
  return graphemesOf(text).reduce((width, grapheme) => width + (PICTOGRAPHIC.test(grapheme) ? 2 : 1), 0);
}

/** Emojis de un renglón (un emoji con selector de variación o ZWJ cuenta como uno). */
export const emojiCount = (line: string): number => graphemesOf(line).filter((grapheme) => PICTOGRAPHIC.test(grapheme)).length;

/** Encabezado que nunca queda solo al final de una parte: un renglón entero en negrita. */
const HEADING = /^\*[^*\n]+\*$/;

interface Unit {
  /** Separador con la unidad anterior: '\n' o uno o más renglones en blanco. */
  sep: string;
  text: string;
  /** Si es un encabezado unido a su bloque: las unidades originales, para separarlas si no caben juntas (DEF-002). */
  members?: Unit[];
}

function unitsOf(text: string): Unit[] {
  const units: Unit[] = [];
  let blanks = 0;
  for (const line of text.split('\n')) {
    if (line.trim() === '') {
      blanks += 1;
      continue;
    }
    const last = units[units.length - 1];
    if (last && blanks === 0 && INDENT_CHARS.test(line)) last.text = `${last.text}\n${line}`;
    else units.push({ sep: '\n'.repeat(blanks + 1), text: line });
    blanks = 0;
  }
  // Un encabezado se queda con lo que encabeza.
  for (let index = units.length - 2; index >= 0; index -= 1) {
    const unit = units[index];
    const next = units[index + 1];
    if (unit && next && HEADING.test(unit.text)) {
      units[index] = { sep: unit.sep, text: `${unit.text}${next.sep}${next.text}`, members: [unit, ...(next.members ?? [next])] };
      units.splice(index + 1, 1);
    }
  }
  return units;
}

/**
 * Parte un mensaje en textos de hasta `max` caracteres sin separar nunca un bloque (REQ-F-029,
 * RF-12): un renglón y los renglones con sangría que lo siguen (un producto del menú, una línea del
 * pedido), y un encabezado en negrita con el bloque que encabeza. Se corta entre bloques; ninguna
 * parte empieza ni termina con un renglón en blanco. Si un encabezado y su bloque no caben juntos,
 * van por separado (DEF-002). Solo un bloque más largo que `max` se parte por renglones
 * (`chunkText`). Sin renglones en blanco ni sangrías, da lo mismo que `chunkText`.
 */
export function splitMessage(text: string, max = MAX_MESSAGE_CHARS): string[] {
  const parts: string[] = [];
  let current = '';
  const add = (unit: Unit): void => {
    if (unit.text.length > max && unit.members) {
      for (const member of unit.members) add(member);
    } else if (unit.text.length > max) {
      if (current !== '') parts.push(current);
      const pieces = chunkText(unit.text, max);
      current = pieces.pop() ?? '';
      parts.push(...pieces);
    } else if (current === '') current = unit.text;
    else if (current.length + unit.sep.length + unit.text.length <= max) current = `${current}${unit.sep}${unit.text}`;
    else {
      parts.push(current);
      current = unit.text;
    }
  };
  for (const unit of unitsOf(text)) add(unit);
  if (current !== '') parts.push(current);
  return parts;
}
