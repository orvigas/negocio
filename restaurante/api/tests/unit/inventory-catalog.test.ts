import { describe, expect, it } from 'vitest';

import {
  CategoryInUseError,
  CategoryInactiveError,
  INVENTORY_ACTIONS,
  InventoryConflictError,
  InventoryValidationError,
  ItemHasActiveVariantsError,
  ItemLockedError,
  ItemNameTakenError,
  ParentInactiveError,
  createInventoryRepository,
  createMemoryInventoryStore,
  formatDecimal,
  type CreateItemInput,
} from '@restaurante/core/inventory';

/** Reglas del catálogo de inventario (REQ-F-049, T1) sobre el store en memoria. */

const ANA = { id: 7, name: 'Ana Gerente' };
const LUIS = { id: 8, name: 'Luis Admin' };
const NOW = new Date('2026-11-18T18:00:00.000Z');

async function setup() {
  const store = createMemoryInventoryStore();
  const inventory = createInventoryRepository({ store, now: () => NOW });
  const abarrotes = await inventory.createCategory({ name: 'Abarrotes' }, ANA);
  const bebidas = await inventory.createCategory({ name: 'Bebidas' }, ANA);
  const insumo = (name: string, extra: Partial<CreateItemInput> = {}) =>
    inventory.createItem({ type: 'insumo', categoryId: abarrotes.id, name, baseUnit: 'kg', ...extra }, ANA);
  return { store, inventory, abarrotes, bebidas, insumo };
}

/** Errores por campo de una promesa que debe rechazarse con InventoryValidationError. */
async function fieldsOf(promise: Promise<unknown>): Promise<Record<string, string>> {
  const error: unknown = await promise.then(
    () => null,
    (err: unknown) => err,
  );
  expect(error).toBeInstanceOf(InventoryValidationError);
  return (error as InventoryValidationError).fields;
}

describe('alta (RF-2, CA-1)', () => {
  it('crea un insumo activo con su historial de alta y el nombre del autor', async () => {
    const { inventory, insumo } = await setup();
    const masa = await insumo('  Masa de maíz  ', { units: [{ name: 'bulto', factor: '25' }], sku: 'MAS-01', description: '  Para molotes \r\n y tortillas ' });
    expect(masa).toMatchObject({ name: 'Masa de maíz', description: 'Para molotes \n y tortillas', sku: 'MAS-01', baseUnit: 'kg', active: true, version: 1, kind: 'simple' });
    expect(masa.units).toEqual([{ name: 'bulto', factor: 25_000n }]);

    const list = await inventory.listItems();
    expect(list.items.map((item) => [item.name, item.categoryName])).toEqual([['Masa de maíz', 'Abarrotes']]);

    const { history } = await inventory.getItem(masa.id);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ action: INVENTORY_ACTIONS.CREATE, actorId: 7, actorName: 'Ana Gerente', at: NOW });
    expect(history[0]?.changes).toContainEqual({ field: 'units', before: null, after: [{ name: 'bulto', factor: '25.000' }] });
  });

  it('rechaza por campo el nombre vacío, los obligatorios que faltan y los empaques inválidos (CA-6)', async () => {
    const { inventory, abarrotes } = await setup();
    expect(await fieldsOf(inventory.createItem({ name: '   ' }, ANA))).toEqual({
      name: 'Escribe el nombre.',
      type: 'Elige el tipo de artículo.',
      categoryId: 'Elige la categoría.',
      baseUnit: 'Elige la unidad base (kg, g, L, ml, pza).',
    });
    const units = [
      { name: 'caja', factor: '0' },
      { name: 'paquete', factor: '-3' },
      { name: 'Caja', factor: 'doce' },
      { name: 'KG', factor: '1.5' },
      { name: 'bolsa', factor: '1.2345' },
    ];
    expect(await fieldsOf(inventory.createItem({ type: 'insumo', categoryId: abarrotes.id, name: 'Sal', baseUnit: 'kg', units }, ANA))).toEqual({
      'units.0.factor': 'El factor debe ser mayor que 0.',
      'units.1.factor': 'Escribe un número sin signo, con punto decimal (p. ej. 24 o 0.355).',
      'units.2.name': 'Ya hay un empaque con ese nombre en el artículo.',
      'units.2.factor': 'Escribe un número sin signo, con punto decimal (p. ej. 24 o 0.355).',
      'units.3.name': 'No puede llamarse como una unidad del sistema (kg, g, L, ml, pza).',
      'units.4.factor': 'Máximo 3 decimales.',
    });
  });

  it('no asigna una categoría inactiva ni una que no existe', async () => {
    const { inventory, bebidas, insumo } = await setup();
    await inventory.deactivateCategory(bebidas.id, ANA);
    await expect(insumo('Sal', { categoryId: bebidas.id })).rejects.toBeInstanceOf(CategoryInactiveError);
    expect(await fieldsOf(insumo('Sal', { categoryId: 999 }))).toEqual({ categoryId: 'La categoría no existe.' });
  });
});

