import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { hashPassword } from '@restaurante/core/identity';
import { createUserRepository } from '@restaurante/db/user-repository';

import { VALID_ENV } from '../helpers.ts';
import { ADMIN_ENV, ADMIN_PASSWORD, ADMIN_USER, TEST_HASH_PARAMS } from '../support/admin.ts';
import { makeDatabase, makeTempDir } from '../support/database.ts';
import { freePort, startServer } from '../support/process.ts';
import { databaseUrl } from '../support/test-database-config.ts';

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
 */

const API_ENTRY = join('..', 'api', 'src', 'server.ts');
const INVENTORY_ENTRY = join('..', 'inventory-manager', 'src', 'server.ts');
const EDITOR = { username: 'eli', password: 'contraseña-de-eli-QA-039-pr2' };
const IMAGE_SRC = '/img/molotes/molotes-queso-oaxaca.jpg';

const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()?.();
});

type Proc = Awaited<ReturnType<typeof startServer>>;

interface Stack {
  api: Proc;
  landing: Proc;
  inventory: Proc;
  url: string;
  /** Cabeceras de un navegador en este origen (o del proxy, en producción). */
  browser: Record<string, string>;
  secrets: string[];
  startInventory: (env: Record<string, string>) => Promise<{ proc: Proc; url: string }>;
}

async function startStack({ inventoryEnv = {}, browser }: { inventoryEnv?: Record<string, string>; browser?: (url: string) => Record<string, string> } = {}): Promise<Stack> {
  const database = await makeDatabase();
  cleanups.push(database.cleanup);
  const dataDir = await makeTempDir();
  cleanups.push(dataDir.cleanup);
  const apiPort = await freePort();
  const DATABASE_URL = databaseUrl(database.config);
  const api = await startServer({ DATABASE_URL, PORT: String(apiPort), INTERNAL_NOTIFY_TOKEN: undefined }, 60_000, { args: [API_ENTRY] });
  cleanups.push(() => api.stop());
  expect(api.started, api.output().stderr).toBe(true);
  const landing = await startServer({ DATABASE_URL, DATA_DIR: dataDir.dir, ...ADMIN_ENV, API_INTERNAL_URL: `http://127.0.0.1:${apiPort}`, INTERNAL_NOTIFY_TOKEN: undefined }, 60_000);
  cleanups.push(() => landing.stop());
  expect(landing.started, landing.output().stderr).toBe(true);
  const passwordHash = await hashPassword(EDITOR.password, TEST_HASH_PARAMS);
  await createUserRepository({ prisma: database.prisma }).create({ username: EDITOR.username, displayName: 'Eli Molotes', role: 'editor', businesses: ['molotes'], passwordHash }, { kind: 'system' });

  const startInventory = async (env: Record<string, string>) => {
    const port = await freePort();
    const proc = await startServer({ ...env, PORT: String(port), API_INTERNAL_URL: `http://127.0.0.1:${apiPort}` }, 60_000, { args: [INVENTORY_ENTRY] });
    cleanups.push(() => proc.stop());
    expect(proc.started, proc.output().stderr).toBe(true);
    return { proc, url: `http://127.0.0.1:${port}` };
  };
  const { proc: inventory, url } = await startInventory({ NODE_ENV: 'development', ...inventoryEnv });
  return {
    api,
    landing,
    inventory,
    url,
    browser: browser ? browser(url) : { Origin: url, 'Sec-Fetch-Site': 'same-origin' },
    secrets: [ADMIN_PASSWORD, EDITOR.password, VALID_ENV.INTERNAL_NOTIFY_TOKEN],
    startInventory,
  };
}

