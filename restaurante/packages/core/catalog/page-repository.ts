import { silentLogger, toZonedIsoString, type BusinessId, type Logger } from '../shared/index.ts';
import { diffMenuData } from './menu-diff.ts';
import { validatePageData, type PageData } from './menu-schema.ts';
import {
  PAGE_ACTIONS,
  PageConflictError,
  PageNoPreviousError,
  PageUnavailableError,
  PageValidationError,
  versionOf,
  type PageAction,
  type PageStore,
  type StoredPage,
} from './page-store.ts';

/**
 * Datos de página en MySQL (REQ-F-044, RF-1, RF-7 y RF-8). Las reglas son las del repositorio de
 * archivos: control de versión `revision@updatedAt`, una sola versión anterior y restaurar intercambia
 * vigente y anterior (RN-3). Sin caché: cada lectura va al store, así que un dato importado o
 * restaurado por otro proceso se ve al momento. Sin filas, responde "no disponible" (RF-4).
 */

export interface PageAuthor {
  id: number;
  name: string;
}

export interface PageState {
  data: PageData;
  version: string;
  updatedAt: string | null;
  updatedBy: string | null;
  /** Hay una versión anterior válida que restaurar. */
  hasPrevious: boolean;
}

export type PageSaveAction = typeof PAGE_ACTIONS.SAVE | typeof PAGE_ACTIONS.OVERWRITE_AFTER_CONFLICT;

export interface PageRepository {
  /** Estado vigente. Lanza PageUnavailableError si no hay datos o los guardados no son válidos. */
  get(business: BusinessId): Promise<PageState>;
  /** `data` ya viene del formulario: se valida aquí igualmente, como última defensa. */
  save(business: BusinessId, request: { data: unknown; expectedVersion: string; author: PageAuthor; action?: PageSaveAction }): Promise<PageState>;
  /** `expectedVersion` obligatoria: repetir una restauración sin confirmar no debe deshacerla (D-10). */
  restorePrevious(business: BusinessId, request: { expectedVersion: string; author: PageAuthor }): Promise<PageState>;
}

export interface PageRepositoryOptions {
  store: PageStore;
  timeZone: string;
  now?: () => Date;
  logger?: Logger;
}

export function createPageRepository({ store, timeZone, now = () => new Date(), logger = silentLogger }: PageRepositoryOptions): PageRepository {
  /** Datos de una versión guardada, o null si no son válidos (nunca se registra su contenido). */
  function parse(business: BusinessId, stored: StoredPage): PageData | null {
    let data: unknown;
    try {
      data = JSON.parse(stored.data);
    } catch {
      return null;
    }
    if (validatePageData(business, data).length > 0) return null;
    // validatePageData no encontró problemas: tiene la forma de los datos de página del negocio.
    return data as PageData;
  }

  /** Versión vigente y sus datos; sin ellos, "no disponible". */
  function currentOf(business: BusinessId, stored: StoredPage | null): { stored: StoredPage; data: PageData } {
    if (!stored) throw new PageUnavailableError();
    const data = parse(business, stored);
    if (!data) {
      logger.error('page_data_invalid', { business, slot: 'current', revision: stored.revision });
      throw new PageUnavailableError();
    }
    return { stored, data };
  }

  function validPrevious(business: BusinessId, stored: StoredPage | null): { stored: StoredPage; data: PageData } | null {
    if (!stored) return null;
    const data = parse(business, stored);
    if (!data) {
      logger.warn('page_data_invalid', { business, slot: 'previous', revision: stored.revision });
      return null;
    }
    return { stored, data };
  }

  const stateOf = (data: PageData, stored: StoredPage, hasPrevious: boolean): PageState => ({
    data,
    version: versionOf(stored),
    updatedAt: stored.updatedAt,
    updatedBy: stored.updatedBy,
    hasPrevious,
  });

  const conflictOf = (stored: StoredPage): PageConflictError =>
    new PageConflictError({ version: versionOf(stored), updatedAt: stored.updatedAt, updatedBy: stored.updatedBy });

  function assertVersion(stored: StoredPage, expectedVersion: string): void {
    if (expectedVersion !== versionOf(stored)) throw conflictOf(stored);
  }

  function nextVersion(revision: number, data: PageData, author: PageAuthor): StoredPage {
    return { revision: revision + 1, updatedAt: toZonedIsoString(now(), timeZone), updatedBy: author.name, updatedById: author.id, data: JSON.stringify(data) };
  }

  /** Publica `next`, deja `before` como anterior y lo registra, todo en la misma transacción. */
  async function commit(business: BusinessId, { next, nextData, before, action, author }: { next: StoredPage; nextData: PageData; before: { stored: StoredPage; data: PageData }; action: PageAction; author: PageAuthor }): Promise<PageState> {
    await store.transaction(async (tx) => {
      if (!(await tx.replaceCurrent(business, next, before.stored))) {
        // Otra escritura se confirmó entre la lectura y esta: gana la primera.
        const { current } = await tx.read(business);
        throw conflictOf(current ?? before.stored);
      }
      await tx.putPrevious(business, before.stored);
      await tx.addChange({ at: next.updatedAt, business, author: author.name, authorId: author.id, action, changes: diffMenuData(before.data, nextData) });
    });
    logger.info('page_saved', { business, action, revision: next.revision });
    return stateOf(nextData, next, true);
  }

  return Object.freeze<PageRepository>({
    async get(business) {
      const { current, previous } = await store.read(business);
      const vigente = currentOf(business, current);
      return stateOf(vigente.data, vigente.stored, validPrevious(business, previous) !== null);
    },

    async save(business, { data, expectedVersion, author, action = PAGE_ACTIONS.SAVE }) {
      const before = currentOf(business, (await store.read(business)).current);
      assertVersion(before.stored, expectedVersion);
      const issues = validatePageData(business, data);
      if (issues.length > 0) throw new PageValidationError(issues);
      // validatePageData no encontró problemas: tiene la forma de los datos de página del negocio.
      const nextData = data as PageData;
      return commit(business, { next: nextVersion(before.stored.revision, nextData, author), nextData, before, action, author });
    },

    async restorePrevious(business, { expectedVersion, author }) {
      const { current, previous } = await store.read(business);
      const before = currentOf(business, current);
      const target = validPrevious(business, previous);
      if (!target) throw new PageNoPreviousError();
      assertVersion(before.stored, expectedVersion);
      const revision = Math.max(before.stored.revision, target.stored.revision);
      return commit(business, { next: nextVersion(revision, target.data, author), nextData: target.data, before, action: PAGE_ACTIONS.RESTORE_PREVIOUS, author });
    },
  });
}
