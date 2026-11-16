import { describe, expect, it } from 'vitest';

import { botStateResponseSchema } from '@restaurante/contracts';
import { canonicalPhone, createMemoryBotControlStore, DEFAULT_BOT_LIMITS, MS, type BotControl, type BotControlStore } from '@restaurante/core/bot-control';
import { DatabaseUnavailableError, silentLogger } from '@restaurante/core/shared';

import { createBotProtection } from '../../src/bot/protection/protection.ts';
import { ADMIN, BOT_STAFF, TEST_BOT_KEYS, call, session, startAdmin, type AdminHarness, type BotOptions, type Session } from '../support/admin.ts';

/**
 * Efectos del control del bot por `/api/v1/admin` (REQ-F-043) sobre la protección real, con la misma
 * instancia de `BotControl` y sin esperar ningún refresco: pausa (CA-3), alta (CA-5), baja (CA-7),
 * "alcanzaron un tope hoy" (CA-8 a CA-11), uso (CA-12), rotación (CA-14), privacidad (CA-15) y fallos
 * de la base (RF-12, CA-19).
 */

const P = '/api/v1/admin/bot';
const CUSTOMER = '5215512345678';
const KNOWN_FULL = [CUSTOMER, canonicalPhone(CUSTOMER), CUSTOMER.slice(-10)];
const canonical = canonicalPhone(CUSTOMER);
const databaseDown = () => new DatabaseUnavailableError({ name: 'PrismaClientKnownRequestError', code: 'P1001', originalCode: undefined });

const protectionOf = (control: BotControl, limits = DEFAULT_BOT_LIMITS) => createBotProtection({ control, limits, timeZone: 'America/Mexico_City', logger: silentLogger });

async function setup(bot: BotOptions = {}) {
  const h = await startAdmin({ bot });
  const auth = await session(h.url, ADMIN);
  const protection = protectionOf(h.botControl, bot.limits);
  let serial = 0;
  const say = (from = CUSTOMER) => protection.admit({ from, text: `texto ${(serial += 1)}` }, h.clock.now.getTime(), 0);
  return { h, auth, say };
}

const state = async (h: AdminHarness, auth: Session) => botStateResponseSchema.parse(await (await call(h.url, P, auth)).json()).bot;
const post = (h: AdminHarness, auth: Session, path: string, body: unknown = {}) => call(h.url, `${P}${path}`, auth, { method: 'POST', body });
const audits = async (h: AdminHarness) => h.botStore.recentAudit(20);
const settle = () => new Promise((resolve) => setImmediate(resolve));

/** Pasa la medianoche del negocio sin caducar la sesión (2 h de inactividad) ni leer la lista. */
async function pastMidnight(h: AdminHarness, auth: Session) {
  for (let step = 0; step < 9; step += 1) {
    h.clock.now = new Date(h.clock.now.getTime() + 90 * MS.minute);
    await call(h.url, '/api/v1/admin/sesion', auth);
  }
}

