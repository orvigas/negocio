/**
 * Decimales exactos del inventario (REQ-F-049, RN-14 y PV-13): punto fijo con `bigint` nativo, sin
 * coma flotante ni dependencias. Un valor con escala `s` es el entero `valor × 10^s` (24.000 con
 * escala 3 es 24000n).
 *
 * - Cantidades y factores: escala 3 (DECIMAL(13,3) en MySQL). Costos (T3): escala 4.
 * - El único redondeo es el de una división (conversión de unidades): mitad hacia arriba, el mismo
 *   criterio «0.5 sube» del cotizador (REQ-F-046), aplicado al valor absoluto.
 */

/** Escala de las cantidades y los factores de conversión. */
export const QUANTITY_SCALE = 3;
/** Dígitos enteros de una cantidad o un factor (DECIMAL(13,3): 10 enteros y 3 decimales). */
export const QUANTITY_INTEGER_DIGITS = 10;
/** Escala de los costos por unidad (DECIMAL(15,4); REQ-F-050). */
export const COST_SCALE = 4;
/** Dígitos enteros de un costo (DECIMAL(15,4): 11 enteros y 4 decimales). */
export const COST_INTEGER_DIGITS = 11;
/** Escala de la merma en % (DECIMAL(5,2): 40.00 % es 4000n; 100 % es 10000n). */
export const WASTE_SCALE = 2;

export type DecimalParseResult = { ok: true; value: bigint } | { ok: false; error: string };

export interface ParseDecimalOptions {
  scale?: number;
  integerDigits?: number;
}

const pow10 = (exponent: number): bigint => 10n ** BigInt(exponent);

/**
 * Lee un decimal sin signo escrito con punto («24», «0.355»). Rechaza la coma, el signo, la notación
 * científica, los espacios internos y más decimales de los que admite la escala (no redondea).
 */
export function parseDecimal(raw: unknown, { scale = QUANTITY_SCALE, integerDigits = QUANTITY_INTEGER_DIGITS }: ParseDecimalOptions = {}): DecimalParseResult {
  if (typeof raw !== 'string') return { ok: false, error: 'Escribe un número.' };
  const text = raw.trim();
  if (text === '') return { ok: false, error: 'Escribe un número.' };
  if (/^\d+,\d+$/.test(text)) return { ok: false, error: 'Usa punto decimal, no coma (p. ej. 0.5).' };
  const match = /^(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) return { ok: false, error: 'Escribe un número sin signo, con punto decimal (p. ej. 24 o 0.355).' };
  const integer = (match[1] ?? '').replace(/^0+(?=\d)/, '');
  const fraction = match[2] ?? '';
  if (fraction.length > scale) return { ok: false, error: `Máximo ${scale} decimales.` };
  if (integer.length > integerDigits) return { ok: false, error: `Máximo ${integerDigits} dígitos antes del punto.` };
  return { ok: true, value: BigInt(integer) * pow10(scale) + BigInt(fraction.padEnd(scale, '0') || '0') };
}

/** Texto con exactamente `scale` decimales («24.000»). */
export function formatDecimal(value: bigint, scale = QUANTITY_SCALE): string {
  const sign = value < 0n ? '-' : '';
  const digits = (value < 0n ? -value : value).toString().padStart(scale + 1, '0');
  if (scale === 0) return `${sign}${digits}`;
  return `${sign}${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
}

/** División entera con redondeo de la mitad hacia arriba (sobre el valor absoluto). */
export function divideRounded(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) throw new RangeError('División entre cero');
  const negative = numerator < 0n !== denominator < 0n;
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  const quotient = (2n * n + d) / (2n * d);
  return negative ? -quotient : quotient;
}

/**
 * Multiplica dos decimales y expresa el resultado con la escala `outScale`, redondeando una sola vez:
 * `a` (escala `aScale`) × `b` (escala `bScale`).
 */
export function multiplyDecimals(a: bigint, aScale: number, b: bigint, bScale: number, outScale: number): bigint {
  const productScale = aScale + bScale;
  const product = a * b;
  return productScale >= outScale ? divideRounded(product, pow10(productScale - outScale)) : product * pow10(outScale - productScale);
}
