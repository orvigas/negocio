import { afterAll, describe, expect, it } from 'vitest';

import { createMemoryProductStore } from '../../src/repositories/memory-product-store.ts';
import { createPrismaProductStore } from '../../src/repositories/prisma-product-store.ts';
import {
  LIMIT_MESSAGE,
  ProductConflictError,
  ProductNotFoundError,
  ProductValidationError,
  type ChangeEntry,
  type ProductRepository,
  type ProductStore,
} from '../../src/repositories/product-repository.ts';
import { seedData } from '../helpers.ts';
import { makeDatabase } from '../support/database.ts';
import { ANA, LUIS, VALID_INPUTS, makeProductRepository, seedSources } from '../support/products.ts';

/**
 * Contrato del repositorio de productos (REQ-F-008, RF-9): las mismas pruebas contra el store
 * de memoria y el de Prisma/MySQL (base de pruebas).
 */

const cleanups: (() => Promise<void>)[] = [];
afterAll(async () => {
  while (cleanups.length > 0) await cleanups.pop()?.();
});

interface StoreUnderTest {
  store: ProductStore;
  /** Registro completo de cambios (para inspeccionar acciones y autores). */
  changes: () => Promise<ChangeEntry[]>;
}

const FACTORIES: [string, () => Promise<StoreUnderTest>][] = [
  [
    'memoria',
    async () => {
      const store = createMemoryProductStore();
      return { store, changes: async () => store.state.changes };
    },
  ],
  [
    'prisma',
    async () => {
      const database = await makeDatabase();
      cleanups.push(database.cleanup);
      // Los autores son usuarios reales (FK de product_change.actor_id).
      for (const author of [ANA, LUIS]) {
        await database.prisma.user.create({
          data: { id: author.id, username: author.name, usernameKey: author.name.toLowerCase(), displayName: author.name, role: 'admin', passwordHash: 'x', updatedAt: new Date() },
        });
      }
      const store = createPrismaProductStore({ prisma: database.prisma });
      return {
        store,
        changes: async () =>
          (await database.prisma.productChange.findMany({ orderBy: { id: 'asc' } })).map((row) => ({
            ...row,
            business: row.business,
            action: row.action as ChangeEntry['action'],
            changes: JSON.parse(row.changes) as ChangeEntry['changes'],
          })),
      };
    },
  ],
];

/** Reloj que avanza 1 s en cada lectura (fechas distintas y ordenables). */
function tickingClock() {
  let current = Date.parse('2026-10-09T18:00:00Z');
  return () => new Date((current += 1000));
}