/** Cliente con su propia cookie de sesión (un "navegador"), sin seguir redirecciones. */
function client(stack: Stack, base = stack.url, headers = stack.browser) {
  let cookie = '';
  const remember = (res: Response) => {
    for (const line of res.headers.getSetCookie()) {
      const pair = line.split(';')[0] ?? '';
      const [name, value] = pair.split('=');
      if (name === undefined) continue;
      if (value === '' || value === undefined) cookie = '';
      else {
        cookie = pair;
        stack.secrets.push(value);
      }
    }
    return res;
  };
  return {
    cookie: () => cookie,
    get: async (path: string, extra: Record<string, string> = {}) => remember(await fetch(`${base}${path}`, { redirect: 'manual', headers: { ...headers, ...(cookie ? { Cookie: cookie } : {}), ...extra } })),
    post: async (path: string, form: Record<string, string>, extra: Record<string, string> = {}) =>
      remember(
        await fetch(`${base}${path}`, {
          method: 'POST',
          redirect: 'manual',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers, ...(cookie ? { Cookie: cookie } : {}), ...extra },
          body: new URLSearchParams(form).toString(),
        }),
      ),
  };
}

type Client = ReturnType<typeof client>;

async function loginAs(c: Client, username: string, password: string, next = '/') {
  const res = await c.post('/acceso', { username, password, next });
  expect(res.status).toBe(303);
  return res;
}

const hidden = (html: string, name: string): string => {
  const match = new RegExp(`name="${name}" value="([^"]*)"`).exec(html);
  if (!match?.[1]) throw new Error(`Falta ${name}`);
  return match[1];
};

const molotesForm = (name: string) => ({
  category: 'platillo',
  detailsType: '',
  name,
  description: 'Masa rellena.',
  label: 'Nuevo',
  tone: 'sky',
  price: '25.00',
  orderPrice: '70.00',
  orderQuantity: '3',
  'image.src': IMAGE_SRC,
  'image.alt': name,
  'image.width': '800',
  'image.height': '600',
});

const productNames = async (c: Client, business = 'molotes') => {
  const html = await (await c.get(`/${business}/productos`)).text();
  return html;
};

function expectNoSecrets(stack: Stack, ...procs: Proc[]) {
  const all = [stack.api, stack.landing, stack.inventory, ...procs].flatMap((proc) => [proc.output().stdout, proc.output().stderr]).join('\n');
  for (const secret of stack.secrets) if (secret.length >= 8) expect(all.includes(secret), `secreto en el log (${secret.slice(0, 4)}…)`).toBe(false);
}

