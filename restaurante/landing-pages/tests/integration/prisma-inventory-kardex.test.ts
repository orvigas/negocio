import { afterEach, describe, expect, it } from 'vitest';

import {
  AlreadyReversedError,
  InventoryValidationError,
  businessDate,
  createInventoryRepository,
  createKardexRepository,
  createRecipeRepository,
  formatDecimal,
  verifyKardex,
  type InventoryAuthor,
  type InventoryStore,
} from '@restaurante/core/inventory';
import { createPrismaInventoryStore } from '@restaurante/db/prisma-inventory-store';

import { makeDatabase, type TestDatabase } from '../support/database.ts';

/**
 * Kardex sobre MySQL 8.4 real (REQ-F-051, T3): solo lo que depende de la base. Concurrencia sin pérdida
 * de movimientos (CA-13), doble envío con la `api` reiniciada (CA-12), decimales y fecha del hecho de
 * ida y vuelta, `inventory:verify` ante una fila alterada (CA-15), la cadena punta a punta saldo
 * inicial → compra → costo real de la receta (CA-18) y las carreras del catálogo y de las reversiones.
 */

const TZ = 'America/Mexico_City';
const databases: TestDatabase[] = [];
afterEach(async () => {
  while (databases.length > 0) await databases.pop()?.cleanup();
});

async function setup() {
  const database = await makeDatabase();
  databases.push(database);
  const { prisma } = database;
  const user = await prisma.user.create({ data: { username: 'ana', usernameKey: 'ana', displayName: 'Ana', role: 'gerente', passwordHash: 'x', updatedAt: new Date() } });
  const ana: InventoryAuthor = { id: user.id, name: user.displayName };
  const store = createPrismaInventoryStore({ prisma });
  const inventory = createInventoryRepository({ store });
  const kardex = createKardexRepository({ store, timeZone: TZ });
  const abarrotes = await inventory.createCategory({ name: 'Abarrotes' }, ana);
  const insumo = (name: string, extra: Record<string, unknown> = {}) => inventory.createItem({ type: 'insumo', categoryId: abarrotes.id, name, baseUnit: 'kg', ...extra }, ana);
  const today = businessDate(new Date(), TZ);
  const purchase = (lines: { itemId: number; quantity: string; amount: string }[], requestId?: string) =>
    kardex.createPurchase({ occurredOn: today, lines: lines.map((line) => ({ ...line, unit: 'kg' })) }, ana, { requestId: requestId ?? null });
  const verify = (on: InventoryStore = store) => verifyKardex({ movementsAfter: (id, seq, limit) => on.read((r) => r.movementsAfter(id, seq, limit)), allStock: () => on.read((r) => r.allStock()) });
  return { prisma, store, inventory, kardex, ana, abarrotes, insumo, today, purchase, verify };
}

const stockOf = async (prisma: TestDatabase['prisma'], itemId: number) => {
  const row = await prisma.inventoryStock.findUniqueOrThrow({ where: { itemId } });
  return { quantity: row.quantity.toFixed(3), avgCost: row.avgCost?.toFixed(4) ?? null, lastCost: row.lastCost?.toFixed(4) ?? null, lastSeq: row.lastSeq };
};

