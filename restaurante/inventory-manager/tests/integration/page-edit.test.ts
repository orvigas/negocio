import { describe, expect, it } from 'vitest';

import { textOf } from '../support/bot-page.ts';
import { ELI, dom, formFields } from '../support/browser.ts';
import { MOLOTES, MOLOTES_RESTORE, TITLE, fieldValue, formOf, openSession, pageRequests, save } from '../support/page-browser.ts';

/** REQ-F-044, RF-6, CA-11, CA-12 y CA-14: edición sin JavaScript contra el doble, con la puerta abierta. */

const PRICE = 'hero.showcase.priceCents';

describe('formulario', () => {
  it('pinta los campos que describe la API, por grupos y con sus valores', async () => {
    const { browser } = await openSession();
    const page = dom(await (await browser.get(MOLOTES)).text());
    expect([...page.querySelectorAll('legend')].map((legend) => legend.textContent)).toEqual(['Showcase del hero', 'Menú de molotes', 'Promoción']);
    expect(page.querySelector<HTMLInputElement>('#f-hero-showcase-title')?.value).toBe('Trilogía poblana');
    expect(page.querySelector('label[for="f-hero-showcase-title"]')?.textContent).toBe('Título');
    expect(page.querySelector<HTMLInputElement>('#f-hero-showcase-priceCents')?.getAttribute('inputmode')).toBe('decimal');
    expect(page.querySelector('#f-hero-showcase-description')?.tagName).toBe('TEXTAREA');
    expect(page.querySelector('#f-hero-showcase-title')?.getAttribute('maxlength')).toBe('120');
    expect(page.querySelector('#f-hero-showcase-title-help')?.textContent).toBe('Máximo 120 caracteres.');
  });

  it('cada negocio tiene sus campos', async () => {
    const { browser } = await openSession();
    const fields = await formOf(browser, '/birria/pagina');
    expect(fields['hero.showcase.title']).toBe('Tostado de comal');
    expect(fields['menu.highlight']).toBeUndefined();
  });

  it('muestra "Último cambio" y no ofrece restaurar la semilla', async () => {
    const { browser } = await openSession();
    const html = await (await browser.get(MOLOTES)).text();
    expect(textOf(html)).toContain('Último cambio: Ana Admin, el 02/11/2026 10:00.');
    expect(html).not.toMatch(/semilla|seed/i);
  });

  it('sin autor ni fecha: lo dice, sin inventar', async () => {
    const { h, browser } = await openSession();
    Object.assign(h.api.page.pages.molotes.current, { updatedBy: null, updatedAt: null });
    expect(textOf(await (await browser.get(MOLOTES)).text())).toContain('Último cambio: sin registrar.');
  });

  it('escapa los valores', async () => {
    const { h, browser } = await openSession();
    h.api.page.pages.molotes.current.values[TITLE] = '"><script>alert(1)</script>';
    const html = await (await browser.get(MOLOTES)).text();
    expect(html).not.toContain('<script>alert(1)');
    expect(fieldValue(html, TITLE)).toBe('"><script>alert(1)</script>');
  });
});

