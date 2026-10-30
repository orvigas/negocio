import { describe, expect, it } from 'vitest';

import { BUSINESS_IDS, type BusinessId } from '@restaurante/core/shared';
import { verifyPassword } from '@restaurante/core/identity';

import { ADMIN_PASSWORD, ADMIN_USER, createUser, loginAs, setupAdmin, type FormFields } from '../support/admin.ts';
import { ACTORS, BUSINESSES_OF, isEditor, hasSession, setupMatrix, expectLoginRedirect } from '../support/admin-authorization-matrix.ts';

/**
 * Matriz de autorización de /admin (REQ-F-007, R-7, RN-2, DT-12; CA-6, CA-7 y CA-11).
 * Ampliación de QA aprobada por el usuario: cada actor contra todas las rutas GET y POST.
 *
 * - Anónimo, sesión de un administrador desactivado: 303 al acceso, nada cambia.
 * - Editor: sus negocios y "Mi cuenta" sí; el otro negocio y la gestión de usuarios, 403 sin
 *   escribir nada, también con un id de usuario inexistente (no se distingue qué ids existen).
 * - Administrador: todo (un id inexistente responde 404).
 *
 * REQ-F-041: parte de admin-authorization-matrix.test.ts (preparación en
 * tests/support/admin-authorization-matrix.ts).
 */

describe('matriz de autorización: páginas (GET)', () => {
  it('cada actor recibe exactamente lo que su rol y sus negocios permiten', async () => {
    const { browsers, target } = await setupMatrix();
    // REQ-F-025: la página "Bot" es solo para administradores, como la gestión de usuarios.
    const userPaths = ['/admin/usuarios', '/admin/usuarios/nuevo', `/admin/usuarios/${target.id}`, `/admin/usuarios/${target.id}/contrasena`, '/admin/bot'];

    for (const actor of ACTORS) {
      const browser = browsers[actor];
      const allowed = BUSINESSES_OF[actor] ?? [];
      const check = async (path: string, expected: 'ok' | 'forbidden' | 'notFound') => {
        const res = await browser.get(path);
        const label = `${actor} GET ${path}`;
        if (!hasSession(actor)) return expectLoginRedirect(res, label);
        if (expected === 'forbidden') {
          expect(res.status, label).toBe(403);
          expect(res.text, label).toContain('role="alert"');
          expect(res.headers['cache-control'], label).toBe('no-store');
          return undefined;
        }
        if (expected === 'notFound') return expect(res.status, label).toBe(404);
        expect(res.status, label).toBe(200);
        return undefined;
      };

      await check('/admin', 'ok');
      await check('/admin/cuenta', 'ok');
      for (const businessId of BUSINESS_IDS) {
        const expected = allowed.includes(businessId) ? 'ok' : 'forbidden';
        await check(`/admin/${businessId}`, expected);
        // La confirmación de restaurar: permitida (200 o 404 si no hay versión anterior) o 403.
        const res = await browser.get(`/admin/${businessId}/restaurar-anterior`);
        const label = `${actor} GET /admin/${businessId}/restaurar-anterior`;
        if (!hasSession(actor)) expectLoginRedirect(res, label);
        else if (expected === 'forbidden') expect(res.status, label).toBe(403);
        else expect([200, 303, 404], label).toContain(res.status);
      }
      for (const path of userPaths) await check(path, isEditor(actor) ? 'forbidden' : 'ok');
      // Un id inexistente: 404 para el administrador; para un editor, el mismo 403 que con un id real.
      for (const path of ['/admin/usuarios/999999', '/admin/usuarios/999999/contrasena']) {
        await check(path, isEditor(actor) ? 'forbidden' : 'notFound');
      }
    }
  });

  it('el inicio solo enlaza lo permitido', async () => {
    const { browsers } = await setupMatrix();
    for (const actor of ['editorMolotes', 'editorBirria', 'editorAmbos', 'admin'] as const) {
      const html = (await browsers[actor].get('/admin')).text;
      const allowed = BUSINESSES_OF[actor] ?? [];
      for (const businessId of BUSINESS_IDS) {
        expect(html.includes(`href="/admin/${businessId}"`), `${actor} -> ${businessId}`).toBe(allowed.includes(businessId));
      }
      expect(html.includes('href="/admin/usuarios"'), `${actor} -> usuarios`).toBe(actor === 'admin');
      expect(html.includes('href="/admin/bot"'), `${actor} -> bot`).toBe(actor === 'admin');
      expect(html, actor).toContain('href="/admin/cuenta"');
    }
  });
});

