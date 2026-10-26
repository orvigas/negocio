import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

import type { ProductStore } from '@restaurante/core/catalog';

import { SESSION_IDLE_MS } from '../../src/services/session-store.ts';
import { seedData } from '../helpers.ts';
import { createUser, formFields, login, loginAs, openForm, setupAdmin, submitForm, textOf, type Browser, type FormFields } from '../support/admin.ts';

/**
 * Administración HTML de productos (REQ-F-008, RF-6): sin JavaScript, con POST-redirect-GET.
 * Incluye las pruebas que antes editaban productos desde el formulario de página (REQ-F-001:
 * CA-1, CA-5, CA-7, CA-8, CA-10, CA-15, CA-16 y CA-19), ahora sobre el formulario de producto.
 */

const PRODUCT_FORM = '#product-form';

async function loggedIn(options: Parameters<typeof setupAdmin>[0] = {}) {
  const context = await setupAdmin(options);
  const browser = context.browser();
  expect((await login(browser)).status).toBe(303);
  return { ...context, browser };
}

/** Id de un producto por su slug. */
async function idOf(products: Awaited<ReturnType<typeof setupAdmin>>['products'], business: 'molotes' | 'birria', slug: string): Promise<number> {
  const product = (await products.list(business, { includeDeleted: true })).find((candidate) => candidate.slug === slug);
  if (!product) throw new Error(`No existe ${slug}`);
  return product.id;
}

/** Abre el formulario de un producto y devuelve sus campos tal como los enviaría el navegador. */
async function openProduct(browser: Browser, path: string) {
  const page = await browser.get(path);
  expect(page.status, path).toBe(200);
  return { page, fields: formFields(page.text, PRODUCT_FORM) };
}

function send(browser: Browser, path: string, fields: FormFields, changes: Record<string, string | undefined> = {}) {
  const body: Record<string, string | undefined> = { ...fields, ...changes };
  for (const [name, value] of Object.entries(changes)) if (value === undefined) delete body[name];
  return browser.post(path).type('form').send(body);
}

const editPath = (business: string, id: number) => `/admin/${business}/productos/${id}`;
const updateAction = { action: 'update' };

describe('página del negocio (RF-6.1)', () => {
  it('lista los productos por categoría y en orden, con precio, disponibilidad y acciones accesibles', async () => {
    const { browser } = await loggedIn();
    const page = await browser.get('/admin/molotes');
    const { document } = new JSDOM(page.text).window;
    const tables = [...document.querySelectorAll('.admin-products__table')];
    expect(tables).toHaveLength(2);
    const names = (table: Element) => [...table.querySelectorAll('tbody th[scope="row"]')].map((cell) => cell.textContent.trim());
    expect(names(tables[0]!)).toEqual(seedData('molotes').menu.items.map((item) => item.name));
    expect(names(tables[1]!)).toEqual(seedData('molotes').drinks.items.map((item) => item.name));
    const firstRow = tables[0]!.querySelector('tbody tr')!;
    expect(textOf(firstRow.outerHTML)).toContain('$45 c/u · $130 orden de 3');
    expect(textOf(firstRow.outerHTML)).toContain('Sí');
    // El primero no se puede subir; todos los botones dicen qué producto mueven.
    expect(firstRow.textContent).not.toContain('Subir');
    expect(firstRow.querySelector('button')?.textContent).toBe('Bajar Molotes de Queso Oaxaca');
    expect(textOf(page.text)).toContain('Agregar platillo');
    expect(textOf(page.text)).toContain('Agregar bebida');
    // El formulario de hero y promociones sigue en la misma página (CA-34).
    expect(document.querySelector('#admin-form')).not.toBeNull();
    // Birria: solo platillos.
    expect(textOf((await browser.get('/admin/birria')).text)).not.toContain('Agregar bebida');
  });
});

