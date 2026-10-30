import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.ts';
import { makeConfig, makeRecordingLogger, makeRepository, seedData } from '../helpers.ts';
import { ADMIN_PASSWORD, ADMIN_PASSWORD_HASH, ADMIN_USER, createUser, csrfFrom, formFields, login, loginAs, openForm, setupAdmin, submitForm, textOf } from '../support/admin.ts';
import { listenLocal } from '../support/http.ts';
import { makeProductsFor } from '../support/products.ts';
import { landingProductsFrom } from '../support/landing-products.ts';
import { ADMIN_PAGES, loggedIn, versionOf } from '../support/admin-page.ts';

/**
 * REQ-F-041: parte de admin.test.ts (preparación en tests/support/admin-page.ts).
 */

describe('acceso protegido (RF-5)', () => {
  it('CA-24: sin credenciales configuradas la administración responde "no disponible" y las landings funcionan', async () => {
    const repository = await makeRepository();
    const products = await makeProductsFor(repository);
    const app = createApp({ config: makeConfig(), repository, products, landingProducts: landingProductsFrom(products) });
    const client = (await listenLocal(app)).request();
    for (const path of ['/admin', '/admin/login', ...ADMIN_PAGES]) {
      const res = await client.get(path);
      expect(res.status, path).toBe(503);
      expect(res.body).toEqual({ error: { code: 'ADMIN_UNAVAILABLE', message: 'Administración no disponible' } });
      expect(res.headers['x-robots-tag']).toBe('noindex, nofollow');
    }
    expect((await client.post('/admin/login').type('form').send({ username: 'a', password: 'b' })).status).toBe(503);
    expect((await client.get('/molotes')).status).toBe(200);
    expect((await client.get('/birria')).status).toBe(200);
  });

  it('CA-25: las respuestas de administración llevan noindex y no se cachean; las landings no enlazan a /admin', async () => {
    const { browser, request: client } = await loggedIn();
    for (const path of ['/admin/login', ...ADMIN_PAGES, '/admin/molotes/restaurar-anterior', '/admin/no-existe']) {
      const res = await browser.get(path);
      expect(res.headers['cache-control'], path).toBe('no-store');
      expect(res.headers['x-robots-tag'], path).toBe('noindex, nofollow');
      if (res.status === 200) expect(res.text).toContain('<meta name="robots" content="noindex, nofollow" />');
    }
    for (const path of ['/', '/molotes', '/birria']) {
      expect((await client().get(path)).text).not.toMatch(/\/admin/);
    }
  });

  it('CA-26: la contraseña nunca aparece en los logs', async () => {
    const logger = makeRecordingLogger();
    const { browser } = await setupAdmin({ logger }).then((context) => ({ browser: context.browser() }));
    await login(browser, { password: `${ADMIN_PASSWORD}-mal` });
    await login(browser);
    const { fields } = await openForm(browser, 'molotes');
    await submitForm(browser, 'molotes', fields, {});
    const logs = JSON.stringify(logger.lines);
    expect(logger.lines.length).toBeGreaterThan(3);
    expect(logs).not.toContain(ADMIN_PASSWORD);
    expect(logs).not.toContain(ADMIN_PASSWORD_HASH);
    expect(logs).not.toContain(fields._csrf);
    expect(logs).not.toMatch(/admin_sid=/);
  });

  describe('HTTPS en producción (DT-3)', () => {
    const PROD = { NODE_ENV: 'production', DATA_DIR: '/var/lib/restaurante' };

    it('por HTTP plano la administración no está disponible', async () => {
      const { request: client, logger } = await setupAdmin({ env: { ...PROD, TRUST_PROXY: 'true' } });
      const res = await client().get('/admin/login');
      expect(res.status).toBe(503);
      expect(logger.lines).toContainEqual(expect.objectContaining({ msg: 'admin_requires_https' }));
    });

    it('detrás de nginx con TLS (TRUST_PROXY=true) funciona con cookie Secure', async () => {
      const { browser } = await setupAdmin({ env: { ...PROD, TRUST_PROXY: 'true' } }).then((context) => ({
        browser: context.browser(),
      }));
      const page = await browser.get('/admin/login').set('X-Forwarded-Proto', 'https');
      expect(page.status).toBe(200);
      const res = await browser
        .post('/admin/login')
        .set('X-Forwarded-Proto', 'https')
        .type('form')
        .send({ username: 'dueno', password: ADMIN_PASSWORD });
      expect(res.status).toBe(303);
      expect(res.headers['set-cookie']![0]).toMatch(/; secure;/);
    });

    it('sin TRUST_PROXY no se confía en X-Forwarded-Proto', async () => {
      const { request: client } = await setupAdmin({ env: PROD });
      expect((await client().get('/admin/login').set('X-Forwarded-Proto', 'https')).status).toBe(503);
    });
  });
});

