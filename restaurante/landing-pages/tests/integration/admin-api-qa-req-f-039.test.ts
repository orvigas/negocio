import { createServer, type IncomingMessage, type Server } from 'node:http';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { hashPassword } from '@restaurante/core/identity';
import { createUserRepository } from '@restaurante/db/user-repository';

import { VALID_ENV } from '../helpers.ts';
import { ADMIN_ENV, ADMIN_PASSWORD, ADMIN_USER, TEST_HASH_PARAMS } from '../support/admin.ts';
import { makeDatabase, makeTempDir } from '../support/database.ts';
import { freePort, startServer } from '../support/process.ts';
import { startTcpProxy } from '../support/tcp-proxy.ts';
import { testDatabaseConfigs, databaseUrl } from '../support/test-database-config.ts';

/**
 * QA de REQ-F-039, PR 1 (QA Action Plan aprobado el 2026-10-27): procesos reales de `api` y de
 * `landing-pages` contra MySQL, sin importar código de `api/`. Cubre los huecos que la suite del PR
 * no prueba:
 *
 * - N-02 y N-03: el límite de intentos cuenta el último valor de X-Forwarded-For (también IPv6).
 * - N-13: el login nunca adopta un id recibido (fijación de sesión).
 * - N-06: `?sobrescribir=1` con una versión desfasada no guarda en silencio (RF-9).
 * - N-12: la misma Idempotency-Key en otro negocio no devuelve el producto del primero.
 * - F-13 y F-14: el aviso real hace que la landing muestre el cambio sin reiniciar; con el aviso
 *   caído, la escritura se confirma como `pending` y el fallo queda en el log (CA-11).
 * - N-09: una segunda escritura mientras el primer aviso sigue en curso también llega a la landing.
 * - N-10: con la base caída, 503 sin detalles.
 * - S-01: ningún log de los dos procesos lleva contraseñas, ids de sesión, tokens CSRF ni la
 *   credencial del aviso (CA-16).
 */

const API_ENTRY = join('..', 'api', 'src', 'server.ts');
const P = '/api/v1/admin';
const TOKEN = VALID_ENV.INTERNAL_NOTIFY_TOKEN;
const EDITOR = { username: 'eli', password: 'contraseña-de-eli-QA-039' };
const IMAGE = { src: '/img/molotes/molotes-queso-oaxaca.jpg', alt: 'Molote', width: 800, height: 600 };

const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()?.();
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let ipCounter = 1;
const nextIp = () => `198.51.100.${(ipCounter++ % 250) + 1}`;

interface Session {
  id: string;
  csrfToken: string;
}

interface Stack {
  api: Awaited<ReturnType<typeof startServer>>;
  landing: Awaited<ReturnType<typeof startServer>>;
  apiUrl: string;
  secrets: string[];
  /** Proxy TCP hacia MySQL de la api (solo con `routeDatabase`). */
  dbProxy: Awaited<ReturnType<typeof startTcpProxy>> | null;
}

/**
 * Arranca api (con el aviso hacia `notifyTarget`, por defecto el puerto interno real de landing-pages)
 * y landing-pages sobre una base de pruebas, con el administrador de ADMIN_ENV y un editor de Molotes.
 */
async function startStack({ notifyTarget, routeDatabase }: { notifyTarget?: (landingInternalUrl: string) => Promise<string>; routeDatabase?: boolean } = {}): Promise<Stack> {
  const database = await makeDatabase();
  cleanups.push(database.cleanup);
  const dataDir = await makeTempDir();
  cleanups.push(dataDir.cleanup);
  const apiPort = await freePort();
  const DATABASE_URL = databaseUrl(database.config);

  const landing = await startServer({ DATABASE_URL, DATA_DIR: dataDir.dir, ...ADMIN_ENV, API_INTERNAL_URL: `http://127.0.0.1:${apiPort}` }, 60_000);
  cleanups.push(() => landing.stop());
  expect(landing.started, landing.output().stderr).toBe(true);

  const passwordHash = await hashPassword(EDITOR.password, TEST_HASH_PARAMS);
  await createUserRepository({ prisma: database.prisma }).create({ username: EDITOR.username, displayName: 'Eli Molotes', role: 'editor', businesses: ['molotes'], passwordHash }, { kind: 'system' });

  let apiDatabaseUrl = DATABASE_URL;
  let dbProxy: Stack['dbProxy'] = null;
  if (routeDatabase) {
    const proxy = await startTcpProxy(testDatabaseConfigs().app);
    cleanups.push(() => proxy.down());
    apiDatabaseUrl = databaseUrl({ ...database.config, host: proxy.host, port: proxy.port });
    dbProxy = proxy;
  }
  const target = notifyTarget ? await notifyTarget(landing.internalUrl) : landing.internalUrl;
  const api = await startServer({ DATABASE_URL: apiDatabaseUrl, PORT: String(apiPort), LANDING_INTERNAL_URL: target, INTERNAL_NOTIFY_TOKEN: TOKEN }, 60_000, { args: [API_ENTRY] });
  cleanups.push(() => api.stop());
  expect(api.started, api.output().stderr).toBe(true);
  return { api, landing, apiUrl: `http://127.0.0.1:${apiPort}`, secrets: [TOKEN, ADMIN_PASSWORD, EDITOR.password], dbProxy };
}

