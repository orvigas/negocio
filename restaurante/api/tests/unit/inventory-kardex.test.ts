import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  INVENTORY_ACTIONS,
  InventoryValidationError,
  ItemLockedError,
  SupplierConflictError,
  createInventoryRepository,
  createMemoryInventoryStore,
  createRecipeRepository,
  createSupplierRepository,
  runMasterImport,
  searchKey,
} from '@restaurante/core/inventory';

import { seedInventoryDev } from '../../scripts/support/inventory-dev-seed.ts';

/**
 * Kardex, existencias y proveedores (REQ-F-051, T3) sobre el store en memoria: las reglas que no
 * dependen de MySQL. La concurrencia y las claves únicas reales se prueban en
 * `landing-pages/tests/integration/prisma-inventory-store.test.ts`.
 */

const ANA = { id: 7, name: 'Ana Gerente' };
const LUIS = { id: 8, name: 'Luis Admin' };
const NOW = new Date('2026-11-25T18:00:00.000Z');

function setup() {
  const store = createMemoryInventoryStore();
  const suppliers = createSupplierRepository({ store, now: () => NOW });
  const inventory = createInventoryRepository({ store, now: () => NOW });
  return { store, suppliers, inventory };
}

async function fieldsOf(promise: Promise<unknown>): Promise<Record<string, string>> {
  const error: unknown = await promise.then(
    () => null,
    (err: unknown) => err,
  );
  expect(error).toBeInstanceOf(InventoryValidationError);
  return (error as InventoryValidationError).fields;
}

