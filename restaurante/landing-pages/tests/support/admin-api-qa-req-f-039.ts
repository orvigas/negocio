import { createServer, type IncomingMessage, type Server } from 'node:http';
import { join } from 'node:path';

import { expect } from 'vitest';

import { hashPassword } from '@restaurante/core/identity';
import { createUserRepository } from '@restaurante/db/user-repository';

import { VALID_ENV } from '../helpers.ts';
import { ADMIN_ENV, ADMIN_PASSWORD, TEST_HASH_PARAMS } from './admin.ts';
import { makeDatabase, makeTempDir } from './database.ts';
import { freePort, startServer } from './process.ts';
import { startTcpProxy } from './tcp-proxy.ts';
import { testDatabaseConfigs, databaseUrl } from './test-database-config.ts';

/**
 * Procesos reales de `api` y `landing-pages` para el QA de REQ-F-039, PR 1 (ver
 * admin-api-qa-req-f-039-*.test.ts). REQ-F-041: preparación compartida por los archivos en que se
 * partió admin-api-qa-req-f-039.test.ts, sin cambios.
 */

export const API_ENTRY = join('..', 'api', 'src', 'server.ts');
export const P = '/api/v1/admin';
export const TOKEN = VALID_ENV.INTERNAL_NOTIFY_TOKEN;
export const EDITOR = { username: 'eli', password: 'contraseña-de-eli-QA-039' };
export const IMAGE = { src: '/img/molotes/molotes-queso-oaxaca.jpg', alt: 'Molote', width: 800, height: 600 };

export const cleanups: (() => Promise<unknown>)[] = [];
/** Limpieza de la prueba (procesos, bases, proxies): cada archivo la registra con afterEach. */
export async function runCleanups(): Promise<void> {
  while (cleanups.length > 0) await cleanups.pop()?.();
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export let ipCounter = 1;
export const nextIp = () => `198.51.100.${(ipCounter++ % 250) + 1}`;

export interface Session {
  id: string;
  csrfToken: string;
}

export interface Stack {
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
export async function startStack({ notifyTarget, routeDatabase }: { notifyTarget?: (landingInternalUrl: string) => Promise<string>; routeDatabase?: boolean } = {}): Promise<Stack> {
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

export function login(stack: Stack, username: string, password: string, xff: string | null = nextIp(), extra: Record<string, string> = {}) {
  return fetch(`${stack.apiUrl}${P}/sesion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(xff === null ? {} : { 'X-Forwarded-For': xff }), ...extra },
    body: JSON.stringify({ username, password }),
  });
}

export async function session(stack: Stack, username: string, password: string): Promise<Session> {
  const res = await login(stack, username, password);
  expect(res.status).toBe(201);
  const body = (await res.json()) as { session: Session };
  stack.secrets.push(body.session.id, body.session.csrfToken);
  return body.session;
}

export function call(stack: Stack, path: string, auth: Session, { method = 'GET', body, headers = {} }: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) {
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

export const molotesInput = (name: string) => ({
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

export const birriaInput = (name: string) => ({
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

export interface ProductBody {
  product: { id: number; version: number; name: string; available: boolean };
  meta?: { freshness: string };
}

/** Crea un producto de Molotes y lo publica (disponible). Devuelve la respuesta de la publicación. */
export async function publishMolote(stack: Stack, auth: Session, name: string): Promise<ProductBody> {
  const created = (await (await call(stack, '/molotes/productos', auth, { method: 'POST', body: molotesInput(name) })).json()) as ProductBody;
  const res = await call(stack, `/molotes/productos/${created.product.id}`, auth, { method: 'PUT', body: { ...molotesInput(name), available: true, version: created.product.version } });
  expect(res.status).toBe(200);
  return (await res.json()) as ProductBody;
}

export const landingHas = async (stack: Stack, text: string) => (await (await fetch(`${stack.landing.url}/molotes`)).text()).includes(text);

export function logLines(stdout: string): Record<string, unknown>[] {
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

export function expectNoSecrets(stack: Stack) {
  const all = [stack.api.output().stdout, stack.api.output().stderr, stack.landing.output().stdout, stack.landing.output().stderr].join('\n');
  for (const secret of stack.secrets) expect(all.includes(secret), `secreto en el log (${secret.slice(0, 4)}…)`).toBe(false);
}

/** Proxy HTTP delante del puerto interno: reenvía al momento y retiene la respuesta `holdMs`. */
export async function holdingProxy(target: string, holdMs: number): Promise<string> {
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
