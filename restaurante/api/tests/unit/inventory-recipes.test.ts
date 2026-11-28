import { describe, expect, it } from 'vitest';

import {
  InventoryValidationError,
  ItemInActiveRecipesError,
  ItemLockedError,
  RecipeCycleError,
  RecipeItemInactiveError,
  RecipeNotAllowedError,
  RecipeTooDeepError,
  RecipeVersionConflictError,
  createInventoryRepository,
  createMemoryInventoryStore,
  createRecipeRepository,
  formatDecimal,
  type CreateItemInput,
  type InventoryItem,
  type RecipeLineInput,
} from '@restaurante/core/inventory';

/** Recetas multinivel, versiones y costo teórico (REQ-F-050, T2) sobre el store en memoria. Datos ficticios. */

const ANA = { id: 7, name: 'Ana Gerente' };
let clock = new Date('2026-11-19T18:00:00.000Z');

async function setup() {
  clock = new Date('2026-11-19T18:00:00.000Z');
  const store = createMemoryInventoryStore();
  const now = () => clock;
  const inventory = createInventoryRepository({ store, now });
  const recipes = createRecipeRepository({ store, now });
  const abarrotes = await inventory.createCategory({ name: 'Abarrotes' }, ANA);
  const item = (name: string, type: string, extra: Partial<CreateItemInput> = {}) =>
    inventory.createItem({ type, categoryId: abarrotes.id, name, baseUnit: 'kg', ...extra }, ANA);
  /** Guarda una versión partiendo de la vigente. */
  const save = async (target: InventoryItem, yieldQuantity: string, lines: RecipeLineInput[], extra: Record<string, unknown> = {}) => {
    const { current } = await recipes.getRecipe(target.id);
    return recipes.saveVersion(target.id, { baseVersionId: current?.version.id ?? null, yieldQuantity, lines, ...extra }, ANA);
  };
  const line = (ingredient: InventoryItem, quantity: string, unit = 'kg', wastePercent = '0'): RecipeLineInput => ({ ingredientId: ingredient.id, quantity, unit, wastePercent });
  const unitCostOf = async (target: InventoryItem) => {
    const { current } = await recipes.getRecipe(target.id);
    const cost = current?.cost.unitCost;
    return cost === null || cost === undefined ? null : formatDecimal(cost, 4);
  };
  return { store, inventory, recipes, abarrotes, item, save, line, unitCostOf };
}

async function fieldsOf(promise: Promise<unknown>): Promise<Record<string, string>> {
  const error: unknown = await promise.then(
    () => null,
    (err: unknown) => err,
  );
  expect(error).toBeInstanceOf(InventoryValidationError);
  return (error as InventoryValidationError).fields;
}

async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => null,
    (err: unknown) => err,
  );
}