describe.each(FACTORIES)('repositorio de productos (%s)', (_name, factory) => {
  async function setup(options: { imageExists?: (src: string) => Promise<boolean> } = {}) {
    const underTest = await factory();
    const { repository } = await makeProductRepository({ store: underTest.store, now: tickingClock(), ...options });
    return { ...underTest, repository };
  }

  const names = async (repository: ProductRepository, business: 'molotes' | 'birria', category: 'platillo' | 'bebida' = 'platillo') =>
    (await repository.list(business, { category })).map((product) => product.name);

  describe('importación (RF-3)', () => {
    it('importa la semilla con su orden, variantes y chips; la landing recibe las mismas listas', async () => {
      const { repository, changes } = await setup();
      const molotes = seedData('molotes');
      const birria = seedData('birria');
      expect(repository.getPublished('molotes')).toEqual({ menu: molotes.menu.items, drinks: molotes.drinks.items });
      expect(repository.getPublished('birria')).toEqual({ menu: birria.menu.items });
      const imports = (await changes()).filter((change) => change.action === 'import');
      expect(imports).toHaveLength(molotes.menu.items.length + molotes.drinks.items.length + birria.menu.items.length);
      expect(imports.every((change) => change.actorName === 'sistema' && change.actorId === null)).toBe(true);
      // Los id de Molotes pasan a ser slugs (RF-3.2).
      expect((await repository.list('molotes')).map((product) => product.slug)).toContain('queso-oaxaca');
    });

    it('ocurre una sola vez: un segundo init no reimporta ni registra otra importación (CA-3)', async () => {
      const { store, repository, changes } = await setup();
      const created = await repository.create('molotes', { input: { category: 'bebida', ...VALID_INPUTS.molotesBebida } }, ANA);
      const before = (await changes()).length;
      const { repository: again } = await makeProductRepository({ store });
      expect((await changes()).length).toBe(before);
      expect((await again.list('molotes')).map((product) => product.id)).toContain(created.id);
    });

    it('respeta los datos de la fuente (current.json con cambios)', async () => {
      const underTest = await factory();
      const sources = seedSources();
      const [queso, , , , , , , huitlacoche] = sources.molotes.data.menu.items;
      queso!.unitPriceCents = 5000;
      huitlacoche!.available = false;
      sources.molotes.source = 'current';
      const { repository } = await makeProductRepository({ store: underTest.store, sources });
      const menu = repository.getPublished('molotes').menu;
      expect(menu[0]).toMatchObject({ id: 'queso-oaxaca', unitPriceCents: 5000 });
      expect(menu.find((item) => item.id === 'huitlacoche-epazote')).toMatchObject({ available: false });
    });
  });

  describe('crear (CA-16, CA-17)', () => {
    it('slug a partir del nombre, versión 1, al final, no disponible y con el autor de la sesión', async () => {
      const { repository, changes } = await setup();
      const created = await repository.create('molotes', { input: { category: 'platillo', ...VALID_INPUTS.molotesPlatillo, available: true } }, ANA);
      expect(created).toMatchObject({ slug: 'molote-de-frijol', version: 1, available: false, position: 9, priceCents: 4500, deleted: false });
      expect(created.updatedBy).toMatchObject({ actorId: ANA.id, actorName: 'Ana' });
      expect((await changes()).at(-1)).toMatchObject({ action: 'create', actorId: ANA.id, actorName: 'Ana', slug: 'molote-de-frijol' });
      expect((await names(repository, 'molotes')).at(-1)).toBe('Molote de Frijol');
      // La landing lo recibe (no disponible: buildVisibleMenu lo oculta).
      expect(repository.getPublished('molotes').menu.at(-1)).toMatchObject({ id: 'molote-de-frijol', available: false });
    });

    it('un slug repetido recibe sufijo, también si el original está eliminado (D-16)', async () => {
      const { repository } = await setup();
      const input = { category: 'bebida', ...VALID_INPUTS.molotesBebida, name: 'Molotes de Queso Oaxaca' };
      const first = await repository.create('molotes', { input }, ANA);
      await repository.remove('molotes', first.id, first.version, ANA);
      const second = await repository.create('molotes', { input }, ANA);
      expect(first.slug).toBe('molotes-de-queso-oaxaca');
      expect(second.slug).toBe('molotes-de-queso-oaxaca-2');
      // Un slug importado escrito a propósito también cuenta.
      const imported = await repository.create('molotes', { input: { ...input, name: 'Queso Oaxaca' } }, ANA);
      expect(imported.slug).toBe('queso-oaxaca-2');
    });

    it('rechaza una combinación inválida y datos inválidos sin escribir nada', async () => {
      const { repository, changes } = await setup();
      const before = (await changes()).length;
      await expect(repository.create('birria', { input: { category: 'bebida', ...VALID_INPUTS.molotesBebida } }, ANA)).rejects.toMatchObject({
        fields: { category: expect.any(String) },
      });
      await expect(repository.create('birria', { input: { category: 'platillo', ...VALID_INPUTS.birriaChips } }, ANA)).rejects.toMatchObject({
        fields: { detailsType: expect.any(String) },
      });
      await expect(
        repository.create('molotes', { input: { category: 'bebida', ...VALID_INPUTS.molotesBebida, price: 0 } }, ANA),
      ).rejects.toBeInstanceOf(ProductValidationError);
      expect((await changes()).length).toBe(before);
    });

    it('comprueba que la imagen exista (CA-20)', async () => {
      const { repository } = await setup({ imageExists: async () => false });
      await expect(repository.create('molotes', { input: { category: 'platillo', ...VALID_INPUTS.molotesPlatillo } }, ANA)).rejects.toMatchObject({
        fields: { 'image.src': 'La imagen no existe en public/img/.' },
      });
    });

    it('como máximo 50 productos activos por negocio (D-13, CA-21)', async () => {
      const { repository } = await setup();
      const input = { category: 'platillo', detailsType: 'portion', ...VALID_INPUTS.birriaPortion };
      for (let index = (await repository.list('birria')).length; index < 50; index += 1) await repository.create('birria', { input }, ANA);
      await expect(repository.create('birria', { input }, ANA)).rejects.toMatchObject({ fields: { '': LIMIT_MESSAGE } });
      const [first] = await repository.list('birria');
      const removed = await repository.remove('birria', first!.id, first!.version, ANA);
      const extra = await repository.create('birria', { input }, ANA);
      expect(extra.position).toBeGreaterThan(0);
      await expect(repository.restore('birria', removed.id, removed.version, ANA)).rejects.toMatchObject({ fields: { '': LIMIT_MESSAGE } });
    });
  });

  describe('actualizar y concurrencia (RF-8, CA-28 a CA-30)', () => {
    it('actualiza con la versión vigente, sube la versión y registra los campos cambiados', async () => {
      const { repository, changes } = await setup();
      const [drink] = await repository.list('molotes', { category: 'bebida' });
      const updated = await repository.update(
        'molotes',
        drink!.id,
        { input: { name: drink!.name, description: drink!.description, icon: drink!.icon, tone: drink!.tone, price: '40.50', available: false }, expectedVersion: 1 },
        ANA,
      );
      expect(updated).toMatchObject({ version: 2, priceCents: 4050, available: false, slug: drink!.slug });
      expect((await changes()).at(-1)).toMatchObject({
        action: 'update',
        actorName: 'Ana',
        changes: [
          { field: 'available', before: true, after: false },
          { field: 'priceCents', before: 3500, after: 4050 },
        ],
      });
      expect(repository.getPublished('molotes').drinks[0]).toMatchObject({ priceCents: 4050, available: false });
    });

    it('con una versión vieja responde conflicto con quién y cuándo, y no cambia nada; después se puede sobrescribir', async () => {
      const { repository, changes } = await setup();
      const [drink] = await repository.list('molotes', { category: 'bebida' });
      const input = { name: 'Agua', description: 'd', icon: 'water_full', tone: 'amber', price: 20, available: true };
      const byAna = await repository.update('molotes', drink!.id, { input, expectedVersion: 1 }, ANA);
      const attempt = repository.update('molotes', drink!.id, { input: { ...input, name: 'Agua de Luis' }, expectedVersion: 1 }, LUIS);
      await expect(attempt).rejects.toBeInstanceOf(ProductConflictError);
      await expect(attempt).rejects.toMatchObject({ current: { version: 2, updatedBy: 'Ana', updatedAt: byAna.updatedAt } });
      await expect(repository.remove('molotes', drink!.id, 1, LUIS)).rejects.toBeInstanceOf(ProductConflictError);
      expect((await repository.get('molotes', drink!.id)).name).toBe('Agua');

      const overwritten = await repository.update(
        'molotes',
        drink!.id,
        { input: { ...input, name: 'Agua de Luis' }, expectedVersion: 2, action: 'overwrite_after_conflict' },
        LUIS,
      );
      expect(overwritten).toMatchObject({ name: 'Agua de Luis', version: 3 });
      expect((await changes()).at(-1)).toMatchObject({ action: 'overwrite_after_conflict', actorName: 'Luis' });
    });

    it('dos usuarios que editan productos distintos no tienen conflicto (CA-30)', async () => {
      const { repository } = await setup();
      const [a, b] = await repository.list('molotes', { category: 'bebida' });
      const input = (name: string) => ({ name, description: 'd', icon: 'water_full', tone: 'amber', price: 20, available: true });
      await Promise.all([
        repository.update('molotes', a!.id, { input: input('A'), expectedVersion: 1 }, ANA),
        repository.update('molotes', b!.id, { input: input('B'), expectedVersion: 1 }, LUIS),
      ]);
      expect(await names(repository, 'molotes', 'bebida')).toEqual(['A', 'B']);
    });

    it('orden de las comprobaciones: 404 -> 422 -> 409 (D-19)', async () => {
      const { repository } = await setup();
      const [birria] = await repository.list('birria');
      // Un id de otro negocio no existe en este (CA-22).
      await expect(repository.get('molotes', birria!.id)).rejects.toBeInstanceOf(ProductNotFoundError);
      await expect(repository.update('molotes', birria!.id, { input: {}, expectedVersion: 99 }, ANA)).rejects.toBeInstanceOf(ProductNotFoundError);
      await expect(repository.update('birria', birria!.id, { input: { author: 'x' }, expectedVersion: 99 }, ANA)).rejects.toBeInstanceOf(
        ProductValidationError,
      );
      await expect(repository.remove('birria', birria!.id, 'x', ANA)).rejects.toMatchObject({ fields: { version: expect.any(String) } });
    });
  });

  describe('eliminar, recuperar y ordenar (CA-25 a CA-27)', () => {
    it('eliminar es lógico; recuperar lo deja al final, no disponible y con el mismo slug', async () => {
      const { repository } = await setup();
      const [first] = await repository.list('birria');
      const removed = await repository.remove('birria', first!.id, first!.version, ANA);
      expect(removed).toMatchObject({ deleted: true, version: 2 });
      expect(removed.deletedAt).toBeInstanceOf(Date);
      expect(repository.getPublished('birria').menu.map((item) => item.slug)).not.toContain(first!.slug);
      expect((await repository.list('birria')).map((product) => product.id)).not.toContain(first!.id);
      expect((await repository.list('birria', { includeDeleted: true })).at(-1)).toMatchObject({ id: first!.id, deleted: true });

      const restored = await repository.restore('birria', first!.id, removed.version, ANA);
      expect(restored).toMatchObject({ deleted: false, deletedAt: null, available: false, slug: first!.slug, version: 3 });
      expect((await repository.list('birria')).at(-1)?.id).toBe(first!.id);
      await expect(repository.restore('birria', first!.id, restored.version, ANA)).rejects.toBeInstanceOf(ProductValidationError);
    });

    it('subir C una posición deja A, C, B en la administración y en la landing (CA-27)', async () => {
      const { repository, changes } = await setup();
      const [a, b, c] = await repository.list('birria');
      await repository.move('birria', c!.id, 'up', c!.version, ANA);
      expect((await repository.list('birria')).slice(0, 3).map((product) => product.id)).toEqual([a!.id, c!.id, b!.id]);
      expect(repository.getPublished('birria').menu.slice(0, 3).map((item) => item.slug)).toEqual([a!.slug, c!.slug, b!.slug]);
      const reorders = (await changes()).filter((change) => change.action === 'reorder');
      expect(reorders.map((change) => change.slug).sort()).toEqual([b!.slug, c!.slug].sort());
      // El primero no puede subir más: no cambia nada.
      await repository.move('birria', a!.id, 'up', a!.version, ANA);
      expect((await repository.list('birria'))[0]?.id).toBe(a!.id);
    });

    it('reordenar exige la lista completa de activos con sus versiones (DT-10)', async () => {
      const { repository } = await setup();
      const drinks = await repository.list('molotes', { category: 'bebida' });
      const reversed = [...drinks].reverse().map(({ id, version }) => ({ id, version }));
      const result = await repository.reorder('molotes', 'bebida', reversed, ANA);
      expect(result.map((product) => product.id)).toEqual(reversed.map((item) => item.id));
      await expect(repository.reorder('molotes', 'bebida', reversed.slice(0, 1), ANA)).rejects.toMatchObject({ fields: { items: expect.any(String) } });
      await expect(repository.reorder('birria', 'bebida', [], ANA)).rejects.toMatchObject({ fields: { category: expect.any(String) } });
      // Versiones viejas (las de antes de reordenar).
      await expect(repository.reorder('molotes', 'bebida', drinks.map(({ id, version }) => ({ id, version })), ANA)).rejects.toBeInstanceOf(
        ProductConflictError,
      );
    });
  });

  describe('atomicidad y caché (RF-2.3, D-15)', () => {
    it('si falla la entrada del registro no queda nada escrito', async () => {
      const underTest = await factory();
      const failing: ProductStore = {
        ...underTest.store,
        transaction: (task) =>
          underTest.store.transaction((tx) =>
            task({
              ...tx,
              async addChange(change) {
                if (change.action === 'create') throw new Error('fallo simulado');
                return tx.addChange(change);
              },
            }),
          ),
      };
      const { repository } = await makeProductRepository({ store: failing });
      const before = await repository.list('molotes', { includeDeleted: true });
      await expect(repository.create('molotes', { input: { category: 'bebida', ...VALID_INPUTS.molotesBebida } }, ANA)).rejects.toThrow();
      expect(await repository.list('molotes', { includeDeleted: true })).toEqual(before);
    });

    it('si la recarga de la caché falla, la landing conserva la última versión y se reintenta después', async () => {
      const underTest = await factory();
      let failLists = 0;
      const flaky: ProductStore = {
        ...underTest.store,
        listBusiness: async (business) => {
          if (failLists > 0) {
            failLists -= 1;
            throw new Error('fallo simulado');
          }
          return underTest.store.listBusiness(business);
        },
      };
      const { repository } = await makeProductRepository({ store: flaky });
      const published = repository.getPublished('molotes');
      failLists = 1;
      await repository.create('molotes', { input: { category: 'bebida', ...VALID_INPUTS.molotesBebida } }, ANA);
      expect(repository.getPublished('molotes')).toBe(published);
      await repository.list('molotes');
      expect(repository.getPublished('molotes').drinks).toHaveLength(published.drinks.length + 1);
    });

    it('getLastChange devuelve el cambio más reciente del negocio', async () => {
      const { repository } = await setup();
      expect(await repository.getLastChange('molotes')).toMatchObject({ actorName: 'sistema' });
      await repository.create('molotes', { input: { category: 'bebida', ...VALID_INPUTS.molotesBebida } }, ANA);
      expect(await repository.getLastChange('molotes')).toMatchObject({ actorName: 'Ana', actorId: ANA.id });
      expect(await repository.getLastChange('birria')).toMatchObject({ actorName: 'sistema' });
    });
  });
});