describe('proveedores (RF-1, CA-22)', () => {
  it('da de alta con un teléfono o un correo como contacto, y rechaza cualquier otra cosa', async () => {
    const { suppliers } = setup();
    const carnes = await suppliers.createSupplier({ name: '  Carnes del Norte  ', contact: '+52 (33) 1234-5678' }, ANA);
    expect(carnes).toMatchObject({ name: 'Carnes del Norte', contact: '+52 (33) 1234-5678', active: true, version: 1 });
    await expect(suppliers.createSupplier({ name: 'Abarrotes Sol', contact: 'ventas@abarrotes.example' }, ANA)).resolves.toMatchObject({ contact: 'ventas@abarrotes.example' });
    await expect(suppliers.createSupplier({ name: 'Sin contacto', contact: '  ' }, ANA)).resolves.toMatchObject({ contact: null });

    expect(await fieldsOf(suppliers.createSupplier({ name: 'Doble', contact: '3312345678 ventas@abarrotes.example' }, ANA))).toHaveProperty('contact');
    expect(await fieldsOf(suppliers.createSupplier({ name: 'Corto', contact: '12345' }, ANA))).toHaveProperty('contact');
    expect(await fieldsOf(suppliers.createSupplier({ name: 'Calle', contact: 'Av. Juárez 10' }, ANA))).toHaveProperty('contact');
    expect(await fieldsOf(suppliers.createSupplier({ name: '', contact: null }, ANA))).toHaveProperty('name');
    expect(await fieldsOf(suppliers.createSupplier({ name: 'x'.repeat(81) }, ANA))).toHaveProperty('name');
  });

  it('el nombre es único entre los activos sin distinguir mayúsculas; un inactivo lo libera, y reactivarlo con el nombre en uso se rechaza', async () => {
    const { suppliers } = setup();
    const first = await suppliers.createSupplier({ name: 'Lácteos del Valle' }, ANA);
    expect(await fieldsOf(suppliers.createSupplier({ name: 'LÁCTEOS DEL VALLE' }, ANA))).toEqual({ name: 'Ya hay un proveedor activo con ese nombre.' });

    const inactive = await suppliers.deactivateSupplier(first.id, { version: first.version }, ANA);
    expect(inactive).toMatchObject({ active: false, version: 2 });
    const second = await suppliers.createSupplier({ name: 'lácteos del valle' }, ANA);
    expect(second.active).toBe(true);

    expect(await fieldsOf(suppliers.reactivateSupplier(first.id, { version: inactive.version }, ANA))).toEqual({ name: 'Ya hay un proveedor activo con ese nombre.' });
    const renamed = await suppliers.updateSupplier(second.id, { version: second.version, name: 'Lácteos del Valle Norte' }, ANA);
    await expect(suppliers.reactivateSupplier(first.id, { version: inactive.version }, ANA)).resolves.toMatchObject({ active: true, version: 3 });
    expect(renamed.version).toBe(2);
  });

  it('una edición con una versión vieja da conflicto con quién guardó; «guardar encima» queda en el historial', async () => {
    const { suppliers } = setup();
    const created = await suppliers.createSupplier({ name: 'Verduras Lupita', contact: '3311112222' }, ANA);
    await suppliers.updateSupplier(created.id, { version: 1, name: 'Verduras Lupita', contact: 'pedidos@lupita.example' }, LUIS);

    const conflict: unknown = await suppliers.updateSupplier(created.id, { version: 1, name: 'Verduras Lupita SA' }, ANA).catch((err: unknown) => err);
    expect(conflict).toBeInstanceOf(SupplierConflictError);
    expect((conflict as SupplierConflictError).current).toMatchObject({ id: created.id, version: 2, updatedBy: 'Luis Admin' });

    await suppliers.updateSupplier(created.id, { version: 2, name: 'Verduras Lupita SA', contact: 'pedidos@lupita.example', overwrite: true }, ANA);
    const { supplier, history } = await suppliers.getSupplier(created.id);
    expect(supplier).toMatchObject({ name: 'Verduras Lupita SA', version: 3, updatedByName: 'Ana Gerente' });
    expect(history.map((entry) => [entry.action, entry.actorName])).toEqual([
      [INVENTORY_ACTIONS.OVERWRITE_AFTER_CONFLICT, 'Ana Gerente'],
      [INVENTORY_ACTIONS.UPDATE, 'Luis Admin'],
      [INVENTORY_ACTIONS.CREATE, 'Ana Gerente'],
    ]);
    expect(history[1]?.changes).toEqual([{ field: 'contact', before: '3311112222', after: 'pedidos@lupita.example' }]);
  });

  it('una edición sin cambios no crea versión ni historial', async () => {
    const { suppliers } = setup();
    const created = await suppliers.createSupplier({ name: 'Gas Express', contact: '3399998888' }, ANA);
    const same = await suppliers.updateSupplier(created.id, { version: 1, name: ' Gas Express ', contact: '3399998888' }, ANA);
    expect(same.version).toBe(1);
    expect((await suppliers.getSupplier(created.id)).history).toHaveLength(1);
  });

  it('la lista muestra los activos por defecto y busca sin distinguir mayúsculas ni acentos, pero sí la ñ (OBS-12 b)', async () => {
    const { suppliers } = setup();
    await suppliers.createSupplier({ name: 'Lácteos del Valle' }, ANA);
    const old = await suppliers.createSupplier({ name: 'Carnicería Ñandú' }, ANA);
    await suppliers.createSupplier({ name: 'Carniceria Nandu' }, ANA);
    await suppliers.deactivateSupplier(old.id, { version: 1 }, ANA);

    expect((await suppliers.listSuppliers()).suppliers.map((s) => s.name)).toEqual(['Carniceria Nandu', 'Lácteos del Valle']);
    expect((await suppliers.listSuppliers({ q: 'LACTEOS' })).suppliers.map((s) => s.name)).toEqual(['Lácteos del Valle']);
    expect((await suppliers.listSuppliers({ status: 'all', q: 'ñandú' })).suppliers.map((s) => s.name)).toEqual(['Carnicería Ñandú']);
    expect((await suppliers.listSuppliers({ status: 'inactive' })).page.total).toBe(1);
    await expect(suppliers.listSuppliers({ status: 'borrados' })).rejects.toBeInstanceOf(InventoryValidationError);
  });
});

describe('búsqueda sin acentos (OBS-12 b)', () => {
  it('«cárne» encuentra «Carne» en la lista de artículos y en la de recetas', async () => {
    const { store, inventory } = setup();
    const category = await inventory.createCategory({ name: 'Carnes' }, ANA);
    await inventory.createItem({ type: 'insumo', categoryId: category.id, name: 'Carne de res', baseUnit: 'kg' }, ANA);
    await inventory.createItem({ type: 'insumo', categoryId: category.id, name: 'Piña', baseUnit: 'kg' }, ANA);
    expect((await inventory.listItems({ q: 'cárne' })).items.map((item) => item.name)).toEqual(['Carne de res']);
    expect((await inventory.listItems({ q: 'pina' })).items).toEqual([]);

    const recipes = createRecipeRepository({ store, now: () => NOW });
    const taco = await inventory.createItem({ type: 'compuesto', categoryId: category.id, name: 'Taco de cárnitas', baseUnit: 'pza' }, ANA);
    const res = (await inventory.listItems({ q: 'carne de res' })).items[0];
    await recipes.saveVersion(taco.id, { baseVersionId: null, yieldQuantity: '1', lines: [{ ingredientId: res?.id, quantity: '0.1', unit: 'kg', wastePercent: '0' }] }, ANA);
    expect((await recipes.listRecipes({ q: 'CARNITAS' })).recipes.map((entry) => entry.item.name)).toEqual(['Taco de cárnitas']);
    expect(searchKey(' Cárne ')).toBe(searchKey('CARNE'));
    expect(searchKey('piña')).not.toBe(searchKey('pina'));
  });
});

