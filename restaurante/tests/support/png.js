import { inflateSync } from 'node:zlib';

/**
 * Lectura mínima de PNG e ICO para las pruebas de iconos (REQ-F-002), sin dependencias.
 */

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Tipos de color PNG con canal alfa (escala de grises + alfa, RGBA). */
const ALPHA_COLOR_TYPES = new Set([4, 6]);

/**
 * @param {Buffer} buffer
 * @returns {{ width: number, height: number, bitDepth: number, colorType: number,
 *   hasTransparency: boolean, firstPixel: [number, number, number] }}
 */
export function readPng(buffer) {
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error('No es un PNG');
  const chunks = new Map();
  const idat = [];
  for (let offset = 8; offset < buffer.length; ) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('latin1', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IDAT') idat.push(data);
    else chunks.set(type, data);
    offset += 12 + length;
  }
  const ihdr = chunks.get('IHDR');
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  const bitDepth = ihdr[8];
  const colorType = ihdr[9];
  const hasTransparency = ALPHA_COLOR_TYPES.has(colorType) || chunks.has('tRNS');

  // Primer píxel de la primera fila: con cualquier filtro PNG su valor es el byte crudo
  // (no hay píxeles a la izquierda ni arriba). Solo se usa con imágenes de 8 bits RGB o paleta.
  const raw = inflateSync(Buffer.concat(idat));
  let firstPixel;
  if (colorType === 2 && bitDepth === 8) {
    firstPixel = [raw[1], raw[2], raw[3]];
  } else if (colorType === 3) {
    const index = raw[1] >> (8 - bitDepth);
    const palette = chunks.get('PLTE');
    firstPixel = [palette[index * 3], palette[index * 3 + 1], palette[index * 3 + 2]];
  }
  return { width, height, bitDepth, colorType, hasTransparency, firstPixel };
}

/** Tamaños (px) de las imágenes de un archivo .ico. */
export function readIcoSizes(buffer) {
  if (buffer.readUInt16LE(0) !== 0 || buffer.readUInt16LE(2) !== 1) throw new Error('No es un ICO');
  const count = buffer.readUInt16LE(4);
  return Array.from({ length: count }, (_, i) => {
    const entry = 6 + i * 16;
    return { width: buffer[entry] || 256, height: buffer[entry + 1] || 256 };
  });
}

/** "#03132b" -> [3, 19, 43] */
export const hexToRgb = (hex) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
