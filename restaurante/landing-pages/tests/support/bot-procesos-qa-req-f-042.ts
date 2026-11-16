import { createHmac } from 'node:crypto';
import { appendFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect } from 'vitest';

import { BOT_ENV } from '../helpers.ts';
import { ADMIN_ENV, ADMIN_PASSWORD, ADMIN_USER, csrfFrom } from './admin.ts';
import { appDatabaseUrl, makeDatabase, makeTempDir, type TestDatabase } from './database.ts';
import { freePort, startServer } from './process.ts';

/**
 * QA de REQ-F-042 (PR 2): la `api` y `landing-pages` como procesos reales sobre la misma base, con
 * sus temporizadores reales y sin ejecutar `bot.refresh()` a mano. La salida a Meta la recoge el doble
 * de tests/support/salida-bot-doble.ts: ninguna petición sale de la máquina. Preparación compartida
 * por los archivos bot-procesos-qa-req-f-042*.test.ts, partidos por duración.
 */

const API_ENTRY = join('..', 'api', 'src', 'server.ts');
const DOUBLE = join('tests', 'support', 'salida-bot-doble.ts');
const WEBHOOK = '/webhooks/whatsapp';
export const BOT_PATH = '/admin/bot';
export const P = '/api/v1/admin';
const MX_OFFSET_MS = 6 * 3600 * 1000;
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Desfase hasta un martes a viernes a las 10:00 de Ciudad de México (a lo sumo 3 días). */
function offsetToOpenDay(): number {
  const mx = new Date(Date.now() - MX_OFFSET_MS);
  const day = mx.getUTCDay();
  const add = day >= 2 && day <= 5 ? 0 : (9 - day) % 7;
  return Date.UTC(mx.getUTCFullYear(), mx.getUTCMonth(), mx.getUTCDate() + add, 16) - Date.now();
}

export async function waitFor<T>(read: () => T | Promise<T>, done: (value: T) => boolean, ms = 8000): Promise<T> {
  const limit = Date.now() + ms;
  for (;;) {
    const value = await read();
    if (done(value) || Date.now() > limit) return value;
    await sleep(40);
  }
}

/** Navegador mínimo sobre fetch para el proceso real de landing-pages: conserva las cookies y no sigue redirecciones. */
function createBrowser(base: string) {
  const cookies = new Map<string, string>();
  async function go(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    headers.set('cookie', [...cookies].map(([name, value]) => `${name}=${value}`).join('; '));
    const res = await fetch(`${base}${path}`, { ...init, headers, redirect: 'manual' });
    for (const line of res.headers.getSetCookie()) {
      const [pair = ''] = line.split(';');
      const index = pair.indexOf('=');
      cookies.set(pair.slice(0, index), pair.slice(index + 1));
    }
    return { status: res.status, text: await res.text() };
  }
  return {
    get: (path: string) => go(path),
    post: (path: string, fields: Record<string, string>) =>
      go(path, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields).toString() }),
  };
}

export type Browser = ReturnType<typeof createBrowser>;

interface StackOptions {
  env?: Record<string, string | undefined>;
  /** Base de un arranque anterior (se conserva hasta que la libere quien la creó). */
  reuse?: TestDatabase;
  /** Se ejecuta con landing-pages en marcha y la api todavía sin arrancar. */
  beforeApi?: () => Promise<void>;
}

