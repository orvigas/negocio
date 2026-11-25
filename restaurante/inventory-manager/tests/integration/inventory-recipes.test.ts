import { describe, expect, it } from 'vitest';

import type { InventoryItem } from '@restaurante/contracts';

import type { DoubleUser } from '../support/api-double.ts';
import { ANA, ELI, GEMA, dom, formFields, startInventory, type Browser, type Harness } from '../support/browser.ts';

/**
 * Pantallas de recetas del inventario (REQ-F-050, T2: RF-1 a RF-9, RF-13; CA-4 a CA-7, CA-10 y CA-12)
 * contra el doble de /api/v1/admin/inventario, sin JavaScript (formularios GET y POST/redirect/GET). Las
 * reglas y el costo exacto están en api/tests (core y la API). Datos ficticios.
 */

const AT = '2026-11-19T10:00:00-06:00';
let next = 100;

function addItem(h: Harness, name: string, type: InventoryItem['type'], extra: Partial<InventoryItem> = {}): InventoryItem {
  const item: InventoryItem = { id: ++next, kind: 'simple', type, parentId: null, categoryId: 1, name, description: null, sku: null, baseUnit: 'kg', units: [], active: true, version: 1, createdAt: AT, updatedAt: AT, updatedBy: 'Semilla', referenceCost: null, inventoriable: true, ...extra };
  h.api.inventory.items.push(item);
  return item;
}

async function as(user: DoubleUser) {
  const h = await startInventory({ users: [ANA, ELI, GEMA] });
  h.api.inventory.categories.push({ id: 1, name: 'Abarrotes ficticios', active: true, createdAt: AT, updatedAt: AT });
  const chile = addItem(h, 'Chile ficticio', 'insumo', { referenceCost: '25.0000' });
  const cebolla = addItem(h, 'Cebolla ficticia', 'insumo');
  const salsa = addItem(h, 'Salsa ficticia', 'intermedio');
  const taco = addItem(h, 'Taco ficticio', 'compuesto', { baseUnit: 'pza' });
  const browser = h.browser();
  expect((await browser.login(user)).status).toBe(303);
  return { h, browser, chile, cebolla, salsa, taco };
}

const text = (html: string) => dom(html).body.textContent?.replace(/\s+/g, ' ') ?? '';
const editorOf = (id: number) => `/inventario/articulos/${id}/receta/nueva`;
const recipeOf = (id: number) => `/inventario/articulos/${id}/receta`;

/** Envía el editor de la página `html` con cambios (como el navegador, con el botón pulsado). */
function post(browser: Browser, html: string, id: number, changes: Record<string, string>, action = 'save') {
  return browser.post(recipeOf(id), { ...formFields(html, '#inventory-recipe-form'), action, ...changes });
}

