import { describe, expect, it } from 'vitest';

import type { DoubleUser } from '../support/api-double.ts';
import { ANA, ELI, GEMA, dom, formFields, startInventory, type Browser, type Harness } from '../support/browser.ts';

/**
 * Pantallas del inventario (REQ-F-049, T1: RF-1 a RF-9 y RF-11; CA-1, CA-4, CA-7 a CA-11 y CA-13)
 * contra el doble de /api/v1/admin/inventario, sin JavaScript (formularios GET y POST/redirect/GET).
 * Las reglas reales del catálogo están en api/tests (core y la API).
 */

async function as(user: DoubleUser) {
  const h = await startInventory({ users: [ANA, ELI, GEMA] });
  const browser = h.browser();
  expect((await browser.login(user)).status).toBe(303);
  return { h, browser };
}

const text = (html: string) => dom(html).body.textContent?.replace(/\s+/g, ' ') ?? '';
const navLabels = (html: string) => [...dom(html).querySelectorAll('.admin-header__nav a')].map((link) => link.textContent);
const inventoryRequests = (h: Harness) => h.api.requests.filter((request) => request.path.includes('/inventario'));

/** Envía el formulario de la página con cambios (como lo haría el navegador). */
async function submit(browser: Browser, path: string, selector: string, changes: Record<string, string>, action?: string) {
  const html = await (await browser.get(path)).text();
  const form = dom(html).querySelector(selector);
  const fields = { ...formFields(html, selector), ...changes };
  return browser.post(action ?? form?.getAttribute('action') ?? path, fields);
}

async function category(browser: Browser, name: string) {
  expect((await submit(browser, '/inventario/categorias', '#inventory-category-form', { name })).status).toBe(303);
}

async function createItem(browser: Browser, changes: Record<string, string>, path = '/inventario/articulos/nuevo') {
  const html = await (await browser.get(path)).text();
  const select = dom(html).querySelector('#f-categoryId');
  const firstCategory = select ? ([...select.querySelectorAll('option')].find((option) => option.value !== '')?.value ?? '') : '';
  const res = await browser.post('/inventario/articulos', { ...formFields(html, '#inventory-item-form'), ...(select ? { categoryId: firstCategory } : {}), action: 'create', ...changes });
  return res;
}

describe('acceso por rol (RF-9, CA-10 y CA-11)', () => {
  it('el editor no ve "Inventario" y recibe 403 en las pantallas y acciones, sin pedir nada del inventario a la API', async () => {
    const { h, browser } = await as(ELI);
    expect(navLabels(await (await browser.get('/molotes/productos')).text())).not.toContain('Inventario');
    const csrf = formFields(await (await browser.get('/cuenta')).text(), '#user-form')._csrf ?? '';
    for (const path of ['/inventario/articulos', '/inventario/articulos/nuevo', '/inventario/articulos/1', '/inventario/articulos/1/editar', '/inventario/categorias']) {
      const res = await browser.get(path);
      expect(res.status, path).toBe(403);
      expect(await res.text()).toContain('No tienes permiso para gestionar el inventario.');
    }
    for (const [path, form] of [
      ['/inventario/articulos', { _csrf: csrf, action: 'create', kind: 'simple', name: 'x', type: 'insumo', baseUnit: 'kg' }],
      ['/inventario/articulos/1', { _csrf: csrf, action: 'update', kind: 'simple', name: 'x', version: '1' }],
      ['/inventario/articulos/1/desactivar', { _csrf: csrf, version: '1' }],
      ['/inventario/articulos/1/reactivar', { _csrf: csrf, version: '1' }],
      ['/inventario/categorias', { _csrf: csrf, name: 'x' }],
      ['/inventario/categorias/1', { _csrf: csrf, name: 'x' }],
      ['/inventario/categorias/1/desactivar', { _csrf: csrf, version: '' }],
    ] as const) {
      expect((await browser.post(path, form)).status, path).toBe(403);
    }
    expect(inventoryRequests(h)).toEqual([]);
  });

  it('el gerente entra al inventario desde el inicio, solo ve "Inventario" y recibe 403 en usuarios, bot, cotizador, productos y página', async () => {
    const { browser } = await as(GEMA);
    const home = await browser.get('/');
    expect(home.status).toBe(303);
    expect(home.headers.get('location')).toBe('/inventario/articulos');
    const list = await (await browser.get('/inventario/articulos')).text();
    expect(navLabels(list)).toEqual(['Inventario']);
    expect(dom(list).querySelector('.admin-header__nav a[aria-current="page"]')?.textContent).toBe('Inventario');
    expect([...dom(list).querySelectorAll('.admin-header__subnav a')].map((link) => link.textContent)).toEqual(['Artículos', 'Categorías']);
    for (const path of ['/usuarios', '/bot', '/birria/cotizador', '/molotes/productos', '/birria/pagina']) expect((await browser.get(path)).status, path).toBe(403);
  });
});