describe('nombre único entre los activos (CA-2)', () => {
  it('sin distinguir mayúsculas; con el otro inactivo se acepta; reactivarlo con el nombre ocupado se rechaza', async () => {
    const { inventory, insumo } = await setup();
    const sal = await insumo('Sal');
    expect(await fieldsOf(insumo('sal'))).toEqual({ name: 'Ya hay un artículo activo con ese nombre.' });
    // Los acentos sí distinguen.
    await expect(insumo('Sál')).resolves.toMatchObject({ name: 'Sál' });

    await inventory.deactivateItem(sal.id, { version: 1 }, ANA);
    const nueva = await insumo('SAL');
    expect(nueva.active).toBe(true);
    await expect(inventory.reactivateItem(sal.id, { version: 2 }, ANA)).rejects.toBeInstanceOf(ItemNameTakenError);

    await inventory.deactivateItem(nueva.id, { version: 1 }, ANA);
    await expect(inventory.reactivateItem(sal.id, { version: 2 }, ANA)).resolves.toMatchObject({ active: true, version: 3 });
  });

  it('renombrar a un nombre ocupado se rechaza; el propio nombre con otras mayúsculas vale', async () => {
    const { inventory, insumo } = await setup();
    await insumo('Sal');
    const azucar = await insumo('Azúcar');
    expect(await fieldsOf(inventory.updateItem(azucar.id, { version: 1, categoryId: azucar.categoryId, name: 'SAL', baseUnit: 'kg' }, ANA))).toEqual({
      name: 'Ya hay un artículo activo con ese nombre.',
    });
    await expect(inventory.updateItem(azucar.id, { version: 1, categoryId: azucar.categoryId, name: 'AZÚCAR', baseUnit: 'kg' }, ANA)).resolves.toMatchObject({ name: 'AZÚCAR' });
  });
});

describe('SKU (PV-14, DT-3, CA-3)', () => {
  it('no se repite entre activos e inactivos, sin distinguir mayúsculas', async () => {
    const { inventory, insumo } = await setup();
    const sal = await insumo('Sal', { sku: 'abc-1' });
    await inventory.deactivateItem(sal.id, { version: 1 }, ANA);
    expect(await fieldsOf(insumo('Azúcar', { sku: 'ABC-1' }))).toEqual({ sku: 'Ese SKU ya se usó en otro artículo.' });
    expect(await fieldsOf(insumo('Arroz', { sku: 'con espacio' }))).toEqual({ sku: 'Usa solo letras sin acento, dígitos, punto, guion y guion bajo.' });
  });

  it('un SKU liberado por un cambio no se reutiliza en otro artículo; el propio artículo puede volver a él', async () => {
    const { inventory, insumo } = await setup();
    const sal = await insumo('Sal', { sku: 'X-1' });
    const edit = (version: number, sku: string | null) => inventory.updateItem(sal.id, { version, categoryId: sal.categoryId, name: 'Sal', baseUnit: 'kg', sku }, ANA);
    await edit(1, 'X-2');
    expect(await fieldsOf(insumo('Azúcar', { sku: 'x-1' }))).toEqual({ sku: 'Ese SKU ya se usó en otro artículo.' });
    await expect(edit(2, null)).resolves.toMatchObject({ sku: null });
    await expect(edit(3, 'X-1')).resolves.toMatchObject({ sku: 'X-1' });
    expect(await fieldsOf(insumo('Arroz', { sku: 'X-2' }))).toEqual({ sku: 'Ese SKU ya se usó en otro artículo.' });
  });
});