describe('editor sin JavaScript (RF-3, RF-13)', () => {
  it('muestra 10 filas con un único datalist, añade bloques de 10 conservando lo escrito hasta 40 y guarda la versión', async () => {
    const { h, browser, salsa } = await as(GEMA);
    const html = await (await browser.get(editorOf(salsa.id))).text();
    const page = dom(html);
    expect(page.querySelectorAll('fieldset.recipe-line')).toHaveLength(10);
    expect(page.querySelectorAll('datalist#recipe-ingredients')).toHaveLength(1);
    // Solo ingredientes permitidos (un Compuesto no es ingrediente; CA-11).
    expect([...page.querySelectorAll('#recipe-ingredients option')].map((option) => option.getAttribute('value'))).toEqual(['Chile ficticio', 'Cebolla ficticia', 'Salsa ficticia']);
    expect(page.querySelector('#f-lines-0-ingredient')?.getAttribute('list')).toBe('recipe-ingredients');
    expect(page.querySelector('#f-lines-0-quantity')?.getAttribute('aria-describedby')).toContain('recipe-help-text');
    expect(text(html)).toContain('Neta = cantidad aprovechable tras la merma.');

    let current = html;
    for (const rows of [20, 30, 40]) {
      const res = await post(browser, current, salsa.id, { yieldQuantity: '2', 'lines.0.ingredient': 'Chile ficticio', 'lines.0.quantity': '4', 'lines.0.unit': 'kg' }, 'rows');
      expect(res.status).toBe(200);
      current = await res.text();
      const shown = dom(current);
      expect(shown.querySelectorAll('fieldset.recipe-line')).toHaveLength(rows);
      expect(shown.querySelector('#f-lines-0-ingredient')?.getAttribute('value')).toBe('Chile ficticio');
      expect(shown.querySelector('#f-yieldQuantity')?.getAttribute('value')).toBe('2');
    }
    expect(dom(current).querySelector('button[value="rows"]')).toBeNull();
    expect(h.api.inventory.recipes.versions).toHaveLength(0);

    const saved = await post(browser, current, salsa.id, {});
    expect(saved.status).toBe(303);
    expect(saved.headers.get('location')).toBe(`${recipeOf(salsa.id)}?ok=saved`);
    const body = h.api.requests.find((request) => request.method === 'POST' && request.path.endsWith(`/articulos/${salsa.id}/recetas`))?.body;
    expect(body).toMatchObject({ baseVersionId: null, yieldQuantity: '2', lines: [{ ingredientId: expect.any(Number) as unknown, quantity: '4', unit: 'kg' }] });

    const detail = text(await (await browser.get(`${recipeOf(salsa.id)}?ok=saved`)).text());
    expect(detail).toContain('Versión nueva guardada: ya es la vigente.');
    expect(detail).toContain('Versión 1 vigente');
    expect(detail).toContain('$50.00 / kg');
    expect(detail).toContain('Referencia');
  });

  it('un 422 marca la línea y el campo con texto y enlace, y conserva lo escrito en su fila', async () => {
    const { browser, salsa } = await as(GEMA);
    const html = await (await browser.get(editorOf(salsa.id))).text();
    const res = await post(browser, html, salsa.id, {
      yieldQuantity: '2',
      'lines.0.ingredient': 'Chile ficticio',
      'lines.0.quantity': '1',
      'lines.0.unit': 'kg',
      'lines.2.ingredient': 'Ajo inexistente',
      'lines.2.quantity': '1',
      'lines.2.unit': 'kg',
      'lines.4.ingredient': 'Cebolla ficticia',
      'lines.4.quantity': '0,5',
      'lines.4.unit': 'kg',
    });
    expect(res.status).toBe(422);
    const page = dom(await res.text());
    expect(page.querySelector('#f-lines-2-ingredient')?.getAttribute('aria-invalid')).toBe('true');
    expect(page.querySelector('#f-lines-2-ingredient-error')?.textContent).toContain('No hay un ingrediente activo con ese nombre');
    expect(page.querySelector('#f-lines-4-quantity-error')?.textContent).toContain('mayor que 0');
    expect(page.querySelector('#f-lines-4-quantity')?.getAttribute('value')).toBe('0,5');
    expect([...page.querySelectorAll('[role="alert"] a')].map((link) => [link.getAttribute('href'), link.textContent?.replace(/\s+/g, ' ').trim()])).toEqual([
      ['#f-lines-2-ingredient', 'Línea 3, ingrediente: No hay un ingrediente activo con ese nombre: elige uno de la lista.'],
      ['#f-lines-4-quantity', 'Línea 5, cantidad neta: La cantidad neta debe ser mayor que 0, con punto decimal.'],
    ]);
  });

  it('un ciclo se rechaza con su ruta y conserva lo escrito (CA-4)', async () => {
    const { h, browser, chile, salsa } = await as(GEMA);
    const carne = addItem(h, 'Carne cocida ficticia', 'intermedio');
    h.api.inventory.recipes.saveFrom(carne.id, 'Ana Admin', 1, [{ ingredientId: salsa.id, quantity: 1, unit: 'kg', wastePercent: 0, note: null }]);
    const html = await (await browser.get(editorOf(salsa.id))).text();
    const res = await post(browser, html, salsa.id, { yieldQuantity: '1', 'lines.0.ingredient': 'Carne cocida ficticia', 'lines.0.quantity': '1', 'lines.0.unit': 'kg', 'lines.1.ingredient': chile.name, 'lines.1.quantity': '1', 'lines.1.unit': 'kg' });
    expect(res.status).toBe(422);
    const page = await res.text();
    expect(text(page)).toContain('Ruta del ciclo: Salsa ficticia → Carne cocida ficticia → Salsa ficticia.');
    expect(dom(page).querySelector('#f-lines-1-ingredient')?.getAttribute('value')).toBe('Chile ficticio');
  });
});

