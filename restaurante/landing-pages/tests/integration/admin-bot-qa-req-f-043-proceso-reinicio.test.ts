import { afterEach, describe, expect, it } from 'vitest';

import { CUSTOMER, STAFF, runCleanups, start } from '../support/admin-bot-qa-req-f-043-proceso.ts';
import { P } from '../support/users-api-process.ts';

/**
 * QA de REQ-F-043 (PR 1, sonda S-1): lista de topes, reinicio real y puerto del webhook con el proceso
 * real. Preparación en tests/support/admin-bot-qa-req-f-043-proceso.ts.
 */

afterEach(runCleanups);

describe('efecto inmediato con el proceso real (R-1): lista, reinicio y webhook', () => {
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
