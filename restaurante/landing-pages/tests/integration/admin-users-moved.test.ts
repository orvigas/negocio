import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

import { ADMIN_PASSWORD, ADMIN_USER, USER_PASSWORD, createUser, csrfFrom, login, loginAs, openForm, setupAdmin, submitForm, textOf } from '../support/admin.ts';
import { appDatabaseUrl } from '../support/database.ts';
import { runNode } from '../support/process.ts';

/**
 * Modo de solo lectura de usuarios y "Mi cuenta" en el /admin actual (REQ-F-040, RF-19 y CA-14; P-2
 * "Como productos (Recomendado)"): con ADMIN_NEW_URL se gestionan en el admin nuevo. La lista se
 * consulta sin controles de escritura, con el aviso y el enlace; las pantallas de formulario y
 * cualquier POST responden 410 con el aviso y el enlace a la pantalla equivalente, sin leer el
 * formulario ni escribir nada. Bot, menú, el primer administrador y la recuperación por consola siguen
 * igual. Sin la variable, el comportamiento es el de siempre (admin-users.test.ts y
 * admin-account.test.ts).
 */

const NEW_ADMIN = 'https://admin.birriaelmuneco.test';
const ENV = { ADMIN_NEW_URL: NEW_ADMIN };
const NEW_PASSWORD = 'contraseña-nueva-de-040';

async function movedAdmin() {
  const context = await setupAdmin({ env: ENV });
  const eli = await createUser(context.users, { username: 'eli', displayName: 'Eli Molotes' });
  const browser = await loginAs(context.browser(), ADMIN_USER, ADMIN_PASSWORD);
  /** Estado completo de los usuarios y de su auditoría: nada debe cambiar. */
  const snapshot = async () =>
    JSON.stringify([await context.prisma.user.findMany({ include: { businesses: true }, orderBy: { id: 'asc' } }), await context.prisma.userAudit.findMany({ orderBy: { id: 'asc' } })]);
  return { ...context, newBrowser: context.browser, browser, eli, snapshot };
}

describe('usuarios y "Mi cuenta" sin controles de escritura (RF-19)', () => {
  it('la lista muestra los datos con el aviso y el enlace, sin crear, editar, contraseña, desactivar ni reactivar', async () => {
    const { browser } = await movedAdmin();
    const res = await browser.get('/admin/usuarios');
    expect(res.status).toBe(200);
    const { document } = new JSDOM(res.text).window;
    const rows = [...document.querySelectorAll('tbody tr')].map((row) => textOf(row.outerHTML));
    expect(rows).toHaveLength(2);
    expect(rows.join(' ')).toContain('Eli Molotes');
    const text = textOf(res.text);
    expect(text).toContain('Los usuarios ahora se gestionan en el admin nuevo.');
    expect(document.querySelector(`a[href="${NEW_ADMIN}/usuarios"]`)?.textContent).toBe('Ir a la pantalla equivalente del admin nuevo');
    for (const label of ['Crear usuario', 'Editar', 'Restablecer contraseña', 'Desactivar', 'Reactivar']) expect(text).not.toContain(label);
    expect(document.querySelectorAll('main form').length).toBe(0);
  });

  it.each([
    ['/admin/usuarios/nuevo', '/usuarios/nuevo'],
    ['/admin/usuarios/{id}', '/usuarios/{id}/editar'],
    ['/admin/usuarios/{id}/contrasena', '/usuarios/{id}/contrasena'],
    ['/admin/cuenta', '/cuenta'],
  ])('GET %s: 410 con el aviso y el enlace a %s, sin el formulario', async (path, equivalent) => {
    const { browser, eli } = await movedAdmin();
    const res = await browser.get(path.replace('{id}', String(eli.id)));
    expect(res.status).toBe(410);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.text).toContain(`href="${NEW_ADMIN}${equivalent.replace('{id}', String(eli.id))}"`);
    expect(textOf(res.text)).toMatch(/ahora se (gestionan|cambia) en el admin nuevo/);
    expect(res.text).not.toMatch(/type="password"|name="username"/);
  });

  it('un id mal formado sigue dando 404', async () => {
    const { browser } = await movedAdmin();
    for (const path of ['/admin/usuarios/abc', '/admin/usuarios/0/contrasena']) expect((await browser.get(path)).status, path).toBe(404);
  });

  it('un editor sigue recibiendo 403 en usuarios; "Mi cuenta" le muestra el enlace al admin nuevo', async () => {
    const context = await movedAdmin();
    const editor = await loginAs(context.newBrowser(), 'eli');
    for (const path of ['/admin/usuarios', '/admin/usuarios/nuevo']) expect((await editor.get(path)).status, path).toBe(403);
    const account = await editor.get('/admin/cuenta');
    expect(account.status).toBe(410);
    expect(account.text).toContain(`href="${NEW_ADMIN}/cuenta"`);
  });
});

