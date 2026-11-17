import { DatabaseUnavailableError, type BusinessId } from '../shared/index.ts';
import type { PageChangeEntry, PageImportMark, PageStore, PageStoreTx, StoredPage, StoredPages } from './page-store.ts';

/**
 * Store de página en memoria (REQ-F-044), doble de las pruebas: misma semántica que Prisma/MySQL. Cada
 * transacción trabaja sobre una copia y la confirma al terminar, de una en una.
 */

interface MemoryPageState {
  pages: Map<BusinessId, StoredPages>;
  changes: PageChangeEntry[];
  /** Marcas de `page_import` (una por negocio). */
  imports: Map<BusinessId, PageImportMark>;
  /** Como `product_import` con filas (D-10). */
  productImports: boolean;
}

export interface MemoryPageStore extends PageStore {
  state: MemoryPageState;
  /** Deja `pages` como versiones guardadas de un negocio (como tras la siembra). */
  seed(business: BusinessId, pages: StoredPages): void;
  /** Hace fallar las próximas `times` operaciones como una base caída. */
  failNext(times?: number): void;
}

const copyPages = (pages: StoredPages | undefined): StoredPages => structuredClone(pages ?? { current: null, previous: null });

export function createMemoryPageStore(): MemoryPageStore {
  const state: MemoryPageState = { pages: new Map(), changes: [], imports: new Map(), productImports: false };
  let failures = 0;
  let queue: Promise<unknown> = Promise.resolve();

  function maybeFail(): void {
    if (failures > 0) {
      failures -= 1;
      throw new DatabaseUnavailableError({ name: 'SimulatedFailure', code: undefined, originalCode: undefined });
    }
  }

  function txOn({ pages, changes, imports }: Omit<MemoryPageState, 'productImports'>): PageStoreTx {
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
      async putCurrent(business, current: StoredPage) {
        pages.set(business, { ...copyPages(pages.get(business)), current: structuredClone(current) });
      },
      async markImported(mark) {
        if (imports.has(mark.business)) throw new Error(`Importación duplicada: ${mark.business}`);
        imports.set(mark.business, structuredClone(mark));
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
    async readImports() {
      maybeFail();
      return [...state.imports.values()].map((mark) => structuredClone(mark));
    },
    async hasProductImports() {
      maybeFail();
      return state.productImports;
    },
    transaction<T>(task: (tx: PageStoreTx) => Promise<T>): Promise<T> {
      const run = queue.then(async () => {
        maybeFail();
        const { productImports, ...rest } = state;
        const copy = structuredClone(rest);
        const result = await task(txOn(copy));
        Object.assign(state, copy, { productImports });
        return result;
      });
      queue = run.catch(() => {});
      return run;
    },
  };
}
