import { describe, expect, it } from 'vitest';

import { textOf } from '../support/bot-page.ts';
import { dom, formFields, startInventory } from '../support/browser.ts';
import type { PageFailure } from '../support/api-double-page.ts';
import { MOLOTES, MOLOTES_RESTORE, TITLE, UNCONFIRMED, fieldValue, formOf, openSession, save } from '../support/page-browser.ts';
import { freePortUrl } from '../support/ports.ts';

/** REQ-F-044, RF-9 y H-4 de QA: una escritura sin confirmar conserva lo escrito y no afirma nada. */

const WRITTEN = 'Lo que escribí antes del fallo';
/** Las tres clases de fallo que el controlador trata igual: 5xx, sin respuesta y 4xx inesperado (H-4). */
const FAILURES: readonly PageFailure[] = ['503', 'network', '413'];

function expectUnconfirmed(html: string): void {
  const text = textOf(html);
  expect(text).toContain(UNCONFIRMED);
  expect(text).not.toMatch(/no se guardó|no se restauró|se guardó|guardado/i);
  expect(text).not.toContain('secreto');
  expect(text).not.toContain('aún no está activa');
}

describe('guardar sin confirmación', () => {
  it.each(FAILURES)('%s: 503, lo escrito sigue ahí y pide revisar', async (failure) => {
    const { h, browser } = await openSession();
    const fields = await formOf(browser);
    h.api.page.writeFailure = failure;
    const response = await browser.post(MOLOTES, save({ ...fields, [TITLE]: WRITTEN }));
    expect(response.status).toBe(503);
    const html = await response.text();
    expectUnconfirmed(html);
    expect(fieldValue(html, TITLE)).toBe(WRITTEN);
    expect(fieldValue(html, 'expectedVersion')).toBe(fields.expectedVersion);
    expect(dom(html).querySelector('main .notice')?.getAttribute('role')).toBe('alert');
    expect(dom(html).querySelector('main .notice a')?.getAttribute('href')).toBe(MOLOTES);
  });

  it('API caída, sin poder comprobar la sesión: igual, sin cabecera y con el `_csrf` recibido', async () => {
    const { h, browser } = await openSession();
    const fields = await formOf(browser);
    h.api.mode = 'down';
    const response = await browser.post(MOLOTES, save({ ...fields, [TITLE]: WRITTEN }));
    expect(response.status).toBe(503);
    const html = await response.text();
    expectUnconfirmed(html);
    expect(fieldValue(html, TITLE)).toBe(WRITTEN);
    expect(fieldValue(html, '_csrf')).toBe(fields._csrf);
    expect(dom(html).querySelector('.admin-header')).toBeNull();
    expect(dom(html).querySelector('label[for="f-hero-showcase-title"]')?.textContent).toBe('Título');
  });

  it('API inaccesible de verdad: igual', async () => {
    const { browser: signed } = await openSession();
    const fields = await formOf(signed);
    const browser = (await startInventory({ apiUrl: await freePortUrl(), apiTimeoutMs: 500 })).browser();
    for (const [name, value] of signed.cookies) browser.cookies.set(name, value);
    const response = await browser.post(MOLOTES, save({ ...fields, [TITLE]: WRITTEN, 'promo.description': 'Dos\nlíneas' }));
    expect(response.status).toBe(503);
    const html = await response.text();
    expectUnconfirmed(html);
    // Proceso recién arrancado y sin API (un despliegue): no conoce los campos, pero no pierde nada.
    expect(fieldValue(html, TITLE)).toBe(WRITTEN);
    expect(fieldValue(html, 'promo.description')).toBe('Dos\nlíneas');
    expect(fieldValue(html, 'expectedVersion')).toBe(fields.expectedVersion);
  });

  it('lo recuperado se puede volver a enviar tal cual', async () => {
    const { h, browser } = await openSession();
    const fields = await formOf(browser);
    h.api.mode = 'down';
    const html = await (await browser.post(MOLOTES, save({ ...fields, [TITLE]: WRITTEN }))).text();
    h.api.mode = 'ok';
    const response = await browser.post(MOLOTES, save(formFields(html, '#page-form')));
    expect(response.status).toBe(303);
    expect(h.api.page.pages.molotes.current.values[TITLE]).toBe(WRITTEN);
  });

  it('la escritura sí entró y se perdió la respuesta: repetir no duplica ni habla de "otra persona"', async () => {
    const { h, browser } = await openSession();
    const fields = await formOf(browser);
    Object.assign(h.api.page, { writeFailure: '503', applyBeforeFailure: true });
    const html = await (await browser.post(MOLOTES, save({ ...fields, [TITLE]: WRITTEN }))).text();
    expectUnconfirmed(html);
    Object.assign(h.api.page, { writeFailure: null, applyBeforeFailure: false });
    const response = await browser.post(MOLOTES, save(formFields(html, '#page-form')));
    expect(response.status).toBe(409);
    const again = await response.text();
    expect(textOf(again)).toContain('La página ya cambió: el último cambio lleva tu nombre.');
    expect(textOf(again)).toContain('Última modificación: Ana Admin, el 03/11/2026 10:00.');
    expect(textOf(again)).not.toMatch(/otra persona|no se guardó/i);
    expect(fieldValue(again, TITLE)).toBe(WRITTEN);
    expect(dom(again).querySelector('button[value="overwrite"]')).not.toBeNull();
    expect(h.api.page.writes).toHaveLength(1);
  });

  it('una sobrescritura sin confirmar sigue siéndolo', async () => {
    const { h, browser } = await openSession();
    const fields = await formOf(browser);
    h.api.page.writeFailure = '503';
    const html = await (await browser.post(MOLOTES, save({ ...fields, [TITLE]: WRITTEN }, 'overwrite'))).text();
    expect(dom(html).querySelector('button[value="overwrite"]')).not.toBeNull();
  });
});

