import { afterEach, describe, expect, it } from 'vitest';

import { CUSTOMER, runCleanups, start } from '../support/admin-bot-qa-req-f-043-proceso.ts';

/**
 * QA de REQ-F-043 (PR 1, sonda S-1): efecto inmediato de pausa, alta y baja con el proceso real.
 * Preparación en tests/support/admin-bot-qa-req-f-043-proceso.ts.
 */

afterEach(runCleanups);

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
});
