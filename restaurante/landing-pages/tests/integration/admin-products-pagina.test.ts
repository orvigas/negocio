import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';

import { seedData } from '../helpers.ts';
import { createUser, formFields, loginAs, setupAdmin, textOf } from '../support/admin.ts';
import { PRODUCT_FORM, loggedIn, idOf, openProduct, send, editPath, updateAction } from '../support/admin-products-page.ts';

/**
 * Administración HTML de productos (REQ-F-008, RF-6): sin JavaScript, con POST-redirect-GET.
 * Incluye las pruebas que antes editaban productos desde el formulario de página (REQ-F-001:
 * CA-1, CA-5, CA-7, CA-8, CA-10, CA-15, CA-16 y CA-19), ahora sobre el formulario de producto.
 *
 * REQ-F-041: parte de admin-products.test.ts (preparación en
 * tests/support/admin-products-page.ts).
 */

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