describe('receta, conflicto y API caída (RF-2, RF-6, RF-9, CA-6 y CA-7)', () => {
  it('«Sin costo» lista el faltante con su ruta, en la receta y en la lista', async () => {
    const { h, browser, chile, cebolla, salsa, taco } = await as(GEMA);
    h.api.inventory.recipes.saveFrom(salsa.id, 'Ana Admin', 2, [{ ingredientId: chile.id, quantity: 2, unit: 'kg', wastePercent: 0, note: null }]);
    h.api.inventory.recipes.saveFrom(taco.id, 'Ana Admin', 1, [
      { ingredientId: salsa.id, quantity: 0.1, unit: 'kg', wastePercent: 0, note: null },
      { ingredientId: cebolla.id, quantity: 50, unit: 'g', wastePercent: 0, note: null },
    ]);
    const detail = text(await (await browser.get(recipeOf(taco.id))).text());
    expect(detail).toContain('Sin costo: falta el costo de 1 ingrediente.');
    expect(detail).toContain('Cebolla ficticia');
    expect(detail).toContain('Costo por unidad Sin costo');
    expect(detail).toContain('Receta');
    const list = text(await (await browser.get('/inventario/recetas')).text());
    expect(list).toContain('Recetas vigentes con su costo teórico por unidad');
    expect(list).toContain('Sin costo (falta 1)');
    expect(list).toContain('$25.00 / kg');
    expect(text(await (await browser.get('/inventario/recetas?q=nada')).text())).toContain('No hay recetas vigentes que coincidan con los filtros.');
  });

  it('si otra sesión guardó antes, responde 409 con lo escrito y solo guarda encima si se pide', async () => {
    const { h, browser, chile, cebolla, salsa } = await as(ANA);
    h.api.inventory.recipes.saveFrom(salsa.id, 'Ana Admin', 2, [{ ingredientId: chile.id, quantity: 2, unit: 'kg', wastePercent: 0, note: null }]);
    const html = await (await browser.get(editorOf(salsa.id))).text();
    expect(dom(html).querySelector('#f-lines-0-ingredient')?.getAttribute('value')).toBe('Chile ficticio');
    h.api.inventory.recipes.saveFrom(salsa.id, 'Gema Gerente', 3, [{ ingredientId: cebolla.id, quantity: 3, unit: 'kg', wastePercent: 0, note: null }]);
    const conflict = await post(browser, html, salsa.id, { 'lines.0.quantity': '5' });
    expect(conflict.status).toBe(409);
    const page = await conflict.text();
    expect(text(page)).toContain('Otra persona cambió esta receta mientras la editabas: no se guardó nada.');
    expect(text(page)).toContain('Versión vigente: 2, de Gema Gerente');
    expect(dom(page).querySelector('#f-lines-0-quantity')?.getAttribute('value')).toBe('5');
    const latest = h.api.inventory.recipes.versions.at(-1);
    expect(formFields(page, '#inventory-recipe-form').baseVersionId).toBe(String(latest?.id));
    expect(h.api.inventory.recipes.versions).toHaveLength(2);

    const overwrite = await post(browser, page, salsa.id, {}, 'overwrite');
    expect(overwrite.status).toBe(303);
    expect(h.api.inventory.recipes.versions).toHaveLength(3);
    expect(h.api.inventory.recipes.versions.at(-1)?.lines[0]?.quantity).toBe(5);
  });

  it('con la API caída al guardar, responde 503 y conserva lo escrito', async () => {
    const { h, browser, salsa } = await as(GEMA);
    const html = await (await browser.get(editorOf(salsa.id))).text();
    h.api.mode = 'writes-down';
    const res = await post(browser, html, salsa.id, { yieldQuantity: '3', 'lines.0.ingredient': 'Chile ficticio', 'lines.0.quantity': '1', 'lines.0.unit': 'kg' });
    expect(res.status).toBe(503);
    const page = dom(await res.text());
    expect(page.body.textContent).toContain('Servicio no disponible.');
    expect(page.querySelector('#f-yieldQuantity')?.getAttribute('value')).toBe('3');
    expect(page.querySelector('#f-lines-0-ingredient')?.getAttribute('value')).toBe('Chile ficticio');
  });

  it('cerrar la receta pide confirmación y deja el artículo sin vigente; el historial queda en solo lectura', async () => {
    const { h, browser, chile, salsa } = await as(GEMA);
    const version = h.api.inventory.recipes.saveFrom(salsa.id, 'Ana Admin', 2, [{ ingredientId: chile.id, quantity: 2, unit: 'kg', wastePercent: 40, note: null }]);
    const confirm = await (await browser.get(`${recipeOf(salsa.id)}/cerrar`)).text();
    expect(text(confirm)).toContain('¿Cerrar esta receta?');
    const done = await browser.post(`${recipeOf(salsa.id)}/cerrar`, formFields(confirm, '.inventory-status'));
    expect(done.status).toBe(303);
    expect(text(await (await browser.get(`${recipeOf(salsa.id)}?ok=closed`)).text())).toContain('Receta cerrada: el artículo queda sin receta vigente.');
    const history = text(await (await browser.get(`/inventario/recetas/versiones/${version.id}`)).text());
    expect(history).toContain('Versión cerrada: es de solo lectura y se muestra sin costo.');
    expect(history).toContain('3.333 kg');
  });
});