describe('QA REQ-F-039 PR 2: sesión, cookie y redirecciones', () => {
  it('S-01: en producción detrás de un proxy con TLS la cookie es __Host-admin_sid con Secure, HttpOnly, SameSite=Strict y Path=/, sin Domain; sin TLS, 503', async () => {
    const stack = await startStack();
    const { proc, url } = await stack.startInventory({ NODE_ENV: 'production', TRUST_PROXY: 'true' });
    const proxy = { 'X-Forwarded-Proto': 'https', 'X-Forwarded-Host': 'admin.example.test', 'X-Forwarded-For': '203.0.113.20', Origin: 'https://admin.example.test', 'Sec-Fetch-Site': 'same-origin' };
    const c = client(stack, url, proxy);
    const res = await loginAs(c, ADMIN_USER, ADMIN_PASSWORD);
    const cookie = res.headers.getSetCookie().find((line) => line.startsWith('__Host-admin_sid='));
    expect(cookie).toBeDefined();
    const attributes = (cookie ?? '').toLowerCase();
    for (const attribute of ['secure', 'httponly', 'samesite=strict', 'path=/']) expect(attributes).toContain(attribute);
    expect(attributes).not.toContain('domain=');
    expect(attributes).not.toContain('max-age');
    expect((await c.get('/molotes/productos')).status).toBe(200);
    // Sin TLS (sin X-Forwarded-Proto: https): 503.
    const plain = await fetch(`${url}/acceso`, { redirect: 'manual' });
    expect(plain.status).toBe(503);
    expectNoSecrets(stack, proc);
  });

  it('S-02: al entrar se sustituye la cookie previa por un id nuevo; una cookie inventada no da acceso y se borra; al salir la sesión deja de valer', async () => {
    const stack = await startStack();
    const c = client(stack);
    await loginAs(c, ADMIN_USER, ADMIN_PASSWORD);
    const first = c.cookie();
    await loginAs(c, ADMIN_USER, ADMIN_PASSWORD);
    expect(c.cookie()).not.toBe(first);
    const old = await fetch(`${stack.url}/molotes/productos`, { redirect: 'manual', headers: { Cookie: first } });
    expect([200, 303]).toContain(old.status);
    const forged = await fetch(`${stack.url}/molotes/productos`, { redirect: 'manual', headers: { Cookie: 'admin_sid=inventadoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' } });
    expect(forged.status).toBe(303);
    expect(forged.headers.getSetCookie().join(';')).toMatch(/admin_sid=;/);
    const page = await (await c.get('/molotes/productos')).text();
    const csrf = hidden(page, '_csrf');
    const current = c.cookie();
    const out = await c.post('/salir', { _csrf: csrf });
    expect(out.status).toBe(303);
    expect(out.headers.get('location')).toBe('/acceso');
    const after = await fetch(`${stack.url}/molotes/productos`, { redirect: 'manual', headers: { Cookie: current } });
    expect(after.status).toBe(303);
    expect(after.headers.get('location')).toMatch(/^\/acceso/);
  });

  it('S-05 y S-06: next solo acepta pantallas del admin; todo Location es una ruta interna', async () => {
    const stack = await startStack();
    const malicious = ['//evil.example', '/\\evil', 'https://evil.example', 'javascript:alert(1)', '/%2F%2Fevil', '/MOLOTES/productos', '/molotes/productos/', '/molotes/productos?x=1', '/molotes/productos/0/editar', '/salir', '/acceso', ' /molotes/productos', '/molotes/productos\r\nSet-Cookie: x=1'];
    for (const next of malicious) {
      const res = await client(stack).post('/acceso', { username: ADMIN_USER, password: ADMIN_PASSWORD, next });
      expect(res.headers.get('location'), JSON.stringify(next)).toBe('/');
    }
    for (const next of ['/molotes/productos', '/birria/productos/nuevo', '/molotes/productos/eliminados', '/molotes/productos/3/editar', '/molotes/productos/3/eliminar']) {
      const res = await client(stack).post('/acceso', { username: ADMIN_USER, password: ADMIN_PASSWORD, next });
      expect(res.headers.get('location')).toBe(next);
    }
    const anonymous = await fetch(`${stack.url}/molotes/productos/3/editar`, { redirect: 'manual' });
    expect(anonymous.headers.get('location')).toBe('/acceso?next=%2Fmolotes%2Fproductos%2F3%2Feditar');
    const page = await (await fetch(`${stack.url}/acceso?next=${encodeURIComponent('//evil.example')}`)).text();
    expect(hidden(page, 'next')).toBe('/');
    expectNoSecrets(stack);
  });
});

describe('QA REQ-F-039 PR 2: CSRF, IP y permisos con los procesos reales', () => {
  it('S-03: la primera capa de CSRF responde 403 sin llamar a la API ni cambiar nada', async () => {
    const stack = await startStack();
    const c = client(stack);
    await loginAs(c, ADMIN_USER, ADMIN_PASSWORD);
    const page = await (await c.get('/molotes/productos')).text();
    const csrf = hidden(page, '_csrf');
    const before = (stack.api.output().stdout.match(/\/mover/g) ?? []).length;
    const attempts: Record<string, string>[] = [{ Origin: 'http://evil.example' }, { Origin: 'null', 'Sec-Fetch-Site': 'cross-site' }, { 'Sec-Fetch-Site': 'cross-site' }, { 'Sec-Fetch-Site': 'same-site' }];
    for (const extra of attempts) {
      const res = await c.post('/molotes/productos/3/subir', { _csrf: csrf, version: '1' }, extra);
      expect(res.status, JSON.stringify(extra)).toBe(403);
    }
    expect((stack.api.output().stdout.match(/\/mover/g) ?? []).length).toBe(before);
    const order = (html: string) => html.match(/action="\/molotes\/productos\/\d+\/subir"/g) ?? [];
    expect(order(await productNames(c))).toEqual(order(page));
  });

  it('S-08: con TRUST_PROXY la API cuenta el último valor de X-Forwarded-For; sin él, la IP del socket aunque el navegador mande la cabecera', async () => {
    const stack = await startStack();
    await client(stack, stack.url, { ...stack.browser, 'X-Forwarded-For': '203.0.113.99' }).post('/acceso', { username: ADMIN_USER, password: ADMIN_PASSWORD });
    const { proc, url } = await stack.startInventory({ NODE_ENV: 'development', TRUST_PROXY: 'true' });
    await client(stack, url, { Origin: url, 'Sec-Fetch-Site': 'same-origin', 'X-Forwarded-For': '10.1.1.1, 203.0.113.98' }).post('/acceso', { username: ADMIN_USER, password: ADMIN_PASSWORD });
    const ips = stack.api
      .output()
      .stdout.split('\n')
      .filter((line) => line.includes('"admin_login_succeeded"'))
      .map((line) => (JSON.parse(line) as { ip: string }).ip);
    expect(ips).toEqual(['127.0.0.1', '203.0.113.98']);
    expectNoSecrets(stack, proc);
  });
});

