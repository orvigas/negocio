import { describe, expect, it } from 'vitest';

import { canonicalPhone, createBotControl, createMemoryBotControlStore, DEFAULT_BOT_LIMITS, type BotControlStore } from '@restaurante/core/bot-control';
import { silentLogger } from '@restaurante/core/shared';

/**
 * "Alcanzaron un tope hoy" en el control del bot (REQ-F-043): el personal no aparece (H-1, CA-9), un
 * token de otro día no vale (H-7, CA-10) y el número sale con todos sus topes (H-8, CA-8).
 */

const STAFF = canonicalPhone('5215511110001');
const CUSTOMER = canonicalPhone('5215512345678');
const ADMIN = { kind: 'user', id: 1, name: 'Dueña' } as const;
const KEYS = { current: Buffer.alloc(32, 7), previous: undefined };

async function setup(store: BotControlStore = createMemoryBotControlStore()) {
  const clock = { now: new Date('2026-11-04T18:00:00Z') };
  const control = createBotControl({ store, keys: KEYS, limits: DEFAULT_BOT_LIMITS, timeZone: 'America/Mexico_City', staff: ['5215511110001'], logger: silentLogger, now: () => clock.now });
  await control.init();
  return { control, clock };
}

describe('personal (H-1, D-3)', () => {
  it('no entra en la lista por ningún tope', async () => {
    const { control } = await setup();
    for (const cap of ['burst', 'minute', 'messages', 'cooldown', 'orders'] as const) control.recordReached(STAFF, cap);
    expect((await control.snapshot()).reached).toEqual([]);
  });
});

describe('token de un solo uso del día del negocio (H-7, CA-10)', () => {
  it('uno de ayer no bloquea, aunque nadie haya vuelto a mirar la lista', async () => {
    const { control, clock } = await setup();
    control.recordReached(CUSTOMER, 'burst');
    const [entry] = (await control.snapshot()).reached;
    clock.now = new Date('2026-11-05T18:00:00Z');
    expect(control.reachedLast4(entry!.token)).toBeNull();
    expect(await control.blockReached(entry!.token, '7d', null, ADMIN)).toBe('not_found');
    expect(control.isBlocked(CUSTOMER)).toBe(false);
  });

  it('el mismo día de la zona del negocio sigue valiendo, aunque en UTC ya sea mañana', async () => {
    const { control, clock } = await setup();
    clock.now = new Date('2026-11-05T02:00:00Z');
    control.recordReached(CUSTOMER, 'burst');
    const [entry] = (await control.snapshot()).reached;
    clock.now = new Date('2026-11-05T05:59:00Z');
    expect(await control.blockReached(entry!.token, '7d', null, ADMIN)).toBe('blocked');
  });

  it('usado o inexistente no bloquea', async () => {
    const { control } = await setup();
    control.recordReached(CUSTOMER, 'burst');
    const [entry] = (await control.snapshot()).reached;
    expect(await control.blockReached(entry!.token, '7d', null, ADMIN)).toBe('blocked');
    expect(await control.blockReached(entry!.token, '7d', null, ADMIN)).toBe('not_found');
    expect(await control.blockReached('0'.repeat(32), '7d', null, ADMIN)).toBe('not_found');
  });
});

describe('salida de la lista (H-8, CA-8)', () => {
  it('un número con dos topes sale entero al bloquearlo', async () => {
    const { control } = await setup();
    control.recordReached(CUSTOMER, 'burst');
    control.recordReached(CUSTOMER, 'minute');
    const { reached } = await control.snapshot();
    expect(reached).toHaveLength(2);
    expect(await control.blockReached(reached[0]!.token, '7d', null, ADMIN)).toBe('blocked');
    expect((await control.snapshot()).reached).toEqual([]);
    expect(control.isBlocked(CUSTOMER)).toBe(true);
  });

  it('ya bloqueado: no duplica y sale de la lista', async () => {
    const store = createMemoryBotControlStore();
    const { control } = await setup(store);
    control.recordReached(CUSTOMER, 'messages');
    control.autoBlock(CUSTOMER, 'tope');
    await Promise.resolve();
    const [entry] = (await control.snapshot()).reached;
    expect(await control.blockReached(entry!.token, '7d', null, ADMIN)).toBe('already_blocked');
    expect((await control.snapshot()).reached).toEqual([]);
    expect(store.dump().blocks).toHaveLength(1);
  });

  it('si la base falla, conserva la entrada para reintentar', async () => {
    const memory = createMemoryBotControlStore();
    let failing = false;
    const { control } = await setup({
      ...memory,
      addBlock: (...args) => (failing ? Promise.reject(new Error('caída')) : memory.addBlock(...args)),
    });
    control.recordReached(CUSTOMER, 'burst');
    const [entry] = (await control.snapshot()).reached;
    failing = true;
    await expect(control.blockReached(entry!.token, '7d', null, ADMIN)).rejects.toThrow('caída');
    failing = false;
    expect(await control.blockReached(entry!.token, '7d', null, ADMIN)).toBe('blocked');
  });
});

describe('marca de bloqueo quitado (DT-1)', () => {
  it('solo se consume una vez, y solo para el número que se quitó', async () => {
    const { control } = await setup();
    expect(await control.blockManual(CUSTOMER, '7d', null, ADMIN)).toBe('blocked');
    const [block] = (await control.snapshot()).blocks;
    expect(control.takeReleased(CUSTOMER)).toBe(false);
    await control.unblock(block!.id, ADMIN);
    expect(control.takeReleased(STAFF)).toBe(false);
    expect(control.takeReleased(CUSTOMER)).toBe(true);
    expect(control.takeReleased(CUSTOMER)).toBe(false);
  });

  it('un id que no existe no marca nada', async () => {
    const { control } = await setup();
    expect(await control.unblock(99, ADMIN)).toBeNull();
    expect(control.takeReleased(CUSTOMER)).toBe(false);
  });
});
