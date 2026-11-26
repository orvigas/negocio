import { afterEach, describe, expect, it } from 'vitest';

import {
  CategoryInUseError,
  InventoryConflictError,
  InventoryValidationError,
  ItemLockedError,
  ItemNameTakenError,
  SkuTakenError,
  createInventoryRepository,
  createSupplierRepository,
  formatDecimal,
  type InventoryAuthor,
} from '@restaurante/core/inventory';
import { createPrismaInventoryStore } from '@restaurante/db/prisma-inventory-store';

import { makeDatabase, type TestDatabase } from '../support/database.ts';

/**
 * Catálogo de inventario sobre MySQL 8.4 real (REQ-F-049, T1): solo lo que depende de la base. Claves
 * únicas ante altas simultáneas (nombre entre los activos sin distinguir mayúsculas y registro de
 * SKU), decimales exactos, conflicto de versión con dos escrituras a la vez, inactivación de una
 * categoría frente a un alta simultánea, y las consultas de la lista y la ficha.
 */

const databases: TestDatabase[] = [];
afterEach(async () => {
  while (databases.length > 0) await databases.pop()?.cleanup();
});

async function setup() {
  const database = await makeDatabase();
  databases.push(database);
  const { prisma } = database;
  const user = await prisma.user.create({ data: { username: 'ana', usernameKey: 'ana', displayName: 'Ana', role: 'admin', passwordHash: 'x', updatedAt: new Date() } });
  const ana: InventoryAuthor = { id: user.id, name: user.displayName };
  const store = createPrismaInventoryStore({ prisma });
  const inventory = createInventoryRepository({ store });
  const abarrotes = await inventory.createCategory({ name: 'Abarrotes' }, ana);
  const insumo = (name: string, extra: Record<string, unknown> = {}) =>
    inventory.createItem({ type: 'insumo', categoryId: abarrotes.id, name, baseUnit: 'kg', ...extra }, ana);
  return { prisma, store, inventory, ana, abarrotes, insumo };
}

const fieldsOf = (result: PromiseSettledResult<unknown>): unknown =>
  result.status === 'rejected' && result.reason instanceof InventoryValidationError ? result.reason.fields : result;

describe('claves únicas ante altas simultáneas', () => {
  it('dos altas a la vez con el mismo nombre (otras mayúsculas): una se guarda y la otra da error por campo', async () => {
    const { prisma, insumo } = await setup();
    const results = await Promise.allSettled([insumo('Sal'), insumo('SAL')]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.map(fieldsOf).filter((fields) => JSON.stringify(fields) === JSON.stringify({ name: 'Ya hay un artículo activo con ese nombre.' }))).toHaveLength(1);
    expect(await prisma.inventoryItem.count()).toBe(1);
    expect(await prisma.inventoryChange.count({ where: { entity: 'item' } })).toBe(1);
  });

  it('la clave única del nombre activo es la garantía: inactivo libera el nombre y la base rechaza un duplicado activo', async () => {
    const { prisma, store, inventory, ana, insumo } = await setup();
    const sal = await insumo('Sal');
    // Sin la comprobación previa del repositorio: la base rechaza el segundo activo con la misma clave.
    const duplicate = { ...sal, active: true, version: 1, nameKey: 'sal', name: 'sal' };
    await expect(store.transaction((tx) => tx.insertItem(duplicate))).rejects.toBeInstanceOf(ItemNameTakenError);

    await inventory.deactivateItem(sal.id, { version: 1 }, ana);
    const nueva = await insumo('sal');
    expect(await prisma.inventoryItem.findMany({ select: { id: true, activeNameKey: true }, orderBy: { id: 'asc' } })).toEqual([
      { id: sal.id, activeNameKey: null },
      { id: nueva.id, activeNameKey: 'sal' },
    ]);
    await expect(inventory.reactivateItem(sal.id, { version: 2 }, ana)).rejects.toBeInstanceOf(ItemNameTakenError);
  });

  it('dos altas a la vez con el mismo SKU: una se guarda; el registro no admite un SKU repetido ni uno liberado', async () => {
    const { prisma, store, inventory, ana, insumo } = await setup();
    const results = await Promise.allSettled([insumo('Sal', { sku: 'abc-1' }), insumo('Azúcar', { sku: 'ABC-1' })]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.map(fieldsOf)).toContainEqual({ sku: 'Ese SKU ya se usó en otro artículo.' });
    expect(await prisma.inventorySku.findMany({ select: { skuKey: true } })).toEqual([{ skuKey: 'ABC-1' }]);
    await expect(store.transaction((tx) => tx.registerSku('ABC-1', 999, new Date()))).rejects.toBeInstanceOf(SkuTakenError);

    // Un SKU que el artículo deja de usar sigue registrado a su nombre.
    const [saved] = results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
    if (!saved) throw new Error('Falta el artículo guardado');
    await inventory.updateItem(saved.id, { version: 1, categoryId: saved.categoryId, name: saved.name, baseUnit: 'kg', sku: 'abc-2' }, ana);
    expect(fieldsOf((await Promise.allSettled([insumo('Arroz', { sku: 'ABC-1' })]))[0] as PromiseSettledResult<unknown>)).toEqual({ sku: 'Ese SKU ya se usó en otro artículo.' });
    expect(await prisma.inventorySku.count({ where: { itemId: saved.id } })).toBe(2);
  });
});

