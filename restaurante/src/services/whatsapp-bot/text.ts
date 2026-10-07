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
