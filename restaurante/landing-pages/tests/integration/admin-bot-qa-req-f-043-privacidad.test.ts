import { createHmac } from 'node:crypto';
import { appendFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { BOT_ENV } from '../helpers.ts';
import { ADMIN_PASSWORD, ADMIN_USER, setupAdmin } from '../support/admin.ts';
import { waitFor } from '../support/bot-procesos-qa-req-f-042.ts';
import { makeTempDir } from '../support/database.ts';
import { freePort, startServer } from '../support/process.ts';
import { databaseUrl } from '../support/test-database-config.ts';
import { API_ENTRY, P, nextIp } from '../support/users-api-process.ts';

/**
 * QA de REQ-F-043 (PR 1, sonda S-3, CA-15): un número conocido entra por el admin, por todos los caminos
 * de error y por el webhook. Después se busca en las respuestas, los logs de la API y las tablas.
 */

const WA_ID = '5215512345678';
const FORMS = [WA_ID, '525512345678', '5512345678', '55 1234 5678', '551234'];
const FORBIDDEN_WORDS = ['phoneHash', 'phone_hash', 'keyId', 'key_id', 'last4'];

const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()?.();
});

describe('privacidad con el proceso real (QA-50 a QA-53)', () => {
  it('el número no aparece completo en respuestas, logs ni tablas, ni por los caminos de error', async () => {
    const context = await setupAdmin();
    const temp = await makeTempDir('qa-req-f-043-');
    cleanups.push(temp.cleanup);
    const salida = join(temp.dir, 'salida.jsonl');
    await appendFile(salida, '');
    const webhookPort = await freePort();
    const api = await startServer(
      { ...BOT_ENV, BOT_LIMIT_BURST: '100', BOT_LIMIT_MESSAGES_PER_MINUTE: '1000', BOT_LIMIT_MESSAGES_PER_NUMBER_DAY: '5', WEBHOOK_PORT: String(webhookPort), QA_SALIDA_LOG: salida, DATABASE_URL: databaseUrl(context.database.config), INTERNAL_NOTIFY_TOKEN: undefined },
      60_000,
      { args: ['--import', join(process.cwd(), 'tests', 'support', 'salida-bot-doble.ts'), API_ENTRY] },
    );
    cleanups.push(() => api.stop());
    expect(api.started, api.output().stderr).toBe(true);
    const login = await fetch(`${api.url}${P}/sesion`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': nextIp() }, body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASSWORD }) });
    const { session } = (await login.json()) as { session: { id: string; csrfToken: string } };
    const responses: string[] = [];
    const rawCall = async (path: string, method: string, body?: string, type = 'application/json') => {
      const res = await fetch(`${api.url}${P}/bot${path}`, { method, headers: { authorization: `Bearer ${session.id}`, 'x-csrf-token': session.csrfToken, ...(body === undefined ? {} : { 'content-type': type }) }, ...(body === undefined ? {} : { body }) });
      const text = await res.text();
      responses.push(text);
      return { status: res.status, text };
    };
    const call = (path: string, method: string, body?: unknown) => rawCall(path, method, body === undefined ? undefined : JSON.stringify(body));

    expect((await call('/bloqueos', 'POST', { phone: WA_ID, duration: '7d', reason: 'Abuso' })).status).toBe(201);
    const fails: [unknown, string?][] = [
      [{ phone: WA_ID, duration: '7d' }], // ya bloqueado
      [{ phone: WA_ID, duration: 'mal' }], // duración
      [{ phone: `${WA_ID}x`, duration: '7d' }], // inválido
      [{ phone: WA_ID, duration: '7d', reason: `llama al ${WA_ID}` }], // motivo con el número
      [{ phone: WA_ID, duration: '7d', telefono: WA_ID }], // campo desconocido
      [`{"phone":"${WA_ID}"`], // JSON truncado
      [JSON.stringify({ phone: WA_ID, reason: 'x'.repeat(5000) })], // más de 4 KiB
      [`phone=${WA_ID}`, 'application/x-www-form-urlencoded'],
    ];
    for (const [body, type] of fails) {
      const status = typeof body === 'string' ? (await rawCall('/bloqueos', 'POST', body, type)).status : (await call('/bloqueos', 'POST', body)).status;
      expect(status).toBeGreaterThanOrEqual(400);
      expect(status).toBeLessThan(500);
    }
    expect((await call('/interruptor', 'PUT', { paused: true, reason: `avisar ${WA_ID}` })).status).toBe(422);
    const state = await call('', 'GET');
    const { bot } = JSON.parse(state.text) as { bot: { blocks: { id: number }[] } };
    expect((await call(`/bloqueos/${String(bot.blocks[0]?.id)}/quitar`, 'POST', {})).status).toBe(200);

    // Por el webhook: tope, bloqueo automático, baja.
    const send = (serial: number) => {
      const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ id: '1', changes: [{ field: 'messages', value: { messaging_product: 'whatsapp', metadata: { display_phone_number: '15550783881', phone_number_id: BOT_ENV.WHATSAPP_BOT_ACCOUNT_ID }, contacts: [{ profile: { name: 'Cliente' }, wa_id: WA_ID }], messages: [{ from: WA_ID, id: `wamid.S${String(serial)}`, timestamp: String(Math.floor(Date.now() / 1000)), type: 'text', text: { body: `consulta ${String(serial)}` } }] } }] }] });
      return fetch(`http://127.0.0.1:${String(webhookPort)}/webhooks/whatsapp`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-hub-signature-256': `sha256=${createHmac('sha256', BOT_ENV.WHATSAPP_BOT_APP_SECRET).update(body).digest('hex')}` }, body });
    };
    for (let serial = 0; serial < 7; serial += 1) await send(serial);
    const withBlock = await waitFor(() => call('', 'GET'), ({ text }) => /"id":\d+,"pending":false/.test(text));
    const live = JSON.parse(withBlock.text) as { bot: { blocks: Record<string, unknown>[]; reached: Record<string, unknown>[] } };
    expect(Object.keys(live.bot).sort()).toEqual(['blocks', 'canBlock', 'control', 'previousKeyBlocks', 'reached', 'status', 'storeHealthy', 'usage']);
    expect(Object.keys(live.bot.blocks[0] ?? {}).sort()).toEqual(['author', 'id', 'masked', 'origin', 'pending', 'reason', 'since', 'until']);
    expect(Object.keys(live.bot.reached[0] ?? {}).sort()).toEqual(['at', 'cap', 'masked', 'token']);
    await call(`/bloqueos/${String(live.bot.blocks[0]?.id)}/quitar`, 'POST', {});
    await send(99);
    await waitFor(() => readFile(salida, 'utf8'), () => true, 300);

    const rows = await context.prisma.botBlock.findMany();
    const audit = await context.prisma.botAudit.findMany();
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const { stdout, stderr } = api.output();
    const reviewed = { responses: responses.join('\n'), stdout, stderr, tables: JSON.stringify({ rows, audit }) };
    const everything = Object.values(reviewed).join('\n');
    for (const form of FORMS.slice(0, 3)) expect(everything).not.toContain(form);
    expect(reviewed.tables).not.toContain('55 1234 5678');
    for (const word of FORBIDDEN_WORDS) expect(reviewed.responses).not.toContain(word);
    for (const { phoneHash } of rows) {
      expect(`${reviewed.responses}${stdout}${stderr}`).not.toContain(phoneHash);
    }
    console.info(`QA-51 revisados: ${Object.entries(reviewed).map(([key, value]) => `${key}=${String(value.length)}`).join(' ')} bytes; filas bot_block=${String(rows.length)} bot_audit=${String(audit.length)}`);
  });
});
