import {
  PAGE_IMPORT_SEED_REFUSED,
  allMarked,
  choosePageSource,
  parseChangeLog,
  planPageImport,
  versionOf,
  type PageImportPlan,
  type PageImportProblem,
  type PageStore,
} from '@restaurante/core/catalog';
import { BUSINESS_IDS, confirmedByOther, isWriteConflict, silentLogger, type BusinessId, type Logger } from '@restaurante/core/shared';

import type { MenuRepository } from '../repositories/menu-repository.ts';

/**
 * Importación única de los datos de página a MySQL al arrancar (REQ-F-044, PR 3; RF-2, RF-3, RF-8,
 * D-10). La hace la `app` nueva, la única con el volumen y con la `app` anterior ya detenida.
 *
 * - Solo lee `DATA_DIR`: los JSON y `changes.jsonl` quedan intactos (RN-2).
 * - Negocio con marca (`page_import`): no se reimporta (RN-4, CA-2). Si el JSON cambió desde entonces
 *   (una edición durante una vuelta atrás), solo `page_json_diverged`, sin contenido (CA-16).
 * - Negocios sin marca: una sola transacción para todos, con versiones, historial y marcas (CA-3):
 *   si algo falla, no queda nada y el arranque termina con 1.
 * - Semilla en una instalación existente: se niega antes de abrir la transacción (D-10, CA-20).
 * - Log sin contenido: orígenes, contadores y números de línea ilegibles.
 */

/** Límite de la transacción de la importación (mucho menos que el `start_period` de 90 s). */
export const PAGE_IMPORT_TIMEOUT_MS = 60_000;
/** Números de línea ilegibles que se registran como mucho (el total va aparte). */
const LOGGED_LINES = 50;

/** La importación no se puede hacer: el arranque debe terminar con 1. */
export class PageImportRefusedError extends Error {
  readonly code = PAGE_IMPORT_SEED_REFUSED;
  readonly refusals: { business: BusinessId; reason: PageImportProblem }[];

  constructor(refusals: { business: BusinessId; reason: PageImportProblem }[]) {
    super('La importación de la página se niega a usar la semilla en una instalación existente');
    this.name = 'PageImportRefusedError';
    this.refusals = refusals;
  }
}

export interface PageImportOptions {
  repository: Pick<MenuRepository, 'getImportSource' | 'readChangeLog'>;
  store: Pick<PageStore, 'readImports' | 'transaction'>;
  /** `product_import` tenía filas al empezar el arranque (D-10). */
  existing: boolean;
  logger?: Logger;
  now?: () => Date;
}

/** Importa los negocios sin marca. Devuelve los importados en este arranque. */
export async function importPages({ repository, store, existing, logger = silentLogger, now = () => new Date() }: PageImportOptions): Promise<BusinessId[]> {
  const marks = new Map((await store.readImports()).map((mark) => [mark.business, mark]));
  const plans: PageImportPlan[] = [];
  const refusals: { business: BusinessId; reason: PageImportProblem }[] = [];

  for (const business of BUSINESS_IDS) {
    const candidates = await repository.getImportSource(business);
    const mark = marks.get(business);
    if (mark) {
      const published = choosePageSource(candidates);
      if (versionOf(published.document) !== mark.sourceVersion) {
        logger.warn('page_json_diverged', { business, source: published.source, importedSource: mark.source });
      }
      continue;
    }
    const decision = planPageImport(business, candidates, { existing });
    if (decision.ok) plans.push(decision.plan);
    else refusals.push({ business: decision.business, reason: decision.reason });
  }

  if (refusals.length > 0) throw new PageImportRefusedError(refusals);
  if (plans.length === 0) return [];

  // Un error de lectura del registro (permisos, E/S) es un fallo de importación; sin archivo, vacío.
  const { entries, skipped } = parseChangeLog(await repository.readChangeLog());
  if (skipped.length > 0) logger.warn('page_import_lines_skipped', { count: skipped.length, lines: skipped.slice(0, LOGGED_LINES) });
  for (const plan of plans) {
    if (plan.source !== 'current') logger.warn(plan.source === 'seed' ? 'page_import_from_seed' : 'page_import_from_previous', { business: plan.business, reason: plan.problem });
  }

  const importedAt = now();
  try {
    await store.transaction(
      async (tx) => {
        for (const plan of plans) {
          await tx.putCurrent(plan.business, plan.current);
          if (plan.previous) await tx.putPrevious(plan.business, plan.previous);
          await tx.addImportedChanges(entries[plan.business]);
          await tx.markImported({
            business: plan.business,
            importedAt,
            source: plan.source,
            sourceVersion: plan.sourceVersion,
            historyCount: entries[plan.business].length,
            skippedLines: skipped.length,
          });
        }
      },
      { timeoutMs: PAGE_IMPORT_TIMEOUT_MS },
    );
  } catch (err) {
    // La `api` siembra la página de una instalación nueva a la vez (REQ-F-045, solo en desarrollo): si
    // ya están todas las marcas, la escribió ella con la misma semilla; si no, el error es real.
    if (!isWriteConflict(err) || !(await confirmedByOther(() => allMarked(store, plans)))) throw err;
    for (const plan of plans) logger.warn('page_import_skipped', { business: plan.business, reason: 'concurrent' });
    return [];
  }
  for (const plan of plans) {
    logger.info('page_import_done', {
      business: plan.business,
      source: plan.source,
      hasPrevious: plan.previous !== null,
      history: entries[plan.business].length,
      skippedLines: skipped.length,
    });
  }
  return plans.map((plan) => plan.business);
}