describe('decimales y concurrencia', () => {
  it('los factores se guardan y se leen exactos (DECIMAL(13,3)), sin coma flotante', async () => {
    const { prisma, inventory, insumo } = await setup();
    const units = [
      { name: 'lata', factor: '0.355' },
      { name: 'tarima', factor: '1000000' },
      { name: 'pizca', factor: '0.001' },
    ];
    const item = await insumo('Crema', { baseUnit: 'L', units });
    const stored = await prisma.$queryRaw<{ factor: string }[]>`SELECT CAST(factor AS CHAR) AS factor FROM inventory_item_unit ORDER BY position`;
    expect(stored.map((row) => row.factor)).toEqual(['0.355', '1000000.000', '0.001']);
    const { item: read, equivalences } = await inventory.getItem(item.id);
    expect(read.units).toEqual([
      { name: 'lata', factor: 355n },
      { name: 'tarima', factor: 1_000_000_000n },
      { name: 'pizca', factor: 1n },
    ]);
    expect(equivalences.map(({ unit, quantity }) => [unit, formatDecimal(quantity)])).toEqual([
      ['lata', '0.355'],
      ['tarima', '1000000.000'],
      ['pizca', '0.001'],
      ['ml', '0.001'],
    ]);
    // 3 latas de 0.355 L = 1.065 L exactos (en coma flotante, 3 × 0.355 = 1.0649999…).
    expect(formatDecimal((await inventory.convert(item.id, '3', 'lata')).quantity)).toBe('1.065');
  });

  it('dos ediciones a la vez con la misma versión: una se guarda y la otra recibe el conflicto con los datos vigentes', async () => {
    const { prisma, inventory, ana, insumo } = await setup();
    const sal = await insumo('Sal');
    const edit = (name: string) => inventory.updateItem(sal.id, { version: 1, categoryId: sal.categoryId, name, baseUnit: 'kg' }, ana);
    const results = await Promise.allSettled([edit('Sal fina'), edit('Sal gruesa')]);
    const winner = results.find((result) => result.status === 'fulfilled');
    const loser = results.find((result) => result.status === 'rejected');
    expect(winner).toBeDefined();
    expect(loser?.reason).toBeInstanceOf(InventoryConflictError);
    expect((loser?.reason as InventoryConflictError).current).toMatchObject({ id: sal.id, version: 2, updatedBy: 'Ana' });
    const row = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: sal.id } });
    expect(row.version).toBe(2);
    expect(row.name).toBe(winner?.status === 'fulfilled' ? winner.value.name : null);
    expect(await prisma.inventoryChange.count({ where: { entity: 'item', entityId: sal.id, action: 'update' } })).toBe(1);
  });

  it('inactivar una categoría a la vez que se da de alta un artículo en ella nunca deja un artículo activo en una categoría inactiva', async () => {
    const { prisma, inventory, ana } = await setup();
    for (let round = 1; round <= 4; round += 1) {
      const category = await inventory.createCategory({ name: `Ronda ${round}` }, ana);
      const results = await Promise.allSettled([
        inventory.deactivateCategory(category.id, ana),
        inventory.createItem({ type: 'insumo', categoryId: category.id, name: `Artículo ${round}`, baseUnit: 'kg' }, ana),
      ]);
      const [deactivate, create] = results;
      const row = await prisma.inventoryCategory.findUniqueOrThrow({ where: { id: category.id } });
      const activeItems = await prisma.inventoryItem.count({ where: { categoryId: category.id, active: true } });
      if (row.active) {
        expect(activeItems).toBe(1);
        expect(deactivate?.status === 'rejected' && deactivate.reason instanceof CategoryInUseError).toBe(true);
      } else {
        expect(activeItems).toBe(0);
        expect(create?.status).toBe('rejected');
      }
    }
  });
});