describe('guardar (POST/redirect/GET)', () => {
  it('303, y el GET siguiente muestra el cambio y que la landing ya lo tiene', async () => {
    const { h, browser } = await openSession();
    const fields = await formOf(browser);
    const response = await browser.post(MOLOTES, save({ ...fields, [TITLE]: 'Título nuevo' }));
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/molotes/pagina?ok=saved&landing=confirmed');
    const html = await (await browser.get(response.headers.get('location') as string)).text();
    expect(textOf(html)).toContain('Cambios guardados.');
    expect(textOf(html)).toContain('La landing ya muestra el cambio.');
    expect(dom(html).querySelector('main .notice')?.getAttribute('role')).toBe('status');
    expect(fieldValue(html, TITLE)).toBe('Título nuevo');
    expect(h.api.page.writes).toEqual([{ business: 'molotes', action: 'save', authorId: 1 }]);
  });

  it('envía solo los campos de la página y la versión leída, con su CSRF', async () => {
    const { h, browser } = await openSession();
    const fields = await formOf(browser);
    await browser.post(MOLOTES, save(fields));
    const request = pageRequests(h).find(({ method }) => method === 'PUT');
    const body = request?.body as { expectedVersion: string; overwrite?: boolean; fields: Record<string, string> };
    expect(body.expectedVersion).toBe(fields.expectedVersion);
    expect(body.overwrite).toBeUndefined();
    expect(Object.keys(body.fields).sort()).toEqual(Object.keys(fields).filter((name) => !['_csrf', 'expectedVersion'].includes(name)).sort());
    expect(request?.headers['x-csrf-token']).toBe(fields._csrf);
  });

  it('guardado correcto y lectura posterior fallida: conserva el aviso de éxito', async () => {
    const { h, browser } = await openSession();
    const response = await browser.post(MOLOTES, save(await formOf(browser)));
    h.api.page.readFailure = '503';
    const after = await browser.get(response.headers.get('location') as string);
    expect(after.status).toBe(503);
    const text = textOf(await after.text());
    expect(text).toContain('Cambios guardados.');
    expect(text).toContain('La landing ya muestra el cambio.');
    expect(text).toContain('No pudimos cargar la página ahora.');
  });

  it('`pending`: dice que llegará como mucho en un minuto', async () => {
    const { h, browser } = await openSession();
    h.api.freshness = 'pending';
    const response = await browser.post(MOLOTES, save(await formOf(browser)));
    const text = textOf(await (await browser.get(response.headers.get('location') as string)).text());
    expect(text).toContain('Cambios guardados.');
    expect(text).toContain('La landing lo mostrará en cuanto se actualice (como mucho en un minuto).');
    expect(text).not.toContain('ya muestra el cambio');
  });

  it('sin dato de frescura en la URL no afirma nada sobre la landing', async () => {
    const { browser } = await openSession();
    const text = textOf(await (await browser.get(`${MOLOTES}?ok=saved&landing=inventada`)).text());
    expect(text).toContain('Cambios guardados.');
    expect(text).not.toContain('landing ya muestra');
    expect(text).not.toContain('La landing lo mostrará');
  });
});

describe('errores por campo (CA-11)', () => {
  it('precio inválido y texto largo: 422, nada escrito, resumen enlazado y texto junto a cada campo', async () => {
    const { h, browser } = await openSession();
    const fields = await formOf(browser);
    const long = 'é'.repeat(121);
    const response = await browser.post(MOLOTES, save({ ...fields, [PRICE]: 'abc', [TITLE]: long, 'promo.title': 'Se conserva' }));
    expect(response.status).toBe(422);
    const html = await response.text();
    const page = dom(html);
    expect(h.api.page.writes).toEqual([]);

    const summary = page.querySelector('main .notice--error');
    expect(summary?.getAttribute('role')).toBe('alert');
    expect(summary?.textContent).toContain('No se guardó nada: revisa los campos marcados.');
    const links = [...(summary?.querySelectorAll('a') ?? [])];
    expect(links.map((link) => link.getAttribute('href')).sort()).toEqual(['#f-hero-showcase-priceCents', '#f-hero-showcase-title']);
    for (const link of links) expect(page.querySelector(link.getAttribute('href') as string)).not.toBeNull();
    expect(links.map((link) => link.textContent).join(' ')).toContain('Título: Máximo 120 caracteres.');

    const title = page.querySelector('#f-hero-showcase-title');
    expect(title?.getAttribute('aria-invalid')).toBe('true');
    expect(title?.getAttribute('aria-describedby')).toBe('f-hero-showcase-title-help f-hero-showcase-title-error');
    expect(page.querySelector('#f-hero-showcase-title-error')?.textContent).toContain('Error: Máximo 120 caracteres.');

    expect(fieldValue(html, TITLE)).toBe(long);
    expect(fieldValue(html, PRICE)).toBe('abc');
    expect(fieldValue(html, 'promo.title')).toBe('Se conserva');
    expect(fieldValue(html, 'expectedVersion')).toBe(fields.expectedVersion);
  });

  it('un error sin campo va en el resumen, como texto', async () => {
    const { browser } = await openSession();
    const fields = await formOf(browser);
    const response = await browser.post(MOLOTES, save({ ...fields, expectedVersion: '' }));
    expect(response.status).toBe(422);
    expect(textOf(await response.text())).toContain('El formulario no coincide con los campos de la página.');
  });
});

