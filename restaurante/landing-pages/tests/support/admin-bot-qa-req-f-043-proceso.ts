import { createHmac } from 'node:crypto';
import { appendFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect } from 'vitest';

import { BOT_ENV } from '../helpers.ts';
import { ADMIN_PASSWORD, ADMIN_USER, setupAdmin } from './admin.ts';
import { waitFor } from './bot-procesos-qa-req-f-042.ts';
import { makeTempDir } from './database.ts';
import { freePort, startServer } from './process.ts';
import { databaseUrl } from './test-database-config.ts';
import { API_ENTRY, P, nextIp } from './users-api-process.ts';

/**
 * Sonda S-1 de QA de REQ-F-043: `server.ts` real, con el webhook firmado y las rutas del admin en el
 * mismo proceso, MySQL y el doble de salida. Preparación compartida por
 * admin-bot-qa-req-f-043-{proceso,proceso-reinicio}.test.ts, partidos para no pasar de 20 s en el CI
 * (.claude/rules/testing.md), sin cambiar los casos. El refresco se fija en 300 s: un efecto inmediato
 * solo puede venir de la misma instancia de `BotControl`, no de la relectura de la base.
 */

export const CUSTOMER = '525512345678';
export const STAFF = BOT_ENV.WHATSAPP_BOT_STAFF_MOLOTES;
const DOUBLE = join('tests', 'support', 'salida-bot-doble.ts');

export type State = { control: { paused: boolean }; blocks: { id: number | null; pending: boolean; origin: string; masked: string }[]; reached: { token: string; masked: string; cap: string }[]; usage: { counters: { id: string; used: number; limit: number; reached: boolean }[] } };

export const cleanups: (() => Promise<unknown>)[] = [];
/** Limpieza de la prueba: cada archivo la registra con afterEach. */
export async function runCleanups(): Promise<void> {
  while (cleanups.length > 0) await cleanups.pop()?.();
}

export async function start(env: Record<string, string> = {}) {
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
