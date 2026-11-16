import { describe, expect, it } from 'vitest';

import { canonicalPhone, createBotControl, createMemoryBotControlStore, DEFAULT_BOT_LIMITS, MS, type BotLimits } from '@restaurante/core/bot-control';
import { silentLogger } from '@restaurante/core/shared';

import { createBotProtection } from '../../src/bot/protection/protection.ts';

/**
 * Protección en `admit` tras los cambios de REQ-F-043: el personal que supera la ráfaga no entra en la
 * lista (H-1, CA-9) y quitar un bloqueo devuelve la atención de inmediato, con tope diario o con
 * enfriamiento (DT-1, CA-7).
 */

const CUSTOMER = '5215512345678';
const STAFF = '5215511110001';
const ADMIN = { kind: 'user', id: 1, name: 'Dueña' } as const;
const TIME_ZONE = 'America/Mexico_City';

async function setup(overrides: Partial<BotLimits> = {}) {
  const limits = { ...DEFAULT_BOT_LIMITS, burst: 100, messagesPerMinute: 1000, ...overrides };
  const clock = { now: new Date('2026-11-04T18:00:00Z') };
  const store = createMemoryBotControlStore();
  const control = createBotControl({ store, keys: { current: Buffer.alloc(32, 7), previous: undefined }, limits, timeZone: TIME_ZONE, staff: [STAFF], logger: silentLogger, now: () => clock.now });
  await control.init();
  const protection = createBotProtection({ control, limits, timeZone: TIME_ZONE, logger: silentLogger });
  const advance = (ms: number) => {
    clock.now = new Date(clock.now.getTime() + ms);
  };
  let serial = 0;
  const say = (from = CUSTOMER, text = `texto ${(serial += 1)}`) => {
    const verdict = protection.admit({ from, text }, clock.now.getTime(), 0);
    advance(MS.minute);
    return verdict;
  };
  /** Varios mensajes en el mismo instante. */
  const burst = (from: string, count: number) => Array.from({ length: count }, () => protection.admit({ from, text: `texto ${(serial += 1)}` }, clock.now.getTime(), 0));
  const unblockAll = async () => {
    await new Promise((resolve) => setImmediate(resolve));
    for (const block of (await control.snapshot()).blocks) await control.unblock(block.id, ADMIN);
  };
  return { control, say, burst, advance, unblockAll };
}

describe('personal (H-1, CA-9)', () => {
  it('superar la ráfaga no lo mete en la lista y se le sigue atendiendo pasada la ventana', async () => {
    const h = await setup({ burst: 2, burstWindowMs: 10 * MS.second });
    expect(h.burst(STAFF, 4)).toContain('drop');
    expect((await h.control.snapshot()).reached).toEqual([]);
    h.advance(MS.hour);
    expect(h.say(STAFF)).toBe('process');
  });

  it('un cliente que supera la ráfaga sí entra en la lista', async () => {
    const h = await setup({ burst: 2, burstWindowMs: 10 * MS.second });
    expect(h.burst(CUSTOMER, 4)).toContain('drop');
    expect((await h.control.snapshot()).reached.map(({ cap }) => cap)).toEqual(['burst']);
  });
});

describe('quitar un bloqueo devuelve la atención (DT-1, CA-7)', () => {
  it('tope diario: se atiende de inmediato y recupera el cupo del día', async () => {
    const h = await setup({ messagesPerNumberDay: 3 });
    expect([h.say(), h.say(), h.say(), h.say(), h.say()]).toEqual(['process', 'process', 'process', 'daily_notice', 'drop']);
    await h.unblockAll();
    expect([h.say(), h.say(), h.say()]).toEqual(['process', 'process', 'process']);
    // Con el cupo agotado de nuevo, la protección vuelve a actuar: el tope no quedó desactivado.
    expect(h.say()).toBe('daily_notice');
  });

  it('enfriamiento del bloqueo por repeticiones: se atiende de inmediato, sin esperar los 30 min', async () => {
    const h = await setup({ repeatCount: 2, repeatWindowMs: 10 * MS.minute, cooldownMs: 30 * MS.minute });
    expect([h.say(CUSTOMER, 'hola'), h.say(CUSTOMER, 'hola')]).toEqual(['process', 'drop']);
    expect(h.say(CUSTOMER, 'otro')).toBe('drop');
    h.advance(31 * MS.minute);
    expect([h.say(CUSTOMER, 'hola'), h.say(CUSTOMER, 'hola')]).toEqual(['process', 'drop']);
    await new Promise((resolve) => setImmediate(resolve));
    expect((await h.control.snapshot()).blocks.map(({ origin }) => origin)).toEqual(['repeticion']);

    await h.unblockAll();
    expect(h.say(CUSTOMER, 'ya me atienden')).toBe('process');
  });

  it('tras esa baja, repetir vuelve a contar como un primer enfriamiento: no bloquea de nuevo al instante', async () => {
    const h = await setup({ repeatCount: 2, repeatWindowMs: 10 * MS.minute, cooldownMs: 30 * MS.minute });
    h.say(CUSTOMER, 'hola');
    h.say(CUSTOMER, 'hola');
    h.advance(31 * MS.minute);
    h.say(CUSTOMER, 'hola');
    h.say(CUSTOMER, 'hola');
    await h.unblockAll();

    expect([h.say(CUSTOMER, 'hola'), h.say(CUSTOMER, 'hola')]).toEqual(['process', 'drop']);
    await new Promise((resolve) => setImmediate(resolve));
    expect((await h.control.snapshot()).blocks).toEqual([]);
    expect(h.say(CUSTOMER, 'otro')).toBe('drop');
  });

  it('solo alcanza al número que se quitó', async () => {
    const h = await setup({ messagesPerNumberDay: 1 });
    const OTHER = '5215500005678';
    h.say();
    h.say(OTHER);
    h.say();
    h.say(OTHER);
    await new Promise((resolve) => setImmediate(resolve));
    const { blocks } = await h.control.snapshot();
    const mine = blocks.find((block) => block.last4 === canonicalPhone(CUSTOMER).slice(-4));
    await h.control.unblock(mine!.id, ADMIN);
    expect(h.say()).toBe('process');
    expect(h.say(OTHER)).toBe('drop');
  });

  it('un bloqueo manual también: el número no hereda un enfriamiento previo', async () => {
    const h = await setup({ repeatCount: 2, repeatWindowMs: 10 * MS.minute, cooldownMs: 30 * MS.minute });
    h.say(CUSTOMER, 'hola');
    h.say(CUSTOMER, 'hola');
    expect(await h.control.blockManual(CUSTOMER, '7d', null, ADMIN)).toBe('blocked');
    await h.unblockAll();
    expect(h.say(CUSTOMER, 'otro')).toBe('process');
  });

  it('un enfriamiento sin bloqueo sigue su curso', async () => {
    const h = await setup({ repeatCount: 2, repeatWindowMs: 10 * MS.minute, cooldownMs: 30 * MS.minute });
    h.say(CUSTOMER, 'hola');
    h.say(CUSTOMER, 'hola');
    await h.unblockAll();
    expect(h.say(CUSTOMER, 'otro')).toBe('drop');
  });
});
