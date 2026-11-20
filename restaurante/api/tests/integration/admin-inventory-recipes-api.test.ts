import { describe, expect, it } from 'vitest';

import {
  inventoryCategoryResponseSchema,
  inventoryItemDetailResponseSchema,
  inventoryItemResponseSchema,
  itemInActiveRecipesErrorSchema,
  recipeCloseResponseSchema,
  recipeConflictErrorSchema,
  recipeCycleErrorSchema,
  recipeDetailResponseSchema,
  recipeIngredientsResponseSchema,
  recipeListResponseSchema,
  recipeSaveResponseSchema,
  recipeUsedInResponseSchema,
  recipeVersionResponseSchema,
  validationErrorSchema,
} from '@restaurante/contracts';

import { ADMIN, MANAGER, MOLOTES_EDITOR, call, session, startAdmin, type AdminHarness, type Session } from '../support/admin.ts';

/**
 * Recetas del inventario en `/api/v1/admin/inventario` (REQ-F-050, T2), en proceso con el store en
 * memoria: permisos (CA-12), CSRF, contrato de las respuestas (costo como texto, origen por línea,
 * «Sin costo» con sus faltantes), los códigos de error propios (ciclo con su ruta, conflicto de versión
 * con la vigente, receta no permitida, artículo usado en recetas vigentes), la idempotencia del guardado
 * y los campos nuevos del artículo. Las reglas se prueban en `inventory-recipes.test.ts` y la base en
 * `prisma-inventory-recipes.test.ts`. Datos ficticios.
 */

const I = '/api/v1/admin/inventario';
const KEY = 'clave-de-receta-000000001';

async function catalog(h: AdminHarness, auth: Session) {
  const res = await call(h.url, `${I}/categorias`, auth, { method: 'POST', body: { name: 'Producción' } });
  const categoryId = inventoryCategoryResponseSchema.parse(await res.json()).category.id;
  const create = async (body: Record<string, unknown>) => {
    const created = await call(h.url, `${I}/articulos`, auth, { method: 'POST', body: { categoryId, ...body } });
    expect(created.status).toBe(201);
    return inventoryItemResponseSchema.parse(await created.json()).item;
  };
  const carne = await create({ type: 'insumo', name: 'Carne ficticia', baseUnit: 'kg', referenceCost: '100' });
  const cebolla = await create({ type: 'insumo', name: 'Cebolla ficticia', baseUnit: 'kg' });
  const mano = await create({ type: 'insumo', name: 'Mano de obra ficticia', baseUnit: 'hr', referenceCost: '80', inventoriable: false });
  const cocida = await create({ type: 'intermedio', name: 'Carne cocida ficticia', baseUnit: 'kg' });
  const taco = await create({ type: 'compuesto', name: 'Taco ficticio', baseUnit: 'pza' });
  return { categoryId, carne, cebolla, mano, cocida, taco };
}

const line = (ingredientId: number, quantity: string, unit = 'kg', wastePercent = '0') => ({ ingredientId, quantity, unit, wastePercent });

describe('acceso (CA-12)', () => {
  const ROUTES = [
    { method: 'GET', path: `${I}/recetas` },
    { method: 'GET', path: `${I}/recetas/ingredientes` },
    { method: 'GET', path: `${I}/recetas/versiones/1` },
    { method: 'GET', path: `${I}/articulos/1/recetas` },
    { method: 'POST', path: `${I}/articulos/1/recetas`, body: { baseVersionId: null, yieldQuantity: '1', lines: [line(2, '1')] } },
    { method: 'POST', path: `${I}/articulos/1/recetas/cerrar`, body: { baseVersionId: 1 } },
    { method: 'GET', path: `${I}/articulos/1/usado-en` },
  ];

  it('editor: 403 FORBIDDEN_ROLE en lectura y escritura; sin sesión, 401; sin CSRF, 403; y no se escribe nada', async () => {
    const h = await startAdmin({ users: [MOLOTES_EDITOR, MANAGER] });
    const eli = await session(h.url, MOLOTES_EDITOR);
    const gema = await session(h.url, MANAGER);
    for (const route of ROUTES) {
      const forbidden = await call(h.url, route.path, eli, { method: route.method, body: route.body });
      expect(forbidden.status, `${route.method} ${route.path}`).toBe(403);
      expect((await forbidden.json()).error.code).toBe('FORBIDDEN_ROLE');
      const anonymous = await call(h.url, route.path, null, { method: route.method, body: route.body });
      expect(anonymous.status, `${route.method} ${route.path}`).toBe(401);
      if (route.method === 'POST') {
        const noCsrf = await call(h.url, route.path, gema, { method: route.method, body: route.body, csrf: null });
        expect(noCsrf.status, `${route.method} ${route.path}`).toBe(403);
        expect((await noCsrf.json()).error.code).toBe('CSRF_INVALID');
      }
    }
    expect(h.inventoryStore.state.recipeVersions).toHaveLength(0);
    expect(h.inventoryStore.state.changes).toHaveLength(0);
  });
});