describe('edición simultánea (RF-7)', () => {
  async function twoEditors() {
    const context = await setupAdmin();
    // Dos personas con su propia cuenta, editoras de Birria.
    await createUser(context.users, { username: 'ana', displayName: 'Ana', businesses: ['birria'] });
    await createUser(context.users, { username: 'beto', displayName: 'Beto', businesses: ['birria'] });
    const a = await loginAs(context.browser(), 'ana');
    const b = await loginAs(context.browser(), 'beto');
    const formA = await openForm(a, 'birria');
    const formB = await openForm(b, 'birria');
    context.clock.advance(3 * 60_000);
    const saved = await submitForm(a, 'birria', formA.fields, { 'promo.title': 'Título de Ana' });
    expect(saved.status).toBe(303);
    return { ...context, a, b, formB };
  }

  it('CA-32: B no guarda nada y ve quién y cuándo cambió el menú, con dos opciones', async () => {
    const { b, formB, repository } = await twoEditors();
    const version = await versionOf(repository, 'birria');
    const res = await submitForm(b, 'birria', formB.fields, { 'promo.title': 'Título de Beto' });

    expect(res.status).toBe(409);
    expect(await versionOf(repository, 'birria')).toBe(version);
    const text = textOf(res.text);
    expect(text).toContain('El menú cambió mientras lo editabas');
    expect(text).toContain('Ana guardó otra versión el 09/10/2026 12:03.');
    expect(res.text).toContain('name="action" value="overwrite_after_conflict">Guardar mis cambios de todos modos</button>');
    expect(res.text).toMatch(/href="\/admin\/birria">Descartar y cargar la versión actual<\/a>/);
    expect(res.text).not.toContain('value="save">Guardar cambios</button>');
    expect(formFields(res.text)['promo.title']).toBe('Título de Beto');
  });

  it('CA-33: "Guardar mis cambios de todos modos" sobrescribe y la versión de A queda como anterior', async () => {
    const { b, formB, repository, request: client } = await twoEditors();
    const conflict = await submitForm(b, 'birria', formB.fields, { 'promo.title': 'Título de Beto' });
    const res = await submitForm(b, 'birria', formFields(conflict.text), { action: 'overwrite_after_conflict' });

    expect(res.status).toBe(303);
    expect(res.headers.location).toBe('/admin/birria?ok=overwrite_after_conflict');
    expect((await client().get('/birria')).text).toContain('Título de Beto');
    expect(JSON.parse(repository.storage.files.get('birria/previous')!).data.promo.title).toBe('Título de Ana');
    expect(repository.storage.changes.at(-1)).toMatchObject({ author: 'Beto', action: 'overwrite_after_conflict' });
  });

  it('CA-33: "Descartar" muestra los datos de A y no escribe nada', async () => {
    const { b, formB, repository } = await twoEditors();
    await submitForm(b, 'birria', formB.fields, { 'promo.title': 'Título de Beto' });
    const changes = repository.storage.changes.length;
    const page = await b.get('/admin/birria');
    expect(formFields(page.text)['promo.title']).toBe('Título de Ana');
    expect(repository.storage.changes).toHaveLength(changes);
  });

  it('RN-6: si otra persona vuelve a guardar antes de sobrescribir, aparece un nuevo aviso', async () => {
    const { a, b, formB } = await twoEditors();
    const conflict = await submitForm(b, 'birria', formB.fields, { 'promo.title': 'Título de Beto' });
    const formA = await openForm(a, 'birria');
    await submitForm(a, 'birria', formA.fields, { 'promo.title': 'Segundo de Ana' });
    const res = await submitForm(b, 'birria', formFields(conflict.text), { action: 'overwrite_after_conflict' });
    expect(res.status).toBe(409);
  });
});

