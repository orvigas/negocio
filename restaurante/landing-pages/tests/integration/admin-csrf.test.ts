import { describe, expect, it } from 'vitest';

import { ADMIN_PASSWORD, csrfFrom, type FormFields, openForm, setupAdmin, submitForm } from '../support/admin.ts';
import { loggedIn, versionOf } from '../support/admin-page.ts';

/**
 * REQ-F-041: parte de admin.test.ts (preparación en tests/support/admin-page.ts).
 */

describe('acceso protegido (RF-5)', () => {
  describe('CA-23: CSRF', () => {
    it.each([
      ['sin token', (fields: FormFields) => delete fields._csrf],
      ['con un token incorrecto', (fields: FormFields) => (fields._csrf = 'x'.repeat(43))],
    ])('rechaza un guardado %s', async (_label, mutate) => {
      const { browser, repository } = await loggedIn();
      const { fields } = await openForm(browser, 'molotes');
      mutate(fields);
      const before = await versionOf(repository, 'molotes');
      const res = await submitForm(browser, 'molotes', fields, {});
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('CSRF_INVALID');
      expect(await versionOf(repository, 'molotes')).toBe(before);
    });

    it('rechaza peticiones con un Origin ajeno o Sec-Fetch-Site cross-site', async () => {
      const { browser, repository } = await loggedIn();
      const { fields } = await openForm(browser, 'molotes');
      const before = await versionOf(repository, 'molotes');
      const foreign = await browser
        .post('/admin/molotes')
        .set('Origin', 'https://evil.example')
        .type('form')
        .send({ ...fields, action: 'save' });
      expect(foreign.status).toBe(403);
      const crossSite = await browser
        .post('/admin/molotes')
        .set('Sec-Fetch-Site', 'cross-site')
        .type('form')
        .send({ ...fields, action: 'save' });
      expect(crossSite.status).toBe(403);
      const loginCsrf = await browser.post('/admin/login').set('Origin', 'https://evil.example').type('form').send({ username: 'x' });
      expect(loginCsrf.status).toBe(403);
      expect(await versionOf(repository, 'molotes')).toBe(before);
    });

    it('acepta el Origin propio', async () => {
      const { browser } = await loggedIn();
      const { fields } = await openForm(browser, 'molotes');
      const res = await browser
        .post('/admin/molotes')
        .set('Origin', 'http://127.0.0.1')
        .set('Host', '127.0.0.1')
        .type('form')
        .send({ ...fields, action: 'save' });
      expect(res.status).toBe(303);
    });

    // DEF-001: lo que envía un navegador real en los formularios. Con `Referrer-Policy:
    // no-referrer` (Helmet) manda `Origin: null`; con la política de /admin, el origen real.
    const BROWSER_NO_REFERRER = { Origin: 'null', 'Sec-Fetch-Site': 'same-origin' };

    it('DEF-001: acepta el flujo completo con Origin: null + Sec-Fetch-Site: same-origin (acceso, guardar, restaurar, cerrar sesión)', async () => {
      const { browser, repository } = await setupAdmin().then((context) => ({ ...context, browser: context.browser() }));
      const loginRes = await browser
        .post('/admin/login')
        .set(BROWSER_NO_REFERRER)
        .type('form')
        .send({ username: 'dueno', password: ADMIN_PASSWORD });
      expect(loginRes.status).toBe(303);

      const { fields } = await openForm(browser, 'molotes');
      const save = await browser
        .post('/admin/molotes')
        .set(BROWSER_NO_REFERRER)
        .type('form')
        .send({ ...fields, 'menu.highlight': 'Desde el navegador', action: 'save' });
      expect(save.status).toBe(303);
      expect((await repository.getPublished('molotes')).data.menu.highlight).toBe('Desde el navegador');

      const confirm = await browser.get('/admin/molotes/restaurar-anterior');
      const restore = await browser
        .post('/admin/molotes/restaurar-anterior')
        .set(BROWSER_NO_REFERRER)
        .type('form')
        .send({ _csrf: csrfFrom(confirm.text) });
      expect(restore.status).toBe(303);

      const page = await browser.get('/admin/molotes');
      const logout = await browser.post('/admin/logout').set(BROWSER_NO_REFERRER).type('form').send({ _csrf: csrfFrom(page.text) });
      expect(logout.status).toBe(303);
      expect((await browser.get('/admin/molotes')).status).toBe(303);
    });

    it('DEF-001: acepta el Origin real con Sec-Fetch-Site: same-origin', async () => {
      const { browser } = await setupAdmin().then((context) => ({ browser: context.browser() }));
      const res = await browser
        .post('/admin/login')
        .set({ Host: 'admin.ejemplo.mx', Origin: 'http://admin.ejemplo.mx', 'Sec-Fetch-Site': 'same-origin' })
        .type('form')
        .send({ username: 'dueno', password: ADMIN_PASSWORD });
      expect(res.status).toBe(303);
    });

    it.each([
      ['Origin ajeno con Sec-Fetch-Site: cross-site', { Origin: 'https://evil.example', 'Sec-Fetch-Site': 'cross-site' }],
      ['Origin ajeno sin Sec-Fetch-Site', { Origin: 'https://evil.example' }],
      ['Origin ajeno aunque diga same-origin', { Origin: 'https://evil.example', 'Sec-Fetch-Site': 'same-origin' }],
      ['Origin: null con Sec-Fetch-Site: cross-site', { Origin: 'null', 'Sec-Fetch-Site': 'cross-site' }],
      ['Origin: null con Sec-Fetch-Site: same-site', { Origin: 'null', 'Sec-Fetch-Site': 'same-site' }],
      ['Origin: null sin Sec-Fetch-Site', { Origin: 'null' }],
    ])('DEF-001 / CA-23: rechaza %s (acceso y guardado)', async (_label, headers) => {
      const { browser, repository } = await loggedIn();
      const { fields } = await openForm(browser, 'molotes');
      const before = await versionOf(repository, 'molotes');

      const save = await browser
        .post('/admin/molotes')
        .set(headers)
        .type('form')
        .send({ ...fields, 'menu.highlight': 'Ataque', action: 'save' });
      expect(save.status).toBe(403);
      expect(save.body.error.code).toBe('CSRF_INVALID');
      expect(await versionOf(repository, 'molotes')).toBe(before);

      const loginRes = await browser.post('/admin/login').set(headers).type('form').send({ username: 'dueno', password: ADMIN_PASSWORD });
      expect(loginRes.status).toBe(403);
    });

    it('DEF-001: /admin envía Referrer-Policy: same-origin y las landings conservan no-referrer', async () => {
      const { request: client } = await setupAdmin();
      for (const path of ['/admin/login', '/admin/molotes']) {
        expect((await client().get(path)).headers['referrer-policy'], path).toBe('same-origin');
      }
      for (const path of ['/', '/molotes', '/birria']) {
        expect((await client().get(path)).headers['referrer-policy'], path).toBe('no-referrer');
      }
    });

    it('cerrar sesión también exige el token', async () => {
      const { browser } = await loggedIn();
      expect((await browser.post('/admin/logout').type('form').send({})).status).toBe(403);
      expect((await browser.get('/admin/molotes')).status).toBe(200);
    });
  });
});
