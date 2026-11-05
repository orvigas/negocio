import { createHmac } from 'node:crypto';
import { appendFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { BOT_ENV } from '../helpers.ts';
import { ADMIN_PASSWORD, ADMIN_USER, setupAdmin } from '../support/admin.ts';
import { BOT_PATH, startStack, waitFor } from '../support/bot-procesos-qa-req-f-042.ts';
import { makeTempDir } from '../support/database.ts';
import { freePort, startServer } from '../support/process.ts';
import { databaseUrl } from '../support/test-database-config.ts';
import { API_ENTRY, P, nextIp } from '../support/users-api-process.ts';

/**
 * QA de REQ-F-043 (PR 1, sonda S-1): `server.ts` real, con el webhook firmado y las rutas del admin en
 * el mismo proceso, MySQL y el doble de salida. El refresco se fija en 300 s: un efecto inmediato solo
 * puede venir de la misma instancia de `BotControl`, no de la relectura de la base.
 */

const CUSTOMER = '525512345678';
const STAFF = BOT_ENV.WHATSAPP_BOT_STAFF_MOLOTES;
const DOUBLE = join('tests', 'support', 'salida-bot-doble.ts');

type State = { control: { paused: boolean }; blocks: { id: number | null; pending: boolean; origin: string; masked: string }[]; reached: { token: string; masked: string; cap: string }[]; usage: { counters: { id: string; used: number; limit: number; reached: boolean }[] } };

const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()?.();
});