describe('QA REQ-F-039 PR 2: formularios con la API real', () => {
  it('F-10 y S-10: la requestId es distinta en cada formulario, se conserva tras un 422 y evita el doble alta', async () => {
    const stack = await startStack();
    const c = client(stack);
    await loginAs(c, EDITOR.username, EDITOR.password);
    const formA = await (await c.get('/molotes/productos/nuevo?categoria=platillo')).text();
    const formB = await (await c.get('/molotes/productos/nuevo?categoria=platillo')).text();
    const requestId = hidden(formA, 'requestId');
    expect(requestId).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(hidden(formB, 'requestId')).not.toBe(requestId);
    const csrf = hidden(formA, '_csrf');
    // 422: vuelve a pintar lo escrito con la misma requestId.
    const invalid = await c.post('/molotes/productos', { _csrf: csrf, requestId, ...molotesForm('Molote Doble QA2'), price: 'abc' });
    expect(invalid.status).toBe(422);
    const invalidHtml = await invalid.text();
    expect(hidden(invalidHtml, 'requestId')).toBe(requestId);
    expect(invalidHtml).toContain('Molote Doble QA2');
    // Doble envío con la misma requestId: un solo producto.
    const first = await c.post('/molotes/productos', { _csrf: csrf, requestId, ...molotesForm('Molote Doble QA2') });
    const second = await c.post('/molotes/productos', { _csrf: csrf, requestId, ...molotesForm('Molote Doble QA2') });
    expect([first.status, second.status]).toEqual([303, 303]);
    const list = await productNames(c);
    // Una fila por producto: el título de la fila es `<span>N.</span> nombre</p>`.
    expect(list.split('</span> Molote Doble QA2</p>').length - 1).toBe(1);
    // Una requestId con formato inválido no llega a la API: el servidor la sustituye por una nueva y
    // el alta se hace una sola vez, sin errores ni trazas.
    const forged = await c.post('/molotes/productos', { _csrf: csrf, requestId: 'corta', ...molotesForm('Molote Forjado QA2') });
    expect(forged.status).toBe(303);
    expect((await productNames(c)).split('</span> Molote Forjado QA2</p>').length - 1).toBe(1);
    expect(stack.api.output().stdout).not.toContain('INVALID_IDEMPOTENCY_KEY');
    expectNoSecrets(stack);
  });

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

describe('QA REQ-F-039 PR 2: salud en producción', () => {
  // DEF-005 (QA del PR 2), corregido: /salud responde sin exigir TLS (el HEALTHCHECK del contenedor
  // habla por HTTP con 127.0.0.1); el resto del admin sigue solo por HTTPS en producción.
  it('DEF-005: /salud responde 200 en producción aunque la petición no llegue por TLS (healthcheck interno)', async () => {
    const stack = await startStack();
    const { url } = await stack.startInventory({ NODE_ENV: 'production', TRUST_PROXY: 'true' });
    const res = await fetch(`${url}/salud`, { redirect: 'manual' });
    expect(res.status).toBe(200);
  });
});