describe('existencias listas para movimientos (RF-12, CA-20; DT-T3-2)', () => {
  it('el alta, la importación A5 y la semilla dejan cada artículo que no es padre con existencia 0 y sin costo', async () => {
    const { store, inventory } = setup();
    const category = await inventory.createCategory({ name: 'Bebidas' }, ANA);
    const masa = await inventory.createItem({ type: 'insumo', categoryId: category.id, name: 'Masa de maíz', baseUnit: 'kg' }, ANA);
    const refresco = await inventory.createItem({ kind: 'parent', type: 'reventa', categoryId: category.id, name: 'Refresco 600 ml' }, ANA);
    const cola = await inventory.createItem({ kind: 'variant', parentId: refresco.id, name: 'Refresco cola 600 ml', baseUnit: 'pza' }, ANA);
    expect(store.state.stock.get(masa.id)).toMatchObject({ quantity: 0n, avgCost: null, lastCost: null, lastSeq: 0 });
    expect(store.state.stock.has(cola.id)).toBe(true);
    expect(store.state.stock.has(refresco.id)).toBe(false);

    const imported = createMemoryInventoryStore();
    const fixture: unknown = JSON.parse(readFileSync(new URL('../fixtures/inventory-import/ficticio.json', import.meta.url), 'utf8'));
    await runMasterImport({ store: imported, input: fixture, write: true, now: () => NOW });
    const importedItems = imported.state.items.filter((item) => item.kind !== 'parent');
    expect(importedItems.length).toBeGreaterThan(0);
    expect(importedItems.every((item) => imported.state.stock.get(item.id)?.lastSeq === 0)).toBe(true);

    const seeded = createMemoryInventoryStore();
    await seedInventoryDev({ inventory: createInventoryRepository({ store: seeded, now: () => NOW }), recipes: createRecipeRepository({ store: seeded, now: () => NOW }) });
    for (const item of seeded.state.items) expect(seeded.state.stock.has(item.id)).toBe(item.kind !== 'parent');
  });

  it('RN-T3-11 (CA-19): con movimientos, la unidad base, los empaques y el atributo inventariable ya no cambian', async () => {
    const { store, inventory } = setup();
    const category = await inventory.createCategory({ name: 'Abarrotes' }, ANA);
    const sal = await inventory.createItem({ type: 'insumo', categoryId: category.id, name: 'Sal', baseUnit: 'kg', units: [{ name: 'bolsa', factor: '1' }] }, ANA);
    // Sin movimientos, el cambio se permite.
    const edited = await inventory.updateItem(sal.id, { version: 1, categoryId: category.id, name: 'Sal', baseUnit: 'kg', units: [{ name: 'bolsa', factor: '2' }], inventoriable: false }, ANA);
    const back = await inventory.updateItem(sal.id, { version: edited.version, categoryId: category.id, name: 'Sal', baseUnit: 'kg', units: [{ name: 'bolsa', factor: '2' }], inventoriable: true }, ANA);

    // Simula el primer movimiento del Kardex (la existencia guarda su seq).
    const stock = store.state.stock.get(sal.id);
    if (!stock) throw new Error('falta la existencia');
    stock.lastSeq = 1;
    await expect(inventory.updateItem(sal.id, { version: back.version, categoryId: category.id, name: 'Sal', baseUnit: 'g', units: [{ name: 'bolsa', factor: '2000' }] }, ANA)).rejects.toBeInstanceOf(ItemLockedError);
    expect(await fieldsOf(inventory.updateItem(sal.id, { version: back.version, categoryId: category.id, name: 'Sal', baseUnit: 'kg', units: [{ name: 'bolsa', factor: '2' }], inventoriable: false }, ANA))).toHaveProperty('inventoriable');
    // El resto de la ficha sigue editable.
    await expect(inventory.updateItem(sal.id, { version: back.version, categoryId: category.id, name: 'Sal de mar', baseUnit: 'kg', units: [{ name: 'bolsa', factor: '2' }] }, ANA)).resolves.toMatchObject({ name: 'Sal de mar' });
    expect((await inventory.getItem(sal.id)).locked).toBe(true);
  });
});