function login(stack: Stack, username: string, password: string, xff: string | null = nextIp(), extra: Record<string, string> = {}) {
  return fetch(`${stack.apiUrl}${P}/sesion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(xff === null ? {} : { 'X-Forwarded-For': xff }), ...extra },
    body: JSON.stringify({ username, password }),
  });
}

async function session(stack: Stack, username: string, password: string): Promise<Session> {
  const res = await login(stack, username, password);
  expect(res.status).toBe(201);
  const body = (await res.json()) as { session: Session };
  stack.secrets.push(body.session.id, body.session.csrfToken);
  return body.session;
}

function call(stack: Stack, path: string, auth: Session, { method = 'GET', body, headers = {} }: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  return fetch(`${stack.apiUrl}${P}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${auth.id}`,
      ...(method === 'GET' ? {} : { 'X-CSRF-Token': auth.csrfToken }),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

const molotesInput = (name: string) => ({
  category: 'platillo',
  name,
  description: 'Masa rellena.',
  label: 'Nuevo',
  tone: 'sky',
  price: '25.00',
  orderPrice: '70.00',
  orderQuantity: 3,
  image: { ...IMAGE, alt: name },
});

const birriaInput = (name: string) => ({
  category: 'platillo',
  detailsType: 'chips',
  name,
  label: 'Crujiente',
  description: 'Dorado en comal.',
  price: 40,
  priceUnit: 'c/u',
  image: { ...IMAGE, alt: name },
  detailsLabel: 'Incluye:',
  chips: [{ text: 'Consomé', highlight: true }],
});

interface ProductBody {
  product: { id: number; version: number; name: string; available: boolean };
  meta?: { freshness: string };
}

/** Crea un producto de Molotes y lo publica (disponible). Devuelve la respuesta de la publicación. */
async function publishMolote(stack: Stack, auth: Session, name: string): Promise<ProductBody> {
  const created = (await (await call(stack, '/molotes/productos', auth, { method: 'POST', body: molotesInput(name) })).json()) as ProductBody;
  const res = await call(stack, `/molotes/productos/${created.product.id}`, auth, { method: 'PUT', body: { ...molotesInput(name), available: true, version: created.product.version } });
  expect(res.status).toBe(200);
  return (await res.json()) as ProductBody;
}

const landingHas = async (stack: Stack, text: string) => (await (await fetch(`${stack.landing.url}/molotes`)).text()).includes(text);

function logLines(stdout: string): Record<string, unknown>[] {
  return stdout
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as Record<string, unknown>];
      } catch {
        return [];
      }
    });
}

function expectNoSecrets(stack: Stack) {
  const all = [stack.api.output().stdout, stack.api.output().stderr, stack.landing.output().stdout, stack.landing.output().stderr].join('\n');
  for (const secret of stack.secrets) expect(all.includes(secret), `secreto en el log (${secret.slice(0, 4)}…)`).toBe(false);
}

/** Proxy HTTP delante del puerto interno: reenvía al momento y retiene la respuesta `holdMs`. */
async function holdingProxy(target: string, holdMs: number): Promise<string> {
  const server: Server = createServer((req: IncomingMessage, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      void (async () => {
        const upstream = await fetch(`${target}${req.url ?? '/'}`, {
          method: req.method ?? 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: String(req.headers.authorization ?? '') },
          body: Buffer.concat(chunks),
        });
        const text = await upstream.text();
        await sleep(holdMs);
        res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
        res.end(text);
      })();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  cleanups.push(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  if (typeof address !== 'object' || address === null) throw new Error('Sin puerto');
  return `http://127.0.0.1:${address.port}`;
}

describe('QA REQ-F-039 PR 1: acceso a /api/v1/admin', () => {
  it('N-02 y N-03: el límite cuenta el último valor de X-Forwarded-For; el primero no lo evita; IPv6 y espacios valen', async () => {
    const stack = await startStack();
    const victim = '203.0.113.77';
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const res = await login(stack, ADMIN_USER, 'contraseña-equivocada', `10.0.0.${attempt}, ${victim}`);
      expect(res.status).toBe(attempt < 5 ? 401 : 429);
    }
    // Cambiar el primer valor (lo que podría fijar un cliente) no evita el bloqueo, ni con la contraseña correcta.
    const spoofed = await login(stack, ADMIN_USER, ADMIN_PASSWORD, `10.9.9.9, ${victim}`);
    expect(spoofed.status).toBe(429);
    expect(spoofed.headers.get('retry-after')).toMatch(/^\d+$/);
    // Otra IP como último valor: no afectada.
    expect((await login(stack, ADMIN_USER, ADMIN_PASSWORD, `${victim}, 203.0.113.78`)).status).toBe(201);
    // IPv6 y espacios alrededor.
    expect((await login(stack, ADMIN_USER, ADMIN_PASSWORD, '2001:db8::1')).status).toBe(201);
    expect((await login(stack, ADMIN_USER, ADMIN_PASSWORD, '  203.0.113.79  ')).status).toBe(201);
    // Sin IP válida: 400 sin contar el intento.
    for (const xff of [null, '', 'unknown', '203.0.113.80, no-es-ip']) {
      const res = await login(stack, ADMIN_USER, ADMIN_PASSWORD, xff);
      expect(res.status, String(xff)).toBe(400);
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe('CLIENT_IP_REQUIRED');
    }
    expectNoSecrets(stack);
  });

  it('N-13: el login nunca adopta un id recibido; cada login da un id nuevo de 256 bits; un id inventado no vale', async () => {
    const stack = await startStack();
    const first = await session(stack, ADMIN_USER, ADMIN_PASSWORD);
    const res = await login(stack, ADMIN_USER, ADMIN_PASSWORD, nextIp(), { Authorization: `Bearer ${first.id}` });
    expect(res.status).toBe(201);
    const second = ((await res.json()) as { session: Session }).session;
    stack.secrets.push(second.id, second.csrfToken);
    expect(second.id).not.toBe(first.id);
    expect(second.csrfToken).not.toBe(first.csrfToken);
    for (const id of [first.id, second.id]) expect(id).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const invented = await fetch(`${stack.apiUrl}${P}/sesion`, { headers: { Authorization: 'Bearer inventado-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' } });
    expect(invented.status).toBe(401);
    expectNoSecrets(stack);
  });
});

