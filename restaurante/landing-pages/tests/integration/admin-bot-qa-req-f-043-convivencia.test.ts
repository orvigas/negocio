import { afterEach, describe, expect, it } from 'vitest';

import { BOT_ENV } from '../helpers.ts';
import { CUSTOMER, cleanups, runCleanups, type State } from '../support/admin-bot-qa-req-f-043-proceso.ts';
import { BOT_PATH, startStack, waitFor } from '../support/bot-procesos-qa-req-f-042.ts';
import { P } from '../support/users-api-process.ts';

/**
 * QA de REQ-F-043 (PR 1, sonda S-1): convivencia de la API con `/admin/bot` con los dos procesos
 * reales. Preparación en tests/support/admin-bot-qa-req-f-043-proceso.ts.
 */

afterEach(runCleanups);

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