export async function startStack({ env = BOT_ENV, reuse, beforeApi }: StackOptions = {}) {
  const database: TestDatabase = reuse ?? (await makeDatabase());
  const temp = await makeTempDir('qa-req-f-042-');
  const salida = join(temp.dir, 'salida.jsonl');
  await appendFile(salida, '');
  const offset = offsetToOpenDay();
  const [apiPort, webhookPort] = [await freePort(), await freePort()];
  const shared = {
    ...env,
    DATABASE_URL: appDatabaseUrl(database.name),
    BOT_CONTROL_REFRESH_SECONDS: env['BOT_CONTROL_REFRESH_SECONDS'] ?? '1', // M-1 de REQ-F-043, PR 3: mide con 10 s reales.
    QA_SALIDA_LOG: salida,
    QA_DESFASE_MS: String(offset),
  };
  const args = (entry: string) => ['--import', join(process.cwd(), DOUBLE), entry];
  const landing = await startServer(
    { ...shared, ...ADMIN_ENV, DATA_DIR: join(temp.dir, 'data'), API_INTERNAL_URL: `http://127.0.0.1:${String(apiPort)}` },
    30_000,
    { args: args('src/server.ts') },
  );
  expect(landing.started, landing.output().stderr).toBe(true);
  await beforeApi?.();
  const api = await startServer(
    { ...shared, PORT: String(apiPort), WEBHOOK_PORT: String(webhookPort), LANDING_INTERNAL_URL: landing.internalUrl },
    30_000,
    { args: args(API_ENTRY) },
  );
  expect(api.started, api.output().stderr).toBe(true);
  const apiUrl = `http://127.0.0.1:${String(apiPort)}`;
  const webhookUrl = `http://127.0.0.1:${String(webhookPort)}${WEBHOOK}`;
  let nextId = 0;

  const outbound = async () => (await readFile(salida, 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line) as { provider: string; body: string });
  const outboundTo = async (customer: string) => (await outbound()).filter((entry) => entry.body.includes(customer.slice(-8)));
  const apiLog = () => api.output().stdout.split('\n').filter(Boolean).map((line) => JSON.parse(line) as Record<string, unknown>);

  async function send(from: string, text: string): Promise<Response> {
    nextId += 1;
    const body = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [{
        id: '102290129340398',
        changes: [{
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '15550783881', phone_number_id: BOT_ENV.WHATSAPP_BOT_ACCOUNT_ID },
            contacts: [{ profile: { name: 'Cliente Ficticio' }, wa_id: from }],
            messages: [{ from, id: `wamid.QA${String(nextId)}`, timestamp: String(Math.floor((Date.now() + offset) / 1000)), type: 'text', text: { body: text } }],
          },
        }],
      }],
    });
    const signature = `sha256=${createHmac('sha256', BOT_ENV.WHATSAPP_BOT_APP_SECRET).update(body).digest('hex')}`;
    return fetch(webhookUrl, { method: 'POST', headers: { 'content-type': 'application/json', 'x-hub-signature-256': signature }, body });
  }

  async function replied(customer: string, previous: number): Promise<string> {
    const seen = await waitFor(() => outboundTo(customer), (list) => list.length > previous);
    expect(seen.length, `sin respuesta a ${customer}`).toBeGreaterThan(previous);
    return seen.slice(previous).map((entry) => entry.body).join('\n');
  }

  async function adminBrowser(): Promise<Browser> {
    const browser = createBrowser(landing.url);
    expect((await browser.post('/admin/login', { username: ADMIN_USER, password: ADMIN_PASSWORD })).status).toBe(303);
    return browser;
  }

  const adminPost = async (browser: Browser, path: string, fields: Record<string, string> = {}) =>
    browser.post(path, { _csrf: csrfFrom((await browser.get(BOT_PATH)).text), ...fields });

  async function apiSession() {
    const res = await fetch(`${apiUrl}${P}/sesion`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.40' },
      body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASSWORD }),
    });
    expect(res.status).toBe(201);
    return ((await res.json()) as { session: { id: string; csrfToken: string } }).session;
  }

  return {
    database, landing, api, apiUrl, webhookUrl, outbound, outboundTo, apiLog, send, replied, adminBrowser, adminPost, apiSession,
    async stop() {
      await api.stop();
      await landing.stop();
      if (!reuse) await database.cleanup();
      await temp.cleanup();
    },
  };
}

export type Stack = Awaited<ReturnType<typeof startStack>>;
