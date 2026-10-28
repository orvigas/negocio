import { describe, expect, it } from 'vitest';

import { product } from '../support/api-double.ts';
import { ANA, ELI, dom, formFields, startInventory, type Harness } from '../support/browser.ts';

/**
 * Productos en el admin nuevo, sin JavaScript (REQ-F-039: RF-7 a RF-11 y RF-16; CA-6 a CA-8 y CA-14),
 * contra el doble de /api/v1/admin. Todo con POST/redirect/GET.
 */

const MOLOTES = () => [product(1, 'molotes', 'Molote de Queso', 1), product(2, 'molotes', 'Molote de Papa', 2, { available: false }), product(3, 'birria', 'Refresco', 1)];

async function loggedIn(options: Parameters<typeof startInventory>[0] = {}) {
  const h = await startInventory({ products: MOLOTES(), ...options });
  const browser = h.browser();
  expect((await browser.login(ELI)).status).toBe(303);
  return { h, browser };
}

const csrfOf = (html: string): string => dom(html).querySelector<HTMLInputElement>('input[name="_csrf"]')?.value ?? '';
const lastWrite = (h: Harness) => [...h.api.requests].reverse().find((request) => request.method !== 'GET');

describe('lista (RF-8)', () => {
  it('muestra los activos por categoría y en su orden, con precio, estado en texto y acciones con nombre', async () => {
    const { browser } = await loggedIn();
    const res = await browser.get('/molotes/productos');
    expect(res.status).toBe(200);
    const page = dom(await res.text());
    expect(page.querySelectorAll('h1')).toHaveLength(1);
    expect([...page.querySelectorAll('h2')].map((h2) => h2.textContent)).toEqual(['Platillos', 'Bebidas']);
    const rows = [...page.querySelectorAll('[data-product-row]')];
    expect(rows.map((row) => row.querySelector('.product-row__name')?.textContent?.replace(/\s+/g, ' ').trim())).toEqual(['1. Molote de Queso', '2. Molote de Papa']);
    expect(rows[0]?.textContent).toContain('$25 c/u · $70 orden de 3');
    expect(rows[1]?.textContent).toContain('No disponible');
    // El primero no se sube y el último no se baja; cada botón dice qué producto mueve.
    expect(rows[0]?.querySelector('[data-reorder-button="up"]')).toBeNull();
    expect(rows[0]?.querySelector('[data-reorder-button="down"]')?.textContent).toBe('Bajar Molote de Queso');
    expect(rows[1]?.querySelector('[data-reorder-button="down"]')).toBeNull();
    expect(page.querySelector('.admin-header__nav a[aria-current="page"]')?.textContent).toBe('Molotes');
    expect(page.body.className).toContain('admin-shell--molotes');
  });
});

