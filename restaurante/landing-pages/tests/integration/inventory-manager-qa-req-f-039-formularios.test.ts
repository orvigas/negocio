import { afterEach, describe, expect, it } from 'vitest';

import { ADMIN_PASSWORD, ADMIN_USER } from '../support/admin.ts';
import { EDITOR, IMAGE_SRC, startStack, client, loginAs, hidden, molotesForm, productNames, expectNoSecrets, runCleanups } from '../support/inventory-manager-qa-req-f-039.ts';

/**
 * QA de REQ-F-039, PR 2 (QA Action Plan aprobado el 2026-10-28): procesos reales de `api`,
 * `landing-pages` (importación de la semilla y primer administrador) e `inventory-manager` contra
 * MySQL, sin importar código de las otras apps. Cubre lo que las pruebas de inventory-manager no
 * prueban al usar un doble de la API:
 *
 * - S-01: cookie `__Host-admin_sid` en producción detrás de un proxy con TLS; 503 sin TLS.
 * - S-05 y S-06: `next` con destinos maliciosos y `Location` siempre interna.
 * - S-03: la primera capa de CSRF corta antes de llegar a la API.
 * - S-08: la IP que cuenta la API es la del proxy (último valor) solo con TRUST_PROXY.
 * - F-10 y S-10: la `requestId` del formulario evita el doble alta y se conserva tras un 422.
 * - F-11: 409 real entre dos sesiones, sin sobrescribir sin pedirlo.
 * - F-12: API caída de verdad: 503 con lo escrito intacto y sin trazas.
 * - S-09: ningún log lleva contraseñas, ids de sesión ni tokens CSRF.
 *
 * REQ-F-041: parte de inventory-manager-qa-req-f-039.test.ts (preparación en
 * tests/support/inventory-manager-qa-req-f-039.ts).
 */

afterEach(runCleanups);

describe('QA REQ-F-039 PR 2: formularios con la API real', () => {
  it('F-11: 409 real entre dos sesiones: conserva lo escrito, dice quién, no guarda sin pedirlo y sobrescribe solo a petición', async () => {
    const stack = await startStack();
    const eli = client(stack);
    const ana = client(stack);
    await loginAs(eli, EDITOR.username, EDITOR.password);
    await loginAs(ana, ADMIN_USER, ADMIN_PASSWORD);
    const eliForm = await (await eli.get('/molotes/productos/3/editar')).text();
    const anaForm = await (await ana.get('/molotes/productos/3/editar')).text();
    const base = { category: 'platillo', detailsType: '', description: 'Masa rellena.', label: 'Nuevo', tone: 'sky', price: '45.00', orderPrice: '130.00', orderQuantity: '3', 'image.src': IMAGE_SRC, 'image.alt': 'x', 'image.width': '800', 'image.height': '600' };
    const anaSave = await ana.post('/molotes/productos/3', { _csrf: hidden(anaForm, '_csrf'), version: hidden(anaForm, 'version'), ...base, name: 'Nombre De Ana QA2', action: 'update' });
    expect(anaSave.status).toBe(303);
    const conflict = await eli.post('/molotes/productos/3', { _csrf: hidden(eliForm, '_csrf'), version: hidden(eliForm, 'version'), ...base, name: 'Nombre De Eli QA2', action: 'update' });
    expect(conflict.status).toBe(409);
    const html = await conflict.text();
    expect(html).toContain('Nombre De Eli QA2');
    expect(html).toContain('dueno');
    expect(html).not.toContain('value="update"');
    expect(await productNames(eli)).toContain('Nombre De Ana QA2');
    const overwrite = await eli.post('/molotes/productos/3', { _csrf: hidden(html, '_csrf'), version: hidden(html, 'version'), ...base, name: 'Nombre De Eli QA2', action: 'overwrite' });
    expect(overwrite.status).toBe(303);
    expect(await productNames(eli)).toContain('Nombre De Eli QA2');
  });

  it('F-12: con la API caída, el alta y la edición responden 503 con lo escrito intacto y sin trazas', async () => {
    const stack = await startStack();
    const c = client(stack);
    await loginAs(c, EDITOR.username, EDITOR.password);
    const form = await (await c.get('/molotes/productos/nuevo?categoria=platillo')).text();
    const edit = await (await c.get('/molotes/productos/3/editar')).text();
    await stack.api.stop();
    const created = await c.post('/molotes/productos', { _csrf: hidden(form, '_csrf'), requestId: hidden(form, 'requestId'), ...molotesForm('Molote Sin Api QA2') });
    expect(created.status).toBe(503);
    const createdHtml = await created.text();
    expect(createdHtml).toContain('Molote Sin Api QA2');
    expect(hidden(createdHtml, 'requestId')).toBe(hidden(form, 'requestId'));
    const updated = await c.post('/molotes/productos/3', { _csrf: hidden(edit, '_csrf'), version: hidden(edit, 'version'), ...molotesForm('Edicion Sin Api QA2'), action: 'update' });
    expect(updated.status).toBe(503);
    const updatedHtml = await updated.text();
    expect(updatedHtml).toContain('Edicion Sin Api QA2');
    for (const text of [createdHtml, updatedHtml]) expect(text).not.toMatch(/\n\s+at |ECONNREFUSED|node_modules|127\.0\.0\.1:\d+/);
    expectNoSecrets(stack);
  });
});