describe('costo teórico (RF-6, RN-T2-4)', () => {
  it('CA-1: rendimiento de 2 kg y líneas que suman 100: 50.0000 por kg, con el origen de cada costo', async () => {
    const { item, save, line, recipes } = await setup();
    const chile = await item('Chile ficticio', 'insumo', { referenceCost: '50' });
    const salsa = await item('Salsa ficticia', 'intermedio');
    await save(salsa, '2', [line(chile, '2')]);
    const { current } = await recipes.getRecipe(salsa.id);
    expect(current?.cost).toMatchObject({ total: 1_000_000n, unitCost: 500_000n, missing: [] });
    expect(current?.cost.lines.map((entry) => [entry.cost, entry.source])).toEqual([[1_000_000n, 'referencia']]);
  });

  it('RN-T2-1 y CA-2: 6.000 kg netos al 40 % son 10.000 kg brutos; a 100/kg y rendimiento de 6 kg, 166.6667 por kg', async () => {
    const { item, save, line, recipes, unitCostOf } = await setup();
    const carne = await item('Carne ficticia', 'insumo', { referenceCost: '100' });
    const cocida = await item('Carne cocida ficticia', 'intermedio');
    const { version } = await save(cocida, '6.000', [line(carne, '6.000', 'kg', '40')]);
    expect(version.lines[0]).toMatchObject({ netBaseQuantity: 6000n, wastePercent: 4000n, grossBaseQuantity: 10_000n });
    expect((await recipes.getRecipe(cocida.id)).current?.cost.total).toBe(10_000_000n);
    expect(await unitCostOf(cocida)).toBe('166.6667');
  });

  it('CA-2: la merma va de 0 a 99.99 %; 100 % se rechaza en su línea', async () => {
    const { item, save, line } = await setup();
    const sal = await item('Sal ficticia', 'insumo');
    const mezcla = await item('Mezcla ficticia', 'intermedio');
    const { version } = await save(mezcla, '1', [line(sal, '0.001', 'kg', '99.99')]);
    expect(version.lines[0]?.grossBaseQuantity).toBe(10_000n);
    expect(await fieldsOf(save(mezcla, '1', [line(sal, '1', 'kg', '100')]))).toEqual({ 'lines.0.wastePercent': 'La merma debe ser menor que 100 %.' });
    expect(await fieldsOf(save(mezcla, '1', [line(sal, '1', 'kg', '12.345')]))).toEqual({ 'lines.0.wastePercent': 'Máximo 2 decimales.' });
  });

  it('un empate exacto redondea la mitad hacia arriba, en la bruta y en el costo por unidad (DEF-003)', async () => {
    const { item, save, line, unitCostOf } = await setup();
    const sal = await item('Sal ficticia', 'insumo', { referenceCost: '0.0001' });
    const mezcla = await item('Mezcla ficticia', 'intermedio');
    // 0.001 kg al 60 %: 0.0025 kg brutos -> 0.003. 1 kg a 0.0001 con rendimiento de 2 kg: 0.00005 -> 0.0001.
    const { version } = await save(mezcla, '1', [line(sal, '0.001', 'kg', '60')]);
    expect(version.lines[0]?.grossBaseQuantity).toBe(3n);
    await save(mezcla, '2', [line(sal, '1')]);
    expect(await unitCostOf(mezcla)).toBe('0.0001');
  });

  it('CA-3: 500 g de un ingrediente en kg a 10/kg cuestan 5.0000; pza sin factor se rechaza con un mensaje claro', async () => {
    const { item, save, line, recipes } = await setup();
    const harina = await item('Harina ficticia', 'insumo', { referenceCost: '10' });
    const masa = await item('Masa ficticia', 'intermedio');
    await save(masa, '1', [line(harina, '500', 'g')]);
    expect((await recipes.getRecipe(masa.id)).current?.cost.lines[0]).toMatchObject({ netBaseQuantity: 500n, cost: 50_000n, unit: 'g' });
    expect(await fieldsOf(save(masa, '1', [line(harina, '2', 'pza')]))).toEqual({ 'lines.0.unit': 'No hay factor para convertir pza a kg en este artículo.' });
  });

  it('CA-7: sin CPP se usa la referencia; sin referencia la receta queda «Sin costo» y lista el faltante con su ruta (nunca 0)', async () => {
    const { item, save, line, recipes, unitCostOf } = await setup();
    const cebolla = await item('Cebolla ficticia', 'insumo');
    const chile = await item('Chile ficticio', 'insumo', { referenceCost: '40' });
    const salsa = await item('Salsa ficticia', 'intermedio');
    const taco = await item('Taco ficticio', 'compuesto', { baseUnit: 'pza' });
    await save(salsa, '1', [line(chile, '1'), line(cebolla, '0.5')]);
    await save(taco, '10', [line(salsa, '0.2')]);
    const { current } = await recipes.getRecipe(taco.id);
    expect(current?.cost).toMatchObject({ total: null, unitCost: null });
    expect(current?.cost.lines[0]).toMatchObject({ cost: null, source: 'sin_costo' });
    expect(current?.cost.missing).toEqual([{ itemId: cebolla.id, name: 'Cebolla ficticia', path: ['Taco ficticio', 'Salsa ficticia', 'Cebolla ficticia'] }]);
    expect((await recipes.listRecipes()).recipes.map((entry) => [entry.item.name, entry.unitCost, entry.missingCount])).toEqual([
      ['Salsa ficticia', null, 1],
      ['Taco ficticio', null, 1],
    ]);
    expect(await unitCostOf(salsa)).toBeNull();
  });

  it('CA-8: un cambio en una sub-receta o en un costo de referencia cambia el costo de la receta que la usa, sin versión nueva', async () => {
    const { inventory, item, save, line, recipes, unitCostOf } = await setup();
    const chile = await item('Chile ficticio', 'insumo', { referenceCost: '40' });
    const salsa = await item('Salsa ficticia', 'intermedio');
    const taco = await item('Taco ficticio', 'compuesto', { baseUnit: 'pza' });
    await save(salsa, '1', [line(chile, '1')]);
    const { version } = await save(taco, '10', [line(salsa, '0.5')]);
    expect(await unitCostOf(taco)).toBe('2.0000');

    await save(salsa, '2', [line(chile, '1')]);
    expect(await unitCostOf(taco)).toBe('1.0000');
    await inventory.updateItem(chile.id, { version: chile.version, name: chile.name, baseUnit: 'kg', categoryId: chile.categoryId, referenceCost: '80' }, ANA);
    expect(await unitCostOf(taco)).toBe('2.0000');
    expect((await recipes.getRecipe(taco.id)).versions.map((entry) => entry.id)).toEqual([version.id]);
  });

  it('CA-9: un no inventariable en hr con costo de referencia se costea en la receta', async () => {
    const { item, save, line, recipes } = await setup();
    const mano = await item('Mano de obra ficticia', 'insumo', { baseUnit: 'hr', inventoriable: false, referenceCost: '50' });
    expect(mano).toMatchObject({ baseUnit: 'hr', inventoriable: false, referenceCost: 500_000n });
    const salsa = await item('Salsa ficticia', 'intermedio');
    await save(salsa, '1', [line(mano, '0.5', 'hr')]);
    expect((await recipes.getRecipe(salsa.id)).current?.cost.lines[0]).toMatchObject({ cost: 250_000n, source: 'referencia' });
    expect(await fieldsOf(save(salsa, '1', [line(mano, '30', 'g')]))).toEqual({ 'lines.0.unit': 'No hay factor para convertir g a hr en este artículo.' });
  });

  it('PT-3: un Intermedio con la receta cerrada se costea por su referencia; sin ella queda «Sin costo»', async () => {
    const { inventory, item, save, line, recipes, unitCostOf } = await setup();
    const chile = await item('Chile ficticio', 'insumo', { referenceCost: '40' });
    const salsa = await item('Salsa ficticia', 'intermedio', { referenceCost: '30' });
    const taco = await item('Taco ficticio', 'compuesto', { baseUnit: 'pza' });
    const { version } = await save(salsa, '1', [line(chile, '1')]);
    await save(taco, '1', [line(salsa, '1')]);
    expect(await unitCostOf(taco)).toBe('40.0000');
    await recipes.closeRecipe(salsa.id, { baseVersionId: version.id }, ANA);
    expect((await recipes.getRecipe(taco.id)).current?.cost.lines[0]).toMatchObject({ unitCost: 300_000n, source: 'referencia' });
    const current = (await inventory.getItem(salsa.id)).item;
    await inventory.updateItem(salsa.id, { version: current.version, name: current.name, baseUnit: 'kg', categoryId: current.categoryId, referenceCost: null }, ANA);
    expect(await unitCostOf(taco)).toBeNull();
  });
});

