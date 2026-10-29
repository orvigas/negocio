import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

import { createUser, csrfFrom, login, loginAs, openForm, setupAdmin, submitForm, textOf } from '../support/admin.ts';

/**
 * Modo de solo lectura de los productos en el /admin actual (REQ-F-039, RF-15 y CA-13): con
 * ADMIN_NEW_URL, la edición de productos se hace en el admin nuevo. Las páginas muestran los
 * productos sin controles de edición, con un aviso y el enlace; ninguna escritura cambia nada (HTML:
 * 410 con el aviso; /admin/api: 410 PRODUCTS_MOVED). Usuarios, cuenta, bot y menú funcionan igual.
 * Sin la variable, el comportamiento es el de siempre (lo cubren admin-products.test.ts y
 * admin-products-api.test.ts).
 */

const NEW_ADMIN = 'https://admin.birriaelmuneco.test';
const ENV = { ADMIN_NEW_URL: NEW_ADMIN };

async function movedAdmin() {
  const context = await setupAdmin({ env: ENV });
  const browser = context.browser();
  expect((await login(browser)).status).toBe(303);
  const [first, second] = await context.products.list('molotes');
  /** Estado completo de los productos y del registro: nada debe cambiar. */
  const snapshot = async () => JSON.stringify([await context.products.list('molotes', { includeDeleted: true }), await context.prisma.productChange.count()]);
  return { ...context, newBrowser: context.browser, browser, first: first!, second: second!, snapshot };
}

