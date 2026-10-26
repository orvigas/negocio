import { describe, expect, it } from 'vitest';

import {
  ADMIN_PASSWORD,
  ADMIN_USER,
  USER_PASSWORD,
  createUser,
  csrfFrom,
  formFields,
  login,
  loginAs,
  setupAdmin,
  textOf,
  type Browser,
  type FormFields,
} from '../support/admin.ts';

/** Gestión de usuarios (REQ-F-007, R-8, D-6 a D-8, D-10; CA-7 a CA-12 y CA-18). */

async function asAdmin() {
  const context = await setupAdmin();
  const admin = await loginAs(context.browser(), ADMIN_USER, ADMIN_PASSWORD);
  const userByName = async (username: string) => (await context.users.findCredentials(username))?.user ?? null;
  return { ...context, admin, userByName };
}

async function submit(browser: Browser, path: string, formPath: string, values: FormFields) {
  const page = await browser.get(formPath);
  return browser.post(path).type('form').send({ ...formFields(page.text, 'main form'), _csrf: csrfFrom(page.text), ...values });
}

const NEW_EDITOR = Object.freeze({
  username: 'Ana',
  displayName: 'Ana López',
  role: 'editor',
  'business-molotes': 'on',
  password: 'clave-de-ana-123',
  passwordConfirmation: 'clave-de-ana-123',
});

const createForm = (browser: Browser, values: FormFields) => submit(browser, '/admin/usuarios', '/admin/usuarios/nuevo', values);
const postAction = async (browser: Browser, path: string) => {
  const page = await browser.get('/admin/usuarios');
  return browser.post(path).type('form').send({ _csrf: csrfFrom(page.text) });
};

describe('crear usuarios (CA-8 y CA-9)', () => {
  it('el administrador crea un editor que entra y solo ve sus negocios (CA-8)', async () => {
    const { admin, browser, userByName, prisma } = await asAdmin();
    const res = await createForm(admin, { ...NEW_EDITOR });
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe('/admin/usuarios?ok=created');

    const list = await admin.get(res.headers.location!);
    expect(textOf(list.text)).toContain('Usuario creado.');
    expect(textOf(list.text)).toMatch(/Ana Ana López Editor Moloteando Activo Nunca/);

    const ana = await loginAs(browser(), 'ana', NEW_EDITOR.password);
    expect((await ana.get('/admin/molotes')).status).toBe(200);
    expect((await ana.get('/admin/birria')).status).toBe(403);
    expect((await userByName('ana'))?.lastLoginAt).not.toBeNull();
    // El hash es scrypt y la auditoría registra quién creó a quién, sin la contraseña.
    const stored = await prisma.user.findFirst({ where: { usernameKey: 'ana' } });
    expect(stored?.passwordHash).toMatch(/^scrypt\$/);
    const audit = await prisma.userAudit.findFirst({ where: { action: 'create', targetId: stored?.id } });
    expect(audit).toMatchObject({ actorKind: 'user' });
    expect(audit?.changes).not.toContain(NEW_EDITOR.password);
  });

  it.each([
    ['usuario repetido (otras mayúsculas)', { username: 'DUENO' }, 'u-username', 'Ya existe un usuario con ese nombre de acceso'],
    ['contraseña corta', { password: 'corta-11ch', passwordConfirmation: 'corta-11ch' }, 'u-password', 'al menos 12 caracteres'],
    ['editor sin negocios', { 'business-molotes': undefined }, 'u-businesses', 'Asigna al menos un negocio al editor.'],
  ])('CA-9: %s -> error junto al campo y no se guarda nada', async (_case, changes, fieldId, message) => {
    const { admin, prisma } = await asAdmin();
    const values: FormFields = { ...NEW_EDITOR };
    for (const [name, value] of Object.entries(changes)) {
      if (value === undefined) delete values[name];
      else values[name] = value;
    }
    const before = await prisma.user.count();
    const res = await createForm(admin, values);
    expect(res.status).toBe(422);
    expect(await prisma.user.count()).toBe(before);
    expect(res.text).toContain(`id="${fieldId}-error"`);
    expect(textOf(res.text)).toContain(message);
    expect(res.text).toMatch(/role="alert"[^>]*>\s*<p class="admin-notice__title font-bold">No se guardó nada/);
    expect(res.text).toContain(`href="#${fieldId}"`);
    // Se conserva lo escrito, salvo las contraseñas.
    expect(res.text).toContain('value="Ana López"');
    expect(res.text).not.toContain(NEW_EDITOR.password);
  });

  it('el formulario no depende de JavaScript y las contraseñas usan autocomplete="new-password"', async () => {
    const { admin } = await asAdmin();
    const page = await admin.get('/admin/usuarios/nuevo');
    expect(page.status).toBe(200);
    expect(page.text).not.toMatch(/<script/);
    expect(page.text).toMatch(/<input[^>]*id="u-password"[^>]*type="password"[^>]*autocomplete="new-password"/);
    expect(page.text).toMatch(/<legend[^>]*>Negocios del editor<\/legend>/);
  });
});