describe('restaurar la versión anterior (CA-12)', () => {
  it('el enlace solo aparece con una versión anterior', async () => {
    const { browser } = await openSession();
    expect(dom(await (await browser.get(MOLOTES)).text()).querySelector(`a[href="${MOLOTES_RESTORE}"]`)?.textContent).toBe('Restaurar versión anterior');
    expect(dom(await (await browser.get('/birria/pagina')).text()).querySelector('a[href="/birria/pagina/restaurar"]')).toBeNull();
  });

  it('el GET solo pide confirmación: no escribe', async () => {
    const { h, browser } = await openSession();
    const html = await (await browser.get(MOLOTES_RESTORE)).text();
    const form = dom(html).querySelector(`form[action="${MOLOTES_RESTORE}"]`);
    expect(form?.getAttribute('method')).toBe('post');
    expect(dom(html).querySelector('main a[href="/molotes/pagina"]')).not.toBeNull();
    expect(h.api.page.writes).toEqual([]);
  });

  it('confirmar intercambia las versiones y repetirlo lo deshace', async () => {
    const { h, browser } = await openSession();
    const confirm = async () => {
      const fields = formFields(await (await browser.get(MOLOTES_RESTORE)).text(), `form[action="${MOLOTES_RESTORE}"]`);
      const response = await browser.post(MOLOTES_RESTORE, fields);
      expect(response.status).toBe(303);
      return response.headers.get('location') as string;
    };
    const location = await confirm();
    expect(location).toBe('/molotes/pagina?ok=restored&landing=confirmed');
    const html = await (await browser.get(location)).text();
    expect(textOf(html)).toContain('Versión anterior restaurada.');
    expect(fieldValue(html, TITLE)).toBe('Título anterior');

    await confirm();
    expect(fieldValue(await (await browser.get(MOLOTES)).text(), TITLE)).toBe('Trilogía poblana');
    expect(h.api.page.writes.map(({ action }) => action)).toEqual(['restore_previous', 'restore_previous']);
  });

  it('sin versión anterior: lo explica, sin formulario', async () => {
    const { browser } = await openSession();
    const html = await (await browser.get('/birria/pagina/restaurar')).text();
    expect(textOf(html)).toContain('No hay una versión anterior que restaurar.');
    expect(dom(html).querySelector('main form')).toBeNull();
  });

  it('un POST sin versión anterior: 409, sin cambios', async () => {
    const { h, browser } = await openSession();
    const { _csrf: csrf, expectedVersion } = await formOf(browser, '/birria/pagina');
    const response = await browser.post('/birria/pagina/restaurar', { _csrf: csrf as string, expectedVersion: expectedVersion as string });
    expect(response.status).toBe(409);
    expect(textOf(await response.text())).toContain('No hay una versión anterior que restaurar: no se cambió nada.');
    expect(h.api.page.writes).toEqual([]);
  });

  it('sin `expectedVersion`: 422, sin cambios', async () => {
    const { h, browser } = await openSession();
    const { _csrf: csrf } = await formOf(browser);
    const response = await browser.post(MOLOTES_RESTORE, { _csrf: csrf as string });
    expect(response.status).toBe(422);
    expect(textOf(await response.text())).toContain('No se restauró nada');
    expect(h.api.page.writes).toEqual([]);
  });
});

describe('permisos, con la puerta abierta (CA-10)', () => {
  it('el editor guarda en su negocio, con su autoría', async () => {
    const { h, browser } = await openSession(ELI);
    expect((await browser.post(MOLOTES, save(await formOf(browser)))).status).toBe(303);
    expect(h.api.page.writes).toEqual([{ business: 'molotes', action: 'save', authorId: 2 }]);
  });

  it('el editor no entra en otro negocio: ni lectura ni escritura', async () => {
    const { h, browser } = await openSession(ELI);
    const fields = await formOf(browser);
    expect((await browser.get('/birria/pagina')).status).toBe(403);
    expect((await browser.get('/birria/pagina/restaurar')).status).toBe(403);
    expect((await browser.post('/birria/pagina', save(fields))).status).toBe(403);
    expect((await browser.post('/birria/pagina/restaurar', { _csrf: fields._csrf as string, expectedVersion: fields.expectedVersion as string })).status).toBe(403);
    expect(h.api.page.writes).toEqual([]);
    expect(pageRequests(h).filter(({ path }) => path.includes('birria'))).toEqual([]);
  });
});

describe('sin JavaScript (CA-14)', () => {
  it('todo son formularios y enlaces normales', async () => {
    const { browser } = await openSession();
    const page = dom(await (await browser.get(MOLOTES)).text());
    const form = page.querySelector('#page-form');
    expect(form?.getAttribute('method')).toBe('post');
    expect(form?.getAttribute('action')).toBe(MOLOTES);
    expect(form?.hasAttribute('data-submit-guard')).toBe(true);
    expect(form?.querySelector('button[type="submit"][name="action"][value="save"]')?.textContent).toBe('Guardar cambios');
    expect(page.querySelector('[onclick], [onsubmit]')).toBeNull();
  });
});
