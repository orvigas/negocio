import { describe, expect, it } from 'vitest';

import { textOf } from '../support/bot-page.ts';
import { dom, formFields, type Browser } from '../support/browser.ts';
import { MOLOTES, MOLOTES_RESTORE, TITLE, fieldValue, formOf, openSession, pageRequests, save } from '../support/page-browser.ts';

/** REQ-F-044, CA-9 y CA-12: dos personas sobre la misma versión, sin JavaScript. */

const WRITTEN = 'Lo que escribí yo';

async function conflicted(browser: Browser, touch: () => void) {
  const fields = await formOf(browser);
  touch();
  const response = await browser.post(MOLOTES, save({ ...fields, [TITLE]: WRITTEN }));
  return { fields, response, html: await response.text() };
}

describe('guardar sobre una versión que ya cambió (CA-9)', () => {
  it('409 con quién y cuándo, lo escrito intacto y nada guardado', async () => {
    const { h, browser } = await openSession();
    const { response, html } = await conflicted(browser, () => h.api.page.touch('molotes', 'Otra Persona'));
    expect(response.status).toBe(409);
    expect(textOf(html)).toContain('Otra persona cambió esta página mientras la editabas: no se guardó nada.');
    expect(textOf(html)).toContain('Última modificación: Otra Persona, el 03/11/2026 10:00.');
    expect(fieldValue(html, TITLE)).toBe(WRITTEN);
    expect(h.api.page.writes).toEqual([]);
    expect(h.api.page.pages.molotes.current.values[TITLE]).toBe('Trilogía poblana');
  });

  it('el aviso se lee primero y las salidas son las dos pedidas, sin más', async () => {
    const { h, browser } = await openSession();
    const { html } = await conflicted(browser, () => h.api.page.touch('molotes', 'Otra Persona'));
    const page = dom(html);
    const notice = page.querySelector('main .notice');
    expect(notice?.getAttribute('role')).toBe('alert');
    expect(notice?.hasAttribute('autofocus')).toBe(true);
    expect(page.querySelector('button[value="overwrite"]')?.textContent).toBe('Guardar mis cambios de todos modos');
    expect(page.querySelector('.page-form__actions a')?.getAttribute('href')).toBe(MOLOTES);
    expect(page.querySelector('.page-form__actions a')?.textContent).toContain('Descartar');
    expect(page.querySelector('button[value="save"]')).toBeNull();
    expect(page.querySelector('a[href$="restaurar"]')).toBeNull();
  });

  it('"Guardar mis cambios de todos modos" guarda sobre la versión vigente y queda registrado', async () => {
    const { h, browser } = await openSession();
    const { html } = await conflicted(browser, () => h.api.page.touch('molotes', 'Otra Persona'));
    const response = await browser.post(MOLOTES, save(formFields(html, '#page-form'), 'overwrite'));
    expect(response.status).toBe(303);
    expect(h.api.page.pages.molotes.current.values[TITLE]).toBe(WRITTEN);
    expect(h.api.page.writes).toEqual([{ business: 'molotes', action: 'overwrite_after_conflict', authorId: 1 }]);
    expect((pageRequests(h).findLast(({ method }) => method === 'PUT')?.body as { overwrite?: boolean }).overwrite).toBe(true);
  });

  it('otro cambio durante la sobrescritura: otro 409, sin pisar a nadie', async () => {
    const { h, browser } = await openSession();
    const { html } = await conflicted(browser, () => h.api.page.touch('molotes', 'Otra Persona'));
    h.api.page.touch('molotes', 'Tercera Persona');
    const response = await browser.post(MOLOTES, save(formFields(html, '#page-form'), 'overwrite'));
    expect(response.status).toBe(409);
    const again = await response.text();
    expect(textOf(again)).toContain('Tercera Persona');
    expect(fieldValue(again, TITLE)).toBe(WRITTEN);
    expect(fieldValue(again, 'expectedVersion')).not.toBe(fieldValue(html, 'expectedVersion'));
    expect(h.api.page.writes).toEqual([]);
  });

  it('un error de validación al sobrescribir no pierde la decisión ni la versión', async () => {
    const { h, browser } = await openSession();
    const { html } = await conflicted(browser, () => h.api.page.touch('molotes', 'Otra Persona'));
    const fields = formFields(html, '#page-form');
    const response = await browser.post(MOLOTES, save({ ...fields, 'hero.showcase.priceCents': 'abc' }, 'overwrite'));
    expect(response.status).toBe(422);
    const again = await response.text();
    expect(dom(again).querySelector('button[value="overwrite"]')).not.toBeNull();
    expect(dom(again).querySelector('.page-form__actions a')?.textContent).toContain('Descartar');
    expect(fieldValue(again, 'expectedVersion')).toBe(fields.expectedVersion);
    expect(h.api.page.writes).toEqual([]);
  });

  it('sin autor en la versión vigente no inventa uno', async () => {
    const { h, browser } = await openSession();
    const { html } = await conflicted(browser, () => h.api.page.touch('molotes', null));
    expect(textOf(html)).toContain('Última modificación: otra sesión, el 03/11/2026 10:00.');
  });
});