describe('alta (RF-7, CA-6)', () => {
  it('sin JS: el formulario sale del descriptor, crea el producto con la clave de idempotencia y el token CSRF, y vuelve a la lista', async () => {
    const { h, browser } = await loggedIn();
    const html = await (await browser.get('/molotes/productos/nuevo?categoria=platillo')).text();
    const page = dom(html);
    expect(page.querySelector('h1')?.textContent).toBe('Nuevo platillo de Molotes');
    const fields = formFields(html, '#product-form');
    expect(fields.requestId).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(fields.category).toBe('platillo');
    const res = await browser.post('/molotes/productos', { ...fields, name: 'Molote de Frijol', price: '30', action: 'create' });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/molotes/productos?ok=created');
    const write = lastWrite(h);
    expect(write?.headers['idempotency-key']).toBe(fields.requestId);
    expect(write?.headers['x-csrf-token']).toBe(fields._csrf);
    expect(write?.body).toMatchObject({ name: 'Molote de Frijol', price: '30', category: 'platillo', image: { src: '' } });
    const list = await (await browser.get(res.headers.get('location') ?? '')).text();
    expect(list).toContain('Producto creado como no disponible y al final de su categoría.');
    expect(list).toContain('Molote de Frijol');
  });

  it('doble envío del mismo formulario: un solo producto (misma clave)', async () => {
    const { h, browser } = await loggedIn();
    const fields = formFields(await (await browser.get('/molotes/productos/nuevo?categoria=bebida')).text(), '#product-form');
    const body = { ...fields, name: 'Agua de Jamaica', action: 'create' };
    await Promise.all([browser.post('/molotes/productos', body), browser.post('/molotes/productos', body)]);
    expect(h.api.products.filter((candidate) => candidate.name === 'Agua de Jamaica')).toHaveLength(1);
  });

  it('422: se vuelve a pintar con lo escrito, el error junto a su campo y un resumen con enlaces (CA-14)', async () => {
    const { browser } = await loggedIn();
    const fields = formFields(await (await browser.get('/molotes/productos/nuevo?categoria=platillo')).text(), '#product-form');
    const res = await browser.post('/molotes/productos', { ...fields, name: '', description: 'Lo que escribí', action: 'create' });
    expect(res.status).toBe(422);
    const page = dom(await res.text());
    const name = page.querySelector<HTMLInputElement>('#f-name');
    expect(name?.getAttribute('aria-invalid')).toBe('true');
    expect(name?.getAttribute('aria-describedby')).toContain('f-name-error');
    expect(page.querySelector('#f-name-error')?.textContent).toContain('Escribe el nombre.');
    expect(page.querySelector('#f-description')?.textContent).toBe('Lo que escribí');
    const summary = page.querySelector('[role="alert"]');
    expect(summary?.textContent).toContain('No se guardó nada');
    expect(summary?.querySelector('a[href="#f-name"]')?.textContent).toBe('Nombre: Escribe el nombre.');
    // La misma clave de idempotencia (nada se creó).
    expect(page.querySelector<HTMLInputElement>('input[name="requestId"]')?.value).toBe(fields.requestId);
  });

  it('Birria: primero se elige el tipo de detalle', async () => {
    const h = await startInventory({ products: MOLOTES() });
    const browser = h.browser();
    await browser.login(ANA);
    const page = dom(await (await browser.get('/birria/productos/nuevo')).text());
    expect([...page.querySelectorAll('.kind-choice__option')].map((link) => link.getAttribute('href'))).toEqual([
      '/birria/productos/nuevo?categoria=platillo&tipo=chips',
      '/birria/productos/nuevo?categoria=platillo&tipo=portion',
      '/birria/productos/nuevo?categoria=platillo&tipo=variants',
    ]);
    const form = dom(await (await browser.get('/birria/productos/nuevo?categoria=platillo&tipo=variants')).text());
    expect(form.querySelectorAll('.product-form__row')).toHaveLength(6);
    expect(form.querySelector<HTMLSelectElement>('#f-variants-2-position')?.value).toBe('3');
    // Un tipo que no existe para el negocio: 404.
    expect((await browser.get('/molotes/productos/nuevo?categoria=postre')).status).toBe(200);
    expect((await browser.get('/birria/productos/nuevo?categoria=platillo&tipo=otro')).status).toBe(404);
  });
});