describe('ciclos y profundidad (RF-5, CA-4)', () => {
  it('rechaza A en la receta de A y A en la de B si A usa B, con la ruta, sin escribir nada', async () => {
    const { store, item, save, line } = await setup();
    const sal = await item('Sal ficticia', 'insumo');
    const a = await item('Base A', 'intermedio');
    const b = await item('Base B', 'intermedio');
    const direct = await rejectionOf(save(a, '1', [line(a, '1')]));
    expect(direct).toBeInstanceOf(RecipeCycleError);
    expect((direct as RecipeCycleError).path).toEqual(['Base A', 'Base A']);

    await save(b, '1', [line(sal, '1')]);
    await save(a, '1', [line(b, '1')]);
    const before = structuredClone(store.state.recipeVersions);
    const indirect = await rejectionOf(save(b, '1', [line(sal, '1'), line(a, '1')]));
    expect((indirect as RecipeCycleError).path).toEqual(['Base B', 'Base A', 'Base B']);
    expect(store.state.recipeVersions).toEqual(before);
  });

  it('admite 8 niveles de recetas anidadas y rechaza el noveno con la cadena más larga, por una línea o por quien lo usa', async () => {
    const { store, item, save, line } = await setup();
    const sal = await item('Sal ficticia', 'insumo');
    const levels: InventoryItem[] = [];
    let previous = sal;
    for (let level = 1; level <= 8; level += 1) {
      const next = await item(`Nivel ${level}`, 'intermedio');
      await save(next, '1', [line(previous, '1')]);
      levels.push(next);
      previous = next;
    }
    const ninth = await item('Nivel 9', 'intermedio');
    const error = await rejectionOf(save(ninth, '1', [line(sal, '1'), line(previous, '1')]));
    expect(error).toBeInstanceOf(RecipeTooDeepError);
    // REQ-F-054, RF-2: `path` baja desde la receta que se guarda (path[1]: el ingrediente de su línea).
    expect(error).toMatchObject({ depth: 9, max: 8, path: ['Nivel 9', 'Nivel 8', 'Nivel 7', 'Nivel 6', 'Nivel 5', 'Nivel 4', 'Nivel 3', 'Nivel 2', 'Nivel 1'], usedBy: [] });

    // El exceso por quien lo usa: Base usada por Nivel 1 (que ya tiene 8 niveles encima) y sin subrecetas propias.
    const base = await item('Base ficticia', 'intermedio');
    const first = levels[0];
    if (!first) throw new Error('falta el Nivel 1');
    await save(first, '1', [line(sal, '1'), line(base, '1')]);
    const external = await rejectionOf(save(base, '1', [line(sal, '1')]));
    expect(external).toMatchObject({ depth: 9, path: ['Base ficticia'], usedBy: ['Nivel 1', 'Nivel 2', 'Nivel 3', 'Nivel 4', 'Nivel 5', 'Nivel 6', 'Nivel 7', 'Nivel 8'] });
    expect(store.state.recipeVersions.filter((version) => version.itemId === ninth.id || version.itemId === base.id)).toEqual([]);
  });
});

