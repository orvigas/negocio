import { createHmac } from 'node:crypto';
import { appendFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createPrismaBotControlStore } from '@restaurante/db/prisma-bot-control-store';

import { BOT_ENV } from '../helpers.ts';
import { ADMIN_ENV, ADMIN_PASSWORD, ADMIN_USER, csrfFrom, textOf } from '../support/admin.ts';
import { appDatabaseUrl, makeDatabase, makeTempDir, type TestDatabase } from '../support/database.ts';
import { freePort, startServer } from '../support/process.ts';

/**
 * QA de REQ-F-042 (PR 2): la `api` y `landing-pages` como procesos reales sobre la misma base, con
 * sus temporizadores reales y sin ejecutar `bot.refresh()` a mano. La salida a Meta la recoge el doble
 * de tests/support/salida-bot-doble.ts: ninguna petición sale de la máquina.
 */

const API_ENTRY = join('..', 'api', 'src', 'server.ts');
const DOUBLE = join('tests', 'support', 'salida-bot-doble.ts');
const WEBHOOK = '/webhooks/whatsapp';
const BOT_PATH = '/admin/bot';
const P = '/api/v1/admin';
const MX_OFFSET_MS = 6 * 3600 * 1000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Desfase hasta un martes a viernes a las 10:00 de Ciudad de México (a lo sumo 3 días). */
function offsetToOpenDay(): number {
  const mx = new Date(Date.now() - MX_OFFSET_MS);
  const day = mx.getUTCDay();
  const add = day >= 2 && day <= 5 ? 0 : (9 - day) % 7;
  return Date.UTC(mx.getUTCFullYear(), mx.getUTCMonth(), mx.getUTCDate() + add, 16) - Date.now();
}