describe('edición, conflicto y reglas inmutables', () => {
  it('CA-9: la segunda edición con la misma versión recibe el conflicto con los datos vigentes; "guardar encima" queda registrado', async () => {
    const { inventory, insumo } = await setup();
    const sal = await insumo('Sal');
    const body = (name: string, version: number) => ({ version, categoryId: sal.categoryId, name, baseUnit: 'kg' });
    await inventory.updateItem(sal.id, body('Sal de mar', 1), LUIS);
    const conflict: unknown = await inventory.updateItem(sal.id, body('Sal fina', 1), ANA).catch((err: unknown) => err);
    expect(conflict).toBeInstanceOf(InventoryConflictError);
    expect((conflict as InventoryConflictError).current).toEqual({ id: sal.id, version: 2, updatedAt: NOW, updatedBy: 'Luis Admin' });
    expect((await inventory.getItem(sal.id)).item.name).toBe('Sal de mar');

    await inventory.updateItem(sal.id, { ...body('Sal fina', 2), overwrite: true }, ANA);
    const { item, history } = await inventory.getItem(sal.id);
    expect(item).toMatchObject({ name: 'Sal fina', version: 3, updatedByName: 'Ana Gerente' });
    expect(history.map((entry) => entry.action)).toEqual([INVENTORY_ACTIONS.OVERWRITE_AFTER_CONFLICT, INVENTORY_ACTIONS.UPDATE, INVENTORY_ACTIONS.CREATE]);
    expect(history[0]?.changes).toEqual([{ field: 'name', before: 'Sal de mar', after: 'Sal fina' }]);
  });

  it('el tipo no se cambia después de crearlo', async () => {
    const { inventory, insumo } = await setup();
    const sal = await insumo('Sal');
    expect(await fieldsOf(inventory.updateItem(sal.id, { version: 1, type: 'reventa', categoryId: sal.categoryId, name: 'Sal', baseUnit: 'kg' }, ANA))).toEqual({
      type: 'El tipo no se cambia después de crear el artículo.',
    });
  });

  it('RN-4: con el artículo en uso, la unidad base y los empaques no cambian, el resto sí', async () => {
    const { store, inventory, insumo } = await setup();
    const masa = await insumo('Masa', { units: [{ name: 'bulto', factor: '25' }] });
    store.markInUse(masa.id);
    const body = { version: 1, categoryId: masa.categoryId, name: 'Masa de maíz', baseUnit: 'kg', units: [{ name: 'bulto', factor: '25.000' }] };
    await expect(inventory.updateItem(masa.id, { ...body, baseUnit: 'g' }, ANA)).rejects.toBeInstanceOf(ItemLockedError);
    await expect(inventory.updateItem(masa.id, { ...body, units: [{ name: 'bulto', factor: '20' }] }, ANA)).rejects.toBeInstanceOf(ItemLockedError);
    await expect(inventory.updateItem(masa.id, body, ANA)).resolves.toMatchObject({ name: 'Masa de maíz', version: 2 });
    expect((await inventory.getItem(masa.id)).locked).toBe(true);
  });
});