describe('efecto inmediato en el bot', () => {
  it('CA-3: pausar descarta el siguiente mensaje sin esperar el refresco y queda en bot_audit', async () => {
    const { h, auth, say } = await setup();
    expect(say()).toBe('process');
    await call(h.url, `${P}/interruptor`, auth, { method: 'PUT', body: { paused: true, reason: 'Gasto raro' } });
    expect(say()).toBe('drop');
    expect((await audits(h))[0]).toMatchObject({ action: 'bot_paused', actorKind: 'user', actorName: ADMIN.displayName, reason: 'Gasto raro' });
    await call(h.url, `${P}/interruptor`, auth, { method: 'PUT', body: { paused: false } });
    expect(say()).toBe('process');
    expect((await audits(h))[0]).toMatchObject({ action: 'bot_resumed' });
  });

  it('dos pausas seguidas: gana la última y las dos quedan en la auditoría', async () => {
    const { h, auth } = await setup();
    await call(h.url, `${P}/interruptor`, auth, { method: 'PUT', body: { paused: true, reason: 'Una' } });
    await call(h.url, `${P}/interruptor`, auth, { method: 'PUT', body: { paused: true, reason: 'Dos' } });
    expect((await state(h, auth)).control.reason).toBe('Dos');
    expect(await audits(h)).toHaveLength(2);
  });

  it('CA-5: bloquear 7 días hace que el bot lo ignore y la lista lo muestre enmascarado', async () => {
    const { h, auth, say } = await setup();
    expect(say()).toBe('process');
    expect((await post(h, auth, '/bloqueos', { phone: CUSTOMER, duration: '7d', reason: 'Abuso' })).status).toBe(201);
    expect(say()).toBe('drop');
    const { blocks } = await state(h, auth);
    expect(blocks).toEqual([
      {
        id: expect.any(Number) as number,
        pending: false,
        masked: '*********5678',
        origin: 'manual',
        reason: 'Abuso',
        author: ADMIN.displayName,
        since: '2026-10-26T12:00:00-06:00',
        until: '2026-11-02T12:00:00-06:00',
      },
    ]);
    expect((await audits(h))[0]).toMatchObject({ action: 'block_added', masked: '*********5678', origin: 'manual', details: '7 d', reason: 'Abuso' });
  });

  it.each(['24h', '30d', 'permanente'])('acepta la duración %s', async (duration) => {
    const { h, auth } = await setup();
    expect((await post(h, auth, '/bloqueos', { phone: CUSTOMER, duration })).status).toBe(201);
    const [block] = (await state(h, auth)).blocks;
    expect(block?.until === null).toBe(duration === 'permanente');
  });

  it('CA-7: quitar un bloqueo manual vuelve a atender el número y queda en bot_audit', async () => {
    const { h, auth, say } = await setup();
    await post(h, auth, '/bloqueos', { phone: CUSTOMER, duration: '7d' });
    const [block] = (await state(h, auth)).blocks;
    const res = await post(h, auth, `/bloqueos/${block?.id}/quitar`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ block: { masked: '*********5678' } });
    expect(say()).toBe('process');
    expect((await audits(h))[0]).toMatchObject({ action: 'block_removed', masked: '*********5678', actorName: ADMIN.displayName });
    expect((await state(h, auth)).blocks).toEqual([]);
    expect((await post(h, auth, `/bloqueos/${block?.id}/quitar`)).status).toBe(404);
  });

  it('CA-7 y DT-1: quitar un bloqueo automático por tope diario devuelve la atención hoy mismo', async () => {
    const { h, auth, say } = await setup({ limits: { ...DEFAULT_BOT_LIMITS, messagesPerNumberDay: 2 } });
    expect([say(), say(), say()]).toEqual(['process', 'process', 'daily_notice']);
    await settle();
    expect(say()).toBe('drop');
    const [block] = (await state(h, auth)).blocks;
    expect(block).toMatchObject({ origin: 'tope', author: null });
    expect((await post(h, auth, `/bloqueos/${block?.id}/quitar`)).status).toBe(200);
    expect(say()).toBe('process');
    expect((await audits(h))[0]).toMatchObject({ action: 'block_removed', origin: 'tope' });
  });

  it('CA-7 y DT-1: quitar un bloqueo automático por repeticiones levanta también el enfriamiento', async () => {
    const limits = { ...DEFAULT_BOT_LIMITS, repeatCount: 2 };
    const { h, auth } = await setup({ limits });
    const protection = protectionOf(h.botControl, limits);
    const repeat = () => protection.admit({ from: CUSTOMER, text: 'hola' }, h.clock.now.getTime(), 0);
    repeat();
    repeat();
    h.clock.now = new Date(h.clock.now.getTime() + 31 * MS.minute);
    repeat();
    repeat();
    await settle();
    expect(protection.admit({ from: CUSTOMER, text: 'otro' }, h.clock.now.getTime(), 0)).toBe('drop');
    const [block] = (await state(h, auth)).blocks;
    expect(block).toMatchObject({ origin: 'repeticion' });
    await post(h, auth, `/bloqueos/${block?.id}/quitar`);
    expect(protection.admit({ from: CUSTOMER, text: 'otro' }, h.clock.now.getTime(), 0)).toBe('process');
  });

  it('RF-6: un alta automática sin guardar sale como pendiente y no se puede quitar', async () => {
    const memory = createMemoryBotControlStore();
    const { h, auth } = await setup({ store: { ...memory, addBlock: () => Promise.reject(databaseDown()) } });
    h.botControl.autoBlock(canonical, 'tope');
    await settle();
    expect((await state(h, auth)).blocks).toMatchObject([{ id: null, pending: true, masked: '*********5678', origin: 'tope' }]);
  });
});

