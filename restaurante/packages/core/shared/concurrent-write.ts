import { setTimeout as delay } from 'node:timers/promises';

import { DatabaseUnavailableError } from './database-errors.ts';

/**
 * Dos arranques que preparan a la vez la misma instalación nueva (REQ-F-045: la `api` y, mientras
 * conviva su importación, landing-pages en desarrollo). Las dos escriben lo mismo (la semilla), así que
 * no importa quién gane; el que pierde choca con las claves únicas o con un interbloqueo, su
 * transacción se revierte entera y debe seguir arrancando si el otro confirmó la suya.
 */

/** Códigos de Prisma (P2002 unicidad, P2034 conflicto) y de MySQL (1062, 1213) de ese choque. */
const CONFLICT_CODES: ReadonlySet<string> = new Set(['P2002', 'P2034']);
const CONFLICT_ORIGINAL_CODES: ReadonlySet<string> = new Set(['1062', '1213']);

/** El error es un choque con otra transacción que escribía a la vez (no una base caída ni un dato inválido). */
export function isWriteConflict(err: unknown): boolean {
  if (!(err instanceof DatabaseUnavailableError)) return false;
  const { code, originalCode } = err.details;
  return (code !== undefined && CONFLICT_CODES.has(code)) || (originalCode !== undefined && CONFLICT_ORIGINAL_CODES.has(originalCode));
}

export interface WaitOptions {
  attempts?: number;
  delayMs?: number;
}

/**
 * Tras un choque, la marca de la otra escritura puede no estar confirmada todavía (en un interbloqueo,
 * MySQL revierte una transacción y la otra sigue). Se lee la marca hasta `attempts` veces, con
 * `delayMs` entre lecturas: true en cuanto está; false si no aparece (el error es real).
 */
export async function confirmedByOther(isMarked: () => Promise<boolean>, { attempts = 20, delayMs = 250 }: WaitOptions = {}): Promise<boolean> {
  for (let attempt = 1; ; attempt += 1) {
    if (await isMarked().catch(() => false)) return true;
    if (attempt >= attempts) return false;
    await delay(delayMs);
  }
}
