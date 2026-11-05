import type { BusinessId } from '../shared/index.ts';
import type { FieldChange } from './menu-diff.ts';
import type { ValidationError } from './menu-schema.ts';

/**
 * Store de los datos de página (REQ-F-044, RF-1 y RF-8): contrato que implementan Prisma/MySQL
 * (packages/db) y la memoria (memory-page-store.ts), acciones del historial y errores de dominio.
 */

export const PAGE_ACTIONS = Object.freeze({
  SAVE: 'save',
  OVERWRITE_AFTER_CONFLICT: 'overwrite_after_conflict',
  RESTORE_PREVIOUS: 'restore_previous',
  /** Solo en entradas importadas de `changes.jsonl` (RF-8): el admin nuevo no la ofrece (D-5). */
  RESTORE_SEED: 'restore_seed',
});
export type PageAction = (typeof PAGE_ACTIONS)[keyof typeof PAGE_ACTIONS];

/**
 * Identificador de versión: cambia con cada escritura, incluidas las restauraciones. El mismo formato
 * que los JSON, para que una versión importada conserve su identidad.
 */
export const versionOf = (version: { revision: number; updatedAt: string | null }): string => `${version.revision}@${version.updatedAt ?? 'seed'}`;

/** Versión guardada. `updatedAt` es texto: conserva la fecha y su desplazamiento tal cual. */
export interface StoredPage {
  revision: number;
  updatedAt: string | null;
  updatedBy: string | null;
  updatedById: number | null;
  /** JSON de los datos de página (sin validar: lo valida el repositorio al leer). */
  data: string;
}

export interface StoredPages {
  current: StoredPage | null;
  previous: StoredPage | null;
}

export interface PageChangeEntry {
  at: string | null;
  business: BusinessId;
  author: string;
  authorId: number | null;
  action: PageAction;
  changes: FieldChange[];
}

export interface PageStoreTx {
  read(business: BusinessId): Promise<StoredPages>;
  /** Reemplaza la versión vigente si sigue siendo `expected`; si no, false y no escribe nada. */
  replaceCurrent(business: BusinessId, next: StoredPage, expected: Pick<StoredPage, 'revision' | 'updatedAt'>): Promise<boolean>;
  putPrevious(business: BusinessId, previous: StoredPage): Promise<void>;
  addChange(entry: PageChangeEntry): Promise<void>;
}

export interface PageStore {
  read(business: BusinessId): Promise<StoredPages>;
  /** Ejecuta `task` de forma atómica: si lanza, no queda nada escrito. */
  transaction<T>(task: (tx: PageStoreTx) => Promise<T>): Promise<T>;
}

// --- Errores de dominio ----------------------------------------------------------

export class PageError extends Error {}

/** Sin datos en MySQL (aún no importados) o con la edición aún sin activar (RF-4). */
export class PageUnavailableError extends PageError {
  constructor() {
    super('Los datos de página no están disponibles');
    this.name = 'PageUnavailableError';
  }
}

export interface PageConflictInfo {
  version: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

/** La versión enviada ya no es la vigente. */
export class PageConflictError extends PageError {
  readonly current: PageConflictInfo;

  constructor(current: PageConflictInfo) {
    super('Los datos cambiaron mientras se editaban');
    this.name = 'PageConflictError';
    this.current = current;
  }
}

/** No hay una versión anterior válida que restaurar. */
export class PageNoPreviousError extends PageError {
  constructor() {
    super('No hay una versión anterior válida');
    this.name = 'PageNoPreviousError';
  }
}

/** Datos inválidos recibidos por el repositorio. */
export class PageValidationError extends PageError {
  readonly issues: ValidationError[];

  constructor(issues: ValidationError[]) {
    super('Datos de página inválidos');
    this.name = 'PageValidationError';
    this.issues = issues;
  }
}