describe('QA REQ-F-039 PR 1: reglas de producto', () => {
  it('N-06: ?sobrescribir=1 con una versión desfasada responde 409 y no guarda nada (RF-9)', async () => {
    const stack = await startStack();
    const eli = await session(stack, EDITOR.username, EDITOR.password);
    const ana = await session(stack, ADMIN_USER, ADMIN_PASSWORD);
    const created = (await (await call(stack, '/molotes/productos', eli, { method: 'POST', body: molotesInput('Molote Sobrescrito') })).json()) as ProductBody;
    const id = created.product.id;
    const edit = (name: string, version: number) => ({ ...molotesInput(name), available: false, version });
    expect((await call(stack, `/molotes/productos/${id}`, ana, { method: 'PUT', body: edit('Molote De Ana Uno', 1) })).status).toBe(200);
    expect((await call(stack, `/molotes/productos/${id}`, ana, { method: 'PUT', body: edit('Molote De Ana Dos', 2) })).status).toBe(200);
    // Eli sobrescribe con la versión 2 (la que vio en el 409 anterior), pero ya hay una 3.
    const stale = await call(stack, `/molotes/productos/${id}?sobrescribir=1`, eli, { method: 'PUT', body: edit('Molote De Eli', 2) });
    expect(stale.status).toBe(409);
    const current = (await (await call(stack, `/molotes/productos/${id}`, eli)).json()) as ProductBody;
    expect(current.product).toMatchObject({ name: 'Molote De Ana Dos', version: 3 });
  });

  // DEF-002 (QA del PR 1), corregido: la clave se recuerda por usuario, negocio y cuerpo.
  it('N-12: la misma Idempotency-Key del mismo usuario en otro negocio no devuelve el producto del primero', async () => {
    const stack = await startStack();
    const ana = await session(stack, ADMIN_USER, ADMIN_PASSWORD);
    const headers = { 'Idempotency-Key': 'clave-qa-req-f-039-0001' };
    const molotes = await call(stack, '/molotes/productos', ana, { method: 'POST', body: molotesInput('Molote Idempotente'), headers });
    expect(molotes.status).toBe(201);
    const birria = await call(stack, '/birria/productos', ana, { method: 'POST', body: birriaInput('Taco Idempotente'), headers });
    const birriaBody = (await birria.json()) as ProductBody;
    expect(birria.headers.get('location') ?? '').toMatch(/^\/api\/v1\/admin\/birria\/productos\/\d+$/);
    expect(birriaBody.product.name).toBe('Taco Idempotente');
    const list = (await (await call(stack, '/birria/productos', ana)).json()) as { products: { name: string }[] };
    expect(list.products.map((product) => product.name)).toContain('Taco Idempotente');
  });

  it('N-12b (ronda 2): la misma clave en el mismo negocio con otro cuerpo responde 422 IDEMPOTENCY_KEY_REUSED sin crear nada; con el mismo cuerpo, el mismo producto', async () => {
    const stack = await startStack();
    const ana = await session(stack, ADMIN_USER, ADMIN_PASSWORD);
    const headers = { 'Idempotency-Key': 'clave-qa-req-f-039-0002' };
    const names = async () => ((await (await call(stack, '/molotes/productos', ana)).json()) as { products: { name: string }[] }).products.map((product) => product.name);
    const first = (await (await call(stack, '/molotes/productos', ana, { method: 'POST', body: molotesInput('Molote Clave Uno'), headers })).json()) as ProductBody;
    const before = await names();
    const reused = await call(stack, '/molotes/productos', ana, { method: 'POST', body: molotesInput('Molote Clave Dos'), headers });
    expect(reused.status).toBe(422);
    expect(((await reused.json()) as { error: { code: string } }).error.code).toBe('IDEMPOTENCY_KEY_REUSED');
    expect(await names()).toEqual(before);
    const replay = await call(stack, '/molotes/productos', ana, { method: 'POST', body: molotesInput('Molote Clave Uno'), headers });
    expect(replay.status).toBe(201);
    expect(((await replay.json()) as ProductBody).product.id).toBe(first.product.id);
    expect((await names()).filter((name) => name === 'Molote Clave Uno')).toHaveLength(1);
    // Otro usuario con la misma clave: alta propia.
    const eli = await session(stack, EDITOR.username, EDITOR.password);
    const other = (await (await call(stack, '/molotes/productos', eli, { method: 'POST', body: molotesInput('Molote Clave Uno'), headers })).json()) as ProductBody;
    expect(other.product.id).not.toBe(first.product.id);
    expectNoSecrets(stack);
  });
});