describe('edición y conflicto (RF-9, CA-7)', () => {
  it('edita con la versión y vuelve con el aviso de frescura (pendiente si la API lo dice)', async () => {
    const { h, browser } = await loggedIn();
    h.api.freshness = 'pending';
    const html = await (await browser.get('/molotes/productos/1/editar')).text();
    const fields = formFields(html, '#product-form');
    expect(fields).toMatchObject({ name: 'Molote de Queso', price: '25.00', available: 'on', version: '1' });
    const res = await browser.post('/molotes/productos/1', { ...fields, name: 'Molote de Queso Oaxaca', action: 'update' });
    expect(res.headers.get('location')).toBe('/molotes/productos?ok=saved&pendiente=1');
    expect(await (await browser.get(res.headers.get('location') ?? '')).text()).toContain('como mucho en un minuto');
    expect(lastWrite(h)?.body).toMatchObject({ name: 'Molote de Queso Oaxaca', version: 1, available: true });
  });

  it('409: conserva lo escrito, dice quién y cuándo, y solo guarda encima si se pide; nunca en silencio', async () => {
    const { h, browser } = await loggedIn();
    const fields = formFields(await (await browser.get('/molotes/productos/1/editar')).text(), '#product-form');
    h.api.touch(1, 'Luis');
    const res = await browser.post('/molotes/productos/1', { ...fields, name: 'Mi cambio', action: 'update' });
    expect(res.status).toBe(409);
    const html = await res.text();
    const page = dom(html);
    expect(page.querySelector<HTMLInputElement>('#f-name')?.value).toBe('Mi cambio');
    expect(page.body.textContent).toContain('Última modificación: Luis, el 28/10/2026 12:30.');
    // DEF-008: el aviso de conflicto es una alerta y recibe el foco, como el 422 y el 503.
    const alert = page.querySelector('.notice--warning');
    expect(alert?.getAttribute('role')).toBe('alert');
    expect(alert?.getAttribute('tabindex')).toBe('-1');
    expect(alert?.hasAttribute('autofocus')).toBe(true);
    expect(page.querySelector('a[href="/molotes/productos/1/editar"]')?.textContent).toContain('Cargar la versión vigente');
    expect(page.querySelector('button[value="update"]')).toBeNull();
    expect(page.querySelector('button[value="overwrite"]')?.textContent).toBe('Guardar mis cambios sobre la versión vigente');
    expect(h.api.products.find((candidate) => candidate.id === 1)?.name).toBe('Molote de Queso');
    const again = formFields(html, '#product-form');
    expect(again.version).toBe('2');
    const overwrite = await browser.post('/molotes/productos/1', { ...again, action: 'overwrite' });
    expect(overwrite.status).toBe(303);
    expect(lastWrite(h)?.path).toBe('/api/v1/admin/molotes/productos/1');
    expect(h.api.requests.at(-1)?.method).toBe('PUT');
    expect(h.api.products.find((candidate) => candidate.id === 1)?.name).toBe('Mi cambio');
  });

  it('la API caída o en 503 al guardar: aviso claro, formulario intacto y sin trazas (RF-10, CA-8)', async () => {
    const { h, browser } = await loggedIn();
    const fields = formFields(await (await browser.get('/molotes/productos/1/editar')).text(), '#product-form');
    h.api.mode = 'down';
    const res = await browser.post('/molotes/productos/1', { ...fields, name: 'Escrito antes de la caída', action: 'update' });
    expect(res.status).toBe(503);
    const html = await res.text();
    const page = dom(html);
    expect(page.querySelector('[role="alert"]')?.textContent).toContain('Servicio no disponible.');
    expect(page.querySelector<HTMLInputElement>('#f-name')?.value).toBe('Escrito antes de la caída');
    expect(html).not.toMatch(/DATABASE_UNAVAILABLE|\n\s+at |stack/);
  });

  it('alta con la API caída: 503 con lo escrito intacto (RF-10)', async () => {
    const { h, browser } = await loggedIn();
    const fields = formFields(await (await browser.get('/molotes/productos/nuevo?categoria=bebida')).text(), '#product-form');
    h.api.mode = 'down';
    const res = await browser.post('/molotes/productos', { ...fields, name: 'Horchata', description: 'De arroz', action: 'create' });
    expect(res.status).toBe(503);
    const page = dom(await res.text());
    expect(page.querySelector<HTMLInputElement>('#f-name')?.value).toBe('Horchata');
    expect(page.querySelector('#f-description')?.textContent).toBe('De arroz');
    expect(page.querySelector<HTMLInputElement>('input[name="requestId"]')?.value).toBe(fields.requestId);
  });

  it('un producto inexistente o eliminado: 404 sin datos', async () => {
    const { browser } = await loggedIn();
    expect((await browser.get('/molotes/productos/999/editar')).status).toBe(404);
    expect((await browser.get('/molotes/productos/abc/editar')).status).toBe(404);
  });
});

