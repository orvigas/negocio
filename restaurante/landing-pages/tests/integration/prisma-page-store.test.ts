import { afterEach, describe, expect, it } from 'vitest';

import {
  PAGE_ACTIONS,
  PageConflictError,
  PageNoPreviousError,
  createPageRepository,
  versionOf,
  type PageDataByBusiness,
  type StoredPage,
} from '@restaurante/core/catalog';
import { createPrismaPageStore } from '@restaurante/db/prisma-page-store';

import { makeDatabase, type TestDatabase } from '../support/database.ts';

/** Datos de página sobre MySQL real (REQ-F-044, RF-1 y RF-8): transacciones, versiones y textos. */

const AT = '2026-10-01T10:00:00.000-06:00';
const ANA = { id: 7, name: 'Ana' };
const NOW = new Date('2026-10-26T18:00:00.000Z');
const PAGE: PageDataByBusiness['birria'] = {
  hero: { showcase: { title: 'Birria de res', description: 'Con consomé.', priceCents: 19500 } },
  promo: { badge: 'Hoy', title: 'Dos por uno', description: 'Solo en el local.' },
};
const edited = (title: string): PageDataByBusiness['birria'] => ({ ...PAGE, promo: { ...PAGE.promo, title } });

const databases: TestDatabase[] = [];
afterEach(async () => {
  while (databases.length > 0) await databases.pop()?.cleanup();
});

async function setup({ current = true }: { current?: boolean } = {}) {
  const database = await makeDatabase();
  databases.push(database);
  const { prisma } = database;
  if (current) {
    await prisma.pageVersion.create({ data: { business: 'birria', slot: 'current', revision: 1, updatedAt: AT, updatedBy: 'Eli', updatedById: null, data: JSON.stringify(PAGE) } });
  }
  const store = createPrismaPageStore({ prisma });
  return { prisma, store, pages: createPageRepository({ store, timeZone: 'America/Mexico_City', now: () => NOW }) };
}

const VERSION = versionOf({ revision: 1, updatedAt: AT });

