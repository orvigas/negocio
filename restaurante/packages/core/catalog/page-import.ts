import { BUSINESS_IDS, confirmedByOther, isWriteConflict, silentLogger, type BusinessId, type Logger } from '../shared/index.ts';
import { AUTHOR_MAX_LENGTH, pickPageData, textLength, type MenuDocument } from './menu-schema.ts';
import { versionOf, type PageStore, type StoredPage } from './page-store.ts';

/**
 * Datos de página de una instalación nueva (REQ-F-044, RF-3 y D-10; REQ-F-045, RF-4). Las reglas de
 * origen vienen de la importación única desde los JSON (REQ-F-044, PR 3), retirada en REQ-F-045 junto
 * con los JSON: hoy la `api` solo siembra con la semilla (`seedPages`).
 *
 * Origen: `current`; si no sirve, `previous`; si tampoco, la semilla.
 * - Semilla de primera ejecución (instalación nueva): vigente y anterior (CA-5).
 * - Semilla en una instalación existente (`product_import` con filas): se niega (D-10, CA-20).
 *
 * Un documento que no cabe en las columnas (fecha de más de 64 caracteres, revisión fuera de INT,
 * texto mal formado) se trata como inválido (D-2).
 */

export const PAGE_IMPORT_SEED_REFUSED = 'PAGE_IMPORT_SEED_REFUSED';

/** Mayor revisión que cabe en `page_version.revision` (INT con signo). */
const MAX_REVISION = 2_147_483_647;
/** Largo de `page_version.updated_at` y `page_change.at`. */
const MAX_DATE_LENGTH = 64;

export type PageImportSource = 'current' | 'previous' | 'seed';
/** Por qué no hay un `current` utilizable: faltan los archivos o están dañados. */
export type PageImportProblem = 'missing' | 'damaged';

/** Lo que el repositorio de menús encontró al arrancar para un negocio (sin escribir nada). */
export interface PageImportCandidates<Id extends BusinessId = BusinessId> {
  /** Documento vigente válido, o null si falta, está dañado o hay un estado "dañado" pendiente. */
  current: MenuDocument<Id> | null;
  /** Documento anterior válido, o null. */
  previous: MenuDocument<Id> | null;
  /** Por qué `current` es null. */
  problem: PageImportProblem | null;
  /** La semilla se escribió en este arranque (instalación nueva sin JSON). */
  seeded: boolean;
  /** Semilla versionada del negocio. */
  seed: MenuDocument<Id>;
}

export interface PageImportPlan {
  business: BusinessId;
  source: PageImportSource;
  /** `revision@updatedAt` del documento importado como vigente (marca `page_import.source_version`). */
  sourceVersion: string;
  current: StoredPage;
  previous: StoredPage | null;
  /** Solo con origen `previous` o semilla: por qué no se usó `current`. */
  problem: PageImportProblem | null;
}

export type PageImportDecision = { ok: true; plan: PageImportPlan } | { ok: false; code: typeof PAGE_IMPORT_SEED_REFUSED; business: BusinessId; reason: PageImportProblem };

const wellFormed = (text: string): boolean => text.isWellFormed();

/** El documento cabe en las columnas de `page_version`. */
function storable(document: MenuDocument): boolean {
  const { revision, updatedAt, updatedBy } = document;
  if (!Number.isSafeInteger(revision) || revision < 0 || revision > MAX_REVISION) return false;
  if (updatedAt !== null && (updatedAt.length > MAX_DATE_LENGTH || !wellFormed(updatedAt))) return false;
  if (updatedBy !== null && (textLength(updatedBy) > AUTHOR_MAX_LENGTH || !wellFormed(updatedBy))) return false;
  return wellFormed(JSON.stringify(document.data));
}

/** Versión guardada con solo los datos de página del documento (las listas congeladas no se migran). */
function toStored<Id extends BusinessId>(business: Id, document: MenuDocument<Id>): StoredPage {
  return {
    revision: document.revision,
    updatedAt: document.updatedAt,
    updatedBy: document.updatedBy,
    // Los JSON no guardan el id del autor (REQ-F-007 solo lo lleva en `changes.jsonl`).
    updatedById: null,
    data: JSON.stringify(pickPageData(business, document.data)),
  };
}

