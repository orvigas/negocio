import { describe, expect, it } from 'vitest';
import { canonicalPhone, createBotControl, createMemoryBotControlStore, DEFAULT_BOT_LIMITS, MS, validateReason, type BotKeys, type MemoryBotControlStore } from '@restaurante/core/bot-control';


import { makeRecordingLogger } from '../helpers.ts';
import { mx } from '../support/whatsapp.ts';

/**
 * Estado compartido de la protección del bot (REQ-F-025): seudónimo y rotación de la clave (D-T1),
 * lista negra con altas manuales y automáticas (RF-3), copia en memoria con la base caída (RF-3.8,
 * CA-13), contadores pendientes y retención (RF-10, CA-15).
 */

const KEY_A: BotKeys = { current: Buffer.alloc(32, 1), previous: undefined };
const KEY_B: BotKeys = { current: Buffer.alloc(32, 2), previous: Buffer.alloc(32, 1) };
const NUMBER = '5215500001234';
const CANONICAL = '525500001234';
const STAFF = '5215511110001';
const ADMIN = { kind: 'user', id: 1, name: 'Dueña' } as const;

function setup({ keys = KEY_A, store = createMemoryBotControlStore(), start = mx('2026-10-14T10:00') }: { keys?: BotKeys | null; store?: MemoryBotControlStore; start?: Date } = {}) {
  const clock = { now: start };
  const logger = makeRecordingLogger();
  const control = createBotControl({ store, keys, limits: DEFAULT_BOT_LIMITS, timeZone: 'America/Mexico_City', staff: [STAFF], logger, now: () => clock.now });
  const advance = (ms: number) => {
    clock.now = new Date(clock.now.getTime() + ms);
  };
  return { control, store, logger, clock, advance };
}

/** Ningún dato guardado contiene el número completo (en ninguna de sus formas). */
function expectNoFullNumber(store: MemoryBotControlStore): void {
  const text = JSON.stringify(store.dump(), (_key, value: unknown) => (value instanceof Map ? Object.fromEntries(value) : value));
  expect(text).not.toContain(CANONICAL);
  expect(text).not.toContain('5500001234');
}