describe('restaurar versión anterior (RF-6.5)', () => {
  it('CA-30: pide confirmación, restaura, intercambia versiones y lo registra', async () => {
    const { browser, request: client, repository } = await loggedIn();
    const { fields } = await openForm(browser, 'molotes');
    await submitForm(browser, 'molotes', fields, { 'menu.highlight': 'Destacado nuevo' });

    const page = await browser.get('/admin/molotes');
    expect(page.text).toContain('href="/admin/molotes/restaurar-anterior">Restaurar versión anterior</a>');
    const confirm = await browser.get('/admin/molotes/restaurar-anterior');
    expect(confirm.status).toBe(200);
    expect(textOf(confirm.text)).toContain('¿Restaurar la versión anterior?');

    const res = await browser
      .post('/admin/molotes/restaurar-anterior')
      .type('form')
      .send({ _csrf: csrfFrom(confirm.text) });
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe('/admin/molotes?ok=restore_previous');

    expect((await client().get('/molotes')).text).toContain(seedData('molotes').menu.highlight);
    expect(JSON.parse(repository.storage.files.get('molotes/previous')!).data.menu.highlight).toBe('Destacado nuevo');
    expect(repository.storage.changes.at(-1)).toMatchObject({ author: ADMIN_USER, action: 'restore_previous' });
  });

  it('restaurar la semilla sin datos dañados no está permitido', async () => {
    const { browser } = await loggedIn();
    const page = await browser.get('/admin/molotes');
    const res = await browser.post('/admin/molotes/restaurar-semilla').type('form').send({ _csrf: csrfFrom(page.text) });
    expect(res.status).toBe(409);
    expect(textOf(res.text)).toContain('solo se puede restaurar cuando los datos están dañados');
  });
});

describe('archivo dañado (RF-8)', () => {
  it('CA-36: aviso, edición bloqueada y opciones; la elección queda en el registro y desbloquea', async () => {
    const { browser, repository, request: client } = await loggedIn();
    repository.storage.files.set('molotes/current', '{ dañado');

    const page = await browser.get('/admin/molotes');
    expect(page.status).toBe(200);
    expect(textOf(page.text)).toContain('Los datos guardados están dañados; la landing está mostrando la última versión válida.');
    expect(page.text).toMatch(/<fieldset class="admin-form__data space-y-6" disabled>/);
    expect(page.text).not.toContain('value="save">Guardar cambios</button>');
    expect(page.text).toContain('action="/admin/molotes/restaurar-anterior"');
    expect(page.text).toContain('action="/admin/molotes/restaurar-semilla"');
    expect((await client().get('/molotes')).status).toBe(200);

    // Un guardado forzado tampoco escribe.
    const forced = await browser
      .post('/admin/molotes')
      .type('form')
      .send({ ...formFields(page.text), action: 'save' });
    expect(forced.status).toBe(409);
    expect(repository.storage.changes).toHaveLength(0);

    const restore = await browser.post('/admin/molotes/restaurar-semilla').type('form').send({ _csrf: csrfFrom(page.text) });
    expect(restore.status).toBe(303);
    expect(repository.storage.changes.at(-1)).toMatchObject({ author: ADMIN_USER, action: 'restore_seed', business: 'molotes' });

    const unlocked = await browser.get('/admin/molotes');
    expect(unlocked.text).not.toContain('disabled>');
    expect(unlocked.text).toContain('value="save">Guardar cambios</button>');
  });

  it('CA-36: "Restaurar versión anterior" solo se ofrece si es válida', async () => {
    const { browser, repository } = await loggedIn();
    repository.storage.files.set('molotes/current', '[]');
    repository.storage.files.set('molotes/previous', 'nada');
    const page = await browser.get('/admin/molotes');
    expect(page.text).not.toContain('action="/admin/molotes/restaurar-anterior"');
    expect(page.text).toContain('action="/admin/molotes/restaurar-semilla"');
  });
});

describe('rutas', () => {
  it('404 con un negocio desconocido', async () => {
    const { browser } = await loggedIn();
    const res = await browser.get('/admin/tacos');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('límite de intentos detrás de nginx', () => {
  it('usa la IP que añade nginx y no la que envía el cliente en X-Forwarded-For', async () => {
    const PROD = { NODE_ENV: 'production', DATA_DIR: '/var/lib/restaurante', TRUST_PROXY: 'true' };
    const { request: client } = await setupAdmin({ env: PROD });
    const attempt = (spoofed: string) =>
      client()
        .post('/admin/login')
        .set('X-Forwarded-Proto', 'https')
        .set('X-Forwarded-For', `${spoofed}, 203.0.113.7`)
        .type('form')
        .send({ username: 'dueno', password: 'incorrecta' });
    for (let i = 0; i < 5; i += 1) await attempt(`10.0.0.${i}`);
    expect((await attempt('10.0.0.99')).status).toBe(429);
  });
});