/** Documento que publica la landing con estos archivos y de dónde sale (sin aplicar D-10). */
export function choosePageSource<Id extends BusinessId>(candidates: PageImportCandidates<Id>): { source: PageImportSource; document: MenuDocument<Id>; problem: PageImportProblem | null } {
  const { current, previous, seeded, seed } = candidates;
  if (seeded) return { source: 'seed', document: seed, problem: 'missing' };
  if (current && storable(current)) return { source: 'current', document: current, problem: null };
  const problem = candidates.problem ?? 'damaged';
  if (previous && storable(previous)) return { source: 'previous', document: previous, problem };
  return { source: 'seed', document: seed, problem };
}

/**
 * Qué se importa para un negocio. `existing`: la instalación ya tenía productos importados al empezar el
 * arranque (D-10); entonces la semilla nunca se importa como dato real.
 */
export function planPageImport<Id extends BusinessId>(business: Id, candidates: PageImportCandidates<Id>, { existing }: { existing: boolean }): PageImportDecision {
  const { source, document, problem } = choosePageSource(candidates);
  if (source === 'seed' && existing) return { ok: false, code: PAGE_IMPORT_SEED_REFUSED, business, reason: problem ?? 'missing' };
  const current = toStored(business, document);
  let previous: StoredPage | null = null;
  if (source === 'current' && candidates.previous && storable(candidates.previous)) previous = toStored(business, candidates.previous);
  // Primera ejecución: la semilla es la versión vigente y la anterior, como hacían los JSON (CA-5).
  if (source === 'seed' && problem === 'missing') previous = current;
  return { ok: true, plan: { business, source, sourceVersion: versionOf(document), current, previous, problem: source === 'current' ? null : problem } };
}

/** Todos los negocios de `plans` tienen ya su marca de importación. */
export async function allMarked(store: Pick<PageStore, 'readImports'>, plans: readonly Pick<PageImportPlan, 'business'>[]): Promise<boolean> {
  const marked = new Set((await store.readImports()).map((mark) => mark.business));
  return plans.every((plan) => marked.has(plan.business));
}

/** Candidatos de una instalación nueva sin JSON: solo la semilla (primera ejecución, CA-5). */
export function seedCandidates<Id extends BusinessId>(seed: MenuDocument<Id>): PageImportCandidates<Id> {
  return { current: null, previous: null, problem: 'missing', seeded: true, seed };
}

export interface SeedPagesOptions {
  store: Pick<PageStore, 'readImports' | 'transaction'>;
  /** Semilla de cada negocio, ya validada. */
  seeds: { [Id in BusinessId]: MenuDocument<Id> };
  logger?: Logger;
  now?: () => Date;
}

/**
 * Página de una instalación nueva (REQ-F-045, RF-4): crea con la semilla la versión vigente, la anterior
 * y la marca de cada negocio sin marca, en una sola transacción. Quien la llama decide que la
 * instalación es nueva (D-10: en una existente nunca se publica la semilla). Idempotente: un negocio con
 * marca no se toca. Si otro proceso sembró a la vez (la transacción choca con las claves o con un
 * interbloqueo y se revierte), se vuelven a leer las marcas: con todas presentes se registra
 * `page_seed_skipped` y se continúa; si falta alguna, el error es real. Devuelve los negocios sembrados.
 */
export async function seedPages({ store, seeds, logger = silentLogger, now = () => new Date() }: SeedPagesOptions): Promise<BusinessId[]> {
  const marked = new Set((await store.readImports()).map((mark) => mark.business));
  const plans: PageImportPlan[] = [];
  for (const business of BUSINESS_IDS) {
    if (marked.has(business)) continue;
    // Sin `existing`, la semilla nunca se niega.
    const decision = planPageImport(business, seedCandidates(seeds[business]), { existing: false });
    if (decision.ok) plans.push(decision.plan);
  }
  if (plans.length === 0) return [];

  const importedAt = now();
  try {
    await store.transaction(async (tx) => {
      for (const plan of plans) {
        await tx.putCurrent(plan.business, plan.current);
        if (plan.previous) await tx.putPrevious(plan.business, plan.previous);
        await tx.markImported({ business: plan.business, importedAt, source: plan.source, sourceVersion: plan.sourceVersion, historyCount: 0, skippedLines: 0 });
      }
    });
  } catch (err) {
    if (!isWriteConflict(err) || !(await confirmedByOther(() => allMarked(store, plans)))) throw err;
    for (const plan of plans) logger.warn('page_seed_skipped', { business: plan.business, reason: 'concurrent' });
    return [];
  }
  for (const plan of plans) logger.info('page_seeded', { business: plan.business, source: plan.source });
  return plans.map((plan) => plan.business);
}