describe('store de página en MySQL', () => {
  it('sin filas, lee nada', async () => {
    const { store } = await setup({ current: false });
    await expect(store.read('birria')).resolves.toEqual({ current: null, previous: null });
  });

  it('guarda y restaura con el historial, y conserva acentos, emojis y saltos de línea', async () => {
    const { pages, store, prisma } = await setup();
    const title = 'Niño año ñandú ÁÉÍ 🌮\ncon salto';
    const saved = await pages.save('birria', { data: edited(title), expectedVersion: VERSION, author: ANA });
    await expect(pages.get('birria')).resolves.toMatchObject({ data: edited(title), version: saved.version, updatedBy: 'Ana', hasPrevious: true });
    expect((await store.read('birria')).previous).toEqual({ revision: 1, updatedAt: AT, updatedBy: 'Eli', updatedById: null, data: JSON.stringify(PAGE) });

    const restored = await pages.restorePrevious('birria', { expectedVersion: saved.version, author: ANA });
    expect(restored.data).toEqual(PAGE);
    expect(JSON.parse((await store.read('birria')).previous?.data ?? '{}')).toEqual(edited(title));

    const changes = await prisma.pageChange.findMany({ orderBy: { id: 'asc' } });
    expect(changes.map(({ action, author, authorId, business, imported }) => ({ action, author, authorId, business, imported }))).toEqual([
      { action: PAGE_ACTIONS.SAVE, author: 'Ana', authorId: 7, business: 'birria', imported: false },
      { action: PAGE_ACTIONS.RESTORE_PREVIOUS, author: 'Ana', authorId: 7, business: 'birria', imported: false },
    ]);
    expect(JSON.parse(changes[0]?.changes ?? '[]')).toEqual([{ field: 'promo.title', before: 'Dos por uno', after: title }]);
  });

  it('la fecha conserva su desplazamiento: la versión es la misma al releerla', async () => {
    const { store } = await setup();
    expect(versionOf((await store.read('birria')).current as StoredPage)).toBe(VERSION);
  });

  it('una semilla sin fecha se puede guardar (condición de versión con NULL)', async () => {
    const { pages, prisma } = await setup({ current: false });
    await prisma.pageVersion.create({ data: { business: 'birria', slot: 'current', revision: 0, updatedAt: null, updatedBy: null, data: JSON.stringify(PAGE) } });
    await expect(pages.save('birria', { data: edited('Nueva'), expectedVersion: '0@seed', author: ANA })).resolves.toMatchObject({ updatedBy: 'Ana' });
  });

  describe('replaceCurrent exige revisión y fecha a la vez', () => {
    const next: StoredPage = { revision: 5, updatedAt: AT, updatedBy: 'Ana', updatedById: 7, data: '{}' };
    const OTHER = '2026-10-02T10:00:00.000-06:00';

    it.each([
      ['misma fecha y otra revisión', { revision: 2, updatedAt: AT }],
      ['misma revisión y otra fecha', { revision: 1, updatedAt: OTHER }],
      ['misma revisión y fecha NULL', { revision: 1, updatedAt: null }],
    ])('%s: false y no escribe', async (_, expected) => {
      const { store } = await setup();
      const before = await store.read('birria');
      await expect(store.transaction((tx) => tx.replaceCurrent('birria', next, expected))).resolves.toBe(false);
      await expect(store.read('birria')).resolves.toEqual(before);
    });

    it('con la fila en NULL, misma revisión y una fecha: false y no escribe', async () => {
      const { store, prisma } = await setup({ current: false });
      await prisma.pageVersion.create({ data: { business: 'birria', slot: 'current', revision: 1, updatedAt: null, updatedBy: null, data: JSON.stringify(PAGE) } });
      const before = await store.read('birria');
      await expect(store.transaction((tx) => tx.replaceCurrent('birria', next, { revision: 1, updatedAt: AT }))).resolves.toBe(false);
      await expect(store.read('birria')).resolves.toEqual(before);
    });

    it('con las dos iguales, sí reemplaza', async () => {
      const { store } = await setup();
      await expect(store.transaction((tx) => tx.replaceCurrent('birria', next, { revision: 1, updatedAt: AT }))).resolves.toBe(true);
      await expect(store.read('birria')).resolves.toMatchObject({ current: { revision: 5 } });
    });
  });

  it('dos guardados a la vez: uno gana, el otro recibe conflicto y solo queda un registro', async () => {
    const { pages, prisma } = await setup();
    const results = await Promise.allSettled(
      ['Primero', 'Segundo'].map((title, index) => pages.save('birria', { data: edited(title), expectedVersion: VERSION, author: { id: index + 1, name: title } })),
    );
    expect(results.map((result) => result.status).sort()).toEqual(['fulfilled', 'rejected']);
    expect(results.find((result) => result.status === 'rejected')).toMatchObject({ reason: expect.any(PageConflictError) });
    expect(await prisma.pageChange.count()).toBe(1);
    await expect(prisma.pageVersion.findUnique({ where: { business_slot: { business: 'birria', slot: 'current' } } })).resolves.toMatchObject({ revision: 2 });
  });

  it('un fallo dentro de la transacción no deja nada: ni versión, ni anterior, ni historial', async () => {
    const { store, prisma } = await setup();
    await expect(
      store.transaction(async (tx) => {
        await tx.replaceCurrent('birria', { revision: 2, updatedAt: AT, updatedBy: 'Ana', updatedById: 7, data: '{}' }, { revision: 1, updatedAt: AT });
        await tx.putPrevious('birria', { revision: 1, updatedAt: AT, updatedBy: 'Eli', updatedById: null, data: '{}' });
        await tx.addChange({ at: AT, business: 'birria', author: 'Ana', authorId: 7, action: 'save', changes: [] });
        throw new PageNoPreviousError();
      }),
    ).rejects.toBeInstanceOf(PageNoPreviousError);
    await expect(store.read('birria')).resolves.toMatchObject({ current: { revision: 1 }, previous: null });
    expect(await prisma.pageChange.count()).toBe(0);
  });

  it('`author_id` no tiene clave foránea: un id histórico sin usuario se acepta', async () => {
    const { prisma } = await setup();
    await expect(prisma.pageChange.create({ data: { at: null, business: 'birria', author: 'Antiguo', authorId: 999_999, action: 'restore_seed', changes: '[]', imported: true } })).resolves.toMatchObject({ authorId: 999_999 });
  });

  it('el usuario de la app puede escribir en las tres tablas', async () => {
    const { prisma } = await setup();
    await expect(prisma.pageImport.create({ data: { business: 'birria', importedAt: NOW, source: 'current', sourceVersion: VERSION, historyCount: 0, skippedLines: 0 } })).resolves.toMatchObject({ source: 'current' });
  });
});
