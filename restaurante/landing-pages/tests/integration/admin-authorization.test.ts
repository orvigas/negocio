import { describe, expect, it } from 'vitest';

import type { BusinessId } from '../../src/config/businesses.ts';
import { csrfFrom, createUser, formFields, loginAs, setupAdmin, submitForm, textOf } from '../support/admin.ts';

/**
 * Autorización por rol y por negocio en /admin (REQ-F-007, R-7, RN-2, DT-12; CA-6 y CA-7 para
 * los menús). La gestión de usuarios tiene sus propias pruebas en admin-users.test.ts.
 */

async function molotesEditor() {
  const context = await setupAdmin();
  await createUser(context.users, { username: 'mole', displayName: 'Editor de Molotes', businesses: ['molotes'] });
  const browser = await loginAs(context.browser(), 'mole');
  const snapshot = (businessId: BusinessId) => ({
    current: context.repository.storage.files.get(`${businessId}/current`),
    previous: context.repository.storage.files.get(`${businessId}/previous`),
    changes: context.repository.storage.changes.length,
  });
  return { ...context, browser, snapshot };
}

function expectForbidden(res: { status: number; text: string }) {
  expect(res.status).toBe(403);
  expect(res.text).toMatch(/role="alert"[^>]*>\s*<p class="admin-notice__title font-bold">No tienes permiso para administrar Birria El Muñeco\.<\/p>/);
  expect(textOf(res.text)).toContain('No se cambió nada.');
}

describe('editor asignado solo a Molotes (CA-6)', () => {
  it('abrir /admin/birria o su confirmación de restauración responde 403', async () => {
    const { browser } = await molotesEditor();
    expectForbidden(await browser.get('/admin/birria'));
    expectForbidden(await browser.get('/admin/birria/restaurar-anterior'));
  });

  it('guardar, sobrescribir tras conflicto, restaurar y restaurar la semilla en Birria: 403 y el JSON no cambia', async () => {
    const { browser, snapshot, repository } = await molotesEditor();
    // El editor usa el formulario y el token de su propio negocio.
    const page = await browser.get('/admin/molotes');
    const csrf = csrfFrom(page.text);
    // Datos de Birria dañados: también se rechaza la restauración de la semilla, que sí estaría permitida.
    repository.storage.files.set('birria/current', '[]');
    await repository.getForEdit('birria');
    const before = snapshot('birria');

    const birriaFields = { ...formFields(page.text), _csrf: csrf };
    expectForbidden(await submitForm(browser, 'birria', birriaFields, { 'promo.title': 'Intruso' }));
    expectForbidden(await submitForm(browser, 'birria', birriaFields, { action: 'overwrite_after_conflict' }));
    expectForbidden(await browser.post('/admin/birria/restaurar-anterior').type('form').send({ _csrf: csrf }));
    expectForbidden(await browser.post('/admin/birria/restaurar-semilla').type('form').send({ _csrf: csrf }));

    expect(snapshot('birria')).toEqual(before);
  });

  it('el permiso se comprueba antes de leer el formulario: un body inválido también recibe 403', async () => {
    const { browser } = await molotesEditor();
    const res = await browser.post('/admin/birria').type('form').send('a=1&a=2');
    expect(res.status).toBe(403);
  });

  it('el inicio y la navegación solo muestran Molotes, sin Usuarios', async () => {
    const { browser } = await molotesEditor();
    const home = await browser.get('/admin');
    expect(home.status).toBe(200);
    expect(home.text).toContain('href="/admin/molotes"');
    expect(home.text).not.toContain('href="/admin/birria"');
    expect(home.text).not.toContain('href="/admin/usuarios"');
    expect(home.text).toContain('href="/admin/cuenta"');
    expect(textOf(home.text)).toContain('Sesión: Editor de Molotes (Editor)');
  });

  it('en su negocio edita con normalidad y el cambio queda a su nombre', async () => {
    const { browser, repository } = await molotesEditor();
    const page = await browser.get('/admin/molotes');
    expect(page.status).toBe(200);
    expect((await submitForm(browser, 'molotes', formFields(page.text), { 'menu.highlight': 'Del editor' })).status).toBe(303);
    expect(repository.storage.changes.at(-1)).toMatchObject({ author: 'Editor de Molotes', business: 'molotes' });
  });

  it('si pierde el negocio mientras edita, su siguiente envío pide acceso y no escribe (CA-11)', async () => {
    const { browser, users, snapshot } = await molotesEditor();
    const page = await browser.get('/admin/molotes');
    const editor = await users.findCredentials('mole');
    await users.update(
      editor!.user.id,
      { username: 'mole', displayName: 'Editor de Molotes', role: 'editor', businesses: ['birria'] },
      { kind: 'system' },
    );
    const before = snapshot('molotes');
    const res = await submitForm(browser, 'molotes', formFields(page.text), { 'menu.highlight': 'Tarde' });
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe('/admin/login?next=%2Fadmin%2Fmolotes&expirada=1');
    expect(snapshot('molotes')).toEqual(before);
  });
});

describe('administrador', () => {
  it('ve y edita los dos negocios y la gestión de usuarios', async () => {
    const context = await setupAdmin();
    const browser = await loginAs(context.browser(), 'dueno', 'clave-de-prueba-SECRETA-123');
    for (const path of ['/admin/molotes', '/admin/birria']) expect((await browser.get(path)).status).toBe(200);
    const home = await browser.get('/admin');
    expect(home.text).toContain('href="/admin/usuarios"');
    expect(textOf(home.text)).toContain('Sesión: dueno (Administrador)');
  });
});
