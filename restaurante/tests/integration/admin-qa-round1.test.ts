import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

import {
  ADMIN_PASSWORD,
  ADMIN_USER,
  USER_PASSWORD,
  createUser,
  csrfFrom,
  formFields,
  loginAs,
  setupAdmin,
  type Browser,
  type FormFields,
} from '../support/admin.ts';

/**
 * Correcciones de la ronda 1 de QA de REQ-F-007: DEF-001 (desbordamiento en /admin/usuarios),
 * DEF-003 (aria-current en el 403) y DEF-004 (campos desconocidos). DEF-002 está en
 * tests/unit/admin-auth.test.ts.
 */

const LONG_USERNAME = 'u'.repeat(60);

async function adminWithUsers() {
  const context = await setupAdmin();
  await createUser(context.users, { username: LONG_USERNAME, displayName: 'n'.repeat(60) });
  await createUser(context.users, { username: 'ana', displayName: 'Ana', businesses: ['molotes'] });
  const admin = await loginAs(context.browser(), ADMIN_USER, ADMIN_PASSWORD);
  const editor = await loginAs(context.browser(), 'ana', USER_PASSWORD);
  return { ...context, admin, editor };
}

const currentLinks = (html: string) =>
  [...new JSDOM(html).window.document.querySelectorAll('nav a[aria-current="page"]')].map((link) => link.getAttribute('href'));

describe('DEF-001: la tabla de usuarios no desborda el documento', () => {
  it('los textos solo para lectores de pantalla quedan contenidos en el contenedor con scroll posicionado', async () => {
    const { admin } = await adminWithUsers();
    const page = await admin.get('/admin/usuarios');
    const { document } = new JSDOM(page.text).window;
    const container = document.querySelector('.admin-users');
    expect(container?.classList.contains('overflow-x-auto')).toBe(true);
    // `relative` hace que los .sr-only (position: absolute) se coloquen dentro del contenedor.
    expect(container?.classList.contains('relative')).toBe(true);
    const srOnly = [...document.querySelectorAll('.sr-only')].filter((element) => element.closest('table'));
    expect(srOnly.length).toBeGreaterThan(0);
    for (const element of srOnly) expect(container?.contains(element)).toBe(true);
    // Las acciones conservan su nombre accesible, también con un usuario de 60 caracteres.
    const names = [...document.querySelectorAll('.admin-users__action, .admin-users__status-form button')].map((element) =>
      element.textContent.replace(/\s+/g, ' ').trim(),
    );
    expect(names).toEqual(expect.arrayContaining([`Editar a ${LONG_USERNAME}`, `Restablecer contraseña de ${LONG_USERNAME}`, `Desactivar a ${LONG_USERNAME}`]));
  });
});

describe('DEF-003: aria-current solo en el enlace de la URL actual', () => {
  it('el 403 de un negocio no marca ningún enlace como página actual', async () => {
    const { editor } = await adminWithUsers();
    for (const path of ['/admin/birria', '/admin/usuarios']) {
      const res = await editor.get(path);
      expect(res.status).toBe(403);
      expect(currentLinks(res.text), path).toEqual([]);
    }
  });

  it('las demás páginas conservan su aria-current', async () => {
    const { admin } = await adminWithUsers();
    const expected: [string, string][] = [
      ['/admin', '/admin'],
      ['/admin/molotes', '/admin/molotes'],
      ['/admin/birria', '/admin/birria'],
      ['/admin/usuarios', '/admin/usuarios'],
      ['/admin/usuarios/nuevo', '/admin/usuarios'],
      ['/admin/cuenta', '/admin/cuenta'],
    ];
    for (const [path, href] of expected) expect(currentLinks((await admin.get(path)).text), path).toEqual([href]);
  });
});

