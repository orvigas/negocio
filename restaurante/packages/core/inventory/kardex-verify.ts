import { nextAvgCost } from './kardex-math.ts';
import { isMovementType, type KardexMovement, type StockRow } from './kardex-schema.ts';

/**
 * Verificación de la cadena del Kardex (REQ-F-051, RF-13 y CA-15; base de `inventory:verify`). Pura:
 * recibe los movimientos en orden de artículo y `seq` y, al final, las existencias guardadas.
 *
 * Por artículo comprueba: `seq` contiguo desde 1; existencia anterior = nueva del movimiento anterior y
 * nueva = anterior + cantidad; CPP anterior = CPP posterior del anterior y CPP posterior = el que
 * recalcula kardex-math; tipo conocido y cantidad distinta de 0; y que la existencia guardada
 * (cantidad, CPP y último seq) coincida con el último movimiento. Una existencia sin movimientos debe
 * estar en 0, sin costo y con seq 0.
 *
 * Las incidencias solo llevan ids y el nombre de la comprobación: nunca cantidades, costos ni nombres.
 */

export const VERIFY_CHECKS = Object.freeze({
  SEQ: 'seq_no_contiguo',
  BALANCE_CHAIN: 'existencia_anterior',
  BALANCE_SUM: 'existencia_nueva',
  AVG_CHAIN: 'cpp_anterior',
  AVG_REPLAY: 'cpp_recalculado',
  TYPE: 'tipo_desconocido',
  ZERO: 'cantidad_cero',
  STOCK_MISSING: 'existencia_ausente',
  STOCK_MISMATCH: 'existencia_distinta',
} as const);
export type VerifyCheck = (typeof VERIFY_CHECKS)[keyof typeof VERIFY_CHECKS];

export interface VerifyIssue {
  itemId: number;
  check: VerifyCheck;
  /** seq del movimiento; null en las comprobaciones de la existencia. */
  seq: number | null;
}

export interface VerifyReport {
  items: number;
  movements: number;
  issues: VerifyIssue[];
}

interface ChainTail {
  seq: number;
  balance: bigint;
  avgCost: bigint | null;
}

export interface KardexVerifier {
  /** Siguiente movimiento, en orden de (itemId, seq). */
  push(movement: KardexMovement): void;
  /** Cierra la verificación con las existencias guardadas. */
  finish(stock: readonly StockRow[]): VerifyReport;
}

export function createKardexVerifier(): KardexVerifier {
  const tails = new Map<number, ChainTail>();
  const issues: VerifyIssue[] = [];
  let movements = 0;

  return {
    push(movement) {
      movements += 1;
      const issue = (check: VerifyCheck) => issues.push({ itemId: movement.itemId, check, seq: movement.seq });
      const tail = tails.get(movement.itemId) ?? { seq: 0, balance: 0n, avgCost: null };
      if (movement.seq !== tail.seq + 1) issue(VERIFY_CHECKS.SEQ);
      if (movement.balanceBefore !== tail.balance) issue(VERIFY_CHECKS.BALANCE_CHAIN);
      if (movement.balanceAfter !== movement.balanceBefore + movement.quantity) issue(VERIFY_CHECKS.BALANCE_SUM);
      if (movement.avgCostBefore !== tail.avgCost) issue(VERIFY_CHECKS.AVG_CHAIN);
      if (!isMovementType(movement.type)) issue(VERIFY_CHECKS.TYPE);
      if (movement.quantity === 0n) issue(VERIFY_CHECKS.ZERO);
      else if (nextAvgCost(movement.type, movement.balanceBefore, movement.avgCostBefore, movement.quantity, movement.unitCost) !== movement.avgCostAfter) issue(VERIFY_CHECKS.AVG_REPLAY);
      tails.set(movement.itemId, { seq: movement.seq, balance: movement.balanceAfter, avgCost: movement.avgCostAfter });
    },

    finish(stock) {
      const rows = new Map(stock.map((row) => [row.itemId, row]));
      for (const [itemId, tail] of tails) {
        const row = rows.get(itemId);
        if (!row) issues.push({ itemId, check: VERIFY_CHECKS.STOCK_MISSING, seq: null });
        else if (row.quantity !== tail.balance || row.avgCost !== tail.avgCost || row.lastSeq !== tail.seq) issues.push({ itemId, check: VERIFY_CHECKS.STOCK_MISMATCH, seq: null });
      }
      for (const row of stock) {
        if (!tails.has(row.itemId) && (row.quantity !== 0n || row.avgCost !== null || row.lastSeq !== 0)) issues.push({ itemId: row.itemId, check: VERIFY_CHECKS.STOCK_MISMATCH, seq: null });
      }
      return { items: new Set([...tails.keys(), ...rows.keys()]).size, movements, issues };
    },
  };
}

/** Recorre el Kardex por lotes con un lector paginado por clave (itemId, seq). */
export async function verifyKardex(
  reader: { movementsAfter(itemId: number, seq: number, limit: number): Promise<KardexMovement[]>; allStock(): Promise<StockRow[]> },
  batchSize = 5000,
): Promise<VerifyReport> {
  const verifier = createKardexVerifier();
  let cursor = { itemId: 0, seq: 0 };
  for (;;) {
    const batch = await reader.movementsAfter(cursor.itemId, cursor.seq, batchSize);
    for (const movement of batch) verifier.push(movement);
    const last = batch.at(-1);
    if (!last || batch.length < batchSize) break;
    cursor = { itemId: last.itemId, seq: last.seq };
  }
  return verifier.finish(await reader.allStock());
}
