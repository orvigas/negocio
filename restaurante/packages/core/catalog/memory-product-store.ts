import { type BusinessId, DatabaseUnavailableError } from '../shared/index.ts';
import type { Product } from './product-schema.ts';
import {
  SlugTakenError,
  type ChangeEntry,
  type ChangeSummary,
  type ImportSourceName,
  type ProductStore,
  type ProductStoreTx,
} from './product-store.ts';

/**
 * Store de productos en memoria (REQ-F-008, RF-9.1): mismas operaciones que el de Prisma, sin
 * base de datos. Para las pruebas de landings y controladores, y como referencia del contrato.
 *
 * Atomicidad: cada transacción trabaja sobre una copia y solo la publica si termina sin error
 * (las transacciones se serializan). `state` permite a las pruebas inspeccionar los datos y
 * `failNext` simula un fallo de la base de datos.
 */

export interface MemoryProductState {
  products: Product[];
  changes: (ChangeEntry & { id: number })[];
  imports: Map<BusinessId, { at: Date; source: ImportSourceName; count: number }>;
  nextProductId: number;
  nextChangeId: number;
}

export interface MemoryProductStore extends ProductStore {
  readonly state: MemoryProductState;
  /** La próxima operación (lectura o transacción) falla como si la base no respondiera. */
  failNext(times?: number): void;
}

const emptyState = (): MemoryProductState => ({ products: [], changes: [], imports: new Map(), nextProductId: 1, nextChangeId: 1 });

const copyState = (state: MemoryProductState): MemoryProductState => ({
  products: structuredClone(state.products),
  changes: structuredClone(state.changes),
  imports: new Map(state.imports),
  nextProductId: state.nextProductId,
  nextChangeId: state.nextChangeId,
});

export function createMemoryProductStore(): MemoryProductStore {
  const state = emptyState();
  let failures = 0;
  let queue: Promise<unknown> = Promise.resolve();

  function maybeFail(): void {
    if (failures > 0) {
      failures -= 1;
      throw new DatabaseUnavailableError({ name: 'SimulatedFailure', code: undefined, originalCode: undefined });
    }
  }

  const ofBusiness = (data: MemoryProductState, business: BusinessId): Product[] =>
    structuredClone(data.products.filter((product) => product.business === business));

  function summaries(business: BusinessId): ChangeEntry[] {
    return state.changes.filter((change) => change.business === business).sort((a, b) => a.at.getTime() - b.at.getTime() || a.id - b.id);
  }

  const summary = (change: ChangeEntry): ChangeSummary => ({ at: change.at, actorId: change.actorId, actorName: change.actorName });

  function txOn(data: MemoryProductState): ProductStoreTx {
    return {
      async listBusiness(business) {
        return ofBusiness(data, business);
      },
      async insert(product) {
        if (data.products.some((other) => other.business === product.business && other.slug === product.slug)) throw new SlugTakenError();
        const saved: Product = { ...structuredClone(product), id: data.nextProductId };
        data.nextProductId += 1;
        data.products.push(saved);
        return structuredClone(saved);
      },
      async replace(product, expectedVersion) {
        const index = data.products.findIndex((other) => other.id === product.id);
        if (index < 0 || data.products[index]?.version !== expectedVersion) return false;
        data.products[index] = structuredClone(product);
        return true;
      },
      async addChange(entry) {
        data.changes.push({ ...structuredClone(entry), id: data.nextChangeId });
        data.nextChangeId += 1;
      },
      async isImported(business) {
        return data.imports.has(business);
      },
      async markImported(business, record) {
        data.imports.set(business, { ...record });
      },
    };
  }

  return {
    state,
    failNext(times = 1) {
      failures = times;
    },
    async listBusiness(business) {
      maybeFail();
      return ofBusiness(state, business);
    },
    async lastChanges(business) {
      maybeFail();
      const result = new Map<number, ChangeSummary>();
      for (const change of summaries(business)) result.set(change.productId, summary(change));
      return result;
    },
    async lastBusinessChange(business) {
      maybeFail();
      const last = summaries(business).at(-1);
      return last ? summary(last) : null;
    },
    transaction(task) {
      const run = queue.then(async () => {
        maybeFail();
        const draft = copyState(state);
        const result = await task(txOn(draft));
        Object.assign(state, draft);
        return result;
      });
      queue = run.catch(() => {});
      return run;
    },
  };
}