describe('eliminar, recuperar y reordenar (RF-8, CA-6)', () => {
  it('eliminar pide confirmación; recuperar desde "Ver eliminados"', async () => {
    const { h, browser } = await loggedIn();
    const confirm = await (await browser.get('/molotes/productos/2/eliminar')).text();
    expect(dom(confirm).querySelector('h1')?.textContent).toBe('Eliminar Molote de Papa');
    const fields = formFields(confirm, '.confirm-panel__form');
    const removed = await browser.post('/molotes/productos/2/eliminar', fields);
    expect(removed.headers.get('location')).toBe('/molotes/productos?ok=deleted');
    expect(h.api.products.find((candidate) => candidate.id === 2)?.deleted).toBe(true);
    // Con la versión vieja, el conflicto se avisa en la confirmación (si sigue sin eliminar) o vuelve.
    const deletedPage = await (await browser.get('/molotes/productos/eliminados')).text();
    expect(deletedPage).toContain('Molote de Papa');
    const restoreFields = formFields(deletedPage, '.product-row__restore');
    const restored = await browser.post('/molotes/productos/2/recuperar', restoreFields);
    expect(restored.headers.get('location')).toBe('/molotes/productos?ok=restored');
    expect(h.api.products.find((candidate) => candidate.id === 2)).toMatchObject({ deleted: false, available: false });
    const stale = await browser.post('/molotes/productos/2/recuperar', restoreFields);
    expect(stale.status).toBe(409);
  });

  it('sin JS, subir y bajar con PRG; con la versión vieja no mueve nada y lo avisa', async () => {
    const { h, browser } = await loggedIn();
    const page = await (await browser.get('/molotes/productos')).text();
    const csrf = csrfOf(page);
    const moved = await browser.post('/molotes/productos/2/subir', { _csrf: csrf, version: '1' });
    expect(moved.headers.get('location')).toBe('/molotes/productos?ok=moved');
    expect(h.api.products.find((candidate) => candidate.id === 2)?.position).toBe(1);
    const stale = await browser.post('/molotes/productos/2/bajar', { _csrf: csrf, version: '1' });
    expect(stale.headers.get('location')).toBe('/molotes/productos?problema=orden');
    expect(await (await browser.get('/molotes/productos?problema=orden')).text()).toContain('no se movió nada');
  });

  it('con JS (X-Fragment): responde el fragmento de la lista vigente y el resultado', async () => {
    const { browser } = await loggedIn();
    const csrf = csrfOf(await (await browser.get('/molotes/productos')).text());
    const res = await browser.post('/molotes/productos/2/subir', { _csrf: csrf, version: '1' }, { 'x-fragment': 'product-list' });
    expect(res.status).toBe(200);
    expect(res.headers.get('x-reorder-result')).toBe('confirmed');
    const fragment = await res.text();
    expect(fragment).not.toContain('<html');
    expect(fragment.indexOf('Molote de Papa')).toBeLessThan(fragment.indexOf('Molote de Queso'));
    const conflict = await browser.post('/molotes/productos/2/subir', { _csrf: csrf, version: '1' }, { 'x-fragment': 'product-list' });
    expect(conflict.status).toBe(409);
    expect(conflict.headers.get('x-reorder-result')).toBe('conflict');
  });
});

describe('accesibilidad del formulario (RF-16, CA-14)', () => {
  it('cada campo tiene su etiqueta, hay un solo h1, salto al contenido y foco en el resumen de errores', async () => {
    const h = await startInventory({ products: MOLOTES() });
    const browser = h.browser();
    await browser.login(ANA);
    const page = dom(await (await browser.get('/birria/productos/nuevo?categoria=platillo&tipo=variants')).text());
    const controls = [...page.querySelectorAll('#product-form input:not([type="hidden"]), #product-form select, #product-form textarea')];
    expect(controls.length).toBeGreaterThan(20);
    for (const control of controls) expect(page.querySelector(`label[for="${control.id}"]`), control.id).not.toBeNull();
    expect(page.querySelectorAll('h1')).toHaveLength(1);
    expect(page.querySelector('a[href="#contenido"]')?.textContent).toBe('Saltar al contenido');
    expect(page.documentElement.lang).toBe('es');
    // Los botones dicen qué hacen.
    expect(page.querySelector('#product-form button[type="submit"]')?.textContent).toBe('Crear producto');
  });
});
