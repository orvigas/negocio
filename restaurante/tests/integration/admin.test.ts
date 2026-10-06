import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.ts';
import type { BusinessId } from '../../src/config/businesses.ts';
import type { MenuRepository } from '../../src/repositories/menu-repository.ts';
import { LOCK_MS } from '../../src/services/login-throttle.ts';
import { SESSION_IDLE_MS } from '../../src/services/session-store.ts';
import { makeConfig, makeRecordingLogger, makeRepository, seedData } from '../helpers.ts';
import {
  ADMIN_PASSWORD,
  ADMIN_PASSWORD_HASH,
  ADMIN_USER,
  createUser,
  csrfFrom,
  formFields,
  login,
  loginAs,
  type FormFields,
  type MemoryRepository,
  type SetupOptions,
  openForm,
  setupAdmin,
  submitForm,
  textOf,
} from '../support/admin.ts';
import { listenLocal } from '../support/http.ts';
import { makeProductsFor } from '../support/products.ts';

const ADMIN_PAGES = ['/admin/molotes', '/admin/birria'];

async function loggedIn<R extends MenuRepository = MemoryRepository>(options?: SetupOptions<R>) {
  const context = await setupAdmin(options);
  const browser = context.browser();
  const res = await login(browser);
  expect(res.status).toBe(303);
  return { ...context, browser };
}

