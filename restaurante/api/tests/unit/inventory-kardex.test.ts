import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  AlreadyReversedError,
  DocumentHasReturnsError,
  INVENTORY_ACTIONS,
  IdempotencyKeyReusedError,
  InitialBalanceNotAllowedError,
  InventoryValidationError,
  ItemLockedError,
  ReversalNotReversibleError,
  SupplierConflictError,
  VERIFY_CHECKS,
  businessDate,
  createInventoryRepository,
  createKardexRepository,
  createMemoryInventoryStore,
  createRecipeRepository,
  createSupplierRepository,
  formatDecimal,
  runMasterImport,
  searchKey,
  verifyKardex,
  type DocumentResult,
} from '@restaurante/core/inventory';

import { seedInventoryDev } from '../../scripts/support/inventory-dev-seed.ts';

/**
 * Kardex, existencias y proveedores (REQ-F-051, T3) sobre el store en memoria: las reglas que no
 * dependen de MySQL. La concurrencia, las claves únicas y los tipos reales se prueban en
 * `landing-pages/tests/integration/prisma-inventory-store.test.ts` y `prisma-inventory-kardex.test.ts`.
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

// --- Kardex (RF-2 a RF-10, RN-T3-3 a RN-T3-8) ------------------------------------------------------

const TZ = 'America/Mexico_City';
const TODAY = '2026-11-25';
const q3 = (value: bigint | null | undefined) => (value === null || value === undefined ? null : formatDecimal(value, 3));
const c4 = (value: bigint | null | undefined) => (value === null || value === undefined ? null : formatDecimal(value, 4));

async function kardexSetup(now: () => Date = () => NOW) {
  const store = createMemoryInventoryStore();
  const inventory = createInventoryRepository({ store, now });
  const kardex = createKardexRepository({ store, timeZone: TZ, now });
  const suppliers = createSupplierRepository({ store, now });
  const abarrotes = await inventory.createCategory({ name: 'Abarrotes' }, ANA);
  const masa = await inventory.createItem({ type: 'insumo', categoryId: abarrotes.id, name: 'Masa de maíz', baseUnit: 'kg', units: [{ name: 'bulto', factor: '25' }] }, ANA);
  const stockOf = (itemId: number) => store.state.stock.get(itemId);
  const purchase = (itemId: number, quantity: string, amount: string, unit = 'kg', extra: Record<string, unknown> = {}) =>
    kardex.createPurchase({ occurredOn: TODAY, lines: [{ itemId, quantity, unit, amount }], ...extra }, ANA);
  const adjust = (itemId: number, direction: string, quantity: string, extra: Record<string, unknown> = {}, line: Record<string, unknown> = {}) =>
    kardex.createAdjustment({ occurredOn: TODAY, reason: 'error_captura', lines: [{ itemId, direction, quantity, unit: 'kg', ...line }], ...extra }, ANA);
  return { store, inventory, kardex, suppliers, abarrotes, masa, stockOf, purchase, adjust };
}

const lastMovement = (store: ReturnType<typeof createMemoryInventoryStore>, document: DocumentResult) => store.state.movements.filter((m) => m.documentId === document.document.id).at(-1);

describe('compras y CPP (RF-3, RN-T3-4, RN-T3-5)', () => {
  it('CA-1 y CA-2: compra por bultos al costo pagado por kg; la segunda compra promedia el CPP y fija el último costo', async () => {
    const { store, masa, stockOf, purchase } = await kardexSetup();
    const first = await purchase(masa.id, '2', '1000.00', 'bulto');
    const movement = lastMovement(store, first);
    expect([q3(movement?.quantity), q3(movement?.enteredQuantity), movement?.enteredUnit, c4(movement?.unitCost), q3(movement?.balanceBefore), q3(movement?.balanceAfter)]).toEqual(['50.000', '2.000', 'bulto', '20.0000', '0.000', '50.000']);
    expect(first.document).toMatchObject({ type: 'compra', costBasis: 'con_iva', occurredOn: TODAY, actorName: 'Ana Gerente' });
    expect(c4(first.document.totalCost)).toBe('1000.0000');
    expect([q3(stockOf(masa.id)?.quantity), c4(stockOf(masa.id)?.avgCost), c4(stockOf(masa.id)?.lastCost)]).toEqual(['50.000', '20.0000', '20.0000']);

    await purchase(masa.id, '25', '600.00');
    expect([q3(stockOf(masa.id)?.quantity), c4(stockOf(masa.id)?.avgCost), c4(stockOf(masa.id)?.lastCost)]).toEqual(['75.000', '21.3333', '24.0000']);
  });

  it('CA-3: con existencia ≤ 0, el CPP pasa a ser el costo de la compra', async () => {
    const { masa, stockOf, purchase, adjust } = await kardexSetup();
    await purchase(masa.id, '10', '200.00');
    await adjust(masa.id, 'salida', '12');
    expect([q3(stockOf(masa.id)?.quantity), c4(stockOf(masa.id)?.avgCost)]).toEqual(['-2.000', '20.0000']);
    await purchase(masa.id, '10', '250.00');
    expect([q3(stockOf(masa.id)?.quantity), c4(stockOf(masa.id)?.avgCost)]).toEqual(['8.000', '25.0000']);
  });

  it('CA-4: el costo por unidad redondea la mitad hacia arriba; la coma y los decimales de más se rechazan', async () => {
    const { store, inventory, abarrotes, purchase } = await kardexSetup();
    const refresco = await inventory.createItem({ type: 'reventa', categoryId: abarrotes.id, name: 'Refresco', baseUnit: 'pza' }, ANA);
    expect(c4(lastMovement(store, await purchase(refresco.id, '3', '10.00', 'pza'))?.unitCost)).toBe('3.3333');
    expect(c4(lastMovement(store, await purchase(refresco.id, '3', '20.00', 'pza'))?.unitCost)).toBe('6.6667');
    expect(await fieldsOf(purchase(refresco.id, '3', '10,00', 'pza'))).toHaveProperty(['lines.0.amount']);
    expect(await fieldsOf(purchase(refresco.id, '3', '10.001', 'pza'))).toEqual({ 'lines.0.amount': 'Máximo 2 decimales.' });
    expect(await fieldsOf(purchase(refresco.id, '1,5', '10.00', 'pza'))).toHaveProperty(['lines.0.quantity']);
  });

  it('un importe 0 se acepta (sin cargo) y el mismo artículo puede ir en varias líneas, en orden', async () => {
    const { kardex, masa, stockOf } = await kardexSetup();
    const result = await kardex.createPurchase({ occurredOn: TODAY, lines: [{ itemId: masa.id, quantity: '10', unit: 'kg', amount: '200.00' }, { itemId: masa.id, quantity: '10', unit: 'kg', amount: '0' }] }, ANA);
    expect(c4(result.document.totalCost)).toBe('200.0000');
    expect([q3(stockOf(masa.id)?.quantity), c4(stockOf(masa.id)?.avgCost), c4(stockOf(masa.id)?.lastCost), stockOf(masa.id)?.lastSeq]).toEqual(['20.000', '10.0000', '0.0000', 2]);
  });
});

describe('saldo inicial (RF-2, RN-T3-8)', () => {
  it('CA-5 y CA-8: solo sin movimientos vigentes; un segundo saldo o uno tras una compra se rechazan; revertido, admite otro', async () => {
    const { store, inventory, abarrotes, kardex, masa, stockOf, purchase } = await kardexSetup();
    const initial = (itemId: number, quantity = '12.5', unitCost = '18.5') => kardex.createInitialBalance({ occurredOn: TODAY, lines: [{ itemId, quantity, unit: 'kg', unitCost }] }, ANA);
    const first = await initial(masa.id);
    expect([q3(stockOf(masa.id)?.quantity), c4(stockOf(masa.id)?.avgCost), stockOf(masa.id)?.lastCost]).toEqual(['12.500', '18.5000', null]);
    expect((await kardex.itemKardex(masa.id)).movements.map((m) => m.type)).toEqual(['saldo_inicial']);
    const second: unknown = await initial(masa.id).catch((err: unknown) => err);
    expect(second).toBeInstanceOf(InitialBalanceNotAllowedError);
    expect((second as Error).message).toMatch(/ajuste/);

    const sal = await inventory.createItem({ type: 'insumo', categoryId: abarrotes.id, name: 'Sal', baseUnit: 'kg' }, ANA);
    await purchase(sal.id, '1', '12.00');
    await expect(initial(sal.id)).rejects.toBeInstanceOf(InitialBalanceNotAllowedError);

    await kardex.reverseDocument(first.document.id, { reason: 'Capturé mal la cantidad' }, ANA);
    await initial(masa.id, '10', '19');
    expect([q3(stockOf(masa.id)?.quantity), c4(stockOf(masa.id)?.avgCost), stockOf(masa.id)?.lastSeq]).toEqual(['10.000', '19.0000', 3]);
    expect(store.state.documents.map((d) => d.type)).toEqual(['saldo_inicial', 'compra', 'reversion', 'saldo_inicial']);
    expect(await fieldsOf(initial(masa.id, '0'))).toHaveProperty(['lines.0.quantity']);
  });
});

describe('reversión (RF-4, RN-T3-6)', () => {
  it('CA-6: revertir la última compra devuelve el CPP y el último costo; el original no cambia; no se revierte dos veces ni una reversión', async () => {
    const { store, kardex, masa, stockOf, purchase } = await kardexSetup();
    await purchase(masa.id, '50', '1000.00');
    const second = await purchase(masa.id, '25', '600.00');
    const before = structuredClone(store.state.movements);
    const reversal = await kardex.reverseDocument(second.document.id, { reason: 'Factura duplicada' }, LUIS);
    expect([q3(stockOf(masa.id)?.quantity), c4(stockOf(masa.id)?.avgCost), c4(stockOf(masa.id)?.lastCost)]).toEqual(['50.000', '20.0000', '20.0000']);
    expect(reversal.document).toMatchObject({ type: 'reversion', reversesDocumentId: second.document.id, note: 'Factura duplicada', actorName: 'Luis Admin' });
    expect(store.state.movements.slice(0, before.length)).toEqual(before);
    expect((await kardex.getDocument(second.document.id)).document.reversedById).toBe(reversal.document.id);

    await expect(kardex.reverseDocument(second.document.id, { reason: 'otra vez' }, ANA)).rejects.toBeInstanceOf(AlreadyReversedError);
    await expect(kardex.reverseDocument(reversal.document.id, { reason: 'deshacer' }, ANA)).rejects.toBeInstanceOf(ReversalNotReversibleError);
    expect(await fieldsOf(kardex.reverseDocument(second.document.id, { reason: '  ' }, ANA))).toEqual({ reason: 'Escribe el motivo de la reversión.' });
  });

  it('CA-7: revertir una entrada ya consumida deja la existencia negativa, conserva el CPP y la vista previa lo avisa', async () => {
    const { kardex, masa, stockOf, purchase, adjust } = await kardexSetup();
    const bought = await purchase(masa.id, '10', '200.00');
    await adjust(masa.id, 'salida', '8');
    const preview = await kardex.previewReversal(bought.document.id);
    expect(preview.map((line) => [q3(line.quantity), q3(line.balanceAfter), line.negative])).toEqual([['-10.000', '-8.000', true]]);
    await kardex.reverseDocument(bought.document.id, { reason: 'No llegó' }, ANA);
    expect([q3(stockOf(masa.id)?.quantity), c4(stockOf(masa.id)?.avgCost), stockOf(masa.id)?.lastCost]).toEqual(['-8.000', '20.0000', null]);
    expect((await kardex.listStock({ status: 'negative' })).entries.map((entry) => [entry.item.name, entry.negative])).toEqual([['Masa de maíz', true]]);
  });
});

describe('ajuste (RF-5, CA-29)', () => {
  it('la salida sale al CPP; «otro» exige nota; una entrada sin CPP exige costo y con CPP lo rechaza (DT-T3-7)', async () => {
    const { inventory, abarrotes, masa, stockOf, purchase, adjust, store } = await kardexSetup();
    await purchase(masa.id, '10', '200.00');
    const out = await adjust(masa.id, 'salida', '2');
    expect([q3(stockOf(masa.id)?.quantity), c4(lastMovement(store, out)?.unitCost), c4(stockOf(masa.id)?.avgCost)]).toEqual(['8.000', '20.0000', '20.0000']);
    expect(await fieldsOf(adjust(masa.id, 'salida', '1', { reason: 'otro' }))).toHaveProperty('note');
    await expect(adjust(masa.id, 'salida', '1', { reason: 'otro', note: 'Se cayó un costal' })).resolves.toMatchObject({ replayed: false });
    expect(await fieldsOf(adjust(masa.id, 'entrada', '1', {}, { unitCost: '30' }))).toEqual({ 'lines.0.unitCost': 'El artículo ya tiene CPP: deja el costo vacío; entra a su CPP.' });
    await adjust(masa.id, 'entrada', '1');
    expect(c4(stockOf(masa.id)?.avgCost)).toBe('20.0000');

    const sal = await inventory.createItem({ type: 'insumo', categoryId: abarrotes.id, name: 'Sal', baseUnit: 'kg' }, ANA);
    expect(await fieldsOf(adjust(sal.id, 'entrada', '1'))).toEqual({ 'lines.0.unitCost': 'El artículo no tiene CPP: escribe el costo unitario de la entrada.' });
    await adjust(sal.id, 'entrada', '2', {}, { unitCost: '12.5' });
    expect([q3(stockOf(sal.id)?.quantity), c4(stockOf(sal.id)?.avgCost), stockOf(sal.id)?.lastCost]).toEqual(['2.000', '12.5000', null]);
    expect(await fieldsOf(adjust(sal.id, 'salida', '1', { reason: 'robo' }))).toHaveProperty('reason');
  });
});

describe('devolución a proveedor (RF-6, CA-30) y DT-T3-3', () => {
  it('sale al costo de la compra, no pasa de lo pendiente, y la compra no se revierte con devoluciones vigentes', async () => {
    const { store, kardex, masa, stockOf, purchase } = await kardexSetup();
    await purchase(masa.id, '50', '1000.00');
    const bought = await purchase(masa.id, '25', '600.00');
    const line = lastMovement(store, bought);
    const back = (quantity: string) => kardex.createSupplierReturn(bought.document.id, { occurredOn: TODAY, lines: [{ sourceMovementId: line?.id, quantity }] }, ANA);
    const returned = await back('5');
    expect([c4(lastMovement(store, returned)?.unitCost), q3(stockOf(masa.id)?.quantity), c4(stockOf(masa.id)?.avgCost), c4(stockOf(masa.id)?.lastCost)]).toEqual(['24.0000', '70.000', '21.1428', '24.0000']);
    expect(returned.document).toMatchObject({ type: 'devolucion_proveedor', sourceDocumentId: bought.document.id });
    expect((await kardex.getDocument(bought.document.id)).lines.map((l) => q3(l.returnable))).toEqual(['20.000']);
    expect(await fieldsOf(back('20.001'))).toEqual({ 'lines.0.quantity': 'Es más de lo que queda por devolver de esta línea.' });

    const blocked: unknown = await kardex.reverseDocument(bought.document.id, { reason: 'error' }, ANA).catch((err: unknown) => err);
    expect(blocked).toBeInstanceOf(DocumentHasReturnsError);
    expect((blocked as DocumentHasReturnsError).returnIds).toEqual([returned.document.id]);

    await kardex.reverseDocument(returned.document.id, { reason: 'La devolución no salió' }, ANA);
    expect((await kardex.getDocument(bought.document.id)).lines.map((l) => q3(l.returnable))).toEqual(['25.000']);
    await kardex.reverseDocument(bought.document.id, { reason: 'Factura de otro negocio' }, ANA);
    expect([q3(stockOf(masa.id)?.quantity), c4(stockOf(masa.id)?.avgCost), c4(stockOf(masa.id)?.lastCost)]).toEqual(['50.000', '20.0000', '20.0000']);
  });
});

describe('artículos, proveedores, unidades y fecha (CA-9 a CA-11)', () => {
  it('CA-9: un Compuesto, un padre, un no inventariable o un inactivo se rechazan en su línea y no se escribe nada; un proveedor inactivo, tampoco', async () => {
    const { store, inventory, abarrotes, kardex, suppliers, masa } = await kardexSetup();
    const taco = await inventory.createItem({ type: 'compuesto', categoryId: abarrotes.id, name: 'Taco', baseUnit: 'pza' }, ANA);
    const padre = await inventory.createItem({ kind: 'parent', type: 'reventa', categoryId: abarrotes.id, name: 'Refresco 600 ml' }, ANA);
    const mano = await inventory.createItem({ type: 'insumo', categoryId: abarrotes.id, name: 'Mano de obra', baseUnit: 'hr', inventoriable: false }, ANA);
    const viejo = await inventory.createItem({ type: 'insumo', categoryId: abarrotes.id, name: 'Harina vieja', baseUnit: 'kg' }, ANA);
    await inventory.deactivateItem(viejo.id, { version: 1 }, ANA);
    const fields = await fieldsOf(
      kardex.createPurchase(
        {
          occurredOn: TODAY,
          lines: [
            { itemId: masa.id, quantity: '1', unit: 'kg', amount: '20' },
            { itemId: taco.id, quantity: '1', unit: 'pza', amount: '20' },
            { itemId: padre.id, quantity: '1', unit: 'pza', amount: '20' },
            { itemId: mano.id, quantity: '1', unit: 'hr', amount: '20' },
            { itemId: viejo.id, quantity: '1', unit: 'kg', amount: '20' },
          ],
        },
        ANA,
      ),
    );
    expect(Object.keys(fields).sort()).toEqual(['lines.1.item', 'lines.2.item', 'lines.3.item', 'lines.4.item']);
    expect(store.state.documents).toHaveLength(0);
    expect(store.state.stock.get(masa.id)?.lastSeq).toBe(0);

    const proveedor = await suppliers.createSupplier({ name: 'Molino ficticio' }, ANA);
    await suppliers.deactivateSupplier(proveedor.id, { version: 1 }, ANA);
    expect(await fieldsOf(kardex.createPurchase({ occurredOn: TODAY, supplierId: proveedor.id, lines: [{ itemId: masa.id, quantity: '1', unit: 'kg', amount: '20' }] }, ANA))).toHaveProperty('supplierId');
  });

  it('CA-10: sin factor de conversión o con una cantidad que redondea a 0 en la unidad base, error en la línea', async () => {
    const { masa, purchase } = await kardexSetup();
    expect(await fieldsOf(purchase(masa.id, '1', '20', 'pza'))).toHaveProperty(['lines.0.unit']);
    expect(await fieldsOf(purchase(masa.id, '0.4', '20', 'g'))).toHaveProperty(['lines.0.quantity']);
  });

  it('CA-11: hoy y hoy − 31 días se aceptan; mañana y hoy − 32, no; «hoy» es el día local de BUSINESS_TIMEZONE', async () => {
    const { masa, purchase } = await kardexSetup();
    await expect(purchase(masa.id, '1', '20', 'kg', { occurredOn: '2026-10-25' })).resolves.toMatchObject({ replayed: false });
    expect(await fieldsOf(purchase(masa.id, '1', '20', 'kg', { occurredOn: '2026-11-26' }))).toEqual({ occurredOn: 'La fecha no puede ser futura.' });
    expect(await fieldsOf(purchase(masa.id, '1', '20', 'kg', { occurredOn: '2026-10-24' }))).toHaveProperty('occurredOn');
    expect(await fieldsOf(purchase(masa.id, '1', '20', 'kg', { occurredOn: '2026-02-30' }))).toHaveProperty('occurredOn');

    // 23:30 y 00:30 locales (UTC−6) dan el día local, sin importar la zona del servidor.
    expect(businessDate(new Date('2026-11-26T05:30:00.000Z'), TZ)).toBe('2026-11-25');
    expect(businessDate(new Date('2026-11-26T06:30:00.000Z'), TZ)).toBe('2026-11-26');
    const lateNight = await kardexSetup(() => new Date('2026-11-26T05:30:00.000Z'));
    expect(await fieldsOf(lateNight.purchase(lateNight.masa.id, '1', '20', 'kg', { occurredOn: '2026-11-26' }))).toEqual({ occurredOn: 'La fecha no puede ser futura.' });
  });
});

describe('doble envío (CA-12, DT-14)', () => {
  it('el mismo envío crea un solo documento; la misma clave con otros datos se rechaza', async () => {
    const { store, kardex, masa } = await kardexSetup();
    const input = { occurredOn: TODAY, lines: [{ itemId: masa.id, quantity: '10', unit: 'kg', amount: '200.00' }] };
    const first = await kardex.createPurchase(input, ANA, { requestId: 'envio-0001' });
    const again = await kardex.createPurchase(structuredClone(input), ANA, { requestId: 'envio-0001' });
    expect([first.replayed, again.replayed, again.document.id]).toEqual([false, true, first.document.id]);
    expect(store.state.documents).toHaveLength(1);
    await expect(kardex.createPurchase({ ...input, note: 'otra' }, ANA, { requestId: 'envio-0001' })).rejects.toBeInstanceOf(IdempotencyKeyReusedError);
    await expect(kardex.createPurchase(input, ANA, { requestId: 'x' })).rejects.toBeInstanceOf(InventoryValidationError);
  });
});

describe('existencias valorizadas, Kardex del artículo y costo real (RF-7, RF-8, RF-10)', () => {
  it('CA-16: columnas y totales; sin Compuestos, padres ni no inventariables; un inactivo solo con existencia (DT-T3-5); totales con valores redondeados (DT-T3-8)', async () => {
    const { inventory, abarrotes, kardex, masa, purchase, adjust } = await kardexSetup();
    await inventory.createItem({ type: 'compuesto', categoryId: abarrotes.id, name: 'Taco', baseUnit: 'pza' }, ANA);
    await inventory.createItem({ type: 'insumo', categoryId: abarrotes.id, name: 'Mano de obra', baseUnit: 'hr', inventoriable: false }, ANA);
    const sal = await inventory.createItem({ type: 'insumo', categoryId: abarrotes.id, name: 'Sal', baseUnit: 'kg' }, ANA);
    const queso = await inventory.createItem({ type: 'insumo', categoryId: abarrotes.id, name: 'Queso', baseUnit: 'kg' }, ANA);
    const cebolla = await inventory.createItem({ type: 'insumo', categoryId: abarrotes.id, name: 'Cebolla', baseUnit: 'kg' }, ANA);
    await purchase(masa.id, '50', '1000.00');
    await purchase(queso.id, '3', '10.00');
    await purchase(sal.id, '1', '12.00');
    await adjust(sal.id, 'salida', '3');
    await purchase(cebolla.id, '1', '28.00');
    await inventory.deactivateItem(cebolla.id, { version: 1 }, ANA);
    const viejo = await inventory.createItem({ type: 'insumo', categoryId: abarrotes.id, name: 'Viejo', baseUnit: 'kg' }, ANA);
    await inventory.deactivateItem(viejo.id, { version: 1 }, ANA);
    await inventory.createItem({ type: 'insumo', categoryId: abarrotes.id, name: 'Azúcar', baseUnit: 'kg' }, ANA);

    const page = await kardex.listStock();
    expect(page.entries.map((e) => [e.item.name, q3(e.quantity), c4(e.avgCost), e.value === null ? null : formatDecimal(e.value, 2), e.negative, e.noCost])).toEqual([
      ['Azúcar', '0.000', null, null, false, true],
      ['Cebolla', '1.000', '28.0000', '28.00', false, false],
      ['Masa de maíz', '50.000', '20.0000', '1000.00', false, false],
      ['Queso', '3.000', '3.3333', '10.00', false, false],
      ['Sal', '-2.000', '12.0000', '-24.00', true, false],
    ]);
    expect([formatDecimal(page.totals.positiveValue, 2), formatDecimal(page.totals.negativeValue, 2), page.totals.noCostCount]).toEqual(['1038.00', '-24.00', 1]);
    expect((await kardex.listStock({ status: 'no_cost' })).entries.map((e) => e.item.name)).toEqual(['Azúcar']);
    expect((await kardex.listStock({ q: 'AZUCAR' })).entries.map((e) => e.item.name)).toEqual(['Azúcar']);
    await expect(kardex.listStock({ type: 'compuesto' })).rejects.toBeInstanceOf(InventoryValidationError);
  });

  it('CA-17: el Kardex del artículo va del más reciente al más antiguo, con el documento de cada movimiento', async () => {
    const { kardex, masa, purchase, adjust } = await kardexSetup();
    const bought = await purchase(masa.id, '10', '200.00');
    const out = await adjust(masa.id, 'salida', '1');
    const view = await kardex.itemKardex(masa.id);
    expect(view.movements.map((m) => [m.seq, m.type, m.documentId, q3(m.quantity), q3(m.balanceAfter), c4(m.avgCostAfter), m.actorName])).toEqual([
      [2, 'ajuste', out.document.id, '-1.000', '9.000', '20.0000', 'Ana Gerente'],
      [1, 'compra', bought.document.id, '10.000', '10.000', '20.0000', 'Ana Gerente'],
    ]);
    expect(view.page).toEqual({ number: 1, size: 50, total: 2 });
  });

  it('CA-18: el ingrediente se costea por su CPP (no por la referencia) y la receta cambia de costo sin versión nueva; la ficha muestra CPP y último costo', async () => {
    const { store, inventory, abarrotes, purchase } = await kardexSetup();
    const recipes = createRecipeRepository({ store, now: () => NOW });
    const carne = await inventory.createItem({ type: 'insumo', categoryId: abarrotes.id, name: 'Carne', baseUnit: 'kg', referenceCost: '30' }, ANA);
    const taco = await inventory.createItem({ type: 'compuesto', categoryId: abarrotes.id, name: 'Taco', baseUnit: 'pza' }, ANA);
    await recipes.saveVersion(taco.id, { baseVersionId: null, yieldQuantity: '1', lines: [{ ingredientId: carne.id, quantity: '0.5', unit: 'kg', wastePercent: '0' }] }, ANA);
    const before = await recipes.getRecipe(taco.id);
    expect(before.current?.cost.lines.map((l) => [c4(l.cost), l.source])).toEqual([['15.0000', 'referencia']]);

    await purchase(carne.id, '10', '200.00');
    const after = await recipes.getRecipe(taco.id);
    expect(after.current?.cost.lines.map((l) => [c4(l.cost), l.source])).toEqual([['10.0000', 'cpp']]);
    expect(after.versions).toHaveLength(1);
    const ficha = await inventory.getItem(carne.id);
    expect([c4(ficha.stock?.avgCost), c4(ficha.stock?.lastCost)]).toEqual(['20.0000', '20.0000']);
  });
});

describe('verificación de la cadena (RF-13, CA-15)', () => {
  it('una cadena registrada cuadra; un movimiento o una existencia alterados se detectan sin valores', async () => {
    const { store, kardex, masa, purchase, adjust } = await kardexSetup();
    const bought = await purchase(masa.id, '50', '1000.00');
    await purchase(masa.id, '25', '600.00');
    await adjust(masa.id, 'salida', '80');
    await kardex.reverseDocument(bought.document.id, { reason: 'prueba' }, ANA);
    const reader = { movementsAfter: (id: number, seq: number, limit: number) => store.read((r) => r.movementsAfter(id, seq, limit)), allStock: () => store.read((r) => r.allStock()) };
    expect(await verifyKardex(reader, 2)).toMatchObject({ movements: 4, issues: [] });

    const second = store.state.movements[1];
    if (!second) throw new Error('falta el movimiento');
    second.balanceAfter += 1n;
    const stock = store.state.stock.get(masa.id);
    if (!stock) throw new Error('falta la existencia');
    stock.avgCost = 1n;
    const report = await verifyKardex(reader);
    expect(report.issues).toEqual([
      { itemId: masa.id, check: VERIFY_CHECKS.BALANCE_SUM, seq: 2 },
      { itemId: masa.id, check: VERIFY_CHECKS.BALANCE_CHAIN, seq: 3 },
      { itemId: masa.id, check: VERIFY_CHECKS.STOCK_MISMATCH, seq: null },
    ]);
    expect(JSON.stringify(report)).not.toMatch(/Masa|1000|20\.0/);
  });
});