describe('alta, ficha y conversión (RF-2 a RF-4, CA-1 y CA-4)', () => {
  it('el gerente crea un insumo con su empaque; la ficha muestra la equivalencia, convierte y registra el alta con su nombre', async () => {
    const { h, browser } = await as(GEMA);
    await category(browser, 'Abarrotes');
    const res = await createItem(browser, { name: 'Masa de maíz', type: 'insumo', baseUnit: 'kg', 'units.0.name': 'bulto', 'units.0.factor': '25' });
    expect(res.status).toBe(303);
    const location = res.headers.get('location') ?? '';
    expect(location).toMatch(/^\/inventario\/articulos\/\d+\?ok=created$/);
    const create = h.api.requests.find((request) => request.method === 'POST' && request.path.endsWith('/inventario/articulos'));
    expect(create?.body).toMatchObject({ kind: 'simple', type: 'insumo', name: 'Masa de maíz', baseUnit: 'kg', units: [{ name: 'bulto', factor: '25' }] });

    const page = text(await (await browser.get(location)).text());
    expect(page).toContain('Artículo creado.');
    expect(page).toContain('1 bulto = 25 kg');
    expect(page).toMatch(/1 bulto\s*25 kg/);
    expect(page).toContain('Alta · Gema Gerente');

    const id = location.split('?')[0] ?? '';
    const converted = await browser.get(`${id}?cantidad=2&unidad=bulto`);
    expect(converted.status).toBe(200);
    expect(text(await converted.text())).toContain('2 bulto = 50 kg');
    const rejected = await browser.get(`${id}?cantidad=2&unidad=pza`);
    expect(rejected.status).toBe(422);
    expect(text(await rejected.text())).toContain('No hay factor para convertir pza a kg');

    const list = text(await (await browser.get('/inventario/articulos')).text());
    expect(list).toContain('Masa de maíz');
    expect(list).toContain('1 artículo.');
  });

  it('un 422 conserva lo escrito y marca cada campo con texto, enlace del resumen y aria-invalid, también en la fila de empaque correcta', async () => {
    const { browser } = await as(GEMA);
    await category(browser, 'Abarrotes');
    expect((await createItem(browser, { name: 'Sal', type: 'insumo', baseUnit: 'kg' })).status).toBe(303);
    const res = await createItem(browser, { name: 'sal', type: 'insumo', baseUnit: 'kg', 'units.1.name': 'costal', 'units.1.factor': '0' });
    expect(res.status).toBe(422);
    const page = dom(await res.text());
    expect(page.querySelector('#f-name')?.getAttribute('aria-invalid')).toBe('true');
    expect(page.querySelector('#f-name')?.getAttribute('value')).toBe('sal');
    expect(page.querySelector('#f-name-error')?.textContent).toContain('Ya hay un artículo activo con ese nombre.');
    expect(page.querySelector('#f-units-1-factor')?.getAttribute('aria-invalid')).toBe('true');
    expect(page.querySelector('#f-units-1-name')?.getAttribute('value')).toBe('costal');
    expect([...page.querySelectorAll('[role="alert"] a')].map((link) => link.getAttribute('href'))).toEqual(['#f-name', '#f-units-1-factor']);
  });

  it('con la API caída al guardar, responde 503 y conserva lo escrito', async () => {
    const { h, browser } = await as(GEMA);
    await category(browser, 'Abarrotes');
    const html = await (await browser.get('/inventario/articulos/nuevo')).text();
    h.api.mode = 'writes-down';
    const res = await browser.post('/inventario/articulos', { ...formFields(html, '#inventory-item-form'), action: 'create', name: 'Jitomate', type: 'insumo', baseUnit: 'kg' });
    expect(res.status).toBe(503);
    const page = dom(await res.text());
    expect(page.querySelector('#f-name')?.getAttribute('value')).toBe('Jitomate');
    expect(page.body.textContent).toContain('Servicio no disponible.');
  });
});

