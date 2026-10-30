import { describe, expect, it } from 'vitest';

import { LOCK_MS, SESSION_IDLE_MS } from '@restaurante/core/identity';

import { csrfFrom, login, openForm, setupAdmin, submitForm, textOf } from '../support/admin.ts';
import { ADMIN_PAGES, loggedIn, versionOf } from '../support/admin-page.ts';

/**
 * REQ-F-041: parte de admin.test.ts (preparación en tests/support/admin-page.ts).
 */

describe('acceso protegido (RF-5)', () => {
  it.each(ADMIN_PAGES)('CA-20: sin sesión, GET %s redirige al acceso', async (path) => {
    const { request: client } = await setupAdmin();
    const res = await client().get(path);
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe(`/admin/login?next=${encodeURIComponent(path)}`);
  });

  it('CA-20: sin sesión, un guardado se rechaza y no escribe nada', async () => {
    const { request: client, repository } = await setupAdmin();
    const before = await versionOf(repository, 'molotes');
    const res = await client().post('/admin/molotes').type('form').send({ 'menu.highlight': 'Hackeado', action: 'save' });
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe('/admin/login?next=%2Fadmin%2Fmolotes&expirada=1');
    expect(await versionOf(repository, 'molotes')).toBe(before);
  });

  it('GET /admin sin sesión pide acceso; con sesión muestra el inicio (REQ-F-007)', async () => {
    const { request: client } = await setupAdmin();
    const res = await client().get('/admin');
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe('/admin/login?next=%2Fadmin');
    const { browser } = await loggedIn();
    const home = await browser.get('/admin');
    expect(home.status).toBe(200);
    expect(home.text).toContain('href="/admin/molotes">Menú de');
    expect(home.text).toContain('href="/admin/birria">Menú de');
    expect(home.text).toContain('href="/admin/usuarios">Usuarios</a>');
  });

  it('la página de acceso es accesible y no depende de JavaScript', async () => {
    const { request: client } = await setupAdmin();
    const res = await client().get('/admin/login?next=/admin/birria');
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/<form class="admin-login__form[^"]*" method="post" action="\/admin\/login">/);
    expect(res.text).toContain('<label class="admin-field__label block text-sm font-semibold text-slate-800" for="login-user">Usuario</label>');
    expect(res.text).toContain('autocomplete="current-password"');
    expect(res.text).toContain('name="next" value="/admin/birria"');
    expect(res.text).not.toMatch(/<script/);
  });

  it('CA-21: credenciales incorrectas muestran un error genérico y 5 fallos bloquean 15 minutos', async () => {
    const { browser, clock, logger } = await setupAdmin().then((context) => ({ ...context, browser: context.browser() }));

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const res = await login(browser, { password: `incorrecta-${attempt}` });
      expect(res.status).toBe(401);
      expect(textOf(res.text)).toContain('Usuario o contraseña incorrectos.');
    }
    const wrongUser = await login(browser, { username: 'otro' });
    expect(wrongUser.status).toBe(429);
    expect(textOf(wrongUser.text)).toContain('Acceso bloqueado temporalmente.');

    const blocked = await login(browser);
    expect(blocked.status).toBe(429);
    expect(blocked.headers['set-cookie']).toBeUndefined();

    clock.advance(LOCK_MS);
    const allowed = await login(browser);
    expect(allowed.status).toBe(303);
    expect(logger.lines.filter((line) => line.msg === 'admin_login_failed')).toHaveLength(5);
    expect(logger.lines).toContainEqual(expect.objectContaining({ msg: 'admin_login_locked' }));
  });

  it('CA-22: con la credencial se editan ambos negocios y al cerrar sesión se vuelve a pedir acceso', async () => {
    const { browser } = await loggedIn();
    for (const path of ADMIN_PAGES) {
      const res = await browser.get(path);
      expect(res.status).toBe(200);
      expect(res.text).toMatch(/<form id="admin-form"/);
    }

    const page = await browser.get('/admin/molotes');
    const logout = await browser.post('/admin/logout').type('form').send({ _csrf: csrfFrom(page.text) });
    expect(logout.status).toBe(303);
    expect(logout.headers.location).toBe('/admin/login');

    for (const path of ADMIN_PAGES) expect((await browser.get(path)).status).toBe(303);
  });

  it('CA-22: tras 2 horas sin actividad, guardar pide acceso de nuevo y no escribe nada', async () => {
    const { browser, clock, repository } = await loggedIn();
    const { fields } = await openForm(browser, 'molotes');
    const before = await versionOf(repository, 'molotes');

    clock.advance(SESSION_IDLE_MS);
    const res = await submitForm(browser, 'molotes', fields, { 'menu.highlight': 'Tarde' });
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe('/admin/login?next=%2Fadmin%2Fmolotes&expirada=1');
    expect(await versionOf(repository, 'molotes')).toBe(before);

    const loginPage = await browser.get(res.headers.location!);
    expect(textOf(loginPage.text)).toContain('Tu sesión caducó.');
  });

  it('la actividad renueva la sesión', async () => {
    const { browser, clock } = await loggedIn();
    clock.advance(SESSION_IDLE_MS - 60_000);
    expect((await browser.get('/admin/molotes')).status).toBe(200);
    clock.advance(SESSION_IDLE_MS - 60_000);
    expect((await browser.get('/admin/molotes')).status).toBe(200);
  });

  it('el parámetro next solo admite páginas de administración (sin redirección abierta)', async () => {
    const { browser } = await setupAdmin().then((context) => ({ browser: context.browser() }));
    const res = await login(browser, { next: 'https://evil.example/admin/molotes' });
    expect(res.headers.location).toBe('/admin');
    const birria = await login(browser, { next: '/admin/birria' });
    expect(birria.headers.location).toBe('/admin/birria');
  });

  it('cada acceso crea una sesión nueva (sin fijación de sesión)', async () => {
    const { browser } = await setupAdmin().then((context) => ({ browser: context.browser() }));
    const first = (await login(browser)).headers['set-cookie']![0];
    const second = (await login(browser)).headers['set-cookie']![0];
    expect(first).not.toBe(second);
  });

  it('la cookie de sesión es HttpOnly, SameSite=Strict y limitada a /admin', async () => {
    const { browser } = await setupAdmin().then((context) => ({ browser: context.browser() }));
    const cookie = (await login(browser)).headers['set-cookie']![0];
    expect(cookie).toMatch(/^admin_sid=[A-Za-z0-9_-]{43}; path=\/admin; samesite=strict; httponly$/);
  });
});