const versionOf = async (repository: MenuRepository, businessId: BusinessId) => (await repository.getForEdit(businessId)).version;

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

  it('CA-24: sin credenciales configuradas la administración responde "no disponible" y las landings funcionan', async () => {
    const repository = await makeRepository();
    const app = createApp({ config: makeConfig(), repository, products: await makeProductsFor(repository) });
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

describe('guardar (RF-6)', () => {
  // REQ-F-008: el formulario de página guarda hero, destacado y promociones. El precio de un
  // producto (CA-1 de REQ-F-001) se edita en su propio formulario: tests/integration/admin-products.test.ts.
  it('CA-27: guarda con POST-redirect-GET y la landing muestra el precio nuevo del hero sin reiniciar', async () => {
    const { browser, request: client, repository, products } = await loggedIn();
    const landingBefore = await client().get('/molotes');
    expect(landingBefore.text).not.toContain('$150 MXN');

    const { fields } = await openForm(browser, 'molotes');
    const res = await submitForm(browser, 'molotes', fields, { 'hero.showcase.priceCents': '150.00' });
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe('/admin/molotes?ok=save');

    const landing = await client().get('/molotes');
    expect(landing.text).toContain('$150 MXN');
    // Los productos no cambian (CA-34 de REQ-F-008).
    expect(products.getPublished('molotes')).toEqual({ menu: seedData('molotes').menu.items, drinks: seedData('molotes').drinks.items });

    const page = await browser.get(res.headers.location!);
    expect(textOf(page.text)).toContain('Cambios guardados.');
    expect(page.text).toContain('role="status"');

    const changes = repository.storage.changes;
    expect(changes).toEqual([
      expect.objectContaining({
        
        business: 'molotes',
        action: 'save',
        at: '2026-10-09T12:00:00-06:00',
        changes: [{ field: 'hero.showcase.priceCents', before: 14500, after: 15000 }],
      }),
    ]);
    expect(JSON.parse(repository.storage.files.get('molotes/previous')!).data).toEqual(seedData('molotes'));
  });

  it('CA-2: el precio del hero de Birria en 199.50 se muestra como "$199.50 MXN"', async () => {
    const { browser, request: client } = await loggedIn();
    const { fields } = await openForm(browser, 'birria');
    expect((await submitForm(browser, 'birria', fields, { 'hero.showcase.priceCents': '199.50' })).status).toBe(303);
    expect((await client().get('/birria')).text).toContain('$199.50 MXN');
  });

  it('CA-3: el texto destacado y la promoción editados se ven en la landing', async () => {
    const { browser, request: client } = await loggedIn();
    const { fields } = await openForm(browser, 'molotes');
    await submitForm(browser, 'molotes', fields, {
      'menu.highlight': '7 Sabores de Barrio',
      'promo.badge': 'Promo de Temporada',
      'promo.title': 'Martes de Molotes 3x2',
      'promo.description': 'Lleva tres y paga dos todos los martes.',
      
    });
    const { text } = await client().get('/molotes');
    for (const value of ['7 Sabores de Barrio', 'Promo de Temporada', 'Martes de Molotes 3x2', 'Lleva tres y paga dos todos los martes.']) {
      expect(text).toContain(value);
    }
  });

  it('CA-15: un precio de 45.5 se muestra como "$45.50"', async () => {
    const { browser, request: client } = await loggedIn();
    const { fields } = await openForm(browser, 'birria');
    await submitForm(browser, 'birria', fields, { 'hero.showcase.priceCents': '45.5' });
    expect((await client().get('/birria')).text).toContain('$45.50 MXN');
    const page = await browser.get('/admin/birria');
    expect(formFields(page.text)['hero.showcase.priceCents']).toBe('45.50');
  });

  it('CA-14: el autor es el usuario de la sesión (nombre e identificador) y no hay campo de autor', async () => {
    const context = await setupAdmin();
    const ana = await createUser(context.users, { username: 'ana', displayName: 'Ana', businesses: ['molotes'] });
    const browser = await loginAs(context.browser(), 'ana');
    const { page, fields } = await openForm(browser, 'molotes');
    expect(page.text).not.toContain('name="author"');
    expect(textOf(page.text)).toContain('El cambio se registrará a nombre de Ana.');
    expect((await submitForm(browser, 'molotes', fields, { 'hero.showcase.title': 'Hero de Ana' })).status).toBe(303);
    expect(context.repository.storage.changes.at(-1)).toMatchObject({ author: 'Ana', authorId: ana.id, action: 'save', business: 'molotes' });
    expect(JSON.parse(context.repository.storage.files.get('molotes/current')!).updatedBy).toBe('Ana');

    // Un campo "author" enviado a mano no cambia el autor: el formulario se rechaza.
    const forged = await submitForm(browser, 'molotes', formFields((await browser.get('/admin/molotes')).text), { author: 'Otra persona' });
    expect(forged.status).toBe(400);
  });

  it('CA-10 / CA-19: un error de validación conserva lo escrito, marca el campo y no depende del color', async () => {
    const { browser, repository } = await loggedIn();
    const { fields } = await openForm(browser, 'molotes');
    const before = await versionOf(repository, 'molotes');
    const res = await submitForm(browser, 'molotes', fields, {
      'hero.showcase.priceCents': '0',
      'hero.showcase.title': 'Título nuevo escrito',
    });
    expect(res.status).toBe(422);
    expect(await versionOf(repository, 'molotes')).toBe(before);

    const resent = formFields(res.text);
    expect(resent['hero.showcase.priceCents']).toBe('0');
    expect(resent['hero.showcase.title']).toBe('Título nuevo escrito');
    expect(res.text).toMatch(/id="f-hero-showcase-priceCents"[^>]*aria-invalid="true" aria-describedby="f-hero-showcase-priceCents-hint f-hero-showcase-priceCents-error"/);
    expect(res.text).toContain('<p id="f-hero-showcase-priceCents-error" class="admin-field__error mt-1 text-sm font-semibold text-red-800"><strong>Error:</strong> El precio debe ser mayor que $0.</p>');
    expect(res.text).toMatch(/role="alert"[^>]*>\s*<p class="admin-notice__title font-bold">No se guardó nada/);
    expect(res.text).toContain('href="#f-hero-showcase-priceCents"');
  });

  it.each([
    ['un campo desconocido', { 'menu.items.0.secreto': 'x' }],
    ['un slug distinto', { 'menu.items.0.slug': 'otro' }],
    ['un producto de más', { 'menu.items.6.name': 'Nuevo' }],
    // REQ-F-008: los campos de producto ya no son del formulario de página.
    ['un campo de un producto existente', { 'menu.items.0.name': 'Otro nombre' }],
  ])('CA-18: rechaza %s sin escribir', async (_label, changes) => {
    const { browser, repository } = await loggedIn();
    const { fields } = await openForm(browser, 'birria');
    const before = await versionOf(repository, 'birria');
    const res = await submitForm(browser, 'birria', fields, { ...changes });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('STRUCTURE_MODIFIED');
    expect(await versionOf(repository, 'birria')).toBe(before);
  });

  it('rechaza una acción desconocida, cuerpos demasiado grandes y otros tipos de contenido', async () => {
    const { browser } = await loggedIn();
    const { fields } = await openForm(browser, 'molotes');
    expect((await submitForm(browser, 'molotes', fields, { action: 'borrar' })).status).toBe(400);

    const big = await browser
      .post('/admin/molotes')
      .type('form')
      .send({ ...fields, 'menu.highlight': 'a'.repeat(200 * 1024), action: 'save' });
    expect(big.status).toBe(413);
    expect(big.body.error.code).toBe('PAYLOAD_TOO_LARGE');

    const json = await browser.post('/admin/molotes').send({ ...fields, action: 'save' });
    expect(json.status).toBe(415);
  });

  it('CA-31: muestra "Último cambio: <fecha> por <nombre>"', async () => {
    const context = await setupAdmin();
    await createUser(context.users, { username: 'lupe', displayName: 'Doña Lupe', businesses: ['birria'] });
    const browser = await loginAs(context.browser(), 'lupe');
    // REQ-F-008: la importación de productos es el primer cambio registrado (autor "sistema").
    expect(textOf((await browser.get('/admin/birria')).text)).toContain('Último cambio: 09/10/2026 12:00 por sistema');
    context.clock.advance(60_000);
    const { fields } = await openForm(browser, 'birria');
    await submitForm(browser, 'birria', fields, {});
    expect(textOf((await browser.get('/admin/birria')).text)).toContain('Último cambio: 09/10/2026 12:01 por Doña Lupe');
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