describe('edición con conflicto (RF-8, CA-9)', () => {
  it('si otra sesión guardó antes, muestra quién y cuándo con lo escrito, y solo guarda encima si se pide', async () => {
    const { h, browser } = await as(ANA);
    await category(browser, 'Verduras');
    const created = await createItem(browser, { name: 'Cebolla', type: 'insumo', baseUnit: 'kg' });
    const id = Number(/\/(\d+)\?/.exec(created.headers.get('location') ?? '')?.[1]);
    const html = await (await browser.get(`/inventario/articulos/${id}/editar`)).text();
    h.api.inventory.touch(id, 'Gema Gerente');
    const conflict = await browser.post(`/inventario/articulos/${id}`, { ...formFields(html, '#inventory-item-form'), action: 'update', name: 'Cebolla blanca' });
    expect(conflict.status).toBe(409);
    const body = await conflict.text();
    expect(text(body)).toContain('Otra persona cambió este artículo mientras lo editabas: no se guardó nada.');
    expect(text(body)).toContain('Última modificación: Gema Gerente, el 19/11/2026 12:30.');
    expect(h.api.inventory.items.find((item) => item.id === id)?.name).toBe('Cebolla');
    const overwrite = await browser.post(`/inventario/articulos/${id}`, { ...formFields(body, '#inventory-item-form'), action: 'overwrite' });
    expect(overwrite.status).toBe(303);
    expect(h.api.inventory.items.find((item) => item.id === id)?.name).toBe('Cebolla blanca');
    expect(text(await (await browser.get(`/inventario/articulos/${id}`)).text())).toContain('Edición guardada sobre otra versión');
  });
});