describe('páginas de productos sin controles de edición', () => {
  it('la página del negocio lista los productos con el aviso y el enlace, sin agregar, editar, eliminar ni mover', async () => {
    const { browser } = await movedAdmin();
    const page = await browser.get('/admin/molotes');
    expect(page.status).toBe(200);
    const { document } = new JSDOM(page.text).window;
    const section = document.querySelector('.admin-products');
    expect(section).not.toBeNull();
    expect(section!.querySelectorAll('tbody th[scope="row"]').length).toBeGreaterThan(0);
    const text = textOf(section!.outerHTML);
    expect(text).toContain('Los productos ahora se editan en el admin nuevo.');
    expect(section!.querySelector(`a[href="${NEW_ADMIN}"]`)?.textContent).toBe('Ir al admin nuevo');
    for (const label of ['Agregar platillo', 'Agregar bebida', 'Editar', 'Eliminar', 'Subir', 'Bajar']) expect(text).not.toContain(label);
    expect(section!.querySelectorAll('form').length).toBe(0);
    expect(text).toContain('Ver productos eliminados');
    // El formulario de hero y promociones sigue en la misma página.
    expect(document.querySelector('#admin-form')).not.toBeNull();
  });

  it('los eliminados se consultan sin el botón Recuperar', async () => {
    const { browser, first, products } = await movedAdmin();
    await products.remove('molotes', first.id, first.version, { id: 1, name: 'dueno' });
    const page = await browser.get('/admin/molotes/productos/eliminados');
    expect(page.status).toBe(200);
    expect(textOf(page.text)).toContain(first.name);
    expect(textOf(page.text)).not.toContain('Recuperar');
    expect(page.text).toContain(`href="${NEW_ADMIN}"`);
  });

  it.each(['/admin/molotes/productos/nuevo?categoria=platillo', '/admin/birria/productos/nuevo'])('GET %s: 410 con el aviso y el enlace', async (path) => {
    const { browser } = await movedAdmin();
    const res = await browser.get(path);
    expect(res.status).toBe(410);
    expect(textOf(res.text)).toContain('Los productos ahora se editan en el admin nuevo.');
    expect(res.text).toContain(`href="${NEW_ADMIN}"`);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('editar y eliminar (páginas): 410 sin el formulario del producto', async () => {
    const { browser, first } = await movedAdmin();
    for (const path of [`/admin/molotes/productos/${first.id}`, `/admin/molotes/productos/${first.id}/eliminar`]) {
      const res = await browser.get(path);
      expect(res.status, path).toBe(410);
      expect(res.text).not.toContain('id="product-form"');
    }
  });
});

describe('ninguna escritura de productos cambia nada (CA-13)', () => {
  it('cualquier POST de productos, con o sin token CSRF: 410 con el aviso y la base sin cambios', async () => {
    const { browser, first, second, snapshot } = await movedAdmin();
    const csrf = csrfFrom((await browser.get('/admin/molotes')).text);
    const before = await snapshot();
    const posts: [string, Record<string, string>][] = [
      ['/admin/molotes/productos', { _csrf: csrf, action: 'create', category: 'platillo', name: 'Nuevo' }],
      [`/admin/molotes/productos/${first.id}`, { _csrf: csrf, action: 'update', version: String(first.version), name: 'Cambiado' }],
      [`/admin/molotes/productos/${first.id}/eliminar`, { _csrf: csrf, action: 'delete', version: String(first.version) }],
      [`/admin/molotes/productos/${first.id}/recuperar`, { _csrf: csrf, version: String(first.version) }],
      [`/admin/molotes/productos/${second.id}/subir`, { _csrf: csrf, version: String(second.version) }],
      [`/admin/molotes/productos/${first.id}/bajar`, { version: String(first.version) }],
    ];
    for (const [path, body] of posts) {
      const res = await browser.post(path).type('form').send(body);
      expect(res.status, path).toBe(410);
      expect(textOf(res.text)).toContain('Los productos ahora se editan en el admin nuevo.');
    }
    expect(await snapshot()).toBe(before);
  });

  it('sin sesión, un POST lleva al acceso; un editor en un negocio ajeno recibe 403; nada cambia', async () => {
    const context = await movedAdmin();
    const before = await context.snapshot();
    const anonymous = await context.request().post(`/admin/molotes/productos/${context.first.id}`).type('form').send({ action: 'update' });
    expect(anonymous.status).toBe(303);
    expect(anonymous.headers.location).toContain('/admin/login');
    await createUser(context.users, { username: 'birriero', businesses: ['birria'] });
    const editor = await loginAs(context.newBrowser(), 'birriero');
    const forbidden = await editor.post(`/admin/molotes/productos/${context.first.id}`).type('form').send({ action: 'update' });
    expect(forbidden.status).toBe(403);
    expect(forbidden.text).not.toContain('admin nuevo');
    expect(await context.snapshot()).toBe(before);
  });

  it('/admin/api: las escrituras responden 410 PRODUCTS_MOVED sin cambiar nada; las lecturas siguen', async () => {
    const { browser, request: client, first, snapshot } = await movedAdmin();
    const before = await snapshot();
    const base = '/admin/api/molotes/productos';
    const writes = [
      browser.post(base).send({ category: 'bebida', name: 'X' }),
      browser.put(`${base}/${first.id}`).send({ version: first.version }),
      browser.delete(`${base}/${first.id}?version=${first.version}`),
      browser.post(`${base}/${first.id}/recuperar`).send({ version: first.version }),
      browser.put(`${base}/orden`).send({ category: 'platillo', items: [] }),
    ];
    for (const res of await Promise.all(writes)) {
      expect(res.status).toBe(410);
      expect(res.body.error.code).toBe('PRODUCTS_MOVED');
      expect(res.body.error.message).toContain(NEW_ADMIN);
    }
    expect(await snapshot()).toBe(before);
    expect((await browser.get(base)).status).toBe(200);
    expect((await browser.get(`${base}/${first.id}`)).status).toBe(200);
    // Sin sesión, 401 antes que nada.
    expect((await client().post(base).send({})).status).toBe(401);
  });
});

describe('el resto del /admin funciona igual', () => {
  it('menú (hero y promociones), usuarios, cuenta y bot', async () => {
    const { browser } = await movedAdmin();
    const { fields } = await openForm(browser, 'molotes');
    expect((await submitForm(browser, 'molotes', fields, { 'menu.highlight': 'Destacado de prueba' })).status).toBe(303);
    for (const path of ['/admin/usuarios', '/admin/cuenta']) expect((await browser.get(path)).status, path).toBe(200);
    expect([200, 503]).toContain((await browser.get('/admin/bot')).status);
  });
});