async function waitFor<T>(read: () => T | Promise<T>, done: (value: T) => boolean, ms = 8000): Promise<T> {
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

type Browser = ReturnType<typeof createBrowser>;

interface StackOptions {
  env?: Record<string, string | undefined>;
  /** Base de un arranque anterior (se conserva hasta que la libere quien la creó). */
  reuse?: TestDatabase;
  /** Se ejecuta con landing-pages en marcha y la api todavía sin arrancar. */
  beforeApi?: () => Promise<void>;
}

async function startStack({ env = BOT_ENV, reuse, beforeApi }: StackOptions = {}) {
  const database: TestDatabase = reuse ?? (await makeDatabase());
  const temp = await makeTempDir('qa-req-f-042-');
  const salida = join(temp.dir, 'salida.jsonl');
  await appendFile(salida, '');
  const offset = offsetToOpenDay();
  const [apiPort, webhookPort] = [await freePort(), await freePort()];
  const shared = {
    ...env,
    DATABASE_URL: appDatabaseUrl(database.name),
    BOT_CONTROL_REFRESH_SECONDS: '1',
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

type Stack = Awaited<ReturnType<typeof startStack>>;

describe('bot en la api y /admin en landing-pages, procesos reales', () => {
  let stack: Stack;
  let admin: Browser;
  beforeAll(async () => {
    stack = await startStack();
    admin = await stack.adminBrowser();
  }, 90_000);
  afterAll(async () => {
    await stack?.stop();
  }, 30_000);

  it('T-01: verificación con el token correcto e incorrecto', async () => {
    const query = (token: string) => `?hub.mode=subscribe&hub.verify_token=${token}&hub.challenge=reto-123`;
    const ok = await fetch(`${stack.webhookUrl}${query(BOT_ENV.WHATSAPP_BOT_VERIFY_TOKEN)}`);
    expect(ok.status).toBe(200);
    expect(await ok.text()).toBe('reto-123');
    expect((await fetch(`${stack.webhookUrl}${query('otro')}`)).status).toBe(403);
  });

  it('T-02: un POST firmado lo atiende la api, responde 200 y sale una respuesta al doble', async () => {
    const customer = '5215512340001';
    expect((await stack.send(customer, 'hola')).status).toBe(200);
    await stack.replied(customer, 0);
    expect(stack.apiLog().some((line) => line.msg === 'bot_provider_selected')).toBe(true);
    expect(stack.landing.output().stdout).not.toContain('bot_provider_selected');
    expect((await stack.outbound()).every((entry) => entry.provider === 'meta')).toBe(true);
  });

  it('T-03: sin firma o con firma incorrecta, rechazo sin procesar', async () => {
    const before = (await stack.outbound()).length;
    const body = '{"object":"whatsapp_business_account","entry":[]}';
    const none = await fetch(stack.webhookUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
    const bad = await fetch(stack.webhookUrl, { method: 'POST', headers: { 'content-type': 'application/json', 'x-hub-signature-256': `sha256=${'0'.repeat(64)}` }, body });
    expect([none.status, bad.status]).toEqual([401, 403]);
    expect(stack.apiLog().filter((line) => line.msg === 'bot_webhook_signature_invalid')).toHaveLength(2);
    expect((await stack.outbound()).length).toBe(before);
  });

  it('T-08: la pausa de /admin llega sola al bot; el primer mensaje posterior se descarta y al reanudar se atiende', async () => {
    const customer = '5215512340002';
    expect((await stack.adminPost(admin, `${BOT_PATH}/interruptor`, { accion: 'pausar', motivo: 'Incidente QA' })).status).toBe(303);
    await sleep(1600);
    expect((await stack.send(customer, 'hola')).status).toBe(200);
    await sleep(800);
    expect(await stack.outboundTo(customer)).toHaveLength(0);

    expect((await stack.adminPost(admin, `${BOT_PATH}/interruptor`, { accion: 'reanudar', motivo: '' })).status).toBe(303);
    await sleep(1600);
    expect((await stack.send(customer, 'hola de nuevo')).status).toBe(200);
    await stack.replied(customer, 0);
  });

  it('T-09 y T-13: el alta y la baja de /admin llegan al bot; el personal no se bloquea', async () => {
    const customer = '5215512340003';
    expect((await stack.adminPost(admin, `${BOT_PATH}/bloqueos`, { telefono: customer, duracion: '7d', motivo: '' })).status).toBe(303);
    await sleep(1600);
    await stack.send(customer, 'hola');
    await waitFor(stack.apiLog, (lines) => lines.some((line) => line.msg === 'bot_blocked_message'));
    expect(await stack.outboundTo(customer)).toHaveLength(0);

    const id = (await stack.database.prisma.botBlock.findFirst({ where: { removedAt: null } }))?.id;
    expect((await stack.adminPost(admin, `${BOT_PATH}/bloqueos/${String(id)}/quitar`)).status).toBe(303);
    await sleep(1600);
    await stack.send(customer, 'hola otra vez');
    await stack.replied(customer, 0);

    const staff = await stack.adminPost(admin, `${BOT_PATH}/bloqueos`, { telefono: BOT_ENV.WHATSAPP_BOT_STAFF_MOLOTES, duracion: '7d', motivo: '' });
    expect(staff.status).toBe(422);
    expect(staff.text).not.toContain(BOT_ENV.WHATSAPP_BOT_STAFF_MOLOTES);
  });

  it('T-10: el uso enviado por la api aparece en /admin/bot', async () => {
    const rows = await waitFor(
      () => stack.database.prisma.botUsage.findMany(),
      (list) => list.length === 2 && list.every((row) => row.outbound > 0),
    );
    expect(rows.map((row) => row.periodType).sort()).toEqual(['day', 'month']);
    const outbound = rows.find((row) => row.periodType === 'month')?.outbound ?? 0;
    const page = textOf((await admin.get(BOT_PATH)).text);
    expect(page).toContain(String(outbound));
    expect(page).toContain('vuelve con el control del bot en el admin nuevo');
    expect(page).not.toContain('Números que alcanzaron un tope hoy');
  });

  it('T-12: bloquear desde topes responde 410 y no escribe nada', async () => {
    const blocks = await stack.database.prisma.botBlock.count();
    const audits = await stack.database.prisma.botAudit.count();
    const res = await stack.adminPost(admin, `${BOT_PATH}/topes/${'a'.repeat(32)}/bloquear`, { duracion: '7d', motivo: '' });
    expect(res.status).toBe(410);
    expect(textOf(res.text)).toContain('vuelve con el control del bot en el admin nuevo');
    expect(await stack.database.prisma.botBlock.count()).toBe(blocks);
    expect(await stack.database.prisma.botAudit.count()).toBe(audits);
  });

  it('T-14: un producto no disponible en la api deja de ofrecerse en el siguiente mensaje y la frescura se confirma', async () => {
    const customer = '5215512340004';
    const bodies = async () => (await stack.outboundTo(customer)).map((entry) => entry.body);
    await stack.send(customer, 'menú');
    const first = await waitFor(bodies, (list) => list.some((body) => body.includes('Molotes de Queso Oaxaca')));
    expect(first.join('\n')).toContain('Molotes de Queso Oaxaca');
    await sleep(300);
    const count = (await bodies()).length;

    const session = await stack.apiSession();
    const auth = { authorization: `Bearer ${session.id}` };
    const listRes = await fetch(`${stack.apiUrl}${P}/molotes/productos`, { headers: auth });
    expect(listRes.status).toBe(200);
    const list = (await listRes.json()) as { products: Record<string, unknown>[] };
    const queso = list.products.find((product) => product.name === 'Molotes de Queso Oaxaca');
    if (!queso) throw new Error('Falta el producto de la prueba');
    const put = await fetch(`${stack.apiUrl}${P}/molotes/productos/${String(queso.id)}`, {
      method: 'PUT',
      headers: { ...auth, 'content-type': 'application/json', 'x-csrf-token': session.csrfToken },
      body: JSON.stringify({
        category: 'platillo',
        name: queso.name,
        description: queso.description,
        label: queso.label,
        tone: queso.tone,
        price: (Number(queso.priceCents ?? 0) / 100).toFixed(2),
        orderPrice: (Number(queso.orderPriceCents ?? 0) / 100).toFixed(2),
        orderQuantity: queso.orderQuantity,
        image: queso.image,
        available: false,
        version: queso.version,
      }),
    });
    const putText = await put.text();
    expect(put.status, putText).toBe(200);
    expect((JSON.parse(putText) as { meta: { freshness: string } }).meta.freshness).toBe('confirmed');

    await stack.send(customer, 'menú');
    await stack.replied(customer, count);
    await sleep(300);
        const after = (await bodies()).slice(count).join('\n');
    expect(after).toContain('Molotes de Tinga de Pollo');
    expect(after).not.toContain('Molotes de Queso Oaxaca');
  });

  it('N-03: ningún secreto ni número completo en los logs de los dos procesos', () => {
    const logs = stack.api.output().stdout + stack.api.output().stderr + stack.landing.output().stdout + stack.landing.output().stderr;
    for (const secret of [
      BOT_ENV.WHATSAPP_BOT_ACCESS_TOKEN,
      BOT_ENV.WHATSAPP_BOT_APP_SECRET,
      BOT_ENV.WHATSAPP_BOT_VERIFY_TOKEN,
      BOT_ENV.WHATSAPP_BOT_BLOCKLIST_KEY,
      '5215512340001',
      'hola de nuevo',
    ]) {
      expect(logs).not.toContain(secret);
    }
  });

  it('N-07: SIGTERM justo tras una entrega: salida 0 y contadores guardados', async () => {
    const customer = '5215512340005';
    const month = async () => (await stack.database.prisma.botUsage.findFirst({ where: { periodType: 'month' } }))?.outbound ?? 0;
    const previous = await month();
    await stack.send(customer, 'hola');
    await stack.replied(customer, 0);
    expect(await stack.api.stop()).toBe(0);
    expect(await month()).toBeGreaterThan(previous);
  });
});

describe('solo WHATSAPP_BOT_PROVIDER definido (N-06, CA-4)', () => {
  it('T-06, T-07 y N-06: la api en 503 y /admin dice "Desactivado"', async () => {
    const stack = await startStack({ env: { WHATSAPP_BOT_PROVIDER: 'meta' } });
    try {
      for (const method of ['GET', 'POST']) {
        const res = await fetch(stack.webhookUrl, { method });
        expect(res.status).toBe(503);
        expect(((await res.json()) as { error: { code: string } }).error.code).toBe('BOT_DISABLED');
      }
      expect(stack.apiLog().some((line) => line.msg === 'bot_provider_selected')).toBe(false);
      for (const path of ['/', '/molotes', '/birria']) expect((await fetch(`${stack.landing.url}${path}`)).status).toBe(200);
      const admin = await stack.adminBrowser();
      const page = textOf((await admin.get(BOT_PATH)).text);
      expect(page).toContain('Desactivado');
      expect(page).not.toContain('Habilitado');
    } finally {
      await stack.stop();
    }
  }, 60_000);
});

describe('mantenimiento en un solo proceso (T-19, CA-13)', () => {
  it('una caducidad se audita una sola vez, solo en la api y sin repetirse al reiniciar', async () => {
    const database = await makeDatabase();
    const expired = async () => database.prisma.botAudit.count({ where: { action: 'block_expired' } });
    const store = createPrismaBotControlStore({ prisma: database.prisma });
    const past = new Date(Date.now() - 2 * 24 * 3600 * 1000);
    await store.addBlock(
      { phoneHash: 'a'.repeat(64), keyId: 'qa000000', last4: '0006', origin: 'tope', reason: null, expiresAt: new Date(past.getTime() + 3600 * 1000), masked: '*********0006', duration: '1 h' },
      { kind: 'system' },
      past,
    );
    try {
      const first = await startStack({ reuse: database, beforeApi: async () => expect(await expired()).toBe(0) });
      expect(await waitFor(expired, (count) => count > 0)).toBe(1);
      await first.stop();
      const second = await startStack({ reuse: database });
      await second.stop();
      expect(await expired()).toBe(1);
    } finally {
      await database.cleanup();
    }
  }, 60_000);
});