describe('restaurar sobre una versión que ya cambió', () => {
  const confirmForm = async (browser: Browser) => formFields(await (await browser.get(MOLOTES_RESTORE)).text(), `form[action="${MOLOTES_RESTORE}"]`);

  const CHANGED = 'La página cambió desde que abriste la confirmación.';

  it('409 con quién y cuándo y la versión vigente: decidir pasa otra vez por la confirmación', async () => {
    const { h, browser } = await openSession();
    const fields = await confirmForm(browser);
    h.api.page.touch('molotes', 'Otra Persona');
    const response = await browser.post(MOLOTES_RESTORE, fields);
    expect(response.status).toBe(409);
    const html = await response.text();
    expect(textOf(html)).toContain(CHANGED);
    expect(textOf(html)).toContain('Otra Persona, el 03/11/2026 10:00');
    expect(fieldValue(html, 'promo.title')).toBe('Cambio de otra persona');
    expect(dom(html).querySelector(`form[action="${MOLOTES_RESTORE}"]`)).toBeNull();
    expect(dom(html).querySelector(`a[href="${MOLOTES_RESTORE}"]`)).not.toBeNull();
    expect(h.api.page.writes).toEqual([]);

    const again = await confirmForm(browser);
    expect(again.expectedVersion).not.toBe(fields.expectedVersion);
    expect((await browser.post(MOLOTES_RESTORE, again)).status).toBe(303);
    expect(h.api.page.writes).toEqual([{ business: 'molotes', action: 'restore_previous', authorId: 1 }]);
  });

  it('un doble envío no deshace la restauración ni afirma que no se hizo', async () => {
    const { h, browser } = await openSession();
    const fields = await confirmForm(browser);
    expect((await browser.post(MOLOTES_RESTORE, fields)).status).toBe(303);
    const response = await browser.post(MOLOTES_RESTORE, fields);
    expect(response.status).toBe(409);
    const html = await response.text();
    expect(textOf(html)).toContain('Puede ser tu propia restauración, si ya se aplicó, o un cambio posterior.');
    expect(textOf(html)).not.toMatch(/otra persona|no se restauró|confirma de nuevo/i);
    expect(fieldValue(html, TITLE)).toBe('Título anterior');
    expect(dom(html).querySelector(`form[action="${MOLOTES_RESTORE}"]`)).toBeNull();
    expect(h.api.page.writes).toHaveLength(1);
  });

  it('si además no se puede releer, no pierde el aviso del conflicto', async () => {
    const { h, browser } = await openSession();
    const fields = await confirmForm(browser);
    h.api.page.touch('molotes', 'Otra Persona');
    h.api.page.readFailure = '503';
    const response = await browser.post(MOLOTES_RESTORE, fields);
    expect(response.status).toBe(409);
    const text = textOf(await response.text());
    expect(text).toContain(CHANGED);
    expect(text).toContain('Otra Persona, el 03/11/2026 10:00');
  });
});
