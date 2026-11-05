import { describe, expect, it } from 'vitest';

import { canonicalPhone, createBotControl, createMemoryBotControlStore, DEFAULT_BOT_LIMITS, MS, type BotControlStore, type BotKeys, type ControlState } from '@restaurante/core/bot-control';
import { silentLogger } from '@restaurante/core/shared';

/**
 * QA de REQ-F-043 (PR 1, sonda S-5): `BotControl` con reloj inyectado y store envuelto: la lista
 * "alcanzaron un tope hoy" (H-7, H-8), la rotación de claves, el tope de 1000 marcas y el refresco
 * en curso que no debe pisar una escritura.
 */

const TIME_ZONE = 'America/Mexico_City';
const ADMIN = { kind: 'user', id: 1, name: 'Dueña' } as const;
const CUSTOMER = '525512345678';
const KEY_A = Buffer.alloc(32, 7);
const KEY_B = Buffer.alloc(32, 9);

async function setup({ keys = { current: KEY_A, previous: undefined }, store = createMemoryBotControlStore(), start = '2026-11-04T18:00:00Z', timeZone = TIME_ZONE }: { keys?: BotKeys; store?: BotControlStore; start?: string; timeZone?: string } = {}) {
  const clock = { now: new Date(start) };
  const control = createBotControl({ store, keys, limits: DEFAULT_BOT_LIMITS, timeZone, staff: ['5215511110001'], logger: silentLogger, now: () => clock.now });
  await control.init();
  return { control, clock, store, advance: (ms: number) => (clock.now = new Date(clock.now.getTime() + ms)) };
}
const numberAt = (index: number) => `5255${String(10_000_000 + index)}`;

describe('alcanzaron un tope hoy', () => {
  it.each(['orders', 'messages', 'cooldown', 'burst', 'minute'] as const)('QA-10: el tope %s entra enmascarado', async (cap) => {
    const { control } = await setup();
    control.recordReached(CUSTOMER, cap);
    const { reached } = await control.snapshot();
    expect(reached).toMatchObject([{ masked: '*********5678', cap }]);
    expect(JSON.stringify(reached)).not.toContain(CUSTOMER);
    expect(reached[0]?.token).toMatch(/^[0-9a-f]{32}$/);
  });

  it('QA-11: un número con los 5 topes sale entero al bloquearlo y también si da 409', async () => {
    const first = await setup();
    for (const cap of ['orders', 'messages', 'cooldown', 'burst', 'minute'] as const) first.control.recordReached(CUSTOMER, cap);
    first.control.recordReached('525500000001', 'burst');
    const list = (await first.control.snapshot()).reached;
    const token = list.find((entry) => entry.masked.endsWith('5678'))?.token ?? '';
    expect(await first.control.blockReached(token, '7d', null, ADMIN)).toBe('blocked');
    expect((await first.control.snapshot()).reached.map(({ masked }) => masked)).toEqual(['*********0001']);

    const second = await setup();
    second.control.recordReached(CUSTOMER, 'burst');
    second.control.recordReached(CUSTOMER, 'minute');
    await second.control.blockManual(CUSTOMER, '7d', null, ADMIN);
    const entry = (await second.control.snapshot()).reached[0];
    expect(await second.control.blockReached(entry?.token ?? '', '7d', null, ADMIN)).toBe('already_blocked');
    const after = await second.control.snapshot();
    expect(after.reached).toEqual([]);
    expect(after.blocks).toHaveLength(1);
  });

  it('QA-13: el token vence a las 00:00:00 del negocio, aunque nadie mire la lista', async () => {
    const { control, advance } = await setup({ start: '2026-11-05T05:59:59Z' }); // 23:59:59 en CDMX
    control.recordReached(CUSTOMER, 'burst');
    const token = (await control.snapshot()).reached[0]?.token ?? '';
    advance(1000);
    expect(control.reachedLast4(token)).toBeNull();
    expect(await control.blockReached(token, '7d', null, ADMIN)).toBe('not_found');
    expect((await control.snapshot()).blocks).toEqual([]);
  });

  it('QA-13: a las 23:59:59 sigue valiendo', async () => {
    const { control, advance } = await setup({ start: '2026-11-05T05:59:58Z' });
    control.recordReached(CUSTOMER, 'burst');
    const token = (await control.snapshot()).reached[0]?.token ?? '';
    advance(1000);
    expect(await control.blockReached(token, '7d', null, ADMIN)).toBe('blocked');
  });

  it('QA-39: con horario de verano, el día es el de la zona del negocio', async () => {
    const { control, advance } = await setup({ start: '2026-07-15T06:59:59Z', timeZone: 'America/Tijuana' }); // 23:59:59 PDT
    control.recordReached(CUSTOMER, 'burst');
    const token = (await control.snapshot()).reached[0]?.token ?? '';
    advance(1000);
    expect(await control.blockReached(token, '7d', null, ADMIN)).toBe('not_found');
  });

  it('QA-14: un token usado o inexistente no bloquea', async () => {
    const { control } = await setup();
    control.recordReached(CUSTOMER, 'burst');
    const token = (await control.snapshot()).reached[0]?.token ?? '';
    expect(await control.blockReached(token, '7d', null, ADMIN)).toBe('blocked');
    expect(await control.blockReached(token, '7d', null, ADMIN)).toBe('not_found');
    expect(await control.blockReached('0'.repeat(32), '7d', null, ADMIN)).toBe('not_found');
    expect((await control.snapshot()).blocks).toHaveLength(1);
  });
});

