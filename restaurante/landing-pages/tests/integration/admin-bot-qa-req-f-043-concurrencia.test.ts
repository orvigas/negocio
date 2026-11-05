import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';

import { BOT_ENV } from '../helpers.ts';
import { ADMIN_PASSWORD, ADMIN_USER, setupAdmin } from '../support/admin.ts';
import { freePort, startServer } from '../support/process.ts';
import { databaseUrl } from '../support/test-database-config.ts';
import { API_ENTRY, P, nextIp } from '../support/users-api-process.ts';
import { join } from 'node:path';

/**
 * QA de REQ-F-043 (PR 1, sonda S-4): peticiones simultáneas con el proceso real de la API y MySQL. Nunca
 * dos bloqueos activos del mismo número, una sola baja y una sola fila de auditoría.
 */

const CUSTOMER = '5215512345678';

const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()?.();
});

async function start() {
  const context = await setupAdmin();
  const webhookPort = await freePort();
  const api = await startServer(
    { ...BOT_ENV, BOT_LIMIT_BURST: '2', WEBHOOK_PORT: String(webhookPort), DATABASE_URL: databaseUrl(context.database.config), INTERNAL_NOTIFY_TOKEN: undefined },
    60_000,
    { args: ['--import', join(process.cwd(), 'tests', 'support', 'salida-bot-doble.ts'), API_ENTRY] },
  );
  cleanups.push(() => api.stop());
  expect(api.started, api.output().stderr).toBe(true);
  const login = await fetch(`${api.url}${P}/sesion`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': nextIp() },
    body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASSWORD }),
  });
  const { session } = (await login.json()) as { session: { id: string; csrfToken: string } };
  const call = (path: string, method = 'GET', body?: unknown) =>
    fetch(`${api.url}${P}/bot${path}`, {
      method,
      headers: { authorization: `Bearer ${session.id}`, 'x-csrf-token': session.csrfToken, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  let serial = 0;
  const send = (from: string) => {
    serial += 1;
    const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ id: '1', changes: [{ field: 'messages', value: { messaging_product: 'whatsapp', metadata: { display_phone_number: '15550783881', phone_number_id: BOT_ENV.WHATSAPP_BOT_ACCOUNT_ID }, contacts: [{ profile: { name: 'Cliente' }, wa_id: from }], messages: [{ from, id: `wamid.C${String(serial)}`, timestamp: String(Math.floor(Date.now() / 1000)), type: 'text', text: { body: `texto ${String(serial)}` } }] } }] }] });
    return fetch(`http://127.0.0.1:${String(webhookPort)}/webhooks/whatsapp`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-hub-signature-256': `sha256=${createHmac('sha256', BOT_ENV.WHATSAPP_BOT_APP_SECRET).update(body).digest('hex')}` }, body });
  };
  return { context, call, send };
}
const sorted = (responses: Response[]) => responses.map(({ status }) => status).sort();

describe('QA-47: concurrencia con MySQL real', () => {
  it('5 altas simultáneas: una sola fila y una sola auditoría, y 5 bajas: una sola', async () => {
    const { context, call } = await start();
    const added = await Promise.all(Array.from({ length: 5 }, () => call('/bloqueos', 'POST', { phone: CUSTOMER, duration: '7d' })));
    expect(sorted(added)).toEqual([201, 409, 409, 409, 409]);
    expect(await context.prisma.botBlock.count()).toBe(1);
    expect(await context.prisma.botAudit.count({ where: { action: 'block_added' } })).toBe(1);
    const { bot } = (await (await call('')).json()) as { bot: { blocks: { id: number }[] } };
    expect(bot.blocks).toHaveLength(1);
    const id = bot.blocks[0]?.id ?? 0;
    const removed = await Promise.all(Array.from({ length: 5 }, () => call(`/bloqueos/${String(id)}/quitar`, 'POST', {})));
    expect(sorted(removed)).toEqual([200, 404, 404, 404, 404]);
    expect(await context.prisma.botAudit.count({ where: { action: 'block_removed' } })).toBe(1);
  });

  it('5 envíos simultáneos del mismo token: una sola fila', async () => {
    const { context, call, send } = await start();
    for (let index = 0; index < 4; index += 1) await send(CUSTOMER);
    const limit = Date.now() + 5000;
    let token = '';
    while (token === '' && Date.now() < limit) token = ((await (await call('')).json()) as { bot: { reached: { token: string }[] } }).bot.reached[0]?.token ?? '';
    expect(token).not.toBe('');
    const statuses = sorted(await Promise.all(Array.from({ length: 5 }, () => call(`/topes/${token}/bloquear`, 'POST', { duration: '7d' }))));
    expect(statuses.filter((status) => status === 201)).toHaveLength(1);
    expect(statuses.every((status) => [201, 404, 409].includes(status))).toBe(true);
    expect(await context.prisma.botBlock.count()).toBe(1);
    expect(await context.prisma.botAudit.count({ where: { action: 'block_added' } })).toBe(1);
  });
});