describe('alcanzaron un tope hoy (RF-5)', () => {
  it('CA-8: aparece enmascarado con su tope; al bloquearlo queda bloqueado y sale de la lista', async () => {
    const { h, auth, say } = await setup({ limits: { ...DEFAULT_BOT_LIMITS, burst: 1 } });
    say();
    expect(say()).toBe('drop');
    const { reached } = await state(h, auth);
    expect(reached).toEqual([{ token: expect.stringMatching(/^[0-9a-f]{32}$/) as string, masked: '*********5678', cap: 'burst', at: '2026-10-26T12:00:00-06:00' }]);
    const res = await post(h, auth, `/topes/${reached[0]?.token}/bloquear`, { duration: '24h', reason: 'Ráfagas' });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ block: { masked: '*********5678' } });
    const after = await state(h, auth);
    expect(after.reached).toEqual([]);
    expect(after.blocks).toMatchObject([{ masked: '*********5678', origin: 'manual', reason: 'Ráfagas' }]);
    expect((await audits(h))[0]).toMatchObject({ action: 'block_added', details: '1 d', reason: 'Ráfagas' });
  });

  it('CA-9: el personal que supera la ráfaga no aparece y no hay petición que lo bloquee', async () => {
    const { h, auth, say } = await setup({ limits: { ...DEFAULT_BOT_LIMITS, burst: 1 } });
    say(BOT_STAFF);
    expect(say(BOT_STAFF)).toBe('drop');
    expect((await state(h, auth)).reached).toEqual([]);
    for (const token of ['0'.repeat(32), 'f'.repeat(32)]) expect((await post(h, auth, `/topes/${token}/bloquear`, { duration: '7d' })).status).toBe(404);
    expect(await audits(h)).toEqual([]);
    expect(h.botControl.isBlocked(canonicalPhone(BOT_STAFF))).toBe(false);
  });

  it('CA-10: el reenvío de un token usado y un token de ayer dan 404 sin escribir', async () => {
    const { h, auth } = await setup();
    h.botControl.recordReached(canonical, 'burst');
    const [first] = (await state(h, auth)).reached;
    await post(h, auth, `/topes/${first?.token}/bloquear`, { duration: '7d' });
    const written = (await audits(h)).length;
    expect((await post(h, auth, `/topes/${first?.token}/bloquear`, { duration: '7d' })).status).toBe(404);

    h.botControl.recordReached(canonicalPhone('5215500005678'), 'burst');
    const [second] = (await state(h, auth)).reached;
    await pastMidnight(h, auth);
    expect((await post(h, auth, `/topes/${second?.token}/bloquear`, { duration: '7d' })).status).toBe(404);
    expect(await audits(h)).toHaveLength(written);
  });

  it('CA-10 y caso límite: un número con bloqueo automático aparece en las dos listas y bloquearlo da 409', async () => {
    const { h, auth, say } = await setup({ limits: { ...DEFAULT_BOT_LIMITS, messagesPerNumberDay: 1 } });
    expect([say(), say()]).toEqual(['process', 'daily_notice']);
    await settle();
    const { reached, blocks } = await state(h, auth);
    expect(reached).toHaveLength(1);
    expect(blocks).toHaveLength(1);
    const res = await post(h, auth, `/topes/${reached[0]?.token}/bloquear`, { duration: '7d' });
    expect(res.status).toBe(409);
    expect((await state(h, auth)).blocks).toHaveLength(1);
  });

  it('medianoche del negocio: la lista empieza vacía', async () => {
    const { h, auth } = await setup();
    h.botControl.recordReached(canonical, 'burst');
    await pastMidnight(h, auth);
    expect((await state(h, auth)).reached).toEqual([]);
  });

  it('CA-11: tras reiniciar, la lista está vacía y siguen la lista negra, el interruptor y los contadores', async () => {
    const store = createMemoryBotControlStore();
    const { h, auth } = await setup({ store });
    h.botControl.recordReached(canonicalPhone('5215500005678'), 'burst');
    await post(h, auth, '/bloqueos', { phone: CUSTOMER, duration: '7d' });
    await call(h.url, `${P}/interruptor`, auth, { method: 'PUT', body: { paused: true } });
    h.botControl.usage.reserve('outbound', h.clock.now);
    await h.botControl.flush();

    const restarted = await setup({ store });
    const after = await state(restarted.h, restarted.auth);
    expect(after.reached).toEqual([]);
    expect(after.blocks).toHaveLength(1);
    expect(after.control.paused).toBe(true);
    expect(after.usage.counters.find(({ id }) => id === 'outbound_day')?.used).toBe(1);
  });
});

describe('uso (RF-4, CA-12)', () => {
  it('devuelve los valores vigentes; el presupuesto va en micro-USD', async () => {
    const { h, auth } = await setup({ limits: { ...DEFAULT_BOT_LIMITS, outboundDay: 2 } });
    h.botControl.usage.reserve('outbound', h.clock.now);
    h.botControl.usage.reserve('outbound', h.clock.now);
    h.botControl.usage.reserve('template', h.clock.now);
    expect((await state(h, auth)).usage.counters).toEqual([
      { id: 'templates_day', used: 1, limit: DEFAULT_BOT_LIMITS.templatesDay, reached: false },
      { id: 'templates_month', used: 1, limit: DEFAULT_BOT_LIMITS.templatesMonth, reached: false },
      { id: 'outbound_day', used: 2, limit: 2, reached: true },
      { id: 'outbound_month', used: 2, limit: DEFAULT_BOT_LIMITS.outboundMonth, reached: false },
      { id: 'budget', used: DEFAULT_BOT_LIMITS.utilityCostMicros, limit: DEFAULT_BOT_LIMITS.budgetMonthMicros, reached: false },
    ]);
  });
});

