import { BUSINESS_IDS, isBusinessId, type BusinessId } from '../shared/index.ts';
import type { FieldChange } from './menu-diff.ts';
import { AUTHOR_MAX_LENGTH, pickPageData, textLength, type MenuDocument } from './menu-schema.ts';
import { PAGE_ACTIONS, versionOf, type PageAction, type PageChangeEntry, type StoredPage } from './page-store.ts';

/**
 * Importación única de los datos de página desde los JSON (REQ-F-044, PR 3; RF-2, RF-3, RF-8 y D-10).
 * Solo decide y analiza: sin E/S. La lectura de `DATA_DIR` y la escritura en MySQL las hace quien la
 * llama (landing-pages/src/services/page-import.ts) en una sola transacción.
 *
 * Origen (RF-3): `current`; si no sirve, `previous`; si tampoco, la semilla.
 * - `current` válido: vigente = current y anterior = previous (si es válido).
 * - `previous` como vigente: anterior vacío.
 * - Semilla de primera ejecución (instalación nueva sin JSON): vigente y anterior (CA-5).
 * - Semilla por daño en una instalación nueva: anterior vacío.
 * - Semilla en una instalación existente (`product_import` con filas): se niega (D-10, CA-20).
 *
 * Un documento que no cabe en las columnas (fecha de más de 64 caracteres, revisión fuera de INT,
 * texto mal formado) se trata como inválido: un JSON nunca aborta la importación (D-2).
 */

export const PAGE_IMPORT_SEED_REFUSED = 'PAGE_IMPORT_SEED_REFUSED';

/** Mayor revisión que cabe en `page_version.revision` (INT con signo). */
const MAX_REVISION = 2_147_483_647;
/** Largo de `page_version.updated_at` y `page_change.at`. */
const MAX_DATE_LENGTH = 64;
/** Acciones del historial (incluida `restore_seed`, que solo llega importada). */
const KNOWN_ACTIONS: ReadonlySet<string> = new Set(Object.values(PAGE_ACTIONS));

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

// --- Historial (`changes.jsonl`) -------------------------------------------------

export interface ParsedChangeLog {
  /** Entradas válidas de cada negocio, en el orden del archivo. */
  entries: Record<BusinessId, PageChangeEntry[]>;
  /** Números de línea (desde 1) ilegibles: se omiten y solo se cuentan (RF-8). */
  skipped: number[];
}

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

function parseChanges(value: unknown): FieldChange[] | null {
  if (!Array.isArray(value)) return null;
  const changes: FieldChange[] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.field !== 'string' || item.field === '' || !wellFormed(item.field)) return null;
    changes.push({ field: item.field, before: item.before ?? null, after: item.after ?? null });
  }
  return wellFormed(JSON.stringify(changes)) ? changes : null;
}

/** Una línea del registro, o null si es ilegible (nunca se registra su contenido). */
export function parseChangeLine(line: string): PageChangeEntry | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (!isRecord(value)) return null;
  const { at, business, author, authorId, action, changes } = value;
  if (!isBusinessId(business)) return null;
  if (typeof action !== 'string' || !KNOWN_ACTIONS.has(action)) return null;
  if (typeof author !== 'string') return null;
  const name = author.trim();
  if (name === '' || textLength(name) > AUTHOR_MAX_LENGTH || !wellFormed(name)) return null;
  if (at !== null && at !== undefined && (typeof at !== 'string' || at.length > MAX_DATE_LENGTH || !wellFormed(at) || Number.isNaN(Date.parse(at)))) return null;
  // Las entradas anteriores a REQ-F-007 no traen `authorId`: se importan solo con el nombre.
  let id: number | null = null;
  if (authorId !== undefined && authorId !== null) {
    if (!Number.isSafeInteger(authorId) || (authorId as number) <= 0 || (authorId as number) > MAX_REVISION) return null;
    id = authorId as number;
  }
  const parsed = parseChanges(changes);
  if (!parsed) return null;
  // Comprobado arriba: es una de las acciones conocidas.
  return { at: typeof at === 'string' ? at : null, business, author: name, authorId: id, action: action as PageAction, changes: parsed };
}

/** Reparte `changes.jsonl` por negocio. Las líneas vacías se ignoran; una línea final cortada es ilegible. */
export function parseChangeLog(text: string | null): ParsedChangeLog {
  const entries = Object.fromEntries(BUSINESS_IDS.map((business) => [business, [] as PageChangeEntry[]])) as Record<BusinessId, PageChangeEntry[]>;
  const skipped: number[] = [];
  if (text === null) return { entries, skipped };
  const lines = text.split('\n');
  lines.forEach((raw, index) => {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    if (line.trim() === '') return;
    const entry = parseChangeLine(line);
    if (entry) entries[entry.business].push(entry);
    else skipped.push(index + 1);
  });
  return { entries, skipped };
}