describe('lista negra seudonimizada (RF-3, D-T1, CA-9, CA-15)', () => {
  it('el alta manual guarda un HMAC, los 4 últimos dígitos y la auditoría enmascarada', async () => {
    const { control, store } = setup();
    await control.init();
    expect(await control.blockManual('+52 1 55 0000 1234', '24h', 'Pedidos falsos', ADMIN)).toBe('blocked');
    const [block] = store.dump().blocks;
    expect(block).toMatchObject({ last4: '1234', origin: 'manual', reason: 'Pedidos falsos', createdByName: 'Dueña' });
    expect(block?.phoneHash).toMatch(/^[0-9a-f]{64}$/);
    expect(store.dump().audit).toEqual([expect.objectContaining({ action: 'block_added', actorName: 'Dueña', masked: '*********1234', origin: 'manual', details: '1 d' })]);
    // CA-9: las dos formas del mismo número.
    expect(control.isBlocked(canonicalPhone(NUMBER))).toBe(true);
    expect(control.isBlocked(CANONICAL)).toBe(true);
    expectNoFullNumber(store);
  });

  it('rechaza el número del personal, un formato inválido, uno ya bloqueado y la falta de clave', async () => {
    const { control } = setup();
    await control.init();
    expect(await control.blockManual('525511110001', '7d', null, ADMIN)).toBe('staff');
    expect(await control.blockManual('12345', '7d', null, ADMIN)).toBe('invalid_phone');
    expect(await control.blockManual(NUMBER, '7d', null, ADMIN)).toBe('blocked');
    expect(await control.blockManual('5500001234', '30d', null, ADMIN)).toBe('already_blocked');
    const withoutKey = setup({ keys: null });
    await withoutKey.control.init();
    expect(withoutKey.control.canBlock).toBe(false);
    expect(await withoutKey.control.blockManual(NUMBER, '7d', null, ADMIN)).toBe('no_key');
  });

  it('CA-6: al vencer el plazo deja de estar bloqueado; la baja manual también lo quita y se audita', async () => {
    const { control, store, advance } = setup();
    await control.init();
    await control.blockManual(NUMBER, '24h', null, ADMIN);
    advance(24 * MS.hour + 1000);
    expect(control.isBlocked(CANONICAL)).toBe(false);
    await control.blockManual(NUMBER, 'permanente', null, ADMIN);
    const [active] = (await control.snapshot()).blocks;
    expect(active?.expiresAt).toBeNull();
    expect(await control.unblock(active?.id ?? 0, ADMIN)).toBe('1234');
    expect(control.isBlocked(CANONICAL)).toBe(false);
    expect(await control.unblock(active?.id ?? 0, ADMIN)).toBeNull();
    expect(store.dump().audit.map((entry) => entry.action)).toEqual(['block_added', 'block_added', 'block_removed']);
  });

  it('el personal nunca entra por un alta automática (RF-4)', async () => {
    const { control, store } = setup();
    await control.init();
    control.autoBlock(canonicalPhone(STAFF), 'tope');
    await control.refresh();
    expect(store.dump().blocks).toHaveLength(0);
  });

  it('RF-7.2: el escalón depende de los bloqueos automáticos de los últimos 30 días', async () => {
    const { control, store, advance } = setup();
    await control.init();
    const hours = () => {
      const last = store.dump().blocks.at(-1);
      return last?.expiresAt ? (last.expiresAt.getTime() - last.createdAt.getTime()) / MS.hour : null;
    };
    control.autoBlock(CANONICAL, 'repeticion');
    await control.refresh();
    expect(hours()).toBe(24);
    advance(2 * MS.day);
    control.autoBlock(CANONICAL, 'repeticion');
    await control.refresh();
    expect(hours()).toBe(7 * 24);
    advance(8 * MS.day);
    control.autoBlock(CANONICAL, 'repeticion');
    await control.refresh();
    expect(hours()).toBe(30 * 24);
    // RF-1.2: el del tope diario siempre es de 7 días.
    advance(31 * MS.day);
    control.autoBlock(CANONICAL, 'tope');
    await control.refresh();
    expect(hours()).toBe(7 * 24);
    expect(store.dump().audit.filter((entry) => entry.action === 'block_added').every((entry) => entry.actorKind === 'system')).toBe(true);
  });

  it('D-T1: con la clave rotada se sigue reconociendo y la entrada pasa a la clave nueva', async () => {
    const store = createMemoryBotControlStore();
    const before = setup({ store });
    await before.control.init();
    await before.control.blockManual(NUMBER, 'permanente', null, ADMIN);
    const oldHash = store.dump().blocks[0]?.phoneHash;

    const after = setup({ store, keys: KEY_B });
    await after.control.init();
    expect((await after.control.snapshot()).previousKeyBlocks).toBe(1);
    expect(after.control.isBlocked(CANONICAL)).toBe(true);
    await after.control.refresh();
    expect(store.dump().blocks[0]?.phoneHash).not.toBe(oldHash);
    expect((await after.control.snapshot()).previousKeyBlocks).toBe(0);

    // Solo con la clave nueva (sin la anterior) también se reconoce.
    const onlyNew = setup({ store, keys: { current: Buffer.alloc(32, 2), previous: undefined } });
    await onlyNew.control.init();
    expect(onlyNew.control.isBlocked(CANONICAL)).toBe(true);
  });
});