describe('padres y variantes (RF-5, CA-7)', () => {
  async function refrescos() {
    const context = await setup();
    const { inventory, bebidas } = context;
    const padre = await inventory.createItem({ kind: 'parent', type: 'reventa', categoryId: bebidas.id, name: 'Refresco 600 ml' }, ANA);
    const variante = (name: string, sku: string) =>
      inventory.createItem({ kind: 'variant', parentId: padre.id, name, sku, baseUnit: 'pza', units: [{ name: 'caja', factor: '24' }] }, ANA);
    const coca = await variante('Coca-Cola', 'COCA-600');
    const mundet = await variante('Mundet', 'MUNDET-600');
    return { ...context, padre, coca, mundet };
  }

  it('el padre agrupa sin unidad ni existencias; cada variante tiene SKU, unidad base y estado propios y hereda tipo y categoría', async () => {
    const { inventory, padre, coca, bebidas } = await refrescos();
    const detail = await inventory.getItem(padre.id);
    expect(detail.item).toMatchObject({ kind: 'parent', baseUnit: null, sku: null, units: [] });
    expect(detail.equivalences).toEqual([]);
    expect(detail.variants.map((item) => [item.name, item.sku, item.baseUnit, item.active, item.type, item.categoryId])).toEqual([
      ['Coca-Cola', 'COCA-600', 'pza', true, 'reventa', bebidas.id],
      ['Mundet', 'MUNDET-600', 'pza', true, 'reventa', bebidas.id],
    ]);
    const ficha = await inventory.getItem(coca.id);
    expect(ficha.parent?.id).toBe(padre.id);
    expect(ficha.equivalences.map(({ unit, quantity }) => [unit, formatDecimal(quantity)])).toEqual([['caja', '24.000']]);
    expect((await inventory.listItems()).items.find((item) => item.id === padre.id)?.variantCount).toBe(2);
  });

  it('un padre solo es de Reventa o Compuesto y no lleva unidad, SKU ni empaques; una variante no elige tipo ni categoría', async () => {
    const { inventory, abarrotes, padre } = await refrescos();
    expect(
      await fieldsOf(inventory.createItem({ kind: 'parent', type: 'insumo', categoryId: abarrotes.id, name: 'Chiles', baseUnit: 'kg', sku: 'CH', units: [{ name: 'caja', factor: '2' }] }, ANA)),
    ).toEqual({
      type: 'Un artículo padre solo puede ser de Reventa o Compuesto.',
      baseUnit: 'Un artículo padre no lleva unidad base: va en cada variante.',
      sku: 'Un artículo padre no lleva SKU: va en cada variante.',
      units: 'Un artículo padre no lleva empaques: van en cada variante.',
    });
    expect(await fieldsOf(inventory.createItem({ kind: 'variant', parentId: padre.id, type: 'insumo', categoryId: abarrotes.id, name: 'Sidral', baseUnit: 'pza' }, ANA))).toEqual({
      type: 'La variante hereda el tipo del padre.',
      categoryId: 'La variante hereda la categoría del padre.',
    });
  });

  it('inactivar el padre exige confirmar si tiene variantes activas; reactivar el padre no reactiva variantes', async () => {
    const { inventory, padre, coca, mundet } = await refrescos();
    await inventory.deactivateItem(mundet.id, { version: 1 }, ANA);
    const error: unknown = await inventory.deactivateItem(padre.id, { version: 1 }, ANA).catch((err: unknown) => err);
    expect(error).toBeInstanceOf(ItemHasActiveVariantsError);
    expect((error as ItemHasActiveVariantsError).count).toBe(1);

    await inventory.deactivateItem(padre.id, { version: 1, variants: 'deactivate' }, LUIS);
    expect((await inventory.getItem(coca.id)).item).toMatchObject({ active: false, version: 2 });
    expect((await inventory.getItem(coca.id)).history[0]).toMatchObject({ action: INVENTORY_ACTIONS.DEACTIVATE, actorName: 'Luis Admin' });

    // Con el padre inactivo no se crea ni se reactiva una variante.
    await expect(inventory.createItem({ kind: 'variant', parentId: padre.id, name: 'Sidral', baseUnit: 'pza' }, ANA)).rejects.toBeInstanceOf(ParentInactiveError);
    await expect(inventory.reactivateItem(coca.id, { version: 2 }, ANA)).rejects.toBeInstanceOf(ParentInactiveError);

    await inventory.reactivateItem(padre.id, { version: 2 }, ANA);
    expect((await inventory.getItem(padre.id)).variants.map((item) => item.active)).toEqual([false, false]);
  });

  it('cambiar la categoría del padre la cambia en sus variantes, con una entrada "inherit" en cada una', async () => {
    const { inventory, padre, coca, abarrotes } = await refrescos();
    await inventory.updateItem(padre.id, { version: 1, categoryId: abarrotes.id, name: 'Refresco 600 ml' }, ANA);
    const ficha = await inventory.getItem(coca.id);
    expect(ficha.item).toMatchObject({ categoryId: abarrotes.id, version: 2 });
    expect(ficha.history[0]).toMatchObject({ action: INVENTORY_ACTIONS.INHERIT, changes: [{ field: 'categoryId', before: padre.categoryId, after: abarrotes.id }] });
    expect(await fieldsOf(inventory.updateItem(coca.id, { version: 2, categoryId: padre.categoryId, name: 'Coca-Cola', baseUnit: 'pza' }, ANA))).toEqual({
      categoryId: 'La variante hereda la categoría del padre.',
    });
  });
});

