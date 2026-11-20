import { afterEach, describe, expect, it } from 'vitest';

import {
  RecipeCycleError,
  RecipeVersionConflictError,
  createInventoryRepository,
  createRecipeRepository,
  formatDecimal,
  type InventoryAuthor,
  type InventoryItem,
} from '@restaurante/core/inventory';
import { createPrismaInventoryStore } from '@restaurante/db/prisma-inventory-store';

import { makeDatabase, type TestDatabase } from '../support/database.ts';

/**
 * Recetas sobre MySQL 8.4 real (REQ-F-050, T2): solo lo que depende de la base. Decimales exactos,
 * `hr`, inventariable y costo de referencia; una transacción fallida sin restos; el uso real
 * (isInUse y «usado en»); el candado `recetas` con READ COMMITTED ante guardados simultáneos (A→B y
 * B→A: uno se rechaza por ciclo, PT-1; dos versiones del mismo artículo: una vigente y la otra 409);
 * intervalos contiguos y una sola vigente por artículo. Datos ficticios.
 */

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
  const recipes = createRecipeRepository({ store });
  const abarrotes = await inventory.createCategory({ name: 'Abarrotes' }, ana);
  const item = (name: string, type: string, extra: Record<string, unknown> = {}) =>
    inventory.createItem({ type, categoryId: abarrotes.id, name, baseUnit: 'kg', ...extra }, ana);
  const line = (ingredient: InventoryItem, quantity: string, unit = 'kg', wastePercent = '0') => ({ ingredientId: ingredient.id, quantity, unit, wastePercent });
  return { prisma, store, inventory, recipes, ana, item, line };
}