describe('concurrencia (RN-12, CA-13)', () => {
  it('20 salidas simultáneas del mismo artículo dejan 20 movimientos contiguos y la existencia exacta; verify da 0', async () => {
    const { prisma, kardex, insumo, today, ana, purchase, verify } = await setup();
    const masa = await insumo('Masa de maíz');
    await purchase([{ itemId: masa.id, quantity: '100', amount: '2000.00' }]);
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () => kardex.createAdjustment({ occurredOn: today, reason: 'error_captura', lines: [{ itemId: masa.id, direction: 'salida', quantity: '1.5', unit: 'kg' }] }, ana)),
    );
    expect(results.filter((result) => result.status === 'rejected')).toEqual([]);
    const seqs = (await prisma.inventoryMovement.findMany({ where: { itemId: masa.id }, orderBy: { seq: 'asc' }, select: { seq: true } })).map((row) => row.seq);
    expect(seqs).toEqual(Array.from({ length: 21 }, (_, index) => index + 1));
    expect(await stockOf(prisma, masa.id)).toEqual({ quantity: '70.000', avgCost: '20.0000', lastCost: '20.0000', lastSeq: 21 });
    expect((await verify()).issues).toEqual([]);
  });

  it('documentos simultáneos con artículos cruzados terminan sin errores visibles', async () => {
    const { prisma, insumo, purchase, verify } = await setup();
    const [sal, azucar] = await Promise.all([insumo('Sal'), insumo('Azúcar')]);
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, (_, index) =>
        purchase(
          index % 2 === 0
            ? [{ itemId: sal.id, quantity: '1', amount: '10.00' }, { itemId: azucar.id, quantity: '1', amount: '20.00' }]
            : [{ itemId: azucar.id, quantity: '1', amount: '20.00' }, { itemId: sal.id, quantity: '1', amount: '10.00' }],
        ),
      ),
    );
    expect(results.filter((result) => result.status === 'rejected')).toEqual([]);
    expect((await stockOf(prisma, sal.id)).quantity).toBe('10.000');
    expect((await stockOf(prisma, azucar.id)).quantity).toBe('10.000');
    expect((await verify()).issues).toEqual([]);
  });

  it('dos reversiones simultáneas del mismo documento: una se aplica y la otra responde «ya revertido»', async () => {
    const { prisma, kardex, insumo, ana, purchase } = await setup();
    const sal = await insumo('Sal');
    const bought = await purchase([{ itemId: sal.id, quantity: '5', amount: '60.00' }]);
    const results = await Promise.allSettled([kardex.reverseDocument(bought.document.id, { reason: 'uno' }, ana), kardex.reverseDocument(bought.document.id, { reason: 'dos' }, ana)]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((result) => result.status === 'rejected')).toMatchObject({ reason: expect.any(AlreadyReversedError) as unknown });
    expect(await prisma.inventoryDocument.count({ where: { type: 'reversion' } })).toBe(1);
    expect((await stockOf(prisma, sal.id)).quantity).toBe('0.000');
  });

  it('RN-T3-11: el cambio de inventariable y un primer movimiento simultáneos nunca se aplican los dos', async () => {
    const { prisma, inventory, abarrotes, ana, insumo, purchase } = await setup();
    for (let round = 0; round < 3; round += 1) {
      const item = await insumo(`Chile ${round}`);
      const [change, bought] = await Promise.allSettled([
        inventory.updateItem(item.id, { version: 1, categoryId: abarrotes.id, name: item.name, baseUnit: 'kg', inventoriable: false }, ana),
        purchase([{ itemId: item.id, quantity: '1', amount: '30.00' }]),
      ]);
      expect(change.status === 'fulfilled' && bought.status === 'fulfilled').toBe(false);
      const rejected = change.status === 'rejected' ? change.reason : bought.status === 'rejected' ? bought.reason : null;
      expect(rejected).toBeInstanceOf(InventoryValidationError);
      const row = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });
      expect(row.inventoriable === false && (await stockOf(prisma, item.id)).lastSeq > 0).toBe(false);
    }
  });
});