describe('versiones (RF-4, CA-5, RF-9)', () => {
  it('la v2 cierra la v1 con intervalos contiguos; guardar sin cambios no crea versión; cerrar deja sin vigente', async () => {
    const { store, item, save, line, recipes } = await setup();
    const sal = await item('Sal ficticia', 'insumo');
    const salsa = await item('Salsa ficticia', 'intermedio');
    const v1 = await save(salsa, '1', [line(sal, '1')]);
    expect(v1).toMatchObject({ created: true, version: { number: 1, validTo: null, createdByName: 'Ana Gerente' } });
    // El reloj no avanza: la v2 empieza 1 ms después de la v1, nunca antes ni a la vez.
    const v2 = await save(salsa, '1', [line(sal, '2')]);
    const { versions } = await recipes.getRecipe(salsa.id);
    expect(versions.map((entry) => [entry.number, entry.validFrom.toISOString(), entry.validTo?.toISOString() ?? null])).toEqual([
      [2, '2026-11-19T18:00:00.001Z', null],
      [1, '2026-11-19T18:00:00.000Z', '2026-11-19T18:00:00.001Z'],
    ]);
    expect(versions[1]?.lines).toEqual(v1.version.lines);

    expect(await save(salsa, '1', [line(sal, '2.000', 'KG')])).toEqual({ created: false, version: v2.version });
    expect(store.state.recipeVersions).toHaveLength(2);

    clock = new Date('2026-11-19T19:00:00.000Z');
    const closed = await recipes.closeRecipe(salsa.id, { baseVersionId: v2.version.id }, ANA);
    expect(closed?.validTo?.toISOString()).toBe('2026-11-19T19:00:00.000Z');
    expect((await recipes.getRecipe(salsa.id)).current).toBeNull();
    expect(await recipes.closeRecipe(salsa.id, { baseVersionId: null }, ANA)).toBeNull();
    expect(store.state.changes.filter((change) => change.entity === 'recipe').map((change) => change.action)).toEqual(['new_version', 'new_version', 'close']);
  });

  it('partir de una versión que ya no es la vigente da conflicto con la vigente; el doble envío no crea dos versiones', async () => {
    const { store, item, save, line, recipes } = await setup();
    const sal = await item('Sal ficticia', 'insumo');
    const salsa = await item('Salsa ficticia', 'intermedio');
    const v1 = await save(salsa, '1', [line(sal, '1')]);
    const input = { baseVersionId: v1.version.id, yieldQuantity: '1', lines: [line(sal, '3')] };
    expect((await recipes.saveVersion(salsa.id, input, ANA)).created).toBe(true);
    expect((await recipes.saveVersion(salsa.id, input, ANA)).created).toBe(false);

    const stale = await rejectionOf(recipes.saveVersion(salsa.id, { ...input, lines: [line(sal, '4')] }, ANA));
    expect(stale).toBeInstanceOf(RecipeVersionConflictError);
    expect((stale as RecipeVersionConflictError).current).toMatchObject({ number: 2, createdByName: 'Ana Gerente' });
    expect(store.state.recipeVersions).toHaveLength(2);
    expect(await rejectionOf(recipes.closeRecipe(salsa.id, { baseVersionId: v1.version.id }, ANA))).toBeInstanceOf(RecipeVersionConflictError);
  });
});

