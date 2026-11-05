import { afterEach, describe, expect, it } from 'vitest';

import { BOT_ENV } from '../helpers.ts';
import { setupAdmin } from '../support/admin.ts';
import { CUSTOMER, STAFF, TOKEN, cleanups, runCleanups, start } from '../support/admin-bot-qa-req-f-043-acceso.ts';
import { startServer } from '../support/process.ts';
import { databaseUrl } from '../support/test-database-config.ts';
import { API_ENTRY } from '../support/users-api-process.ts';

/**
 * QA de REQ-F-043 (PR 1, sonda S-2): validación y casos negativos de `/api/v1/admin/bot*` con el proceso real de la API contra
 * MySQL. Se arranca como proceso hijo: landing-pages nunca importa código de `api/`. Preparación en
 * tests/support/admin-bot-qa-req-f-043-acceso.ts.
 */

afterEach(runCleanups);

describe('validación y dominio', () => {
  it('QA-30: el motivo', async () => {
    const { json, state } = await start(BOT_ENV);
    const put = async (body: unknown) => (await json('/bot/interruptor', 'PUT', body)).status;
    for (const reason of ['12345678', 'tel 5512345678 ya', 'a'.repeat(201), 123, null, {}]) {
      expect([reason, await put({ paused: true, reason })]).toEqual([reason, 422]);
      expect((await state()).control.paused).toBe(false);
    }
    for (const paused of ['true', 1, null, undefined]) expect(await put({ paused })).toBe(422);
    expect((await state()).control.paused).toBe(false);
    expect(await put({ paused: true, reason: '1234567' })).toBe(200);
    expect((await state()).control.reason).toBe('1234567');
    expect(await put({ paused: false, reason: 'a'.repeat(200) })).toBe(200);
    expect(await put({ paused: true, reason: '   ' })).toBe(200);
    expect((await state()).control).toMatchObject({ paused: true, reason: null });
  });

  it('QA-31 y QA-32: teléfonos y ids', async () => {
    const { context, json, state, tables } = await start(BOT_ENV);
    const post = (body: unknown) => json('/bot/bloqueos', 'POST', body);
    for (const phone of ['12345', 'abc', '', 123, null, '1234567890123456', '55-1234-567x']) expect([phone, (await post({ phone, duration: '7d' })).status]).toEqual([phone, 422]);
    for (const phone of [STAFF, '525511110001', '5511110001', '+52 1 55 1111 0001', BOT_ENV.WHATSAPP_BOT_STAFF_BIRRIA]) expect([phone, (await post({ phone, duration: '7d' })).status]).toEqual([phone, 422]);
    for (const duration of ['1d', '', 7, undefined, 'constructor', '__proto__']) expect([duration, (await post({ phone: CUSTOMER, duration })).status]).toEqual([duration, 422]);
    expect((await tables()).blocks).toBe(0);

    expect((await post({ phone: CUSTOMER, duration: '7d' })).status).toBe(201);
    for (const phone of ['+52 55 1234 5678', '525512345678', '5512345678', '(55) 1234-5678', '+52 1 55 1234 5678']) expect([phone, (await post({ phone, duration: '24h' })).status]).toEqual([phone, 409]);
    expect((await tables()).blocks).toBe(1);

    const id = (await state()).blocks[0]?.id ?? 0;
    expect((await json(`/bot/bloqueos/${String(id)}/quitar`, 'POST', {})).status).toBe(200);
    const statuses: Record<string, number> = {};
    for (const bad of [String(id), '0', '-1', '1e3', '999999', '2147483647', '2147483648', '4294967296', '9999999999', '99999999999']) {
      statuses[bad] = (await json(`/bot/bloqueos/${bad}/quitar`, 'POST', {})).status;
    }
    expect(statuses).toEqual(Object.fromEntries(Object.keys(statuses).map((key) => [key, 404])));
    expect(await context.prisma.botAudit.count({ where: { action: 'block_removed' } })).toBe(1);
  });

  it('QA-33, QA-35 y QA-38: sin bot, sin clave, sin personal', async () => {
    const { context, api, raw, json, state } = await start({ WHATSAPP_BOT_BLOCKLIST_KEY: BOT_ENV.WHATSAPP_BOT_BLOCKLIST_KEY });
    expect(api.started).toBe(true);
    const bot = await state();
    expect(bot.status).toEqual({ enabled: false, provider: null });
    expect(bot.canBlock).toBe(false);
    for (const body of [{ phone: CUSTOMER, duration: '7d' }, { phone: 'x', duration: 'y' }, { phone: STAFF, duration: '7d' }]) {
      const res = await json('/bot/bloqueos', 'POST', body);
      expect([res.status, ((await res.json()) as { error: { code: string } }).error.code]).toEqual([409, 'BOT_KEY_MISSING']);
    }
    expect((await raw('/bot/bloqueos', { session: undefined, method: 'POST' })).status).toBe(401);
    expect((await json(`/bot/topes/${TOKEN}/bloquear`, 'POST', { duration: '7d' })).status).toBe(404);
    expect(await context.prisma.botBlock.count()).toBe(0);
    expect((await json('/bot/interruptor', 'PUT', { paused: true })).status).toBe(200);
  });

  it('QA-33: con bot y sin clave, la API no arranca', async () => {
    const context = await setupAdmin();
    const api = await startServer({ ...BOT_ENV, WHATSAPP_BOT_BLOCKLIST_KEY: undefined, DATABASE_URL: databaseUrl(context.database.config), INTERNAL_NOTIFY_TOKEN: undefined }, 20_000, { args: [API_ENTRY] });
    cleanups.push(() => api.stop());
    expect(api.started).toBe(false);
    expect(api.output().stderr).toContain('WHATSAPP_BOT_BLOCKLIST_KEY');
  });
});