describe('matriz de autorización: formularios (POST) sin permiso', () => {
  it('editores, anónimo y sesión de un administrador desactivado no escriben nada con ningún POST ajeno', async () => {
    const { browsers, csrf, target, snapshot } = await setupMatrix();
    const before = await snapshot();
    const password = 'clave-de-intruso-123';

    const userPosts: [string, FormFields][] = [
      ['/admin/usuarios', { username: 'colado', displayName: 'Colado', role: 'admin', password, passwordConfirmation: password }],
      [`/admin/usuarios/${target.id}`, { username: 'objetivo', displayName: 'Cambiado', role: 'admin' }],
      [`/admin/usuarios/${target.id}/desactivar`, {}],
      [`/admin/usuarios/${target.id}/reactivar`, {}],
      [`/admin/usuarios/${target.id}/contrasena`, { password, passwordConfirmation: password }],
      ['/admin/usuarios/999999', { username: 'x', displayName: 'x', role: 'admin' }],
      ['/admin/usuarios/999999/desactivar', {}],
      // REQ-F-025 (CA-7): la página "Bot".
      ['/admin/bot/interruptor', { accion: 'pausar', motivo: '' }],
      ['/admin/bot/bloqueos', { telefono: '5215500001234', duracion: '7d', motivo: '' }],
      ['/admin/bot/bloqueos/1/quitar', {}],
      [`/admin/bot/topes/${'a'.repeat(32)}/bloquear`, { duracion: '7d', motivo: '' }],
    ];
    const businessPosts = (businessId: BusinessId): [string, FormFields][] => [
      [`/admin/${businessId}`, { action: 'save', 'promo.title': 'Intruso' }],
      [`/admin/${businessId}`, { action: 'overwrite_after_conflict', 'promo.title': 'Intruso' }],
      [`/admin/${businessId}/restaurar-anterior`, {}],
      [`/admin/${businessId}/restaurar-semilla`, {}],
    ];

    for (const actor of ACTORS) {
      if (actor === 'admin') continue;
      const browser = browsers[actor];
      const token = csrf[actor] ?? 'x'.repeat(43);
      const allowed = BUSINESSES_OF[actor] ?? [];
      const forbiddenPosts = [
        ...(isEditor(actor) || !hasSession(actor) ? userPosts : []),
        ...BUSINESS_IDS.filter((businessId) => !allowed.includes(businessId)).flatMap(businessPosts),
      ];
      for (const [path, values] of forbiddenPosts) {
        const res = await browser.post(path).type('form').send({ _csrf: token, ...values });
        const label = `${actor} POST ${path}`;
        if (hasSession(actor)) {
          expect(res.status, label).toBe(403);
        } else {
          expectLoginRedirect(res, label);
          expect(res.headers.location, label).toContain('expirada=1');
        }
      }
    }
    // Nada cambió: menús, registro de cambios, usuarios, negocios y auditoría.
    expect(await snapshot()).toEqual(before);
  });

  it('el permiso se comprueba antes de leer el body: un editor recibe 403 aunque el body sea inválido o enorme', async () => {
    const { browsers, target } = await setupMatrix();
    const editor = browsers.editorMolotes;
    const bodies = ['a=1&a=2', `x=${'a'.repeat(200 * 1024)}`];
    for (const body of bodies) {
      for (const path of ['/admin/birria', '/admin/usuarios', `/admin/usuarios/${target.id}/desactivar`]) {
        const res = await editor.post(path).type('form').send(body);
        expect(res.status, `${path} (${body.length} bytes)`).toBe(403);
      }
    }
  });
});

/** Ampliación de QA (AUTO-6): escalada por "Mi cuenta", D-7 por HTTP con concurrencia y escape de HTML. */

describe('escalada de privilegios desde "Mi cuenta" (R-7, D-9)', () => {
  it('campos extra de rol o negocios al cambiar la propia contraseña no cambian el rol ni los negocios', async () => {
    const { browsers, users, csrf } = await setupMatrix();
    const editor = browsers.editorMolotes;
    const newPassword = 'nueva-clave-del-editor';
    const res = await editor
      .post('/admin/cuenta')
      .type('form')
      .send({
        _csrf: csrf.editorMolotes,
        currentPassword: 'clave-de-usuario-12345',
        password: newPassword,
        passwordConfirmation: newPassword,
        role: 'admin',
        'business-birria': 'on',
        active: 'on',
      });
    // Campos desconocidos: el formulario se rechaza entero (DEF-004) y no se aplica nada.
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: 'INVALID_FORM', message: 'El formulario tiene campos desconocidos.' } });
    const after = (await users.findCredentials('em'))?.user;
    // Tampoco cambió la contraseña.
    expect(await verifyPassword(newPassword, await users.findPasswordHash(after!.id))).toBe(false);
    expect(after?.role).toBe('editor');
    expect(after?.businesses).toEqual(['molotes']);
    expect((await editor.get('/admin/birria')).status).toBe(403);
    expect((await editor.get('/admin/usuarios')).status).toBe(403);
  });
});

describe('el nombre visible y el usuario se escapan en todas las páginas (R-8, XSS almacenado)', () => {
  it('lista, edición, cabecera, inicio, Mi cuenta y 403 muestran el texto escapado', async () => {
    const context = await setupAdmin();
    const evilName = '<img src=x onerror=alert(1)>"\'&';
    const evilUser = '<b>malo</b>';
    await createUser(context.users, { username: evilUser, displayName: evilName, businesses: ['molotes'] });
    const created = (await context.users.findCredentials(evilUser))?.user;
    if (!created) throw new Error('No se creó el usuario');
    const admin = await loginAs(context.browser(), ADMIN_USER, ADMIN_PASSWORD);
    const editor = await loginAs(context.browser(), evilUser);

    const pages = [
      ['admin /admin/usuarios', await admin.get('/admin/usuarios')],
      ['admin edición', await admin.get(`/admin/usuarios/${created.id}`)],
      ['admin contraseña', await admin.get(`/admin/usuarios/${created.id}/contrasena`)],
      ['editor /admin', await editor.get('/admin')],
      ['editor /admin/cuenta', await editor.get('/admin/cuenta')],
      ['editor /admin/molotes', await editor.get('/admin/molotes')],
      ['editor 403', await editor.get('/admin/birria')],
    ] as const;
    for (const [label, res] of pages) {
      expect(res.status, label).toBeLessThan(500);
      expect(res.text, label).not.toContain('<img src=x');
      expect(res.text, label).not.toContain('<b>malo</b>');
    }
    // Donde se muestra el nombre o el usuario, aparece escapado.
    expect(pages[0][1].text).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(pages[0][1].text).toContain('&lt;b&gt;malo&lt;/b&gt;');
    expect(pages[3][1].text).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
});