describe('lista (RF-1, CA-8)', () => {
  it('por defecto solo activos; filtra por inactivos, todos, tipo, categoría y texto en el nombre o el SKU', async () => {
    const { inventory, insumo, bebidas } = await setup();
    const sal = await insumo('Sal de mar', { sku: 'SAL-9' });
    await insumo('Azúcar');
    await inventory.createItem({ type: 'reventa', categoryId: bebidas.id, name: 'Agua natural', baseUnit: 'pza' }, ANA);
    await inventory.deactivateItem(sal.id, { version: 1 }, ANA);

    const names = async (filter: Parameters<typeof inventory.listItems>[0]) => (await inventory.listItems(filter)).items.map((item) => item.name);
    expect(await names({})).toEqual(['Agua natural', 'Azúcar']);
    expect(await names({ status: 'inactive' })).toEqual(['Sal de mar']);
    expect(await names({ status: 'all' })).toEqual(['Agua natural', 'Azúcar', 'Sal de mar']);
    expect(await names({ type: 'reventa' })).toEqual(['Agua natural']);
    expect(await names({ categoryId: bebidas.id })).toEqual(['Agua natural']);
    expect(await names({ status: 'all', q: 'DE MAR' })).toEqual(['Sal de mar']);
    expect(await names({ status: 'all', q: 'sal-9' })).toEqual(['Sal de mar']);
    expect(await names({ q: 'no existe' })).toEqual([]);

    await inventory.reactivateItem(sal.id, { version: 2 }, ANA);
    expect(await names({})).toEqual(['Agua natural', 'Azúcar', 'Sal de mar']);
  });

  it('rechaza filtros fuera de la lista cerrada', async () => {
    const { inventory } = await setup();
    expect(await fieldsOf(inventory.listItems({ status: 'borrados', type: 'otro', categoryId: 'x', page: '0', q: 'a'.repeat(81) }))).toEqual({
      status: 'Elige activos, inactivos o todos.',
      type: 'Elige un tipo de la lista.',
      categoryId: 'Elige una categoría de la lista.',
      q: 'Máximo 80 caracteres.',
      page: 'La página debe ser un entero positivo.',
    });
  });
});

describe('categorías (RF-6, CA-13)', () => {
  it('no se inactiva con artículos activos e indica cuántos; sin ellos, sí', async () => {
    const { inventory, abarrotes, insumo } = await setup();
    const sal = await insumo('Sal');
    await insumo('Azúcar');
    const error: unknown = await inventory.deactivateCategory(abarrotes.id, ANA).catch((err: unknown) => err);
    expect(error).toBeInstanceOf(CategoryInUseError);
    expect((error as CategoryInUseError).message).toBe('La usan 2 artículos activos.');
    expect((await inventory.listCategories()).find((category) => category.id === abarrotes.id)?.activeItemCount).toBe(2);

    for (const item of (await inventory.listItems()).items) await inventory.deactivateItem(item.id, { version: item.version }, ANA);
    await expect(inventory.deactivateCategory(abarrotes.id, ANA)).resolves.toMatchObject({ active: false });
    // Reactivar un artículo con su categoría inactiva se rechaza.
    await expect(inventory.reactivateItem(sal.id, { version: 2 }, ANA)).rejects.toBeInstanceOf(CategoryInactiveError);
  });

  it('nombre único entre las activas sin distinguir mayúsculas; se renombra con historial', async () => {
    const { inventory, abarrotes } = await setup();
    expect(await fieldsOf(inventory.createCategory({ name: ' BEBIDAS ' }, ANA))).toEqual({ name: 'Ya hay una categoría activa con ese nombre.' });
    await expect(inventory.renameCategory(abarrotes.id, { name: 'Abarrotes secos' }, LUIS)).resolves.toMatchObject({ name: 'Abarrotes secos' });
    expect(await fieldsOf(inventory.renameCategory(abarrotes.id, { name: 'bebidas' }, LUIS))).toEqual({ name: 'Ya hay una categoría activa con ese nombre.' });
  });
});
