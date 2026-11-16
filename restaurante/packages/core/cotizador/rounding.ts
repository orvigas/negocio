/**
 * Redondeos del cotizador (REQ-F-046, RN-8 y RN-13). Antes de redondear normalizan a 9 decimales para
 * absorber el error de coma flotante, como hace `ROUND` de Excel con sus 15 cifras significativas:
 * 63 / 0.7 da 90.00000000000001, y `ceilInt` debe dar 90, no 91.
 */

const NORMALIZE_DECIMALS = 9;

const normalize = (x: number): number => Number(x.toFixed(NORMALIZE_DECIMALS));

/** Al más cercano, con 0.5 hacia arriba (alejándose de cero, como `ROUND` de Excel). */
export function roundHalfUp(x: number, decimals = 0): number {
  const factor = 10 ** decimals;
  const value = normalize(x);
  const scaled = normalize(Math.abs(value) * factor);
  const rounded = Math.floor(scaled + 0.5) / factor;
  // Sin -0: un resultado nulo siempre es 0.
  return value < 0 && rounded !== 0 ? -rounded : rounded;
}

/** Hacia arriba al entero (`ROUNDUP(x, 0)` de Excel para valores positivos). */
export function ceilInt(x: number): number {
  return Math.ceil(normalize(x));
}
