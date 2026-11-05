import { PageError, type PageChangeEntry, type PageStore, type PageStoreTx, type StoredPage, type StoredPages } from '@restaurante/core/catalog';
import type { BusinessId } from '@restaurante/core/shared';

import type { Database } from './client.ts';
import { toUnavailable } from './errors.ts';
import type { Prisma } from './generated/prisma/client.ts';

/**
 * Store de los datos de página sobre Prisma/MySQL (REQ-F-044). `replaceCurrent` es un UPDATE condicionado
 * a la versión: dos escrituras a la vez se ordenan por el bloqueo de la fila y la segunda no afecta a
 * ninguna fila, así que no hace falta otra exclusión. Las reglas están en core (page-repository.ts).
 */

type Client = Database | Prisma.TransactionClient;

const toStored = (row: { revision: number; updatedAt: string | null; updatedBy: string | null; updatedById: number | null; data: string }): StoredPage => ({
  revision: row.revision,
  updatedAt: row.updatedAt,
  updatedBy: row.updatedBy,
  updatedById: row.updatedById,
  data: row.data,
});

async function read(client: Client, business: BusinessId): Promise<StoredPages> {
  const rows = await client.pageVersion.findMany({ where: { business } });
  const slot = (name: 'current' | 'previous') => {
    const row = rows.find((candidate) => candidate.slot === name);
    return row ? toStored(row) : null;
  };
  return { current: slot('current'), previous: slot('previous') };
}

const txOn = (tx: Prisma.TransactionClient): PageStoreTx => ({
  read: (business) => read(tx, business),

  async replaceCurrent(business, next, expected) {
    const { count } = await tx.pageVersion.updateMany({
      where: { business, slot: 'current', revision: expected.revision, updatedAt: expected.updatedAt },
      data: toStored(next),
    });
    return count === 1;
  },

  async putPrevious(business, previous) {
    const data = toStored(previous);
    await tx.pageVersion.upsert({ where: { business_slot: { business, slot: 'previous' } }, create: { business, slot: 'previous', ...data }, update: data });
  },

  async addChange({ at, business, author, authorId, action, changes }: PageChangeEntry) {
    await tx.pageChange.create({ data: { at, business, author, authorId, action, changes: JSON.stringify(changes) } });
  },
});

export function createPrismaPageStore({ prisma }: { prisma: Database }): PageStore {
  if (!prisma) throw new TypeError('createPrismaPageStore requiere el cliente de la base de datos');

  async function run<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (err) {
      if (err instanceof PageError) throw err;
      throw toUnavailable(err);
    }
  }

  return Object.freeze<PageStore>({
    read: (business) => run(() => read(prisma, business)),
    transaction: (task) => run(() => prisma.$transaction((tx) => task(txOn(tx)))),
  });
}
