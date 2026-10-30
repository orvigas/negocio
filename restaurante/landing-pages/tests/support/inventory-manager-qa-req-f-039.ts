import { join } from 'node:path';

import { expect } from 'vitest';

import { hashPassword } from '@restaurante/core/identity';
import { createUserRepository } from '@restaurante/db/user-repository';

import { VALID_ENV } from '../helpers.ts';
import { ADMIN_ENV, ADMIN_PASSWORD, TEST_HASH_PARAMS } from './admin.ts';
import { makeDatabase, makeTempDir } from './database.ts';
import { freePort, startServer } from './process.ts';
import { databaseUrl } from './test-database-config.ts';

/**
 * Procesos reales de api, landing-pages e inventory-manager para el QA de REQ-F-039, PR 2
 * (archivos inventory-manager-qa-req-f-039-*.test.ts). REQ-F-041: preparación compartida por los
 * archivos en que se partió inventory-manager-qa-req-f-039.test.ts, sin cambios.
 */

export const API_ENTRY = join('..', 'api', 'src', 'server.ts');
export const INVENTORY_ENTRY = join('..', 'inventory-manager', 'src', 'server.ts');
export const EDITOR = { username: 'eli', password: 'contraseña-de-eli-QA-039-pr2' };
export const IMAGE_SRC = '/img/molotes/molotes-queso-oaxaca.jpg';

export const cleanups: (() => Promise<unknown>)[] = [];
/** Limpieza de la prueba (procesos, bases, proxies): cada archivo la registra con afterEach. */
export async function runCleanups(): Promise<void> {
  while (cleanups.length > 0) await cleanups.pop()?.();
}

export type Proc = Awaited<ReturnType<typeof startServer>>;

export interface Stack {
  api: Proc;
  landing: Proc;
  inventory: Proc;
  url: string;
  /** Cabeceras de un navegador en este origen (o del proxy, en producción). */
  browser: Record<string, string>;
  secrets: string[];
  startInventory: (env: Record<string, string>) => Promise<{ proc: Proc; url: string }>;
}

export async function startStack({ inventoryEnv = {}, browser }: { inventoryEnv?: Record<string, string>; browser?: (url: string) => Record<string, string> } = {}): Promise<Stack> {
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
export function client(stack: Stack, base = stack.url, headers = stack.browser) {
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

export type Client = ReturnType<typeof client>;

export async function loginAs(c: Client, username: string, password: string, next = '/') {
  const res = await c.post('/acceso', { username, password, next });
  expect(res.status).toBe(303);
  return res;
}

export const hidden = (html: string, name: string): string => {
  const match = new RegExp(`name="${name}" value="([^"]*)"`).exec(html);
  if (!match?.[1]) throw new Error(`Falta ${name}`);
  return match[1];
};

export const molotesForm = (name: string) => ({
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

export const productNames = async (c: Client, business = 'molotes') => {
  const html = await (await c.get(`/${business}/productos`)).text();
  return html;
};

export function expectNoSecrets(stack: Stack, ...procs: Proc[]) {
  const all = [stack.api, stack.landing, stack.inventory, ...procs].flatMap((proc) => [proc.output().stdout, proc.output().stderr]).join('\n');
  for (const secret of stack.secrets) if (secret.length >= 8) expect(all.includes(secret), `secreto en el log (${secret.slice(0, 4)}…)`).toBe(false);
}