describe('quién lleva receta y qué es ingrediente (RN-T2-2, RN-T2-3, CA-11)', () => {
  it('un Insumo, una Reventa o un padre no admiten receta; un Compuesto o un padre no son ingredientes', async () => {
    const { inventory, abarrotes, item, save, line, recipes } = await setup();
    const sal = await item('Sal ficticia', 'insumo');
    const refresco = await item('Refresco ficticio', 'reventa', { baseUnit: 'pza' });
    const padre = await inventory.createItem({ kind: 'parent', type: 'compuesto', categoryId: abarrotes.id, name: 'Combo ficticio' }, ANA);
    const taco = await item('Taco ficticio', 'compuesto', { baseUnit: 'pza' });
    for (const target of [sal, refresco, padre]) expect(await rejectionOf(save(target, '1', [line(sal, '1')]))).toBeInstanceOf(RecipeNotAllowedError);
    expect(await fieldsOf(save(taco, '1', [line(sal, '1'), line(taco, '1', 'pza'), line(padre, '1', 'pza')]))).toEqual({
      'lines.1.ingredient': 'Un Compuesto no puede ser ingrediente de otra receta.',
      'lines.2.ingredient': 'Un artículo padre no es ingrediente: elige una de sus variantes.',
    });
    expect((await recipes.ingredientOptions()).map((entry) => entry.name)).toEqual(['Refresco ficticio', 'Sal ficticia']);
  });

  it('valida el rendimiento y las líneas: de 1 a 40, sin repetidos, neta > 0, sin coma', async () => {
    const { item, save, line } = await setup();
    const sal = await item('Sal ficticia', 'insumo');
    const salsa = await item('Salsa ficticia', 'intermedio');
    expect(await fieldsOf(save(salsa, '0', []))).toEqual({ yieldQuantity: 'El rendimiento debe ser mayor que 0.', lines: 'Agrega al menos un ingrediente.' });
    expect(await fieldsOf(save(salsa, '1', [line(sal, '1,5'), line(sal, '0')]))).toEqual({
      'lines.0.quantity': 'Usa punto decimal, no coma (p. ej. 0.5).',
      'lines.1.ingredient': 'Ingrediente repetido: júntalo en una sola línea.',
      'lines.1.quantity': 'La cantidad neta debe ser mayor que 0.',
    });
    expect(await fieldsOf(save(salsa, '1', Array.from({ length: 41 }, () => line(sal, '1'))))).toEqual({ lines: 'Máximo 40 ingredientes.' });
    expect(await fieldsOf(save(salsa, '1', [line(sal, '0.0001', 'g')]))).toEqual({ 'lines.0.quantity': 'Máximo 3 decimales.' });
    expect(await fieldsOf(save(salsa, '1', [line(sal, '0.4', 'g')]))).toEqual({ 'lines.0.quantity': 'La cantidad es demasiado pequeña: en kg se redondea a 0.' });
  });
});