describe('rotación (RF-8, CA-14)', () => {
  it('cuenta los bloqueos con la clave anterior; con 0, cero', async () => {
    const store = createMemoryBotControlStore();
    const { h, auth } = await setup({ store });
    await post(h, auth, '/bloqueos', { phone: CUSTOMER, duration: '7d' });
    expect((await state(h, auth)).previousKeyBlocks).toBe(0);

    const rotated = await setup({ store, keys: { current: Buffer.alloc(32, 9), previous: TEST_BOT_KEYS.current } });
    expect((await state(rotated.h, rotated.auth)).previousKeyBlocks).toBe(1);
  });
});

describe('privacidad (RF-9, CA-15)', () => {
  it('el número no aparece completo en respuestas, logs ni datos guardados, y tampoco el seudónimo', async () => {
    const store = createMemoryBotControlStore();
    const { h, auth } = await setup({ store });
    const bodies: string[] = [];
    const keep = async (res: Promise<Response>) => bodies.push(await (await res).text());
    await keep(post(h, auth, '/bloqueos', { phone: CUSTOMER, duration: '7d' }));
    await keep(post(h, auth, '/bloqueos', { phone: CUSTOMER, duration: '7d' }));
    await keep(post(h, auth, '/bloqueos', { phone: '123', duration: '7d' }));
    h.botControl.recordReached(canonicalPhone('5215500005678'), 'burst');
    await keep(call(h.url, P, auth));
    const [block] = (await state(h, auth)).blocks;
    await keep(post(h, auth, `/bloqueos/${block?.id}/quitar`));

    const { blocks, audit } = store.dump();
    const hash = blocks[0]?.phoneHash ?? '';
    const responses = bodies.join('\n');
    for (const word of ['phoneHash', 'keyId', 'last4', hash]) expect(responses).not.toContain(word);
    expect(h.logger.lines.join('\n')).not.toContain(hash);
    const saved = JSON.stringify({ blocks, audit });
    const everything = [responses, h.logger.lines.join('\n'), saved].join('\n');
    for (const full of KNOWN_FULL) expect(everything).not.toContain(full);
    expect(responses).toContain('*********5678');
  });
});

describe('fallos de la base (RF-12)', () => {
  function flaky() {
    const memory = createMemoryBotControlStore();
    const state = { failing: false };
    const guard = <R>(task: () => Promise<R>): Promise<R> => (state.failing ? Promise.reject(databaseDown()) : task());
    const store: BotControlStore = {
      ...memory,
      activeBlocks: (...args) => guard(() => memory.activeBlocks(...args)),
      getControl: () => guard(() => memory.getControl()),
      setControl: (...args) => guard(() => memory.setControl(...args)),
      addBlock: (...args) => guard(() => memory.addBlock(...args)),
      removeBlock: (...args) => guard(() => memory.removeBlock(...args)),
    };
    return { store, state };
  }

  it('CA-19: una lectura con la base fallando dice que es la última copia conocida', async () => {
    const { store, state: db } = flaky();
    const { h, auth } = await setup({ store });
    await post(h, auth, '/bloqueos', { phone: CUSTOMER, duration: '7d' });
    db.failing = true;
    await h.botControl.refresh();
    const bot = await state(h, auth);
    expect(bot.storeHealthy).toBe(false);
    expect(bot.blocks).toHaveLength(1);
    db.failing = false;
    await h.botControl.refresh();
    expect((await state(h, auth)).storeHealthy).toBe(true);
  });

  it('una escritura con la base caída da 503 sin detalles y nada cambia en el bot', async () => {
    const { store, state: db } = flaky();
    const { h, auth, say } = await setup({ store });
    db.failing = true;
    const paused = await call(h.url, `${P}/interruptor`, auth, { method: 'PUT', body: { paused: true } });
    expect(paused.status).toBe(503);
    expect(await paused.json()).toEqual({ error: { code: 'DATABASE_UNAVAILABLE', message: 'Servicio no disponible temporalmente.' } });
    expect((await post(h, auth, '/bloqueos', { phone: CUSTOMER, duration: '7d' })).status).toBe(503);
    expect(say()).toBe('process');
  });
});
