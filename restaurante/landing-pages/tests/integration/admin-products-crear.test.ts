import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';

import type { ProductStore } from '@restaurante/core/catalog';
import { SESSION_IDLE_MS } from '@restaurante/core/identity';

import { createUser, formFields, loginAs, openForm, setupAdmin, submitForm, textOf } from '../support/admin.ts';
import { PRODUCT_FORM, loggedIn, idOf, openProduct, send, editPath, updateAction } from '../support/admin-products-page.ts';

/**
 * Administración HTML de productos (REQ-F-008, RF-6): sin JavaScript, con POST-redirect-GET.
 * Incluye las pruebas que antes editaban productos desde el formulario de página (REQ-F-001:
 * CA-1, CA-5, CA-7, CA-8, CA-10, CA-15, CA-16 y CA-19), ahora sobre el formulario de producto.
 *
 * REQ-F-041: parte de admin-products.test.ts (preparación en
 * tests/support/admin-products-page.ts).
 */

describe('crear, eliminar, recuperar y ordenar sin JavaScript (CA-25 a CA-27, CA-32)', () => {
  it('CA-32: crear un platillo de Molotes con PRG; queda al final y no disponible', async () => {
    const { browser, products, request: client } = await loggedIn();
    const page = await browser.get('/admin/molotes/productos/nuevo?categoria=platillo');
    expect(page.status).toBe(200);
    // DEF-001: título y h1 concuerdan en género con la categoría.
    expect(page.text).toContain('<title>Nuevo platillo | Administración</title>');
    expect(page.text).toMatch(/<h1[^>]*>Nuevo platillo<\/h1>/);
    const drinkPage = await browser.get('/admin/molotes/productos/nuevo?categoria=bebida');
    expect(drinkPage.text).toContain('<title>Nueva bebida | Administración</title>');
    expect(drinkPage.text).toMatch(/<h1[^>]*>Nueva bebida<\/h1>/);
    expect((await browser.get('/admin/birria/productos/nuevo?categoria=platillo&tipo=variants')).text).toMatch(/<h1[^>]*>Nuevo platillo con variantes<\/h1>/);
    const fields = formFields(page.text, PRODUCT_FORM);
    expect(fields).toMatchObject({ category: 'platillo' });
    expect(fields).not.toHaveProperty('available');
    const res = await send(browser, '/admin/molotes/productos', fields, {
      action: 'create',
      name: 'Molote de Frijol',
      description: 'Frijol con queso.',
      label: 'Nuevo',
      tone: 'sky',
      price: '45',
      orderPrice: '130',
      orderQuantity: '3',
      'image.src': '/img/molotes/molotes-queso-oaxaca.jpg',
      'image.alt': 'Molote',
      'image.width': '800',
      'image.height': '600',
    });
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe('/admin/molotes?ok=product_created');
    const created = (await products.list('molotes', { category: 'platillo' })).at(-1)!;
    expect(created).toMatchObject({ name: 'Molote de Frijol', slug: 'molote-de-frijol', available: false, version: 1, updatedBy: { actorName: 'dueno' } });
    expect((await client().get('/molotes')).text).not.toContain('Molote de Frijol');
    expect(textOf((await browser.get(res.headers.location!)).text)).toContain('Producto creado.');
  });

  it('crear un platillo de Birria: primero el tipo de detalle; un error conserva lo escrito', async () => {
    const { browser, products } = await loggedIn();
    const choice = await browser.get('/admin/birria/productos/nuevo');
    expect(choice.status).toBe(200);
    expect(choice.text).toContain('name="tipo" type="radio" value="chips"');
    const page = await browser.get('/admin/birria/productos/nuevo?categoria=platillo&tipo=chips');
    const fields = formFields(page.text, PRODUCT_FORM);
    expect(fields).toMatchObject({ category: 'platillo', detailsType: 'chips' });
    const base = {
      action: 'create',
      name: 'Taco Dorado',
      label: 'Crujiente',
      description: 'Dorado en comal.',
      price: '40',
      priceUnit: 'c/u',
      'image.src': '/img/birria/taco-de-birria.jpg',
      'image.alt': 'Taco',
      'image.width': '800',
      'image.height': '600',
      detailsLabel: 'Incluye:',
    };
    const invalid = await send(browser, '/admin/birria/productos', fields, base);
    expect(invalid.status).toBe(422);
    expect(formFields(invalid.text, PRODUCT_FORM).name).toBe('Taco Dorado');
    expect(invalid.text).toContain('id="f-chips-error"');
    const res = await send(browser, '/admin/birria/productos', fields, { ...base, 'chips.0.text': 'Consomé', 'chips.0.highlight': 'on' });
    expect(res.status).toBe(303);
    expect((await products.list('birria')).at(-1)).toMatchObject({ slug: 'taco-dorado', detailsType: 'chips', chips: [{ text: 'Consomé', highlight: true }] });
    // Tipos y categorías inválidos: 404.
    expect((await browser.get('/admin/birria/productos/nuevo?categoria=bebida&tipo=chips')).status).toBe(404);
    expect((await browser.get('/admin/birria/productos/nuevo?tipo=otro')).status).toBe(404);
    expect((await browser.get('/admin/molotes/productos/nuevo')).status).toBe(404);
  });

  it('CA-25 / CA-26: eliminar con confirmación y recuperar desde "Eliminados"', async () => {
    const { browser, request: client, products } = await loggedIn();
    const id = await idOf(products, 'birria', 'quesabirria');
    const confirm = await browser.get(`${editPath('birria', id)}/eliminar`);
    expect(confirm.status).toBe(200);
    expect(textOf(confirm.text)).toContain('¿Eliminar «Quesabirria con Tortilla de Mano»?');
    const form = formFields(confirm.text, 'form.mt-4');
    const res = await browser.post(`${editPath('birria', id)}/eliminar`).type('form').send({ ...form, action: 'delete' });
    expect(res.status).toBe(303);
    expect((await client().get('/birria')).text).not.toContain('Quesabirria con Tortilla de Mano');
    expect(textOf((await browser.get('/admin/birria')).text)).not.toContain('Quesabirria con Tortilla de Mano');
    // Recargar: el producto ya no está activo; la edición responde 404.
    expect((await browser.get(editPath('birria', id))).status).toBe(404);

    const deleted = await browser.get('/admin/birria/productos/eliminados');
    expect(textOf(deleted.text)).toContain('Quesabirria con Tortilla de Mano');
    const restoreForm = formFields(deleted.text, 'form.admin-products__restore');
    const restored = await browser.post(`${editPath('birria', id)}/recuperar`).type('form').send(restoreForm);
    expect(restored.status).toBe(303);
    expect(restored.headers.location).toBe('/admin/birria?ok=product_restored');
    expect((await products.list('birria')).at(-1)).toMatchObject({ id, available: false, slug: 'quesabirria' });
    // Repetir el POST (botón atrás) no recupera dos veces: la versión ya no es la vigente.
    expect((await browser.post(`${editPath('birria', id)}/recuperar`).type('form').send(restoreForm)).status).toBe(422);
  });

  it('CA-27: subir C deja A, C, B en la administración y en la landing', async () => {
    const { browser, request: client, products } = await loggedIn();
    const [a, b, c] = await products.list('birria');
    const page = await browser.get('/admin/birria');
    const { document } = new JSDOM(page.text).window;
    const upForm = document.querySelector(`form[action="${editPath('birria', c!.id)}/subir"]`);
    expect(upForm).not.toBeNull();
    const fields = formFields(page.text, `form[action="${editPath('birria', c!.id)}/subir"]`);
    const res = await browser.post(`${editPath('birria', c!.id)}/subir`).type('form').send(fields);
    expect(res.status).toBe(303);
    expect((await products.list('birria')).slice(0, 3).map((product) => product.id)).toEqual([a!.id, c!.id, b!.id]);
    const landing = (await client().get('/birria')).text;
    expect(landing.indexOf(`card-${c!.slug}`)).toBeLessThan(landing.indexOf(`card-${b!.slug}`));
    // Repetir el mismo POST (versión vieja) no mueve otra vez: aviso 409.
    const again = await browser.post(`${editPath('birria', c!.id)}/subir`).type('form').send(fields);
    expect(again.status).toBe(409);
    expect(textOf(again.text)).toContain('no se movió nada');
    expect((await products.list('birria')).slice(0, 3).map((product) => product.id)).toEqual([a!.id, c!.id, b!.id]);
  });

  it('CA-34: guardar hero y promociones no toca los productos', async () => {
    const { browser, prisma } = await loggedIn();
    const before = await prisma.product.findMany({ include: { variants: true, chips: true }, orderBy: { id: 'asc' } });
    const changes = await prisma.productChange.count();
    const { fields } = await openForm(browser, 'birria');
    expect((await submitForm(browser, 'birria', fields, { 'promo.title': 'Nueva promo' })).status).toBe(303);
    expect(await prisma.product.findMany({ include: { variants: true, chips: true }, orderBy: { id: 'asc' } })).toEqual(before);
    expect(await prisma.productChange.count()).toBe(changes);
  });
});