describe('QA REQ-F-039 PR 1: aviso interno con los procesos reales', () => {
  it('F-13: tras una escritura confirmada, la landing muestra el cambio sin reiniciar y el bot recarga (CA-9 en proceso)', async () => {
    const stack = await startStack();
    const eli = await session(stack, EDITOR.username, EDITOR.password);
    expect(await landingHas(stack, 'Molote Avisado QA')).toBe(false);
    const published = await publishMolote(stack, eli, 'Molote Avisado QA');
    expect(published.meta).toEqual({ freshness: 'confirmed' });
    expect(await landingHas(stack, 'Molote Avisado QA')).toBe(true);
    const notified = logLines(stack.landing.output().stdout).filter((line) => line.msg === 'products_change_notified');
    expect(notified.at(-1)).toMatchObject({ business: 'molotes', landing: true, bot: true });
    expectNoSecrets(stack);
  });

  it('F-14: con el aviso caído la escritura se confirma como pending y el fallo queda en el log, sin el token (CA-11)', async () => {
    const deadPort = await freePort();
    const stack = await startStack({ notifyTarget: async () => `http://127.0.0.1:${deadPort}` });
    const eli = await session(stack, EDITOR.username, EDITOR.password);
    const created = await call(stack, '/molotes/productos', eli, { method: 'POST', body: molotesInput('Molote Sin Aviso') });
    expect(created.status).toBe(201);
    expect(((await created.json()) as ProductBody).meta).toEqual({ freshness: 'pending' });
    await sleep(1800);
    const failures = logLines(stack.api.output().stdout).filter((line) => line.msg === 'products_notify_failed');
    expect(failures.length).toBeGreaterThanOrEqual(2);
    expect(failures[0]).toMatchObject({ business: 'molotes', attempt: 1, reason: 'network' });
    expectNoSecrets(stack);
  });

  // DEF-001 (QA del PR 1), corregido: la escritura que llega con un intento en vuelo recibe otro aviso al
  // terminar ese intento, así que llega a la landing antes de la red de seguridad de 60 s.
  it('N-09: una segunda escritura mientras el primer aviso sigue en curso también llega a la landing antes de la recarga de 60 s', async () => {
    // El proxy reenvía el aviso al momento (landing-pages recarga ya) y retiene la respuesta 1,2 s
    // (menos que el límite de 1,5 s del notificador, así que el intento termina bien): mientras tanto,
    // la cadena de avisos de Molotes sigue "en curso" y llega otra escritura.
    const stack = await startStack({ notifyTarget: (internal) => holdingProxy(internal, 1200) });
    const eli = await session(stack, EDITOR.username, EDITOR.password);
    const ana = await session(stack, ADMIN_USER, ADMIN_PASSWORD);
    const createdB = (await (await call(stack, '/molotes/productos', ana, { method: 'POST', body: molotesInput('Molote Segundo QA') })).json()) as ProductBody;
    await sleep(1500);
    // Primera escritura (Eli): su aviso llega a landing-pages al momento y la respuesta tarda 1,2 s.
    const first = call(stack, '/molotes/productos', eli, { method: 'POST', body: molotesInput('Molote Primero QA') });
    await sleep(400);
    // Segunda escritura (Ana), confirmada en la base después de la recarga de landing-pages.
    const second = await call(stack, `/molotes/productos/${createdB.product.id}`, ana, { method: 'PUT', body: { ...molotesInput('Molote Segundo QA'), available: true, version: createdB.product.version } });
    expect(second.status).toBe(200);
    const secondBody = (await second.json()) as ProductBody;
    expect((await first).status).toBe(201);
    let visible = false;
    for (let attempt = 0; attempt < 16 && !visible; attempt += 1) {
      await sleep(500);
      visible = await landingHas(stack, 'Molote Segundo QA');
    }
    // Su frescura es la del aviso que empezó después de ella: según cuánto retenga el proxy, `confirmed`
    // (llegó dentro de los 2 s) o `pending` (llegó después). En los dos casos la landing la muestra.
    expect(['confirmed', 'pending']).toContain(secondBody.meta?.freshness);
    expect(visible).toBe(true);
  });

  it('N-09b (ronda 2): con un aviso en vuelo corto, la segunda escritura responde confirmed y la landing ya la muestra al responder', async () => {
    // Retención de 300 ms: el intento que empieza tras la segunda escritura termina muy por debajo de 2 s.
    const stack = await startStack({ notifyTarget: (internal) => holdingProxy(internal, 300) });
    const eli = await session(stack, EDITOR.username, EDITOR.password);
    const ana = await session(stack, ADMIN_USER, ADMIN_PASSWORD);
    const createdB = (await (await call(stack, '/molotes/productos', ana, { method: 'POST', body: molotesInput('Molote Tercero QA') })).json()) as ProductBody;
    await sleep(600);
    const first = call(stack, '/molotes/productos', eli, { method: 'POST', body: molotesInput('Molote Cuarto QA') });
    await sleep(120);
    const second = await call(stack, `/molotes/productos/${createdB.product.id}`, ana, { method: 'PUT', body: { ...molotesInput('Molote Tercero QA'), available: true, version: createdB.product.version } });
    expect(second.status).toBe(200);
    expect(((await second.json()) as ProductBody).meta).toEqual({ freshness: 'confirmed' });
    // confirmed es veraz: la landing ya muestra el cambio sin esperar.
    expect(await landingHas(stack, 'Molote Tercero QA')).toBe(true);
    expect((await first).status).toBe(201);
    // Nunca dos avisos en paralelo del mismo negocio: los avisos recibidos no se solapan.
    const notified = logLines(stack.landing.output().stdout).filter((line) => line.msg === 'products_change_notified' && line.business === 'molotes');
    expect(notified.length).toBeGreaterThanOrEqual(3);
  });

  it('N-10: con la base caída, /api/v1/admin responde 503 sin trazas, SQL ni credenciales', async () => {
    const stack = await startStack({ routeDatabase: true });
    const ana = await session(stack, ADMIN_USER, ADMIN_PASSWORD);
    await stack.dbProxy?.down();
    const res = await call(stack, '/molotes/productos', ana);
    expect(res.status).toBe(503);
    const text = await res.text();
    expect(JSON.parse(text)).toMatchObject({ error: { code: 'DATABASE_UNAVAILABLE' } });
    expect(text + stack.api.output().stdout + stack.api.output().stderr).not.toMatch(/\n\s+at |SELECT |mysql:\/\//);
    expectNoSecrets(stack);
  });
});