describe('DEF-004: los formularios de usuarios y de Mi cuenta rechazan campos desconocidos', () => {
  async function snapshot(context: Awaited<ReturnType<typeof adminWithUsers>>) {
    return {
      users: await context.prisma.user.findMany({ include: { businesses: true }, orderBy: { id: 'asc' } }),
      audit: await context.prisma.userAudit.count(),
    };
  }

  /** Envía el formulario real de `formPath` (tal como lo manda el navegador) más `extra`. */
  async function send(browser: Browser, formPath: string, action: string, extra: FormFields, selector = 'main form') {
    const page = await browser.get(formPath);
    const fields = formFields(page.text, selector);
    return browser.post(action).type('form').send({ ...fields, _csrf: csrfFrom(page.text), ...extra });
  }

  it('cada formulario: un campo desconocido -> 400 INVALID_FORM y no se escribe nada', async () => {
    const context = await adminWithUsers();
    const target = (await context.users.findCredentials('ana'))!.user;
    const cases: [string, () => Promise<{ status: number; body: unknown }>][] = [
      [
        'crear',
        () =>
          send(context.admin, '/admin/usuarios/nuevo', '/admin/usuarios', {
            username: 'nuevo',
            displayName: 'Nuevo',
            role: 'editor',
            'business-molotes': 'on',
            password: 'clave-del-nuevo-123',
            passwordConfirmation: 'clave-del-nuevo-123',
            foo: '1',
          }),
      ],
      ['editar', () => send(context.admin, `/admin/usuarios/${target.id}`, `/admin/usuarios/${target.id}`, { displayName: 'Cambiado', foo: '1' })],
      ['desactivar', () => send(context.admin, '/admin/usuarios', `/admin/usuarios/${target.id}/desactivar`, { foo: '1' }, '.admin-users__status-form')],
      ['reactivar', () => send(context.admin, '/admin/usuarios', `/admin/usuarios/${target.id}/reactivar`, { foo: '1' }, '.admin-users__status-form')],
      [
        'restablecer',
        () =>
          send(context.admin, `/admin/usuarios/${target.id}/contrasena`, `/admin/usuarios/${target.id}/contrasena`, {
            password: 'otra-clave-de-ana-1',
            passwordConfirmation: 'otra-clave-de-ana-1',
            foo: '1',
          }),
      ],
      [
        'Mi cuenta',
        () =>
          send(context.editor, '/admin/cuenta', '/admin/cuenta', {
            currentPassword: USER_PASSWORD,
            password: 'otra-clave-de-ana-2',
            passwordConfirmation: 'otra-clave-de-ana-2',
            'business-birria': 'on',
          }),
      ],
    ];
    const before = await snapshot(context);
    for (const [label, run] of cases) {
      const res = await run();
      expect(res.status, label).toBe(400);
      expect(res.body, label).toEqual({ error: { code: 'INVALID_FORM', message: 'El formulario tiene campos desconocidos.' } });
    }
    expect(await snapshot(context)).toEqual(before);
    // La sesión del editor sigue y su contraseña no cambió.
    expect((await context.editor.get('/admin/molotes')).status).toBe(200);
  });

  it('los formularios reales siguen funcionando, con las casillas de negocios opcionales', async () => {
    const context = await adminWithUsers();
    const target = (await context.users.findCredentials('ana'))!.user;
    // Editor con un solo negocio marcado (la otra casilla no se envía).
    expect((await send(context.admin, `/admin/usuarios/${target.id}`, `/admin/usuarios/${target.id}`, { displayName: 'Ana 2' })).status).toBe(303);
    // Administrador sin ninguna casilla marcada.
    const csrf = csrfFrom((await context.admin.get('/admin/usuarios/nuevo')).text);
    const created = await context.admin
      .post('/admin/usuarios')
      .type('form')
      .send({
        _csrf: csrf,
        username: 'jefa',
        displayName: 'Jefa',
        role: 'admin',
        password: 'clave-de-la-jefa-1',
        passwordConfirmation: 'clave-de-la-jefa-1',
      });
    expect(created.status).toBe(303);
    expect((await send(context.admin, '/admin/usuarios', `/admin/usuarios/${target.id}/desactivar`, {}, '.admin-users__status-form')).status).toBe(303);
  });

  it('un editor sin permiso recibe 403 antes de que se lea el body (DT-12), aunque traiga campos desconocidos', async () => {
    const context = await adminWithUsers();
    const target = (await context.users.findCredentials('ana'))!.user;
    const csrf = csrfFrom((await context.editor.get('/admin/molotes')).text);
    for (const path of ['/admin/usuarios', `/admin/usuarios/${target.id}`, `/admin/usuarios/${target.id}/desactivar`, `/admin/usuarios/${target.id}/contrasena`]) {
      const res = await context.editor.post(path).type('form').send({ _csrf: csrf, foo: '1' });
      expect(res.status, path).toBe(403);
    }
  });
});