describe('acceso, «usado en» e inactivación (CA-10 y CA-12)', () => {
  it('el editor recibe 403 en todas las pantallas y acciones de recetas, sin pedir nada del inventario a la API', async () => {
    const { h, browser, salsa } = await as(ELI);
    const csrf = formFields(await (await browser.get('/cuenta')).text(), '#user-form')._csrf ?? '';
    for (const path of ['/inventario/recetas', recipeOf(salsa.id), editorOf(salsa.id), `${recipeOf(salsa.id)}/cerrar`, '/inventario/recetas/versiones/1']) {
      expect((await browser.get(path)).status, path).toBe(403);
    }
    expect((await browser.post(recipeOf(salsa.id), { _csrf: csrf, action: 'save', yieldQuantity: '1' })).status).toBe(403);
    expect((await browser.post(`${recipeOf(salsa.id)}/cerrar`, { _csrf: csrf, version: '', baseVersionId: '' })).status).toBe(403);
    expect(h.api.requests.filter((request) => request.path.includes('/inventario'))).toEqual([]);
  });

  it('la ficha muestra «Usado en»; inactivar un ingrediente usado lista las recetas y exige confirmarlo', async () => {
    const { h, browser, chile, salsa } = await as(GEMA);
    h.api.inventory.recipes.saveFrom(salsa.id, 'Ana Admin', 2, [{ ingredientId: chile.id, quantity: 2, unit: 'kg', wastePercent: 0, note: null }]);
    const ficha = await (await browser.get(`/inventario/articulos/${chile.id}`)).text();
    expect(text(ficha)).toContain('Usado en Salsa ficticia (versión 1)');
    expect(text(ficha)).toContain('Costo de referencia $25.0000 por kg (con IVA)');
    expect(dom(ficha).querySelector('#usado-en + ul a')?.getAttribute('href')).toBe(recipeOf(salsa.id));

    // Página cargada antes de que se usara: no lleva la confirmación; la API responde 409 con la lista.
    const stale = await (await browser.get(`/inventario/articulos/${chile.id}/desactivar`)).text();
    expect(formFields(stale, '.inventory-status')).toMatchObject({ recipes: 'keep' });
    const withoutKeep = { ...formFields(stale, '.inventory-status') };
    delete withoutKeep.recipes;
    const rejected = await browser.post(`/inventario/articulos/${chile.id}/desactivar`, withoutKeep);
    expect(rejected.status).toBe(409);
    const confirm = await rejected.text();
    expect(text(confirm)).toContain('Se usa en 1 receta vigente.');
    expect(dom(confirm).querySelector('.confirm-panel')?.textContent).toContain('Salsa ficticia');
    expect(chile.active).toBe(true);
    expect((await browser.post(`/inventario/articulos/${chile.id}/desactivar`, formFields(confirm, '.inventory-status'))).status).toBe(303);
    expect(chile.active).toBe(false);
    expect(text(await (await browser.get(recipeOf(salsa.id))).text())).toContain('Esta versión usa ingredientes inactivos.');
    expect(text(await (await browser.get('/inventario/recetas')).text())).toContain('Usa artículos inactivos');
  });
});
