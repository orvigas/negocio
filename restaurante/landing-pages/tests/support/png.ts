import { inflateSync } from 'node:zlib';

/**
 * Lectura mínima de PNG e ICO para las pruebas de iconos (REQ-F-002), sin dependencias.
 */

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Tipos de color PNG con canal alfa (escala de grises + alfa, RGBA). */
const ALPHA_COLOR_TYPES = new Set([4, 6]);

export interface PngInfo {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  hasTransparency: boolean;
  firstPixel: [number, number, number] | undefined;
}

export function readPng(buffer: Buffer): PngInfo {
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error('No es un PNG');
  const chunks = new Map<string, Buffer>();
  const idat: Buffer[] = [];
  for (let offset = 8; offset < buffer.length; ) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('latin1', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IDAT') idat.push(data);
    else chunks.set(type, data);
    offset += 12 + length;
  }
  // Todo PNG válido tiene IHDR (13 bytes); si faltara, la prueba falla al leerlo.
  const ihdr = chunks.get('IHDR') as Buffer;
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const bitDepth = ihdr.readUInt8(8);
  const colorType = ihdr.readUInt8(9);
  const hasTransparency = ALPHA_COLOR_TYPES.has(colorType) || chunks.has('tRNS');

  // Primer píxel de la primera fila: con cualquier filtro PNG su valor es el byte crudo
  // (no hay píxeles a la izquierda ni arriba). Solo se usa con imágenes de 8 bits RGB o paleta.
  const raw = inflateSync(Buffer.concat(idat));
  // Los índices leídos están dentro del buffer (imagen de 8 bits) o de la paleta.
  let firstPixel: [number, number, number] | undefined;
  if (colorType === 2 && bitDepth === 8) {
    firstPixel = [raw[1], raw[2], raw[3]] as [number, number, number];
  } else if (colorType === 3) {
    const index = raw.readUInt8(1) >> (8 - bitDepth);
    // Una imagen de paleta (tipo 3) siempre tiene PLTE.
    const palette = chunks.get('PLTE') as Buffer;
    firstPixel = [palette[index * 3], palette[index * 3 + 1], palette[index * 3 + 2]] as [number, number, number];
  }
  return { width, height, bitDepth, colorType, hasTransparency, firstPixel };
}

/** Tamaños (px) de las imágenes de un archivo .ico. */
export function readIcoSizes(buffer: Buffer): { width: number; height: number }[] {
  if (buffer.readUInt16LE(0) !== 0 || buffer.readUInt16LE(2) !== 1) throw new Error('No es un ICO');
  const count = buffer.readUInt16LE(4);
  return Array.from({ length: count }, (_, i) => {
    const entry = 6 + i * 16;
    return { width: buffer[entry] || 256, height: buffer[entry + 1] || 256 };
  });
}

/** "#03132b" -> [3, 19, 43] */
// Tres componentes: el map conserva la longitud del arreglo de índices.
export const hexToRgb = (hex: string): [number, number, number] =>
  [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