describe('editar, desactivar y reactivar (CA-10 a CA-12)', () => {
  it('CA-10: el único administrador no puede desactivarse ni pasar a editor', async () => {
    const { admin, userByName } = await asAdmin();
    const owner = (await userByName(ADMIN_USER))!;

    const deactivate = await postAction(admin, `/admin/usuarios/${owner.id}/desactivar`);
    expect(deactivate.status).toBe(409);
    expect(textOf(deactivate.text)).toContain('Debe quedar al menos un administrador activo');

    const demote = await submit(admin, `/admin/usuarios/${owner.id}`, `/admin/usuarios/${owner.id}`, { role: 'editor', 'business-molotes': 'on' });
    expect(demote.status).toBe(409);
    expect(textOf(demote.text)).toContain('Debe quedar al menos un administrador activo');
    expect(await userByName(ADMIN_USER)).toMatchObject({ role: 'admin', active: true });
    // Sigue con su sesión.
    expect((await admin.get('/admin/usuarios')).status).toBe(200);
  });

  it('CA-11: desactivar, cambiar rol, cambiar negocios o restablecer la contraseña cierran la sesión abierta', async () => {
    const { admin, browser, users } = await asAdmin();
    const ana = await createUser(users, { username: 'ana', businesses: ['molotes'] });
    const changes: [string, (session: Browser) => Promise<unknown>][] = [
      ['negocios', () => submit(admin, `/admin/usuarios/${ana.id}`, `/admin/usuarios/${ana.id}`, { 'business-birria': 'on' })],
      ['rol', () => submit(admin, `/admin/usuarios/${ana.id}`, `/admin/usuarios/${ana.id}`, { role: 'admin' })],
      [
        'contraseña',
        () =>
          submit(admin, `/admin/usuarios/${ana.id}/contrasena`, `/admin/usuarios/${ana.id}/contrasena`, {
            password: USER_PASSWORD,
            passwordConfirmation: USER_PASSWORD,
          }),
      ],
      ['desactivar', () => postAction(admin, `/admin/usuarios/${ana.id}/desactivar`)],
    ];
    for (const [label, change] of changes) {
      const session = await loginAs(browser(), 'ana');
      expect((await session.get('/admin/molotes')).status, label).toBe(200);
      await change(session);
      const res = await session.get('/admin/molotes');
      expect(res.status, label).toBe(303);
      expect(res.headers.location, label).toMatch(/^\/admin\/login/);
    }
    // Desactivada no puede volver a entrar (mismo mensaje que con credenciales incorrectas).
    const retry = await login(browser(), { username: 'ana', password: USER_PASSWORD });
    expect(retry.status).toBe(401);
    expect(textOf(retry.text)).toContain('Usuario o contraseña incorrectos.');
  });

  it('cambiar solo el nombre visible no cierra la sesión', async () => {
    const { admin, browser, users } = await asAdmin();
    const ana = await createUser(users, { username: 'ana' });
    const session = await loginAs(browser(), 'ana');
    expect((await submit(admin, `/admin/usuarios/${ana.id}`, `/admin/usuarios/${ana.id}`, { displayName: 'Ana L.' })).status).toBe(303);
    expect((await session.get('/admin/molotes')).status).toBe(200);
    expect(textOf((await session.get('/admin')).text)).toContain('Sesión: Ana L. (Editor)');
  });

  it('CA-12: un usuario reactivado puede volver a entrar', async () => {
    const { admin, browser, users } = await asAdmin();
    const ana = await createUser(users, { username: 'ana' });
    expect((await postAction(admin, `/admin/usuarios/${ana.id}/desactivar`)).status).toBe(303);
    expect((await login(browser(), { username: 'ana', password: USER_PASSWORD })).status).toBe(401);
    const reactivate = await postAction(admin, `/admin/usuarios/${ana.id}/reactivar`);
    expect(reactivate.status).toBe(303);
    expect(reactivate.headers.location).toBe('/admin/usuarios?ok=reactivated');
    expect((await login(browser(), { username: 'ana', password: USER_PASSWORD })).status).toBe(303);
  });

  it('un administrador que no es el último se desactiva a sí mismo y su sesión se cierra', async () => {
    const { admin, users, userByName } = await asAdmin();
    await createUser(users, { username: 'otra', role: 'admin' });
    const owner = (await userByName(ADMIN_USER))!;
    expect((await postAction(admin, `/admin/usuarios/${owner.id}/desactivar`)).status).toBe(303);
    expect((await admin.get('/admin/usuarios')).status).toBe(303);
  });

  it('restablecer la contraseña: la anterior deja de valer y la nueva funciona', async () => {
    const { admin, browser, users } = await asAdmin();
    const ana = await createUser(users, { username: 'ana' });
    const path = `/admin/usuarios/${ana.id}/contrasena`;
    const mismatch = await submit(admin, path, path, { password: 'nueva-clave-de-ana', passwordConfirmation: 'otra-clave-de-ana' });
    expect(mismatch.status).toBe(422);
    expect(textOf(mismatch.text)).toContain('Las contraseñas no coinciden.');
    const ok = await submit(admin, path, path, { password: 'nueva-clave-de-ana', passwordConfirmation: 'nueva-clave-de-ana' });
    expect(ok.status).toBe(303);
    expect((await login(browser(), { username: 'ana', password: USER_PASSWORD })).status).toBe(401);
    expect((await login(browser(), { username: 'ana', password: 'nueva-clave-de-ana' })).status).toBe(303);
  });

  it('id inexistente o inválido -> 404', async () => {
    const { admin } = await asAdmin();
    for (const path of ['/admin/usuarios/999', '/admin/usuarios/abc', '/admin/usuarios/0', '/admin/usuarios/999/contrasena']) {
      expect((await admin.get(path)).status, path).toBe(404);
    }
    expect((await postAction(admin, '/admin/usuarios/999/desactivar')).status).toBe(404);
  });
});