describe('uso en recetas e inactivación (RN-4, RF-7, RF-8, CA-10)', () => {
  it('un artículo usado no cambia su unidad base; inactivarlo exige confirmar y lista las recetas; después no se ofrece', async () => {
    const { inventory, item, save, line, recipes } = await setup();
    const sal = await item('Sal ficticia', 'insumo');
    const chile = await item('Chile ficticio', 'insumo');
    const salsa = await item('Salsa ficticia', 'intermedio');
    const { version } = await save(salsa, '1', [line(sal, '1'), line(chile, '1')]);
    expect((await inventory.getItem(sal.id)).locked).toBe(true);
    expect(await rejectionOf(inventory.updateItem(sal.id, { version: sal.version, name: sal.name, baseUnit: 'g', categoryId: sal.categoryId }, ANA))).toBeInstanceOf(ItemLockedError);
    expect(await recipes.usedIn(sal.id)).toEqual([{ itemId: salsa.id, itemName: 'Salsa ficticia', itemActive: true, versionId: version.id, versionNumber: 1 }]);

    const blocked = await rejectionOf(inventory.deactivateItem(sal.id, { version: sal.version }, ANA));
    expect(blocked).toBeInstanceOf(ItemInActiveRecipesError);
    expect((blocked as ItemInActiveRecipesError).recipes).toEqual([{ itemId: salsa.id, name: 'Salsa ficticia' }]);
    expect((await inventory.getItem(sal.id)).item.active).toBe(true);

    await inventory.deactivateItem(sal.id, { version: sal.version, recipes: 'keep' }, ANA);
    const detail = await recipes.getRecipe(salsa.id);
    expect(detail.current?.version.id).toBe(version.id);
    expect(detail.inactiveIngredientIds).toEqual([sal.id]);
    expect((await recipes.listRecipes()).recipes[0]?.usesInactive).toBe(true);
    expect((await recipes.ingredientOptions()).map((entry) => entry.name)).toEqual(['Chile ficticio', 'Salsa ficticia']);
    expect(await fieldsOf(save(salsa, '2', [line(sal, '1'), line(chile, '1')]))).toEqual({ 'lines.0.ingredient': 'El ingrediente está inactivo: elige otro.' });
  });

  it('inactivar un padre comprueba las recetas de sus variantes; inactivar un Intermedio no cierra su receta', async () => {
    const { inventory, abarrotes, item, save, line, recipes } = await setup();
    const padre = await inventory.createItem({ kind: 'parent', type: 'reventa', categoryId: abarrotes.id, name: 'Refresco ficticio' }, ANA);
    const variante = await inventory.createItem({ kind: 'variant', parentId: padre.id, name: 'Refresco ficticio 600 ml', baseUnit: 'pza' }, ANA);
    const sal = await item('Sal ficticia', 'insumo');
    const salsa = await item('Salsa ficticia', 'intermedio');
    const combo = await item('Combo ficticio', 'compuesto', { baseUnit: 'pza' });
    await save(salsa, '1', [line(sal, '1')]);
    await save(combo, '1', [line(variante, '1', 'pza'), line(salsa, '0.1')]);

    const blocked = await rejectionOf(inventory.deactivateItem(padre.id, { version: padre.version, variants: 'deactivate' }, ANA));
    expect((blocked as ItemInActiveRecipesError).recipes).toEqual([{ itemId: combo.id, name: 'Combo ficticio' }]);

    await inventory.deactivateItem(salsa.id, { version: salsa.version, recipes: 'keep' }, ANA);
    expect((await recipes.getRecipe(salsa.id)).current?.version.number).toBe(1);
    expect(await rejectionOf(save(salsa, '2', [line(sal, '1')]))).toBeInstanceOf(RecipeItemInactiveError);
  });
});

describe('costo de referencia e inventariable en el artículo (RF-10, PT-7)', () => {
  it('se admiten por tipo, con 4 decimales; una edición sin ellos los conserva', async () => {
    const { inventory, abarrotes, item } = await setup();
    expect(await fieldsOf(item('Taco ficticio', 'compuesto', { baseUnit: 'pza', referenceCost: '10' }))).toEqual({ referenceCost: 'Un Compuesto se costea por su receta: no lleva costo de referencia.' });
    expect(await fieldsOf(inventory.createItem({ kind: 'parent', type: 'reventa', categoryId: abarrotes.id, name: 'Padre ficticio', referenceCost: '1' }, ANA))).toEqual({
      referenceCost: 'Un artículo padre no lleva costo: va en cada variante.',
    });
    expect(await fieldsOf(item('Salsa ficticia', 'intermedio', { inventoriable: false }))).toEqual({ inventoriable: 'Solo un Insumo puede no llevar existencias.' });
    expect(await fieldsOf(item('Sal ficticia', 'insumo', { referenceCost: '1.23456' }))).toEqual({ referenceCost: 'Máximo 4 decimales.' });

    const salsa = await item('Salsa ficticia', 'intermedio', { referenceCost: '12.3456' });
    const refresco = await item('Refresco ficticio', 'reventa', { baseUnit: 'pza', referenceCost: '15' });
    expect([salsa.referenceCost, refresco.referenceCost, salsa.inventoriable]).toEqual([123_456n, 150_000n, true]);
    const renamed = await inventory.updateItem(salsa.id, { version: salsa.version, name: 'Salsa ficticia roja', baseUnit: 'kg', categoryId: salsa.categoryId }, ANA);
    expect(renamed).toMatchObject({ referenceCost: 123_456n, inventoriable: true });
    const { history } = await inventory.getItem(salsa.id);
    expect(history[1]?.changes).toContainEqual({ field: 'referenceCost', before: null, after: '12.3456' });
  });
});