describe('recetas en MySQL', () => {
  it('ida y vuelta exacta de los decimales, hr, inventariable y referencia; costo de la merma de cocción (166.6667)', async () => {
    const { prisma, inventory, recipes, ana, item, line } = await setup();
    const mano = await item('Mano de obra ficticia', 'insumo', { baseUnit: 'hr', inventoriable: false, referenceCost: '99999999999.9999' });
    const carne = await item('Carne ficticia', 'insumo', { referenceCost: '100' });
    const cocida = await item('Carne cocida ficticia', 'intermedio');
    expect(await prisma.inventoryItem.findUniqueOrThrow({ where: { id: mano.id }, select: { baseUnit: true, inventoriable: true } })).toEqual({ baseUnit: 'hr', inventoriable: false });
    expect((await inventory.getItem(mano.id)).item.referenceCost).toBe(999_999_999_999_999n);

    const { version } = await recipes.saveVersion(cocida.id, { baseVersionId: null, yieldQuantity: '6.000', note: 'Cocción ficticia', lines: [line(carne, '6.000', 'kg', '40'), line(mano, '1', 'hr', '12.34')] }, ana);
    const stored = await recipes.getVersion(version.id);
    expect(stored.version).toMatchObject({ number: 1, yieldQuantity: 6000n, note: 'Cocción ficticia', createdById: ana.id, createdByName: 'Ana' });
    expect(stored.version.lines.map((entry) => [entry.unit, formatDecimal(entry.quantity), formatDecimal(entry.wastePercent, 2), formatDecimal(entry.grossBaseQuantity)])).toEqual([
      ['kg', '6.000', '40.00', '10.000'],
      ['hr', '1.000', '12.34', '1.141'],
    ]);
    const fresh = (await recipes.getRecipe(cocida.id)).current;
    expect(fresh?.cost.lines[1]).toMatchObject({ unitCost: 999_999_999_999_999n, source: 'referencia' });

    // Sin la mano de obra: el ejemplo de RN-T2-1.
    await recipes.saveVersion(cocida.id, { baseVersionId: version.id, yieldQuantity: '6.000', lines: [line(carne, '6.000', 'kg', '40')] }, ana);
    const current = (await recipes.getRecipe(cocida.id)).current;
    expect(current && formatDecimal(current.cost.unitCost ?? -1n, 4)).toBe('166.6667');
  });

  it('una transacción fallida no deja restos; isInUse y «usado en» reflejan solo lo confirmado', async () => {
    const { prisma, store, inventory, recipes, ana, item, line } = await setup();
    const sal = await item('Sal ficticia', 'insumo');
    const salsa = await item('Salsa ficticia', 'intermedio');
    await expect(
      store.recipeTransaction(async (tx) => {
        await tx.lockRecipes();
        await tx.insertRecipeVersion({ itemId: salsa.id, number: 1, yieldQuantity: 1000n, validFrom: new Date(), note: null, createdAt: new Date(), createdById: ana.id, createdByName: ana.name, lines: [{ position: 1, ingredientId: sal.id, quantity: 1000n, unit: 'kg', netBaseQuantity: 1000n, wastePercent: 0n, grossBaseQuantity: 1000n, note: null }] });
        throw new Error('fallo simulado');
      }),
    ).rejects.toThrow();
    expect(await prisma.inventoryRecipeVersion.count()).toBe(0);
    expect(await prisma.inventoryRecipeLine.count()).toBe(0);
    expect((await inventory.getItem(sal.id)).locked).toBe(false);

    const { version } = await recipes.saveVersion(salsa.id, { baseVersionId: null, yieldQuantity: '1', lines: [line(sal, '1')] }, ana);
    expect([(await inventory.getItem(sal.id)).locked, (await inventory.getItem(salsa.id)).locked]).toEqual([true, true]);
    expect(await recipes.usedIn(sal.id)).toEqual([{ itemId: salsa.id, itemName: 'Salsa ficticia', itemActive: true, versionId: version.id, versionNumber: 1 }]);
    await recipes.closeRecipe(salsa.id, { baseVersionId: version.id }, ana);
    expect(await recipes.usedIn(sal.id)).toEqual([]);
    // RN-4: una versión cerrada sigue bloqueando la unidad base.
    expect((await inventory.getItem(sal.id)).locked).toBe(true);
    expect(await prisma.inventoryChange.count({ where: { entity: 'recipe', entityId: salsa.id } })).toBe(2);
  });

  it('A→B y B→A guardados a la vez: el candado los serializa y uno se rechaza por ciclo (CA-6, PT-1)', async () => {
    const { prisma, recipes, ana, item, line } = await setup();
    const a = await item('Base A', 'intermedio');
    const b = await item('Base B', 'intermedio');
    const results = await Promise.allSettled([
      recipes.saveVersion(a.id, { baseVersionId: null, yieldQuantity: '1', lines: [line(b, '1')] }, ana),
      recipes.saveVersion(b.id, { baseVersionId: null, yieldQuantity: '1', lines: [line(a, '1')] }, ana),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected');
    expect(rejected?.status === 'rejected' && rejected.reason instanceof RecipeCycleError).toBe(true);
    expect(await prisma.inventoryRecipeVersion.count()).toBe(1);
  });

  it('dos versiones simultáneas del mismo artículo desde la v1: una queda vigente y la otra recibe 409; intervalos contiguos', async () => {
    const { prisma, recipes, ana, item, line } = await setup();
    const sal = await item('Sal ficticia', 'insumo');
    const salsa = await item('Salsa ficticia', 'intermedio');
    const v1 = await recipes.saveVersion(salsa.id, { baseVersionId: null, yieldQuantity: '1', lines: [line(sal, '1')] }, ana);
    const results = await Promise.allSettled(
      ['2', '3'].map((quantity) => recipes.saveVersion(salsa.id, { baseVersionId: v1.version.id, yieldQuantity: '1', lines: [line(sal, quantity)] }, ana)),
    );
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected');
    expect(rejected?.status === 'rejected' && rejected.reason instanceof RecipeVersionConflictError && rejected.reason.current?.number === 2).toBe(true);

    const rows = await prisma.inventoryRecipeVersion.findMany({ where: { itemId: salsa.id }, orderBy: { number: 'asc' } });
    expect(rows.map((row) => [row.number, row.currentItemId])).toEqual([
      [1, null],
      [2, salsa.id],
    ]);
    expect(rows[0]?.validTo?.getTime()).toBe(rows[1]?.validFrom.getTime());
  });
});
