import { afterEach, describe, expect, it } from 'vitest';

import { BOT_ENV, TWILIO_BOT_ENV } from '../helpers.ts';
import { CUSTOMER, cleanups, runCleanups, start } from '../support/admin-bot-qa-req-f-043-acceso.ts';
import { adminSql } from '../support/database.ts';

/**
 * QA de REQ-F-043 (PR 1, sonda S-2): estado del bot y fallo parcial de la base de `/api/v1/admin/bot*` con el proceso real de la API contra
 * MySQL. Se arranca como proceso hijo: landing-pages nunca importa código de `api/`. Preparación en
 * tests/support/admin-bot-qa-req-f-043-acceso.ts.
 */

afterEach(runCleanups);

describe('validación y dominio: estado y base', () => {
  it('QA-35: el estado sale del bot realmente creado', async () => {
    const twilio = await start(TWILIO_BOT_ENV);
    expect((await twilio.state()).status).toEqual({ enabled: true, provider: 'twilio' });
    const only = await start({ WHATSAPP_BOT_PROVIDER: 'meta' });
    expect((await only.state()).status).toEqual({ enabled: false, provider: null });
  });

  it('QA-34: fallo parcial real: última copia en la lectura y 503 sin detalles en la escritura', async () => {
    const { context, api, json, raw, state } = await start({ ...BOT_ENV, BOT_CONTROL_REFRESH_SECONDS: '1' });
    expect((await json('/bot/bloqueos', 'POST', { phone: CUSTOMER, duration: '7d' })).status).toBe(201);
    const { name } = context.database;
    await adminSql(name, 'RENAME TABLE bot_block TO bot_block_qa');
    cleanups.push(() => adminSql(name, 'RENAME TABLE bot_block_qa TO bot_block').catch(() => undefined));
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const bot = await state();
    expect(bot.storeHealthy).toBe(false);
    expect(bot.blocks).toHaveLength(1);
    const res = await json('/bot/bloqueos', 'POST', { phone: '5215587654321', duration: '7d' });
    const text = await res.text();
    expect([res.status, JSON.parse(text)]).toMatchObject([503, { error: { code: 'DATABASE_UNAVAILABLE' } }]);
    for (const word of ['bot_block', 'Prisma', 'SELECT', 'INSERT', 'stack']) expect(text).not.toContain(word);
    expect((await raw('/bot', { session: undefined, method: 'GET' })).status).toBe(401);
    expect(api.output().stdout).not.toContain('5587654321');
    await adminSql(name, 'RENAME TABLE bot_block_qa TO bot_block');
    await new Promise((resolve) => setTimeout(resolve, 1200));
    expect((await state()).storeHealthy).toBe(true);
  });
});