describe('recetas en la API', () => {
  it('gerente: campos nuevos del artículo, versión con costo por línea y «Sin costo», lista, historial, ingredientes y «usado en»', async () => {
    const h = await startAdmin({ users: [MANAGER] });
    const gema = await session(h.url, MANAGER);
    const { carne, cebolla, mano, cocida, taco } = await catalog(h, gema);
    expect(carne).toMatchObject({ referenceCost: '100.0000', inventoriable: true });
    expect(mano).toMatchObject({ baseUnit: 'hr', referenceCost: '80.0000', inventoriable: false });
    expect(cebolla.referenceCost).toBeNull();

    // RN-T2-1: 6 kg netos al 40 % = 10 kg brutos; 10 × 100 / 6 = 166.6667 por kg.
    const saved = await call(h.url, `${I}/articulos/${cocida.id}/recetas`, gema, {
      method: 'POST',
      body: { baseVersionId: null, yieldQuantity: '6', note: 'Cocción ficticia', lines: [line(carne.id, '6.000', 'kg', '40'), line(mano.id, '0.5', 'hr')] },
    });
    expect(saved.status).toBe(201);
    const { version } = recipeSaveResponseSchema.parse(await saved.json());
    expect(saved.headers.get('location')).toBe(`${I}/recetas/versiones/${version.id}`);
    expect(version).toMatchObject({ number: 1, yieldQuantity: '6.000', validTo: null, createdBy: 'Gema Gerente', lineCount: 2 });

    const detail = recipeDetailResponseSchema.parse(await (await call(h.url, `${I}/articulos/${cocida.id}/recetas`, gema)).json());
    expect(detail.current?.unitCost).toBe('173.3333');
    expect(detail.current?.version.lines.map((entry) => [entry.ingredient.name, entry.netBaseQuantity, entry.wastePercent, entry.grossBaseQuantity, entry.cost, entry.source])).toEqual([
      ['Carne ficticia', '6.000', '40.00', '10.000', '1000.0000', 'referencia'],
      ['Mano de obra ficticia', '0.500', '0.00', '0.500', '40.0000', 'referencia'],
    ]);

    const tacoSaved = await call(h.url, `${I}/articulos/${taco.id}/recetas`, gema, {
      method: 'POST',
      body: { baseVersionId: null, yieldQuantity: '1', lines: [line(cocida.id, '80', 'g'), line(cebolla.id, '10', 'g')] },
    });
    expect(tacoSaved.status).toBe(201);
    const tacoDetail = recipeDetailResponseSchema.parse(await (await call(h.url, `${I}/articulos/${taco.id}/recetas`, gema)).json());
    expect(tacoDetail.current).toMatchObject({ total: null, unitCost: null, missing: [{ itemId: cebolla.id, name: 'Cebolla ficticia', path: ['Taco ficticio', 'Cebolla ficticia'] }] });
    expect(tacoDetail.current?.version.lines.map((entry) => [entry.source, entry.cost])).toEqual([
      ['receta', '13.8667'],
      ['sin_costo', null],
    ]);

    const list = recipeListResponseSchema.parse(await (await call(h.url, `${I}/recetas?tipo=compuesto`, gema)).json());
    expect(list.recipes.map((entry) => [entry.item.name, entry.unitCost, entry.missingCount, entry.usesInactive])).toEqual([['Taco ficticio', null, 1, false]]);
    const badFilter = await call(h.url, `${I}/recetas?tipo=insumo&pagina=0`, gema);
    expect(badFilter.status).toBe(422);
    expect(Object.keys(validationErrorSchema.parse(await badFilter.json()).error.fields).sort()).toEqual(['pagina', 'tipo']);

    const history = recipeVersionResponseSchema.parse(await (await call(h.url, `${I}/recetas/versiones/${version.id}`, gema)).json());
    expect(history.version).toMatchObject({ number: 1, note: 'Cocción ficticia' });
    expect(history.version.lines[0]).not.toHaveProperty('cost');
    expect((await call(h.url, `${I}/recetas/versiones/999`, gema)).status).toBe(404);

    const options = recipeIngredientsResponseSchema.parse(await (await call(h.url, `${I}/recetas/ingredientes`, gema)).json());
    expect(options.ingredients.map((entry) => entry.name)).not.toContain('Taco ficticio');
    expect(options.ingredients.map((entry) => entry.name)).toContain('Carne cocida ficticia');

    const usedIn = recipeUsedInResponseSchema.parse(await (await call(h.url, `${I}/articulos/${cocida.id}/usado-en`, gema)).json());
    expect(usedIn.recipes).toEqual([{ itemId: taco.id, name: 'Taco ficticio', active: true, versionId: expect.any(Number), versionNumber: 1 }]);
    const ficha = inventoryItemDetailResponseSchema.parse(await (await call(h.url, `${I}/articulos/${carne.id}`, gema)).json());
    expect(ficha.item.locked).toBe(true);
  });

  it('guardar sin cambios no crea versión (200); misma Idempotency-Key, una versión; conflicto 409 con la vigente; cerrar', async () => {
    const h = await startAdmin({ users: [ADMIN, MANAGER] });
    const gema = await session(h.url, MANAGER);
    const ana = await session(h.url, ADMIN);
    const { carne, cocida } = await catalog(h, gema);
    const body = { baseVersionId: null, yieldQuantity: '1', lines: [line(carne.id, '1')] };
    const send = (auth: Session, payload: unknown, key = KEY) => call(h.url, `${I}/articulos/${cocida.id}/recetas`, auth, { method: 'POST', body: payload, headers: { 'Idempotency-Key': key } });

    const [a, b] = await Promise.all([send(gema, body), send(gema, body)]);
    expect([a.status, b.status]).toEqual([201, 201]);
    expect(h.inventoryStore.state.recipeVersions).toHaveLength(1);
    const v1 = recipeSaveResponseSchema.parse(await a.json()).version;

    const same = await send(ana, { ...body, baseVersionId: v1.id }, 'otra-clave-de-receta-0002');
    expect(same.status).toBe(200);
    expect(recipeSaveResponseSchema.parse(await same.json())).toMatchObject({ created: false, version: { id: v1.id } });

    const v2 = await send(ana, { ...body, baseVersionId: v1.id, yieldQuantity: '2' }, 'otra-clave-de-receta-0003');
    expect(v2.status).toBe(201);
    const stale = await send(gema, { ...body, baseVersionId: v1.id, yieldQuantity: '3' }, 'otra-clave-de-receta-0004');
    expect(stale.status).toBe(409);
    const conflict = recipeConflictErrorSchema.parse(await stale.json());
    expect(conflict.error.current).toMatchObject({ number: 2, createdBy: 'Ana Admin' });
    expect(h.inventoryStore.state.recipeVersions).toHaveLength(2);

    const close = await call(h.url, `${I}/articulos/${cocida.id}/recetas/cerrar`, gema, { method: 'POST', body: { baseVersionId: conflict.error.current?.id ?? null } });
    expect(close.status).toBe(200);
    expect(recipeCloseResponseSchema.parse(await close.json()).version).toMatchObject({ number: 2, validTo: expect.any(String) });
    const again = await call(h.url, `${I}/articulos/${cocida.id}/recetas/cerrar`, gema, { method: 'POST', body: { baseVersionId: null } });
    expect(recipeCloseResponseSchema.parse(await again.json())).toEqual({ version: null });
    const detail = recipeDetailResponseSchema.parse(await (await call(h.url, `${I}/articulos/${cocida.id}/recetas`, gema)).json());
    expect(detail.current).toBeNull();
    expect(detail.versions.map((entry) => entry.number)).toEqual([2, 1]);
  });

  it('errores: 422 por línea y cuerpo cerrado, 422 RECIPE_CYCLE con la ruta, 409 RECIPE_NOT_ALLOWED y 404', async () => {
    const h = await startAdmin({ users: [MANAGER] });
    const gema = await session(h.url, MANAGER);
    const { carne, cocida, categoryId } = await catalog(h, gema);
    const post = (id: number, body: unknown) => call(h.url, `${I}/articulos/${id}/recetas`, gema, { method: 'POST', body });

    const invalid = await post(cocida.id, { baseVersionId: null, yieldQuantity: '0', lines: [line(carne.id, '1,5'), { ...line(carne.id, '1', 'pza'), precio: 3 }] });
    expect(invalid.status).toBe(422);
    expect(validationErrorSchema.parse(await invalid.json()).error.fields).toEqual({ 'lines.1.precio': 'Campo desconocido.' });
    const fields = await post(cocida.id, { baseVersionId: null, yieldQuantity: '0', lines: [line(carne.id, '1,5'), line(carne.id, '1', 'kg', '100')] });
    expect(Object.keys(validationErrorSchema.parse(await fields.json()).error.fields).sort()).toEqual(['lines.0.quantity', 'lines.1.ingredient', 'lines.1.wastePercent', 'yieldQuantity']);

    const salsaRes = await call(h.url, `${I}/articulos`, gema, { method: 'POST', body: { type: 'intermedio', categoryId, name: 'Salsa ficticia', baseUnit: 'L' } });
    const salsa = inventoryItemResponseSchema.parse(await salsaRes.json()).item;
    expect((await post(cocida.id, { baseVersionId: null, yieldQuantity: '1', lines: [line(salsa.id, '1', 'L')] })).status).toBe(201);
    const cycle = await post(salsa.id, { baseVersionId: null, yieldQuantity: '1', lines: [line(cocida.id, '1')] });
    expect(cycle.status).toBe(422);
    expect(recipeCycleErrorSchema.parse(await cycle.json()).error.path).toEqual(['Salsa ficticia', 'Carne cocida ficticia', 'Salsa ficticia']);

    const notAllowed = await post(carne.id, { baseVersionId: null, yieldQuantity: '1', lines: [line(cocida.id, '1')] });
    expect(notAllowed.status).toBe(409);
    expect((await notAllowed.json()).error.code).toBe('RECIPE_NOT_ALLOWED');
    for (const path of [`${I}/articulos/999/recetas`, `${I}/articulos/abc/usado-en`]) {
      const res = await call(h.url, path, gema);
      expect(res.status, path).toBe(404);
      expect((await res.json()).error.code).toBe('ITEM_NOT_FOUND');
    }
    expect(h.inventoryStore.state.recipeVersions).toHaveLength(1);
  });

  it('inactivar un ingrediente de una receta vigente: 409 ITEM_IN_ACTIVE_RECIPES con la lista; con recipes=keep se inactiva y la receta lo avisa (CA-10)', async () => {
    const h = await startAdmin({ users: [MANAGER] });
    const gema = await session(h.url, MANAGER);
    const { carne, cocida } = await catalog(h, gema);
    await call(h.url, `${I}/articulos/${cocida.id}/recetas`, gema, { method: 'POST', body: { baseVersionId: null, yieldQuantity: '1', lines: [line(carne.id, '1')] } });

    const blocked = await call(h.url, `${I}/articulos/${carne.id}/desactivar`, gema, { method: 'POST', body: { version: carne.version } });
    expect(blocked.status).toBe(409);
    expect(itemInActiveRecipesErrorSchema.parse(await blocked.json()).error.recipes).toEqual([{ itemId: cocida.id, name: 'Carne cocida ficticia' }]);
    const confirmed = await call(h.url, `${I}/articulos/${carne.id}/desactivar`, gema, { method: 'POST', body: { version: carne.version, recipes: 'keep' } });
    expect(confirmed.status).toBe(200);

    const list = recipeListResponseSchema.parse(await (await call(h.url, `${I}/recetas`, gema)).json());
    expect(list.recipes.map((entry) => [entry.item.name, entry.usesInactive])).toEqual([['Carne cocida ficticia', true]]);
    const detail = recipeDetailResponseSchema.parse(await (await call(h.url, `${I}/articulos/${cocida.id}/recetas`, gema)).json());
    expect(detail.current?.inactiveIngredientIds).toEqual([carne.id]);
  });

  it('otra escritura retiene el candado: 503 INVENTORY_BUSY sin escribir nada', async () => {
    const h = await startAdmin({ users: [MANAGER] });
    const gema = await session(h.url, MANAGER);
    const { carne, cocida } = await catalog(h, gema);
    h.inventoryStore.failNext(1, 'busy');
    const res = await call(h.url, `${I}/articulos/${cocida.id}/recetas`, gema, { method: 'POST', body: { baseVersionId: null, yieldQuantity: '1', lines: [line(carne.id, '1')] } });
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe('INVENTORY_BUSY');
    expect(h.inventoryStore.state.recipeVersions).toHaveLength(0);
  });
});