describe('lista y ficha en MySQL', () => {
  it('filtros, búsqueda por nombre o SKU sin distinguir mayúsculas, número de variantes e historial', async () => {
    const { inventory, ana, abarrotes, insumo } = await setup();
    await insumo('Sal de mar', { sku: 'sal-9' });
    const padre = await inventory.createItem({ kind: 'parent', type: 'reventa', categoryId: abarrotes.id, name: 'Refresco 600 ml' }, ana);
    const coca = await inventory.createItem({ kind: 'variant', parentId: padre.id, name: 'Coca-Cola', baseUnit: 'pza', units: [{ name: 'caja', factor: '24' }] }, ana);
    await inventory.createItem({ kind: 'variant', parentId: padre.id, name: 'Mundet', baseUnit: 'pza' }, ana);
    await inventory.deactivateItem(coca.id, { version: 1 }, ana);

    const list = await inventory.listItems({ status: 'all' });
    expect(list.page).toEqual({ number: 1, size: 50, total: 4 });
    expect(list.items.map((item) => [item.name, item.variantCount, item.categoryName])).toEqual([
      ['Coca-Cola', 0, 'Abarrotes'],
      ['Mundet', 0, 'Abarrotes'],
      ['Refresco 600 ml', 2, 'Abarrotes'],
      ['Sal de mar', 0, 'Abarrotes'],
    ]);
    expect((await inventory.listItems({ q: 'SAL-9' })).items.map((item) => item.name)).toEqual(['Sal de mar']);
    expect((await inventory.listItems({ q: 'DE MAR' })).items.map((item) => item.name)).toEqual(['Sal de mar']);
    // Los comodines de LIKE se buscan como texto, no como «cualquier cosa».
    expect((await inventory.listItems({ status: 'all', q: '%' })).items).toEqual([]);
    expect((await inventory.listItems({ status: 'all', q: '_' })).items).toEqual([]);
    expect((await inventory.listItems({ status: 'inactive' })).items.map((item) => item.name)).toEqual(['Coca-Cola']);
    expect((await inventory.listCategories()).map((category) => [category.name, category.activeItemCount])).toEqual([['Abarrotes', 3]]);

    const ficha = await inventory.getItem(coca.id);
    expect(ficha.parent?.name).toBe('Refresco 600 ml');
    expect(ficha.locked).toBe(false);
    expect(ficha.history.map((entry) => [entry.action, entry.actorId, entry.actorName])).toEqual([
      ['deactivate', ana.id, 'Ana'],
      ['create', ana.id, 'Ana'],
    ]);
    expect(ficha.history[0]?.changes).toEqual([{ field: 'active', before: true, after: false }]);
  });
});

