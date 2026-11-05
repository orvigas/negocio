import { DatabaseUnavailableError, type BusinessId } from '../shared/index.ts';
import type { PageChangeEntry, PageStore, PageStoreTx, StoredPage, StoredPages } from './page-store.ts';

/**
 * Store de página en memoria (REQ-F-044), doble de las pruebas: misma semántica que Prisma/MySQL. Cada
 * transacción trabaja sobre una copia y la confirma al terminar, de una en una.
 */

interface MemoryPageState {
  pages: Map<BusinessId, StoredPages>;
  changes: PageChangeEntry[];
}

export interface MemoryPageStore extends PageStore {
  state: MemoryPageState;
  /** Deja `pages` como versiones de un negocio (lo que hará la importación). */
  seed(business: BusinessId, pages: StoredPages): void;
  /** Hace fallar las próximas `times` operaciones como una base caída. */
  failNext(times?: number): void;
}

const copyPages = (pages: StoredPages | undefined): StoredPages => structuredClone(pages ?? { current: null, previous: null });

export function createMemoryPageStore(): MemoryPageStore {
  const state: MemoryPageState = { pages: new Map(), changes: [] };
  let failures = 0;
  let queue: Promise<unknown> = Promise.resolve();

  function maybeFail(): void {
    if (failures > 0) {
      failures -= 1;
      throw new DatabaseUnavailableError({ name: 'SimulatedFailure', code: undefined, originalCode: undefined });
    }
  }

  function txOn(pages: MemoryPageState['pages'], changes: PageChangeEntry[]): PageStoreTx {
    return {
      async read(business) {
        return copyPages(pages.get(business));
      },
      async replaceCurrent(business, next, expected) {
        const entry = copyPages(pages.get(business));
        const { current } = entry;
        if (current?.revision !== expected.revision || current.updatedAt !== expected.updatedAt) return false;
        pages.set(business, { ...entry, current: structuredClone(next) });
        return true;
      },
      async putPrevious(business, previous: StoredPage) {
        pages.set(business, { ...copyPages(pages.get(business)), previous: structuredClone(previous) });
      },
      async addChange(entry) {
        changes.push(structuredClone(entry));
      },
    };
  }

  return {
    state,
    seed(business, pages) {
      state.pages.set(business, structuredClone(pages));
    },
    failNext(times = 1) {
      failures = times;
    },
    async read(business) {
      maybeFail();
      return copyPages(state.pages.get(business));
    },
    transaction<T>(task: (tx: PageStoreTx) => Promise<T>): Promise<T> {
      const run = queue.then(async () => {
        maybeFail();
        const pages = structuredClone(state.pages);
        const changes = structuredClone(state.changes);
        const result = await task(txOn(pages, changes));
        state.pages = pages;
        state.changes = changes;
        return result;
      });
      queue = run.catch(() => {});
      return run;
    },
  };
}