describe('variantes, baja y categorías (RF-5 a RF-7, CA-7, CA-8 y CA-13)', () => {
  it('un padre con variantes se inactiva con confirmación junto con ellas, y los filtros de estado lo muestran', async () => {
    const { h, browser } = await as(GEMA);
    await category(browser, 'Bebidas');
    const parent = await createItem(browser, { name: 'Refresco 600 ml', type: 'reventa' }, '/inventario/articulos/nuevo?clase=padre');
    expect(parent.status).toBe(303);
    const parentId = Number(/\/(\d+)\?/.exec(parent.headers.get('location') ?? '')?.[1]);
    const form = dom(await (await browser.get(`/inventario/articulos/nuevo?padre=${parentId}`)).text());
    expect(form.querySelector('#f-categoryId')).toBeNull();
    expect(form.body.textContent).toContain('Reventa · Bebidas (los hereda de Refresco 600 ml)');
    expect((await createItem(browser, { name: 'Coca-Cola', baseUnit: 'pza', 'units.0.name': 'caja', 'units.0.factor': '24' }, `/inventario/articulos/nuevo?padre=${parentId}`)).status).toBe(303);

    const detail = text(await (await browser.get(`/inventario/articulos/${parentId}`)).text());
    expect(detail).toContain('No tiene: se controlan en cada variante.');
    expect(detail).toContain('Coca-Cola');

    const confirm = await (await browser.get(`/inventario/articulos/${parentId}/desactivar`)).text();
    expect(text(confirm)).toContain('Tiene 1 variante activa: se inactivarán también.');
    const done = await browser.post(`/inventario/articulos/${parentId}/desactivar`, formFields(confirm, '.inventory-status'));
    expect(done.status).toBe(303);
    expect(h.api.inventory.items.every((item) => !item.active)).toBe(true);

    expect(text(await (await browser.get('/inventario/articulos')).text())).toContain('No hay artículos que coincidan con los filtros.');
    const inactive = text(await (await browser.get('/inventario/articulos?estado=inactive')).text());
    expect(inactive).toContain('Refresco 600 ml');
    expect(inactive).toContain('Variantes: 1');
    expect((await browser.get('/inventario/articulos?estado=otro')).status).toBe(422);
  });

  it('la baja de un padre sin la confirmación de sus variantes activas no inactiva nada y vuelve a pedirla con sus nombres', async () => {
    const { h, browser } = await as(GEMA);
    await category(browser, 'Bebidas');
    const parent = await createItem(browser, { name: 'Refresco 600 ml', type: 'reventa' }, '/inventario/articulos/nuevo?clase=padre');
    const parentId = Number(/\/(\d+)\?/.exec(parent.headers.get('location') ?? '')?.[1]);
    const variant = await createItem(browser, { name: 'Coca-Cola', baseUnit: 'pza' }, `/inventario/articulos/nuevo?padre=${parentId}`);
    const variantId = Number(/\/(\d+)\?/.exec(variant.headers.get('location') ?? '')?.[1]);
    const variantPath = `/inventario/articulos/${variantId}`;
    const variantConfirm = await (await browser.get(`${variantPath}/desactivar`)).text();
    expect((await browser.post(`${variantPath}/desactivar`, formFields(variantConfirm, '.inventory-status'))).status).toBe(303);

    // Formulario cargado sin variantes activas: no lleva la confirmación.
    const stale = await (await browser.get(`/inventario/articulos/${parentId}/desactivar`)).text();
    expect(formFields(stale, '.inventory-status')).not.toHaveProperty('variants');
    const detail = await (await browser.get(variantPath)).text();
    expect((await browser.post(dom(detail).querySelector('.inventory-status')?.getAttribute('action') ?? '', formFields(detail, '.inventory-status'))).status).toBe(303);

    const again = await browser.post(`/inventario/articulos/${parentId}/desactivar`, formFields(stale, '.inventory-status'));
    expect(again.status).toBe(409);
    expect(h.api.inventory.items.every((item) => item.active)).toBe(true);
    const confirm = await again.text();
    expect(text(confirm)).toContain('Tiene 1 variante activa: se inactivarán también.');
    expect(dom(confirm).querySelector('.confirm-panel')?.textContent).toContain('Coca-Cola');
    expect(formFields(confirm, '.inventory-status')).toMatchObject({ variants: 'deactivate' });

    expect((await browser.post(`/inventario/articulos/${parentId}/desactivar`, formFields(confirm, '.inventory-status'))).status).toBe(303);
    expect(h.api.inventory.items.every((item) => !item.active)).toBe(true);
  });

  it('no deja inactivar una categoría que usan artículos activos e indica cuántos', async () => {
    const { browser } = await as(GEMA);
    await category(browser, 'Lácteos');
    expect((await createItem(browser, { name: 'Queso', type: 'insumo', baseUnit: 'kg' })).status).toBe(303);
    const list = await (await browser.get('/inventario/categorias')).text();
    expect(text(list)).toContain('1 artículo activo');
    const statusForm = dom(list).querySelector('.inventory-status');
    const res = await browser.post(statusForm?.getAttribute('action') ?? '', formFields(list, '.inventory-status'));
    expect(res.status).toBe(409);
    expect(text(await res.text())).toContain('la usan 1 artículos activos');
  });
});