describe('proveedores y existencias (REQ-F-051, T3)', () => {
  it('dos altas de proveedor a la vez con el mismo nombre (otras mayúsculas): una se guarda y la otra da error por campo', async () => {
    const { prisma, store, ana } = await setup();
    const suppliers = createSupplierRepository({ store });
    const results = await Promise.allSettled([suppliers.createSupplier({ name: 'Lácteos del Valle' }, ana), suppliers.createSupplier({ name: 'LÁCTEOS DEL VALLE' }, ana)]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.map(fieldsOf).find((value) => !(value && typeof value === 'object' && 'status' in value))).toEqual({ name: 'Ya hay un proveedor activo con ese nombre.' });
    expect(await prisma.inventorySupplier.count()).toBe(1);
    expect(await prisma.inventoryChange.count({ where: { entity: 'supplier' } })).toBe(1);
  });

  it('el alta crea la existencia en 0 y sin costo (no en un padre), y un artículo sin ella la recibe al bloquearse (DT-T3-2)', async () => {
    const { prisma, inventory, ana, abarrotes, insumo } = await setup();
    const sal = await insumo('Sal');
    const padre = await inventory.createItem({ kind: 'parent', type: 'reventa', categoryId: abarrotes.id, name: 'Refresco 600 ml' }, ana);
    const stock = await prisma.inventoryStock.findUnique({ where: { itemId: sal.id } });
    expect(stock && { quantity: stock.quantity.toFixed(3), avgCost: stock.avgCost, lastCost: stock.lastCost, lastSeq: stock.lastSeq }).toEqual({ quantity: '0.000', avgCost: null, lastCost: null, lastSeq: 0 });
    expect(await prisma.inventoryStock.findUnique({ where: { itemId: padre.id } })).toBeNull();

    // Un artículo creado por una imagen anterior (sin existencia): la edición la crea al bloquear.
    const at = new Date();
    const old = await prisma.inventoryItem.create({ data: { kind: 'simple', type: 'insumo', categoryId: abarrotes.id, name: 'Azúcar', nameKey: 'azúcar', activeNameKey: 'azúcar', baseUnit: 'kg', createdAt: at, updatedAt: at } });
    await expect(inventory.updateItem(old.id, { version: 1, categoryId: abarrotes.id, name: 'Azúcar estándar', baseUnit: 'kg' }, ana)).resolves.toMatchObject({ name: 'Azúcar estándar' });
    expect(await prisma.inventoryStock.findUnique({ where: { itemId: old.id } })).toMatchObject({ lastSeq: 0, avgCost: null });
  });

  it('RN-T3-11: con un movimiento registrado (last_seq > 0), la unidad, los empaques y el inventariable quedan bloqueados', async () => {
    const { prisma, inventory, abarrotes, insumo, ana } = await setup();
    const masa = await insumo('Masa de maíz', { units: [{ name: 'bulto', factor: '25' }] });
    await prisma.inventoryStock.update({ where: { itemId: masa.id }, data: { lastSeq: 1 } });
    await expect(inventory.updateItem(masa.id, { version: 1, categoryId: abarrotes.id, name: 'Masa de maíz', baseUnit: 'kg', units: [{ name: 'bulto', factor: '20' }] }, ana)).rejects.toBeInstanceOf(
      ItemLockedError,
    );
    const rejected = await Promise.allSettled([inventory.updateItem(masa.id, { version: 1, categoryId: abarrotes.id, name: 'Masa de maíz', baseUnit: 'kg', units: [{ name: 'bulto', factor: '25' }], inventoriable: false }, ana)]);
    expect(fieldsOf(rejected[0] as PromiseSettledResult<unknown>)).toHaveProperty('inventoriable');
    expect((await inventory.getItem(masa.id)).locked).toBe(true);
  });

  it('la búsqueda de la lista ignora mayúsculas y acentos y distingue la ñ (OBS-12 b)', async () => {
    const { inventory, insumo } = await setup();
    await insumo('Carne de res');
    await insumo('Piña');
    expect((await inventory.listItems({ q: 'cárne' })).items.map((item) => item.name)).toEqual(['Carne de res']);
    expect((await inventory.listItems({ q: 'PIÑA' })).items.map((item) => item.name)).toEqual(['Piña']);
    expect((await inventory.listItems({ q: 'pina' })).items).toEqual([]);
  });
});