describe('editores (CA-7)', () => {
  it('reciben 403 al abrir la gestión de usuarios o enviar sus formularios, y nada cambia', async () => {
    const { browser, users, prisma } = await asAdmin();
    const target = await createUser(users, { username: 'beto' });
    await createUser(users, { username: 'ana' });
    const ana = await loginAs(browser(), 'ana');
    const csrf = csrfFrom((await ana.get('/admin/molotes')).text);
    const before = { users: await prisma.user.findMany({ include: { businesses: true } }), audit: await prisma.userAudit.count() };

    for (const path of ['/admin/usuarios', '/admin/usuarios/nuevo', `/admin/usuarios/${target.id}`, `/admin/usuarios/${target.id}/contrasena`]) {
      const res = await ana.get(path);
      expect(res.status, path).toBe(403);
      expect(textOf(res.text)).toContain('No tienes permiso para gestionar usuarios.');
    }
    const posts: [string, FormFields][] = [
      ['/admin/usuarios', { ...NEW_EDITOR, username: 'colado' }],
      [`/admin/usuarios/${target.id}`, { username: 'beto', displayName: 'Beto', role: 'admin' }],
      [`/admin/usuarios/${target.id}/desactivar`, {}],
      [`/admin/usuarios/${target.id}/reactivar`, {}],
      [`/admin/usuarios/${target.id}/contrasena`, { password: 'clave-de-intruso', passwordConfirmation: 'clave-de-intruso' }],
    ];
    for (const [path, values] of posts) {
      const res = await ana.post(path).type('form').send({ _csrf: csrf, ...values });
      expect(res.status, path).toBe(403);
    }
    expect({ users: await prisma.user.findMany({ include: { businesses: true } }), audit: await prisma.userAudit.count() }).toEqual(before);
  });
});

describe('POST-redirect-GET (CA-18)', () => {
  it('recargar después de crear no repite la operación', async () => {
    const { admin, prisma } = await asAdmin();
    const res = await createForm(admin, { ...NEW_EDITOR });
    expect(res.status).toBe(303);
    const count = await prisma.user.count();
    // El navegador recarga la página de destino (GET), no el POST.
    expect((await admin.get(res.headers.location!)).status).toBe(200);
    expect((await admin.get(res.headers.location!)).status).toBe(200);
    expect(await prisma.user.count()).toBe(count);
  });

  it('sin CSRF válido -> 403 y nada cambia', async () => {
    const { admin, prisma } = await asAdmin();
    const res = await admin.post('/admin/usuarios').type('form').send({ ...NEW_EDITOR, _csrf: 'x'.repeat(43) });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_INVALID');
    expect(await prisma.user.count()).toBe(1);
  });
});