describe('ninguna escritura de usuarios ni de la cuenta cambia nada (CA-14)', () => {
  it('cualquier POST, con sesión y token CSRF válidos: 410 con el aviso y la tabla de usuarios y `user_audit` sin cambios', async () => {
    const { browser, eli, snapshot } = await movedAdmin();
    const csrf = csrfFrom((await browser.get('/admin/molotes')).text);
    const before = await snapshot();
    const posts: [string, Record<string, string>][] = [
      ['/admin/usuarios', { _csrf: csrf, username: 'nora', displayName: 'Nora', role: 'editor', 'business-molotes': 'on', password: NEW_PASSWORD, passwordConfirmation: NEW_PASSWORD }],
      [`/admin/usuarios/${eli.id}`, { _csrf: csrf, username: 'eli', displayName: 'Eli', role: 'admin' }],
      [`/admin/usuarios/${eli.id}/desactivar`, { _csrf: csrf }],
      [`/admin/usuarios/${eli.id}/reactivar`, { _csrf: csrf }],
      [`/admin/usuarios/${eli.id}/contrasena`, { _csrf: csrf, password: NEW_PASSWORD, passwordConfirmation: NEW_PASSWORD }],
      ['/admin/cuenta', { _csrf: csrf, currentPassword: ADMIN_PASSWORD, password: NEW_PASSWORD, passwordConfirmation: NEW_PASSWORD }],
      // Sin token CSRF: tampoco se lee el formulario.
      [`/admin/usuarios/${eli.id}/desactivar`, {}],
    ];
    for (const [path, fields] of posts) {
      const res = await browser.post(path).type('form').send(fields);
      expect(res.status, path).toBe(410);
      expect(textOf(res.text)).toMatch(/ahora se (gestionan|cambia) en el admin nuevo/);
    }
    expect(await snapshot()).toBe(before);
    // Las contraseñas no cambiaron.
    expect((await login(browser, { password: ADMIN_PASSWORD })).status).toBe(303);
    await loginAs(browser, 'eli', USER_PASSWORD);
  });
});

describe('el resto del /admin funciona igual', () => {
  it('menú (hero y promociones) y bot', async () => {
    const { browser } = await movedAdmin();
    const { fields } = await openForm(browser, 'molotes');
    expect((await submitForm(browser, 'molotes', fields, { 'menu.highlight': 'Destacado de prueba' })).status).toBe(303);
    expect([200, 503]).toContain((await browser.get('/admin/bot')).status);
  });

  it('la recuperación por consola sigue funcionando con ADMIN_NEW_URL', async () => {
    const { database, prisma } = await movedAdmin();
    const result = await runNode(['scripts/admin-recover.ts', '--usuario', ADMIN_USER], {
      env: { NODE_ENV: 'test', ...ENV, DATABASE_URL: appDatabaseUrl(database.name) },
      input: `${NEW_PASSWORD}\n`,
    });
    expect(result.code, result.stderr).toBe(0);
    expect(await prisma.userAudit.count({ where: { action: 'console_recovery' } })).toBe(1);
  });
});
