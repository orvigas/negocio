import { describe, expect, it } from 'vitest';

import { seedData } from '../helpers.ts';
import { createUser, formFields, loginAs, openForm, setupAdmin, submitForm, textOf } from '../support/admin.ts';
import { loggedIn, versionOf } from '../support/admin-page.ts';

/**
 * REQ-F-041: parte de admin.test.ts (preparación en tests/support/admin-page.ts).
 */

describe('guardar (RF-6)', () => {
  // REQ-F-008: el formulario de página guarda hero, destacado y promociones. El precio de un
  // producto (CA-1 de REQ-F-001) se edita en su propio formulario: tests/integration/admin-products.test.ts.
  it('CA-27: guarda con POST-redirect-GET y la landing muestra el precio nuevo del hero sin reiniciar', async () => {
    const { browser, request: client, repository, products } = await loggedIn();
    const landingBefore = await client().get('/molotes');
    expect(landingBefore.text).not.toContain('$150 MXN');

    const { fields } = await openForm(browser, 'molotes');
    const res = await submitForm(browser, 'molotes', fields, { 'hero.showcase.priceCents': '150.00' });
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe('/admin/molotes?ok=save');

    const landing = await client().get('/molotes');
    expect(landing.text).toContain('$150 MXN');
    // Los productos no cambian (CA-34 de REQ-F-008).
    expect(products.getPublished('molotes')).toEqual({ menu: seedData('molotes').menu.items, drinks: seedData('molotes').drinks.items });

    const page = await browser.get(res.headers.location!);
    expect(textOf(page.text)).toContain('Cambios guardados.');
    expect(page.text).toContain('role="status"');

    const changes = repository.storage.changes;
    expect(changes).toEqual([
      expect.objectContaining({
        
        business: 'molotes',
        action: 'save',
        at: '2026-10-09T12:00:00-06:00',
        changes: [{ field: 'hero.showcase.priceCents', before: 14500, after: 15000 }],
      }),
    ]);
    expect(JSON.parse(repository.storage.files.get('molotes/previous')!).data).toEqual(seedData('molotes'));
  });

  it('CA-2: el precio del hero de Birria en 199.50 se muestra como "$199.50 MXN"', async () => {
    const { browser, request: client } = await loggedIn();
    const { fields } = await openForm(browser, 'birria');
    expect((await submitForm(browser, 'birria', fields, { 'hero.showcase.priceCents': '199.50' })).status).toBe(303);
    expect((await client().get('/birria')).text).toContain('$199.50 MXN');
  });

  it('CA-3: el texto destacado y la promoción editados se ven en la landing', async () => {
    const { browser, request: client } = await loggedIn();
    const { fields } = await openForm(browser, 'molotes');
    await submitForm(browser, 'molotes', fields, {
      'menu.highlight': '7 Sabores de Barrio',
      'promo.badge': 'Promo de Temporada',
      'promo.title': 'Martes de Molotes 3x2',
      'promo.description': 'Lleva tres y paga dos todos los martes.',
      
    });
    const { text } = await client().get('/molotes');
    for (const value of ['7 Sabores de Barrio', 'Promo de Temporada', 'Martes de Molotes 3x2', 'Lleva tres y paga dos todos los martes.']) {
      expect(text).toContain(value);
    }
  });

  it('CA-15: un precio de 45.5 se muestra como "$45.50"', async () => {
    const { browser, request: client } = await loggedIn();
    const { fields } = await openForm(browser, 'birria');
    await submitForm(browser, 'birria', fields, { 'hero.showcase.priceCents': '45.5' });
    expect((await client().get('/birria')).text).toContain('$45.50 MXN');
    const page = await browser.get('/admin/birria');
    expect(formFields(page.text)['hero.showcase.priceCents']).toBe('45.50');
  });

  it('CA-14: el autor es el usuario de la sesión (nombre e identificador) y no hay campo de autor', async () => {
    const context = await setupAdmin();
    const ana = await createUser(context.users, { username: 'ana', displayName: 'Ana', businesses: ['molotes'] });
    const browser = await loginAs(context.browser(), 'ana');
    const { page, fields } = await openForm(browser, 'molotes');
    expect(page.text).not.toContain('name="author"');
    expect(textOf(page.text)).toContain('El cambio se registrará a nombre de Ana.');
    expect((await submitForm(browser, 'molotes', fields, { 'hero.showcase.title': 'Hero de Ana' })).status).toBe(303);
    expect(context.repository.storage.changes.at(-1)).toMatchObject({ author: 'Ana', authorId: ana.id, action: 'save', business: 'molotes' });
    expect(JSON.parse(context.repository.storage.files.get('molotes/current')!).updatedBy).toBe('Ana');

    // Un campo "author" enviado a mano no cambia el autor: el formulario se rechaza.
    const forged = await submitForm(browser, 'molotes', formFields((await browser.get('/admin/molotes')).text), { author: 'Otra persona' });
    expect(forged.status).toBe(400);
  });

  it('CA-10 / CA-19: un error de validación conserva lo escrito, marca el campo y no depende del color', async () => {
    const { browser, repository } = await loggedIn();
    const { fields } = await openForm(browser, 'molotes');
    const before = await versionOf(repository, 'molotes');
    const res = await submitForm(browser, 'molotes', fields, {
      'hero.showcase.priceCents': '0',
      'hero.showcase.title': 'Título nuevo escrito',
    });
    expect(res.status).toBe(422);
    expect(await versionOf(repository, 'molotes')).toBe(before);

    const resent = formFields(res.text);
    expect(resent['hero.showcase.priceCents']).toBe('0');
    expect(resent['hero.showcase.title']).toBe('Título nuevo escrito');
    expect(res.text).toMatch(/id="f-hero-showcase-priceCents"[^>]*aria-invalid="true" aria-describedby="f-hero-showcase-priceCents-hint f-hero-showcase-priceCents-error"/);
    expect(res.text).toContain('<p id="f-hero-showcase-priceCents-error" class="admin-field__error mt-1 text-sm font-semibold text-red-800"><strong>Error:</strong> El precio debe ser mayor que $0.</p>');
    expect(res.text).toMatch(/role="alert"[^>]*>\s*<p class="admin-notice__title font-bold">No se guardó nada/);
    expect(res.text).toContain('href="#f-hero-showcase-priceCents"');
  });

  it.each([
    ['un campo desconocido', { 'menu.items.0.secreto': 'x' }],
    ['un slug distinto', { 'menu.items.0.slug': 'otro' }],
    ['un producto de más', { 'menu.items.6.name': 'Nuevo' }],
    // REQ-F-008: los campos de producto ya no son del formulario de página.
    ['un campo de un producto existente', { 'menu.items.0.name': 'Otro nombre' }],
  ])('CA-18: rechaza %s sin escribir', async (_label, changes) => {
    const { browser, repository } = await loggedIn();
    const { fields } = await openForm(browser, 'birria');
    const before = await versionOf(repository, 'birria');
    const res = await submitForm(browser, 'birria', fields, { ...changes });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('STRUCTURE_MODIFIED');
    expect(await versionOf(repository, 'birria')).toBe(before);
  });

  it('rechaza una acción desconocida, cuerpos demasiado grandes y otros tipos de contenido', async () => {
    const { browser } = await loggedIn();
    const { fields } = await openForm(browser, 'molotes');
    expect((await submitForm(browser, 'molotes', fields, { action: 'borrar' })).status).toBe(400);

    const big = await browser
      .post('/admin/molotes')
      .type('form')
      .send({ ...fields, 'menu.highlight': 'a'.repeat(200 * 1024), action: 'save' });
    expect(big.status).toBe(413);
    expect(big.body.error.code).toBe('PAYLOAD_TOO_LARGE');

    const json = await browser.post('/admin/molotes').send({ ...fields, action: 'save' });
    expect(json.status).toBe(415);
  });

  it('CA-31: muestra "Último cambio: <fecha> por <nombre>"', async () => {
    const context = await setupAdmin();
    await createUser(context.users, { username: 'lupe', displayName: 'Doña Lupe', businesses: ['birria'] });
    const browser = await loginAs(context.browser(), 'lupe');
    // REQ-F-008: la importación de productos es el primer cambio registrado (autor "sistema").
    expect(textOf((await browser.get('/admin/birria')).text)).toContain('Último cambio: 09/10/2026 12:00 por sistema');
    context.clock.advance(60_000);
    const { fields } = await openForm(browser, 'birria');
    await submitForm(browser, 'birria', fields, {});
    expect(textOf((await browser.get('/admin/birria')).text)).toContain('Último cambio: 09/10/2026 12:01 por Doña Lupe');
  });
});