describe('persistencia', () => {
  it('CA-12: el mismo envío tras reiniciar la api (otro store) crea un solo documento', async () => {
    const { prisma, insumo, ana, today } = await setup();
    const masa = await insumo('Masa de maíz');
    const input = { occurredOn: today, lines: [{ itemId: masa.id, quantity: '10', unit: 'kg', amount: '200.00' }] };
    const first = await createKardexRepository({ store: createPrismaInventoryStore({ prisma }), timeZone: TZ }).createPurchase(input, ana, { requestId: 'envio-reinicio-1' });
    const restarted = createKardexRepository({ store: createPrismaInventoryStore({ prisma }), timeZone: TZ });
    const [again, race] = await Promise.all([restarted.createPurchase(input, ana, { requestId: 'envio-reinicio-1' }), restarted.createPurchase(input, ana, { requestId: 'envio-reinicio-1' })]);
    expect([again.replayed, race.replayed, again.document.id]).toEqual([true, true, first.document.id]);
    expect(await prisma.inventoryDocument.count()).toBe(1);
    expect((await stockOf(prisma, masa.id)).quantity).toBe('10.000');
  });

  it('decimales con signo y la fecha del hecho (DATE) de ida y vuelta, también con la zona local del proceso', async () => {
    const previous = process.env.TZ;
    process.env.TZ = TZ;
    try {
      const { kardex, insumo, ana, today, store } = await setup();
      const sal = await insumo('Sal');
      const date = today;
      await kardex.createAdjustment({ occurredOn: date, reason: 'otro', note: 'Arranque', lines: [{ itemId: sal.id, direction: 'entrada', quantity: '9999.999', unit: 'kg', unitCost: '12345678901.2345' }] }, ana);
      const out = await kardex.createAdjustment({ occurredOn: date, reason: 'error_captura', lines: [{ itemId: sal.id, direction: 'salida', quantity: '10000.5', unit: 'kg' }] }, ana);
      const read = await store.read((reader) => reader.documentById(out.document.id));
      expect(read?.occurredOn).toBe(date);
      const [movement] = await store.read((reader) => reader.documentMovements(out.document.id));
      expect([formatDecimal(movement?.quantity ?? 0n), formatDecimal(movement?.balanceAfter ?? 0n), formatDecimal(movement?.unitCost ?? 0n, 4)]).toEqual(['-10000.500', '-0.501', '12345678901.2345']);
      expect(formatDecimal(read?.totalCost ?? 0n, 4)).toBe('123462961851795.6173');
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });

  it('CA-15: inventory:verify da 0 con la cadena intacta y detecta una fila alterada a mano, sin valores', async () => {
    const { prisma, insumo, purchase, verify } = await setup();
    const masa = await insumo('Masa de maíz');
    await purchase([{ itemId: masa.id, quantity: '10', amount: '200.00' }]);
    await purchase([{ itemId: masa.id, quantity: '5', amount: '120.00' }]);
    expect(await verify()).toMatchObject({ movements: 2, issues: [] });
    await prisma.$executeRaw`UPDATE inventory_movement SET avg_cost_after = 99 WHERE item_id = ${masa.id} AND seq = 2`;
    const report = await verify();
    expect(report.issues.map((issue) => [issue.itemId, issue.check, issue.seq])).toEqual([
      [masa.id, 'cpp_recalculado', 2],
      [masa.id, 'existencia_distinta', null],
    ]);
  });

  it('cadena punta a punta (CA-18): saldo inicial → compra → costo real de la receta con el CPP', async () => {
    const { store, inventory, kardex, abarrotes, ana, insumo, today, purchase } = await setup();
    const carne = await insumo('Carne', { referenceCost: '30' });
    const taco = await inventory.createItem({ type: 'compuesto', categoryId: abarrotes.id, name: 'Taco', baseUnit: 'pza' }, ana);
    const recipes = createRecipeRepository({ store });
    await recipes.saveVersion(taco.id, { baseVersionId: null, yieldQuantity: '1', lines: [{ ingredientId: carne.id, quantity: '0.5', unit: 'kg', wastePercent: '0' }] }, ana);
    await kardex.createInitialBalance({ occurredOn: today, lines: [{ itemId: carne.id, quantity: '10', unit: 'kg', unitCost: '18' }] }, ana);
    await purchase([{ itemId: carne.id, quantity: '10', amount: '220.00' }]);
    const recipe = await recipes.getRecipe(taco.id);
    expect(recipe.current?.cost.lines.map((line) => [formatDecimal(line.unitCost ?? 0n, 4), formatDecimal(line.cost ?? 0n, 4), line.source])).toEqual([['20.0000', '10.0000', 'cpp']]);
    expect(recipe.versions).toHaveLength(1);
  });
});
