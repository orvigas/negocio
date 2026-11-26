import { COST_SCALE, QUANTITY_SCALE, divideRounded, multiplyDecimals } from './decimal.ts';
import { AMOUNT_SCALE, TOTAL_SCALE } from './kardex-schema.ts';

/**
 * Aritmética del Kardex (REQ-F-051, RN-T3-4 a RN-T3-6, RN-9): el único sitio donde se calculan el costo
 * de compra, el CPP y los valores. Solo `bigint` y un redondeo (mitad hacia arriba) por operación.
 * Cantidades con escala 3, costos con escala 4, importes capturados con escala 2.
 *
 * La misma función `nextAvgCost` la usan las escrituras y `inventory:verify`, así que la cadena guardada
 * se puede recalcular.
 */

const AMOUNT_TO_COST = 10n ** BigInt(COST_SCALE + QUANTITY_SCALE - AMOUNT_SCALE);

/** Costo por unidad base de una compra: importe (escala 2) / cantidad base (escala 3), con escala 4 (RN-T3-4). */
export function purchaseUnitCost(amount: bigint, baseQuantity: bigint): bigint {
  if (baseQuantity <= 0n) throw new RangeError('La cantidad de una compra debe ser positiva');
  return divideRounded(amount * AMOUNT_TO_COST, baseQuantity);
}

/** Importe capturado (escala 2) expresado con la escala de los totales (4). */
export const amountToTotal = (amount: bigint): bigint => amount * 10n ** BigInt(TOTAL_SCALE - AMOUNT_SCALE);

/**
 * CPP tras una entrada de `d` unidades a costo `k` sobre una existencia `q` con CPP `c` (RN-T3-5):
 * sin costo, el CPP no cambia; con existencia ≤ 0 o sin CPP, pasa a ser `k`; si no, el promedio.
 */
export function applyEntry(q: bigint, c: bigint | null, d: bigint, k: bigint | null): bigint | null {
  if (k === null) return c;
  if (q <= 0n || c === null) return k;
  return divideRounded(q * c + d * k, q + d);
}

/**
 * CPP tras sacar `d` unidades que entraron a costo `k` (reversión de una entrada o devolución, RN-T3-6):
 * si `q − d > 0`, `(q·c − d·k) / (q − d)`; si no, se conserva. Nunca queda negativo (si lo devuelto
 * costó más que el promedio de lo que queda, el CPP baja a 0).
 */
export function applyEntryReversal(q: bigint, c: bigint | null, d: bigint, k: bigint | null): bigint | null {
  if (c === null || k === null || q - d <= 0n) return c;
  const next = divideRounded(q * c - d * k, q - d);
  return next < 0n ? 0n : next;
}

/** Tipos cuyas salidas deshacen una entrada a su costo (el CPP se recalcula con applyEntryReversal). */
const ENTRY_REVERSING_TYPES: ReadonlySet<string> = new Set(['reversion', 'devolucion_proveedor']);

/**
 * CPP después de un movimiento, según su tipo, su signo y su costo:
 * - entrada: applyEntry;
 * - salida de una reversión o una devolución: applyEntryReversal;
 * - cualquier otra salida: sale al CPP y no lo cambia.
 */
export function nextAvgCost(type: string, balanceBefore: bigint, avgCostBefore: bigint | null, quantity: bigint, unitCost: bigint | null): bigint | null {
  if (quantity > 0n) return applyEntry(balanceBefore, avgCostBefore, quantity, unitCost);
  if (ENTRY_REVERSING_TYPES.has(type)) return applyEntryReversal(balanceBefore, avgCostBefore, -quantity, unitCost);
  return avgCostBefore;
}

/** Valor de una cantidad (escala 3, sin signo) a un costo (escala 4), con escala 4. */
export const lineValue = (quantity: bigint, unitCost: bigint): bigint => multiplyDecimals(quantity < 0n ? -quantity : quantity, QUANTITY_SCALE, unitCost, COST_SCALE, TOTAL_SCALE);

/** Valor de una existencia (con signo) a su CPP, con 2 decimales (RF-7). */
export const stockValue = (quantity: bigint, avgCost: bigint): bigint => multiplyDecimals(quantity, QUANTITY_SCALE, avgCost, COST_SCALE, AMOUNT_SCALE);
