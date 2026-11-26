import type { VerifyReport } from '@restaurante/core/inventory';

/**
 * Salida de `inventory:verify` (REQ-F-051, RF-13), sin E/S para poder probarla aparte del comando. Solo
 * lleva conteos, ids y el nombre de cada comprobación: nunca costos, cantidades ni nombres (CA-15).
 */

/** Incidencias que se listan; el resto solo se cuenta. */
export const VERIFY_LIST_LIMIT = 100;

export const VERIFY_EXIT = Object.freeze({ OK: 0, MISMATCH: 1, UNVERIFIED: 2 } as const);

export function formatVerifyReport(report: VerifyReport & { documents: number }): string {
  const summary = `artículos=${report.items} movimientos=${report.movements} documentos=${report.documents}`;
  if (report.issues.length === 0) return `inventory_verify_ok ${summary}\n`;
  const lines = report.issues.slice(0, VERIFY_LIST_LIMIT).map((issue) => `inventory_verify_mismatch itemId=${issue.itemId} check=${issue.check}${issue.seq === null ? '' : ` seq=${issue.seq}`}`);
  const rest = report.issues.length - lines.length;
  return [...lines, ...(rest > 0 ? [`inventory_verify_more ${rest}`] : []), `inventory_verify_failed incidencias=${report.issues.length} ${summary}`].join('\n') + '\n';
}

export const verifyExitCode = (report: VerifyReport): number => (report.issues.length === 0 ? VERIFY_EXIT.OK : VERIFY_EXIT.MISMATCH);