describe('editar (REQ-F-001 movido aquí, CA-32, CA-33)', () => {
  it('CA-1 / CA-12: el precio unitario guardado con PRG se ve en la landing sin reiniciar', async () => {
    const { browser, request: client, products, prisma } = await loggedIn();
    const id = await idOf(products, 'molotes', 'queso-oaxaca');
    const { fields } = await openProduct(browser, editPath('molotes', id));
    expect(fields).toMatchObject({ price: '45.00', orderPrice: '130.00', orderQuantity: '3', available: 'on', version: '1' });
    const res = await send(browser, editPath('molotes', id), fields, { ...updateAction, price: '50.00' });
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe('/admin/molotes?ok=product_saved');
    const landing = (await client().get('/molotes')).text;
    const card = landing.slice(landing.indexOf('>Molotes de Queso Oaxaca<'));
    expect(card.slice(0, 800)).toContain('$50 c/u');
    expect(textOf((await browser.get(res.headers.location!)).text)).toContain('Producto guardado.');
    const change = await prisma.productChange.findFirst({ where: { productId: id, action: 'update' } });
    expect(JSON.parse(change!.changes)).toEqual([{ field: 'priceCents', before: 4500, after: 5000 }]);
    // Recargar la página de destino no repite nada (es un GET).
    await browser.get(res.headers.location!);
    expect(await prisma.productChange.count({ where: { productId: id, action: 'update' } })).toBe(1);
  });

  it('CA-15: un precio de 45.5 se muestra como "$45.50" en la landing y "45.50" en el formulario', async () => {
    const { browser, request: client, products } = await loggedIn();
    const id = await idOf(products, 'molotes', 'aguas-frescas');
    const { fields } = await openProduct(browser, editPath('molotes', id));
    expect((await send(browser, editPath('molotes', id), fields, { ...updateAction, price: '45.5' })).status).toBe(303);
    expect((await client().get('/molotes')).text).toContain('$45.50 MXN');
    expect((await openProduct(browser, editPath('molotes', id))).fields.price).toBe('45.50');
  });

  it('CA-5 / CA-7 / CA-8 / CA-9 / CA-10: ocultar productos y variantes se refleja en la landing', async () => {
    const { browser, request: client, products } = await loggedIn();
    for (const slug of ['huitlacoche-epazote', 'refrescos']) {
      const id = await idOf(products, 'molotes', slug);
      const { fields } = await openProduct(browser, editPath('molotes', id));
      expect((await send(browser, editPath('molotes', id), fields, { ...updateAction, available: undefined })).status).toBe(303);
    }
    const molotesHtml = (await client().get('/molotes')).text;
    expect(molotesHtml).not.toContain('Molotes de Huitlacoche con Epazote');
    expect(molotesHtml).not.toContain('Refrescos Familia Coca-Cola');
    expect(molotesHtml.match(/class="menu-card /g)).toHaveLength(7);

    const chico = await idOf(products, 'birria', 'consome-chico');
    const chicoForm = await openProduct(browser, editPath('birria', chico));
    expect((await send(browser, editPath('birria', chico), chicoForm.fields, { ...updateAction, 'variants.0.available': undefined })).status).toBe(303);
    const birriamen = await idOf(products, 'birria', 'birriamen');
    const birriamenForm = await openProduct(browser, editPath('birria', birriamen));
    const hideBoth = { ...updateAction, 'variants.0.available': undefined, 'variants.1.available': undefined };
    expect((await send(browser, editPath('birria', birriamen), birriamenForm.fields, hideBoth)).status).toBe(303);
    const birriaHtml = (await client().get('/birria')).text;
    expect(birriaHtml).not.toContain('id="card-birriamen"');
    expect(birriaHtml).toMatch(/id="price-consome-chico"[^>]*>\$45 MXN</);
    expect(birriaHtml).toMatch(/aria-pressed="true" data-variant data-price="\$45 MXN"[^>]*>Sin Carne/);
    expect(birriaHtml).not.toContain('Con Carne (');
  });

  it('CA-10 / CA-19 / CA-33: un error conserva lo escrito, marca el campo con texto y no guarda nada', async () => {
    const { browser, products, prisma } = await loggedIn();
    const id = await idOf(products, 'molotes', 'queso-oaxaca');
    const { fields } = await openProduct(browser, editPath('molotes', id));
    const before = await prisma.productChange.count();
    const res = await send(browser, editPath('molotes', id), fields, { ...updateAction, price: '0', name: 'Nombre nuevo escrito' });
    expect(res.status).toBe(422);
    expect(await prisma.productChange.count()).toBe(before);
    const resent = formFields(res.text, PRODUCT_FORM);
    expect(resent.price).toBe('0');
    expect(resent.name).toBe('Nombre nuevo escrito');
    expect(res.text).toMatch(/id="f-price"[^>]*aria-invalid="true" aria-describedby="f-price-hint f-price-error"/);
    expect(res.text).toContain('<p id="f-price-error" class="admin-field__error mt-1 text-sm font-semibold text-red-800"><strong>Error:</strong> El precio debe ser mayor que $0.</p>');
    expect(res.text).toMatch(/role="alert"[^>]*>\s*<p class="admin-notice__title font-bold">No se guardó nada/);
    expect(res.text).toContain('href="#f-price"');
  });

  it('CA-16 / CA-20: una imagen que no existe se rechaza junto al campo', async () => {
    const { browser, products } = await loggedIn();
    const id = await idOf(products, 'birria', 'quesabirria');
    const { fields } = await openProduct(browser, editPath('birria', id));
    const res = await send(browser, editPath('birria', id), fields, { ...updateAction, 'image.src': '/img/birria/no-existe.jpg' });
    expect(res.status).toBe(422);
    expect(textOf(res.text)).toContain('La imagen no existe en public/img/.');
    expect(res.text).toContain('id="f-image-src-error"');
  });

  it('variantes: agregar, quitar y reordenar filas sin JavaScript; los errores vuelven a su fila', async () => {
    const { browser, request: client, products } = await loggedIn();
    const id = await idOf(products, 'birria', 'bebidas');
    const { fields } = await openProduct(browser, editPath('birria', id));
    // Agrega una tercera variante en la fila 3, la pone primera y quita la segunda original.
    const res = await send(browser, editPath('birria', id), fields, {
      ...updateAction,
      'variants.2.label': 'Agua Mineral',
      'variants.2.price': '30',
      'variants.2.description': 'Topo Chico helado.',
      'variants.2.available': 'on',
      'variants.2.position': '1',
      'variants.1.remove': 'on',
    });
    expect(res.status).toBe(303);
    const saved = await products.get('birria', id);
    expect(saved.variants.map((variant) => variant.label)).toEqual(['Agua Mineral', 'Aguas Frescas']);
    expect((await client().get('/birria')).text).toContain('Agua Mineral ($30)');

    // Un error en la fila 4 se marca en la fila 4.
    const again = await openProduct(browser, editPath('birria', id));
    const bad = await send(browser, editPath('birria', id), again.fields, { ...updateAction, 'variants.3.label': 'Sin precio', 'variants.3.description': 'd' });
    expect(bad.status).toBe(422);
    expect(bad.text).toContain('id="f-variants-3-price-error"');
    // Quitar todas: de 1 a 6.
    const none = await send(browser, editPath('birria', id), again.fields, { ...updateAction, 'variants.0.remove': 'on', 'variants.1.remove': 'on' });
    expect(none.status).toBe(422);
    expect(none.text).toContain('id="f-variants-error"');
  });

  it('rechaza un formulario manipulado (campo desconocido, autor o casilla con otro valor) con 400', async () => {
    const { browser, products } = await loggedIn();
    const id = await idOf(products, 'molotes', 'refrescos');
    const { fields } = await openProduct(browser, editPath('molotes', id));
    for (const changes of [{ secreto: 'x' }, { author: 'Otra persona' }, { 'image.src': '/img/x.jpg' }, { available: 'yes' }, { action: 'borrar' }]) {
      expect((await send(browser, editPath('molotes', id), fields, { ...updateAction, ...changes })).status, JSON.stringify(changes)).toBe(400);
    }
  });
});

describe('concurrencia en la administración (CA-28, CA-29)', () => {
  async function anaAndLuis() {
    const context = await setupAdmin();
    await createUser(context.users, { username: 'ana', displayName: 'Ana', businesses: ['birria'] });
    await createUser(context.users, { username: 'luis', displayName: 'Luis', businesses: ['birria'] });
    const ana = await loginAs(context.browser(), 'ana');
    const luis = await loginAs(context.browser(), 'luis');
    const id = await idOf(context.products, 'birria', 'quesabirria');
    const formAna = await openProduct(ana, editPath('birria', id));
    const formLuis = await openProduct(luis, editPath('birria', id));
    context.clock.advance(3 * 60_000);
    expect((await send(ana, editPath('birria', id), formAna.fields, { ...updateAction, name: 'Quesabirria de Ana' })).status).toBe(303);
    return { ...context, ana, luis, id, formLuis };
  }

  it('CA-28: Luis no guarda nada y ve que Ana lo cambió y cuándo, con dos opciones', async () => {
    const { luis, id, formLuis, prisma } = await anaAndLuis();
    const before = await prisma.productChange.count();
    const res = await send(luis, editPath('birria', id), formLuis.fields, { ...updateAction, name: 'Quesabirria de Luis' });
    expect(res.status).toBe(409);
    expect(await prisma.productChange.count()).toBe(before);
    const text = textOf(res.text);
    expect(text).toContain('El producto cambió mientras lo editabas');
    expect(text).toContain('Ana lo cambió el 09/10/2026 12:03.');
    expect(res.text).toContain('name="action" value="overwrite_after_conflict">Guardar mis cambios de todos modos</button>');
    expect(res.text).toContain(`href="${editPath('birria', id)}">Descartar y cargar la versión actual</a>`);
    expect(formFields(res.text, PRODUCT_FORM).name).toBe('Quesabirria de Luis');
  });

  it('CA-29: "Guardar mis cambios de todos modos" guarda los de Luis y lo registra como sobrescribir tras conflicto', async () => {
    const { luis, id, formLuis, prisma, request: client } = await anaAndLuis();
    const conflict = await send(luis, editPath('birria', id), formLuis.fields, { ...updateAction, name: 'Quesabirria de Luis' });
    const res = await send(luis, editPath('birria', id), formFields(conflict.text, PRODUCT_FORM), { action: 'overwrite_after_conflict' });
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe('/admin/birria?ok=product_overwritten');
    expect((await client().get('/birria')).text).toContain('Quesabirria de Luis');
    expect(await prisma.productChange.findFirst({ where: { productId: id }, orderBy: { id: 'desc' } })).toMatchObject({
      action: 'overwrite_after_conflict',
      actorName: 'Luis',
    });
  });

  it('CA-29: "Descartar" muestra los datos de Ana y no escribe nada', async () => {
    const { luis, id, formLuis, prisma } = await anaAndLuis();
    await send(luis, editPath('birria', id), formLuis.fields, { ...updateAction, name: 'Quesabirria de Luis' });
    const before = await prisma.productChange.count();
    expect((await openProduct(luis, editPath('birria', id))).fields.name).toBe('Quesabirria de Ana');
    expect(await prisma.productChange.count()).toBe(before);
  });

  it('CA-28: eliminar con una versión vieja muestra el aviso y permite eliminar de todos modos', async () => {
    const { luis, id, prisma } = await anaAndLuis();
    const res = await luis.post(`${editPath('birria', id)}/eliminar`).type('form').send({ _csrf: (await openProduct(luis, editPath('birria', id))).fields._csrf, version: '1', action: 'delete' });
    expect(res.status).toBe(409);
    expect(textOf(res.text)).toContain('Ana lo cambió el 09/10/2026 12:03.');
    expect(await prisma.product.findUnique({ where: { id } })).toMatchObject({ deleted: false });
    const confirm = formFields(res.text, 'form.mt-4');
    expect(confirm.version).toBe('2');
    const again = await luis.post(`${editPath('birria', id)}/eliminar`).type('form').send({ ...confirm, action: 'delete' });
    expect(again.status).toBe(303);
    expect(await prisma.product.findUnique({ where: { id } })).toMatchObject({ deleted: true });
  });
});

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