async function start(env: Record<string, string> = {}) {
  const context = await setupAdmin();
  const temp = await makeTempDir('qa-req-f-043-');
  cleanups.push(temp.cleanup);
  const salida = join(temp.dir, 'salida.jsonl');
  await appendFile(salida, '');
  const webhookPort = await freePort();
  const shared = { ...BOT_ENV, BOT_CONTROL_REFRESH_SECONDS: '300', BOT_LIMIT_BURST: '100', BOT_LIMIT_MESSAGES_PER_MINUTE: '1000', ...env, WEBHOOK_PORT: String(webhookPort), QA_SALIDA_LOG: salida, DATABASE_URL: databaseUrl(context.database.config), INTERNAL_NOTIFY_TOKEN: undefined };
  const boot = async () => {
    const process_ = await startServer(shared, 60_000, { args: ['--import', join(process.cwd(), DOUBLE), API_ENTRY] });
    expect(process_.started, process_.output().stderr).toBe(true);
    return process_;
  };
  const running = { api: await boot() };
  cleanups.push(() => running.api.stop());
  const login = async () => {
    const res = await fetch(`${running.api.url}${P}/sesion`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': nextIp() }, body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASSWORD }) });
    return ((await res.json()) as { session: { id: string; csrfToken: string } }).session;
  };
  let session = await login();
  const call = (path: string, method = 'GET', body?: unknown) =>
    fetch(`${running.api.url}${P}/bot${path}`, { method, headers: { authorization: `Bearer ${session.id}`, 'x-csrf-token': session.csrfToken, ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const state = async () => ((await (await call('')).json()) as { bot: State }).bot;
  let serial = 0;
  const send = (from: string, text = `consulta ${String((serial += 1))}`) => {
    serial += 1;
    const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ id: '1', changes: [{ field: 'messages', value: { messaging_product: 'whatsapp', metadata: { display_phone_number: '15550783881', phone_number_id: BOT_ENV.WHATSAPP_BOT_ACCOUNT_ID }, contacts: [{ profile: { name: 'Cliente' }, wa_id: from }], messages: [{ from, id: `wamid.P${String(serial)}`, timestamp: String(Math.floor(Date.now() / 1000)), type: 'text', text: { body: text } }] } }] }] });
    return fetch(`http://127.0.0.1:${String(webhookPort)}/webhooks/whatsapp`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-hub-signature-256': `sha256=${createHmac('sha256', BOT_ENV.WHATSAPP_BOT_APP_SECRET).update(body).digest('hex')}` }, body });
  };
  const sentTo = async (customer: string) => (await readFile(salida, 'utf8')).split('\n').filter((line) => line.includes(customer.slice(-8))).length;
  const logged = (msg: string) => running.api.output().stdout.includes(`"msg":"${msg}"`);
  const until = (done: () => boolean | Promise<boolean>, what: string) => waitFor(done, Boolean, 5000).then((value) => expect(value, what).toBe(true));
  const restart = async () => {
    await running.api.stop();
    running.api = await boot();
    session = await login();
  };
  return { context, running, call, state, send, sentTo, logged, until, restart, webhookPort };
}

describe('efecto inmediato con el proceso real (R-1)', () => {
  it('QA-40 y QA-41: pausar corta el siguiente mensaje sin esperar el refresco; reanudar lo devuelve', async () => {
    const { context, call, send, sentTo, logged, until } = await start();
    await send(CUSTOMER);
    await until(async () => (await sentTo(CUSTOMER)) > 0, 'el bot responde antes de pausar');
    const before = await sentTo(CUSTOMER);

    expect((await call('/interruptor', 'PUT', { paused: true, reason: 'Gasto raro' })).status).toBe(200);
    await send(CUSTOMER);
    await until(() => logged('bot_paused_dropped'), 'el mensaje se descarta por la pausa');
    expect(await sentTo(CUSTOMER)).toBe(before);

    expect((await call('/interruptor', 'PUT', { paused: true, reason: 'Sigue raro' })).status).toBe(200);
    expect((await call('/interruptor', 'PUT', { paused: false })).status).toBe(200);
    await send(CUSTOMER);
    await until(async () => (await sentTo(CUSTOMER)) > before, 'el bot responde tras reanudar');
    const audit = await context.prisma.botAudit.findMany({ orderBy: { id: 'asc' } });
    expect(audit.map(({ action, reason }) => [action, reason])).toEqual([['bot_paused', 'Gasto raro'], ['bot_paused', 'Sigue raro'], ['bot_resumed', null]]);
    expect(audit.every(({ actorKind, actorName }) => actorKind === 'user' && actorName !== null)).toBe(true);
  });

  it('QA-42, QA-01 y QA-43: alta, tope diario real y baja que devuelve la atención', async () => {
    const { context, call, state, send, sentTo, logged, until } = await start({ BOT_LIMIT_MESSAGES_PER_NUMBER_DAY: '5' });
    const blocked = '525587654321';
    expect((await call('/bloqueos', 'POST', { phone: '55 8765 4321', duration: '7d' })).status).toBe(201);
    await send(blocked);
    await until(() => logged('bot_blocked_message'), 'el número bloqueado se descarta');
    expect(await sentTo(blocked)).toBe(0);
    const manual = (await state()).blocks.find(({ origin }) => origin === 'manual');
    expect(manual?.masked).toBe('*********4321');
    expect((await call(`/bloqueos/${String(manual?.id)}/quitar`, 'POST', {})).status).toBe(200);
    await send(blocked);
    await until(async () => (await sentTo(blocked)) > 0, 'responde tras quitar el bloqueo manual');

    for (let index = 0; index < 6; index += 1) await send(CUSTOMER);
    await until(async () => (await state()).blocks.some(({ origin, pending }) => origin === 'tope' && !pending), 'bloqueo automático guardado');
    const automatic = await state();
    expect(automatic.reached).toMatchObject([{ cap: 'messages', masked: '*********5678' }]);
    const id = automatic.blocks.find(({ origin }) => origin === 'tope')?.id;
    const sent = await sentTo(CUSTOMER);
    await send(CUSTOMER);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(await sentTo(CUSTOMER)).toBe(sent);
    expect((await call(`/bloqueos/${String(id)}/quitar`, 'POST', {})).status).toBe(200);
    await send(CUSTOMER);
    await until(async () => (await sentTo(CUSTOMER)) > sent, 'responde hoy mismo tras quitar el bloqueo automático (DT-1)');
    const removed = await context.prisma.botAudit.findMany({ where: { action: 'block_removed' } });
    expect(removed.map(({ origin }) => origin)).toEqual(['manual', 'tope']);
  });

  it('QA-02: un bloqueo quitado levanta el enfriamiento en curso', async () => {
    const { call, state, send, sentTo, logged, until } = await start({ BOT_REPEAT_COUNT: '2' });
    await send(CUSTOMER, 'hola repetido');
    await send(CUSTOMER, 'hola repetido');
    await until(() => logged('bot_cooldown_started'), 'enfriamiento');
    const sent = await sentTo(CUSTOMER);
    await send(CUSTOMER, 'otra cosa');
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(await sentTo(CUSTOMER)).toBe(sent);
    expect((await call('/bloqueos', 'POST', { phone: CUSTOMER, duration: '24h' })).status).toBe(201);
    const id = (await state()).blocks[0]?.id;
    expect((await call(`/bloqueos/${String(id)}/quitar`, 'POST', {})).status).toBe(200);
    await send(CUSTOMER, 'una tercera');
    await until(async () => (await sentTo(CUSTOMER)) > sent, 'responde sin esperar el enfriamiento');
  });

  it('QA-44: la ráfaga del cliente entra en la lista, la del personal no, y el token bloquea', async () => {
    const { context, call, state, send, until } = await start({ BOT_LIMIT_BURST: '3' });
    for (let index = 0; index < 5; index += 1) await send(CUSTOMER);
    for (let index = 0; index < 5; index += 1) await send(STAFF);
    await until(async () => (await state()).reached.length > 0, 'cliente en la lista');
    await new Promise((resolve) => setTimeout(resolve, 200));
    const { reached } = await state();
    expect(reached.map(({ masked, cap }) => [masked, cap])).toEqual([['*********5678', 'burst']]);
    expect((await call(`/topes/${reached[0]?.token ?? ''}/bloquear`, 'POST', { duration: '7d', reason: 'Abuso' })).status).toBe(201);
    expect((await call(`/topes/${reached[0]?.token ?? ''}/bloquear`, 'POST', { duration: '7d' })).status).toBe(404);
    const after = await state();
    expect(after.reached).toEqual([]);
    expect(after.blocks).toMatchObject([{ masked: '*********5678', origin: 'manual' }]);
    expect(await context.prisma.botBlock.count()).toBe(1);
    expect(await context.prisma.botAudit.findMany({ where: { action: 'block_added' } })).toMatchObject([{ masked: '*********5678', reason: 'Abuso', details: '7 d' }]);
  });

  it('QA-45 y QA-46: tras un reinicio real, la lista está vacía y siguen bloqueos, interruptor y contadores', async () => {
    const { context, running, call, state, send, sentTo, until, restart } = await start({ BOT_LIMIT_BURST: '3' });
    for (let index = 0; index < 5; index += 1) await send(CUSTOMER);
    await until(async () => (await state()).reached.length > 0, 'lista con una entrada');
    await until(async () => (await sentTo(CUSTOMER)) >= 3, 'respuestas enviadas');
    expect((await call('/bloqueos', 'POST', { phone: '5215587654321', duration: '30d' })).status).toBe(201);
    expect((await call('/interruptor', 'PUT', { paused: true })).status).toBe(200);
    const before = await state();
    const used = before.usage.counters;
    expect(used.map(({ id }) => id)).toEqual(['templates_day', 'templates_month', 'outbound_day', 'outbound_month', 'budget']);
    expect(used.find(({ id }) => id === 'outbound_day')?.used).toBeGreaterThan(0);

    await restart();
    expect(running.api.started).toBe(true);
    const after = await state();
    expect(after.reached).toEqual([]);
    expect(after.control.paused).toBe(true);
    expect(after.blocks.map(({ masked }) => masked)).toEqual(['*********4321']);
    expect(after.usage.counters).toEqual(used);
    const rows = await context.prisma.botUsage.findMany({ orderBy: { periodType: 'asc' } });
    const outbound = Object.fromEntries(rows.map(({ periodType, outbound: value }) => [periodType, value]));
    expect(outbound).toEqual({ day: used.find(({ id }) => id === 'outbound_day')?.used, month: used.find(({ id }) => id === 'outbound_month')?.used });
  });

  it('QA-66: el puerto del webhook no sirve el admin', async () => {
    const { running, webhookPort } = await start();
    for (const method of ['GET', 'PUT', 'POST']) {
      for (const path of ['/bot', '/bot/interruptor', '/bot/bloqueos']) {
        expect((await fetch(`http://127.0.0.1:${String(webhookPort)}${P}${path}`, { method })).status).toBe(404);
      }
    }
    expect((await fetch(`${running.api.url}/webhooks/whatsapp`)).status).toBe(404);
  });
});

describe('convivencia con /admin/bot (QA-64)', () => {
  it('lo escrito en /admin/bot llega a la API en el refresco, y al revés; esa baja no libera el cupo (declarado)', async () => {
    const stack = await startStack({ env: { ...BOT_ENV, BOT_LIMIT_MESSAGES_PER_NUMBER_DAY: '5', BOT_LIMIT_BURST: '100' } });
    cleanups.push(() => stack.stop());
    const session = await stack.apiSession();
    const call = (path: string, method = 'GET', body?: unknown) =>
      fetch(`${stack.apiUrl}${P}/bot${path}`, { method, headers: { authorization: `Bearer ${session.id}`, 'x-csrf-token': session.csrfToken, ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const state = async () => ((await (await call('')).json()) as { bot: State }).bot;
    const admin = await stack.adminBrowser();

    expect((await stack.adminPost(admin, `${BOT_PATH}/interruptor`, { accion: 'pausar', motivo: 'Desde la landing' })).status).toBe(303);
    expect((await waitFor(state, ({ control }) => control.paused, 3000)).control.paused).toBe(true);
    expect((await stack.adminPost(admin, `${BOT_PATH}/interruptor`, { accion: 'reanudar', motivo: '' })).status).toBe(303);
    expect((await waitFor(state, ({ control }) => !control.paused, 3000)).control.paused).toBe(false);

    expect((await stack.adminPost(admin, `${BOT_PATH}/bloqueos`, { telefono: '5587654321', duracion: '7d', motivo: '' })).status).toBe(303);
    const seen = await waitFor(state, ({ blocks }) => blocks.length === 1, 3000);
    expect(seen.blocks).toMatchObject([{ masked: '*********4321' }]);
    expect((await call(`/bloqueos/${String(seen.blocks[0]?.id)}/quitar`, 'POST', {})).status).toBe(200);
    const page = await waitFor(() => admin.get(BOT_PATH), ({ text }) => !text.includes('*********4321'), 3000);
    expect(page.text).not.toContain('*********4321');

    expect((await call('/interruptor', 'PUT', { paused: true, reason: 'Desde la API' })).status).toBe(200);
    const paused = await waitFor(() => admin.get(BOT_PATH), ({ text }) => text.includes('Desde la API'), 3000);
    expect(paused.text).toContain('Desde la API');
    expect((await call('/interruptor', 'PUT', { paused: false })).status).toBe(200);

    for (let index = 0; index < 6; index += 1) await stack.send(CUSTOMER, `consulta ${String(index)}`);
    const blocked = await waitFor(state, ({ blocks }) => blocks.some(({ origin, pending }) => origin === 'tope' && !pending), 5000);
    const id = blocked.blocks.find(({ origin }) => origin === 'tope')?.id;
    expect((await stack.adminPost(admin, `${BOT_PATH}/bloqueos/${String(id)}/quitar`)).status).toBe(303);
    await waitFor(state, ({ blocks }) => blocks.length === 0, 3000);
    const log = stack.apiLog().length;
    await stack.send(CUSTOMER, 'después de la baja en la landing');
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(stack.apiLog().slice(log).some(({ msg }) => msg === 'bot_number_cap_reached')).toBe(false);

    const page2 = await admin.get(BOT_PATH);
    const { usage } = await state();
    const outbound = usage.counters.find(({ id: counter }) => counter === 'outbound_day');
    expect(outbound?.used).toBeGreaterThan(0);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const page3 = await admin.get(BOT_PATH);
    expect(page3.text).toContain(String((await state()).usage.counters.find(({ id: counter }) => counter === 'outbound_day')?.used));
    expect(page2.status).toBe(200);
  });
});