describe('permisos y sesión (CA-15, casos límite)', () => {
  it('CA-15: un editor de Molotes recibe 403 en las páginas y acciones de productos de Birria y no cambia nada', async () => {
    const context = await setupAdmin();
    await createUser(context.users, { username: 'eva', displayName: 'Eva', businesses: ['molotes'] });
    const eva = await loginAs(context.browser(), 'eva');
    const csrf = (await openProduct(eva, editPath('molotes', await idOf(context.products, 'molotes', 'refrescos')))).fields._csrf;
    const id = await idOf(context.products, 'birria', 'quesabirria');
    const before = await context.prisma.productChange.count();
    for (const path of [editPath('birria', id), `${editPath('birria', id)}/eliminar`, '/admin/birria/productos/nuevo', '/admin/birria/productos/eliminados']) {
      expect((await eva.get(path)).status, path).toBe(403);
    }
    for (const path of [editPath('birria', id), `${editPath('birria', id)}/eliminar`, `${editPath('birria', id)}/subir`, `${editPath('birria', id)}/recuperar`, '/admin/birria/productos']) {
      expect((await eva.post(path).type('form').send({ _csrf: csrf!, version: '1', action: 'delete' })).status, path).toBe(403);
    }
    expect(await context.prisma.productChange.count()).toBe(before);
  });

  it('la sesión caducada a mitad de una edición pide acceso de nuevo y no escribe nada', async () => {
    const { browser, products, clock, prisma } = await loggedIn();
    const id = await idOf(products, 'molotes', 'refrescos');
    const { fields } = await openProduct(browser, editPath('molotes', id));
    clock.advance(SESSION_IDLE_MS + 1000);
    const before = await prisma.productChange.count();
    const res = await send(browser, editPath('molotes', id), fields, { ...updateAction, name: 'Tarde' });
    expect(res.status).toBe(303);
    expect(res.headers.location).toMatch(/^\/admin\/login\?next=%2Fadmin%2Fmolotes&expirada=1$/);
    expect(await prisma.productChange.count()).toBe(before);
  });

  it('un producto de otro negocio o inexistente responde 404 (CA-22)', async () => {
    const { browser, products } = await loggedIn();
    const birria = await idOf(products, 'birria', 'quesabirria');
    for (const path of [editPath('molotes', birria), editPath('molotes', 999999), '/admin/molotes/productos/abc', `${editPath('molotes', birria)}/eliminar`]) {
      expect((await browser.get(path)).status, path).toBe(404);
    }
  });

  it('CA-35: si la base de datos falla, las páginas de productos responden 503 y las landings 200', async () => {
    let failing = false;
    const wrapProductStore = (store: ProductStore): ProductStore => ({
      ...store,
      listBusiness: async (business) => {
        if (failing) {
          const { DatabaseUnavailableError } = await import('@restaurante/core/shared');
          throw new DatabaseUnavailableError({ name: 'PrismaClientKnownRequestError', code: 'P2039', originalCode: '1205' });
        }
        return store.listBusiness(business);
      },
    });
    const { browser, request: client, logger } = await loggedIn({ wrapProductStore });
    failing = true;
    for (const path of ['/admin/molotes', '/admin/molotes/productos/1']) {
      const res = await browser.get(path);
      expect(res.status, path).toBe(503);
      expect(textOf(res.text)).toContain('Administración no disponible');
    }
    expect(logger.lines).toContainEqual(expect.objectContaining({ msg: 'database_unavailable', originalCode: '1205' }));
    expect((await client().get('/molotes')).status).toBe(200);
  });
});