describe('base de datos caída (RF-3.8, CA-13)', () => {
  it('se aplica la última copia conocida de la lista negra y del interruptor, con un solo error registrado', async () => {
    const { control, store, logger, advance } = setup();
    await control.init();
    await control.blockManual(NUMBER, '7d', null, ADMIN);
    await control.setPaused(true, ADMIN, 'Prueba');
    store.failing = true;
    for (let i = 0; i < 5; i += 1) {
      advance(11_000);
      expect(control.isBlocked(CANONICAL)).toBe(true);
      expect(control.isPaused()).toBe(true);
      await control.refresh();
    }
    const failures = logger.lines.filter((line) => line.msg === 'bot_control_store_failed');
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({ level: 'error', operation: 'refresh', name: 'DatabaseUnavailableError' });
    store.failing = false;
    advance(11_000);
    await control.refresh();
    expect(logger.lines.filter((line) => line.msg === 'bot_control_store_recovered')).toHaveLength(1);
  });

  it('un alta automática surte efecto al instante y se guarda cuando vuelve la base', async () => {
    const { control, store } = setup();
    await control.init();
    store.failing = true;
    control.autoBlock(CANONICAL, 'tope');
    expect(control.isBlocked(CANONICAL)).toBe(true);
    await control.refresh();
    expect(control.isBlocked(CANONICAL)).toBe(true);
    store.failing = false;
    await control.refresh();
    expect(store.dump().blocks).toEqual([expect.objectContaining({ origin: 'tope', last4: '1234' })]);
    expect(control.isBlocked(CANONICAL)).toBe(true);
  });

  it('los contadores pendientes se guardan al volver la base (y al apagar)', async () => {
    const { control, store } = setup();
    await control.init();
    store.failing = true;
    for (let i = 0; i < 3; i += 1) control.usage.reserve('outbound', mx('2026-10-14T10:00'));
    await control.flush();
    store.failing = false;
    await control.flush();
    expect(store.dump().usage.get('day:2026-10-14')?.outbound).toBe(3);
    expect(store.dump().usage.get('month:2026-10')?.outbound).toBe(3);
  });
});

describe('interruptor y retención', () => {
  it('RF-9.1: cada cambio del interruptor queda en la auditoría y en el log', async () => {
    const { control, store, logger } = setup();
    await control.init();
    await control.setPaused(true, ADMIN, null);
    expect(control.isPaused()).toBe(true);
    await control.setPaused(false, ADMIN, 'Todo bien');
    expect(control.isPaused()).toBe(false);
    expect(store.dump().audit.map((entry) => [entry.action, entry.actorName, entry.reason])).toEqual([
      ['bot_paused', 'Dueña', null],
      ['bot_resumed', 'Dueña', 'Todo bien'],
    ]);
    expect(logger.lines.map((line) => line.msg)).toEqual(['bot_control_paused', 'bot_control_resumed']);
  });

  it('RF-10: audita las caducidades, borra lo vencido a los 30 días y la auditoría de más de 12 meses', async () => {
    const { control, store, advance } = setup();
    await control.init();
    await control.blockManual(NUMBER, '24h', null, ADMIN);
    advance(2 * MS.day);
    await control.maintenance();
    expect(store.dump().audit.map((entry) => entry.action)).toEqual(['block_added', 'block_expired']);
    expect(store.dump().blocks).toHaveLength(1);
    advance(30 * MS.day);
    await control.maintenance();
    expect(store.dump().blocks).toHaveLength(0);
    advance(365 * MS.day);
    await control.maintenance();
    expect(store.dump().audit).toHaveLength(0);
  });

  it('D-T4: el motivo admite texto, no números completos ni más de 200 caracteres', () => {
    expect(validateReason('  Pedidos   falsos ')).toEqual({ value: 'Pedidos falsos' });
    expect(validateReason('')).toEqual({ value: null });
    expect(validateReason('Llama al 55 1234 5678')).toEqual({ error: 'No escribas números de teléfono en el motivo.' });
    expect(validateReason('x'.repeat(201))).toHaveProperty('error');
    expect(validateReason('a\u0007b')).toHaveProperty('error');
  });
});

describe('alcanzaron un tope hoy (RF-6, D-T11)', () => {
  it('guarda solo el número enmascarado y un token de un solo uso; se vacía al cambiar el día', async () => {
    const { control, store, clock } = setup();
    await control.init();
    control.recordReached(CANONICAL, 'messages');
    control.recordReached(CANONICAL, 'messages');
    const { reached } = await control.snapshot();
    expect(reached).toEqual([{ token: expect.stringMatching(/^[0-9a-f]{32}$/), masked: '*********1234', cap: 'messages', at: clock.now }]);
    const token = reached[0]?.token ?? '';
    expect(await control.blockReached(token, '30d', null, ADMIN)).toBe('blocked');
    expect(await control.blockReached(token, '30d', null, ADMIN)).toBe('not_found');
    expect(control.isBlocked(CANONICAL)).toBe(true);
    expect(store.dump().blocks[0]).toMatchObject({ origin: 'manual', last4: '1234' });
    control.recordReached('525500009999', 'orders');
    clock.now = mx('2026-10-15T00:01');
    expect((await control.snapshot()).reached).toEqual([]);
  });
});