describe('rotación (QA-16)', () => {
  it('cuenta la clave anterior, libera el número con su hash anterior y con 0 no cuenta nada', async () => {
    const store = createMemoryBotControlStore();
    const before = await setup({ store });
    await before.control.blockManual(CUSTOMER, '7d', null, ADMIN);
    expect((await before.control.snapshot()).previousKeyBlocks).toBe(0);

    const { control } = await setup({ store, keys: { current: KEY_B, previous: KEY_A } });
    const snapshot = await control.snapshot();
    expect(snapshot.previousKeyBlocks).toBe(1);
    await control.unblock(snapshot.blocks[0]?.id ?? 0, ADMIN);
    expect(control.takeReleased(canonicalPhone(CUSTOMER))).toBe(true);
    expect(control.takeReleased(canonicalPhone(CUSTOMER))).toBe(false);
    expect((await control.snapshot()).previousKeyBlocks).toBe(0);
  });
});

describe('marcas de bloqueo quitado (QA-37)', () => {
  it('con 1001 bajas solo se olvida la más antigua', async () => {
    const { control } = await setup();
    for (let index = 0; index < 1001; index += 1) await control.blockManual(numberAt(index), '7d', null, ADMIN);
    for (const block of [...(await control.snapshot()).blocks].sort((a, b) => a.id - b.id)) await control.unblock(block.id, ADMIN);
    expect(control.takeReleased(numberAt(0))).toBe(false);
    expect(control.takeReleased(numberAt(1))).toBe(true);
    expect(control.takeReleased(numberAt(1000))).toBe(true);
  });

  it('observación (DEF-TRIVIAL de QA): con el conjunto lleno, repetir un número ya marcado expulsa a otro', async () => {
    const { control } = await setup();
    for (let index = 0; index < 1000; index += 1) await control.blockManual(numberAt(index), '7d', null, ADMIN);
    for (const block of [...(await control.snapshot()).blocks].sort((a, b) => a.id - b.id)) await control.unblock(block.id, ADMIN);
    await control.blockManual(numberAt(999), '7d', null, ADMIN);
    await control.unblock((await control.snapshot()).blocks[0]?.id ?? 0, ADMIN);
    expect(control.takeReleased(numberAt(0))).toBe(false);
  });
});

describe('refresco en curso (QA-65)', () => {
  /** Store cuya siguiente lectura de `activeBlocks` y `getControl` devuelve lo leído antes y espera a `release`. */
  function delayed(store: BotControlStore) {
    let gate: { read: Promise<unknown>; open: () => void } | null = null;
    const wrapped: BotControlStore = {
      ...store,
      activeBlocks: async (at) => {
        const rows = await store.activeBlocks(at);
        if (gate) await gate.read;
        return rows;
      },
      getControl: async () => {
        const state: ControlState = await store.getControl();
        if (gate) await gate.read;
        return state;
      },
    };
    return {
      wrapped,
      hold: () => {
        let open = () => undefined as void;
        const read = new Promise<void>((resolve) => (open = resolve));
        gate = { read, open };
        return () => {
          gate = null;
          open();
        };
      },
    };
  }

  it('una pausa, un alta y una baja escritas durante el refresco no se pierden', async () => {
    const base = createMemoryBotControlStore();
    const { wrapped, hold } = delayed(base);
    const { control } = await setup({ store: wrapped });
    await control.blockManual('525500000002', '7d', null, ADMIN);
    const id = (await control.snapshot()).blocks[0]?.id ?? 0;

    const release = hold();
    const refreshing = control.refresh();
    await control.setPaused(true, ADMIN, 'durante el refresco');
    await control.blockManual(CUSTOMER, '7d', null, ADMIN);
    await control.unblock(id, ADMIN);
    release();
    await refreshing;

    expect(control.isPaused()).toBe(true);
    expect(control.isBlocked(canonicalPhone(CUSTOMER))).toBe(true);
    expect(control.isBlocked('525500000002')).toBe(false);
  });
});

describe('observación de la marca sin consumir (QA-36)', () => {
  it('un nuevo bloqueo no borra la marca: sigue disponible al caducar', async () => {
    const { control, advance } = await setup();
    await control.blockManual(CUSTOMER, '7d', null, ADMIN);
    await control.unblock((await control.snapshot()).blocks[0]?.id ?? 0, ADMIN);
    await control.blockManual(CUSTOMER, '24h', null, ADMIN);
    advance(25 * MS.hour);
    expect(control.isBlocked(CUSTOMER)).toBe(false);
    expect(control.takeReleased(CUSTOMER)).toBe(true);
  });
});