describe('restaurar sin confirmación', () => {
  const confirm = (html: string) => formFields(html, `form[action="${MOLOTES_RESTORE}"]`);

  it.each(FAILURES)('%s: 503, pide revisar y no afirma nada', async (failure) => {
    const { h, browser } = await openSession();
    const fields = confirm(await (await browser.get(MOLOTES_RESTORE)).text());
    h.api.page.writeFailure = failure;
    const response = await browser.post(MOLOTES_RESTORE, fields);
    expect(response.status).toBe(503);
    const html = await response.text();
    expectUnconfirmed(html);
    expect(dom(html).querySelector('main a')?.textContent).toBe('Revisar la página');
  });

  it('API caída, sin poder comprobar la sesión: igual, sin cabecera', async () => {
    const { h, browser } = await openSession();
    const fields = confirm(await (await browser.get(MOLOTES_RESTORE)).text());
    h.api.mode = 'down';
    const response = await browser.post(MOLOTES_RESTORE, fields);
    expect(response.status).toBe(503);
    const html = await response.text();
    expectUnconfirmed(html);
    expect(dom(html).querySelector('.admin-header')).toBeNull();
  });
});

describe('sesión y CSRF de la API', () => {
  it('sesión caducada al guardar: al acceso, volviendo a la pantalla', async () => {
    const { h, browser } = await openSession();
    const fields = await formOf(browser);
    h.api.page.writeFailure = 'expired';
    const response = await browser.post(MOLOTES, save(fields));
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/acceso?next=%2Fmolotes%2Fpagina&expirada=1');
  });

  it('CSRF vencido: 403 con el mensaje de la API y enlace a la pantalla', async () => {
    const { browser } = await openSession();
    const response = await browser.post(MOLOTES, save({ ...(await formOf(browser)), _csrf: 'vencido' }));
    expect(response.status).toBe(403);
    const html = await response.text();
    expect(textOf(html)).toContain('La petición no es válida.');
    expect(dom(html).querySelector('main a')?.getAttribute('href')).toBe(MOLOTES);
  });
});

describe('logs', () => {
  it('nunca llevan lo escrito', async () => {
    const { h, browser } = await openSession();
    const fields = await formOf(browser);
    h.api.page.writeFailure = '503';
    await browser.post(MOLOTES, save({ ...fields, [TITLE]: WRITTEN }));
    h.api.page.writeFailure = null;
    h.api.page.touch('molotes', 'Otra Persona');
    await browser.post(MOLOTES, save({ ...fields, [TITLE]: WRITTEN }));
    expect(h.logger.lines.join('\n')).not.toContain(WRITTEN);
    expect(h.logger.lines.join('\n')).toContain('api_unavailable');
    expect(h.logger.lines.join('\n')).toContain('page_conflict_shown');
  });
});
