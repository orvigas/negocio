import { afterEach, describe, expect, it } from 'vitest';

import type { Database } from '../../src/db/client.ts';
import { createPrismaBotControlStore } from '../../src/repositories/prisma-bot-control-store.ts';
import { createBotControl } from '../../src/services/bot-control.ts';
import { DEFAULT_BOT_LIMITS, MS } from '../../src/services/whatsapp-bot/protection/limits.ts';
import { makeRecordingLogger } from '../helpers.ts';
import { TEST_BOT_KEYS } from '../support/admin.ts';
import { makeDatabase, type TestDatabase } from '../support/database.ts';
import { mx } from '../support/whatsapp.ts';

/**
 * Store de la protección del bot sobre MySQL 8.4 real (REQ-F-025): lista negra sin dos bloqueos
 * activos del mismo número, contadores con incrementos concurrentes, interruptor que sobrevive a
 * un reinicio, retención (RF-10) y ningún número completo en ninguna columna (CA-15).
 */

const NUMBER = '5215500001234';
const databases: TestDatabase[] = [];
afterEach(async () => {
  while (databases.length > 0) await databases.pop()?.cleanup();
});

async function database(): Promise<TestDatabase> {
  const db = await makeDatabase();
  databases.push(db);
  return db;
}

async function makeAdmin(prisma: Database) {
  const user = await prisma.user.create({
    data: { username: 'duena', usernameKey: 'duena', displayName: 'Dueña', role: 'admin', passwordHash: 'scrypt$x', createdAt: new Date(), updatedAt: new Date() },
  });
  return { kind: 'user' as const, id: user.id, name: user.displayName };
}

function control(prisma: Database, clock: { now: Date }) {
  return createBotControl({
    store: createPrismaBotControlStore({ prisma }),
    keys: TEST_BOT_KEYS,
    limits: DEFAULT_BOT_LIMITS,
    timeZone: 'America/Mexico_City',
    staff: ['5215511110001'],
    logger: makeRecordingLogger(),
    now: () => clock.now,
  });
}

/** Todas las filas de las tablas del bot como texto. */
async function allRows(prisma: Database): Promise<string> {
  const rows = [await prisma.botBlock.findMany(), await prisma.botAudit.findMany(), await prisma.botUsage.findMany(), await prisma.botControl.findMany()];
  return JSON.stringify(rows);
}

describe('store de la protección del bot en MySQL (REQ-F-025)', () => {
  it('alta, baja, auditoría y unicidad del bloqueo activo con altas concurrentes', async () => {
    const { prisma } = await database();
    const admin = await makeAdmin(prisma);
    const clock = { now: mx('2026-10-14T10:00') };
    const bot = control(prisma, clock);
    await bot.init();
    const outcomes = await Promise.all([bot.blockManual(NUMBER, '7d', 'Abuso', admin), bot.blockManual('525500001234', '24h', null, admin)]);
    expect(outcomes.filter((outcome) => outcome === 'blocked')).toHaveLength(1);
    expect(await prisma.botBlock.count()).toBe(1);
    const [entry] = (await bot.snapshot()).blocks;
    expect(await bot.unblock(entry?.id ?? 0, admin)).toBe('1234');
    const audit = await prisma.botAudit.findMany({ orderBy: { id: 'asc' } });
    expect(audit.map((row) => [row.action, row.actorId, row.masked])).toEqual([
      ['block_added', admin.id, '*********1234'],
      ['block_removed', admin.id, '*********1234'],
    ]);
  });

  it('CA-12 y CA-5: el interruptor y los contadores se mantienen tras un reinicio', async () => {
    const { prisma } = await database();
    const admin = await makeAdmin(prisma);
    const clock = { now: mx('2026-10-14T10:00') };
    const first = control(prisma, clock);
    await first.init();
    await first.setPaused(true, admin, 'Incidente');
    for (let i = 0; i < 20; i += 1) first.usage.reserve('outbound', clock.now);
    first.usage.reserve('template', clock.now);
    await first.flush();

    const restarted = control(prisma, clock);
    await restarted.init();
    expect(restarted.isPaused()).toBe(true);
    const { usage } = await restarted.snapshot();
    expect(usage.day).toEqual({ period: '2026-10-14', templates: 1, outbound: 20 });
    expect(usage.month).toEqual({ period: '2026-10', templates: 1, outbound: 20 });
    expect(await prisma.botAudit.findFirst({ where: { action: 'bot_paused' } })).toMatchObject({ actorId: admin.id, reason: 'Incidente' });
  });

  it('RF-2.4: la marca de tope alcanzado se pone una sola vez por periodo', async () => {
    const { prisma } = await database();
    const store = createPrismaBotControlStore({ prisma });
    const at = mx('2026-10-14T10:00');
    const results = await Promise.all([store.markCapped('day', '2026-10-14', 'templates', at), store.markCapped('day', '2026-10-14', 'templates', at)]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await store.markCapped('day', '2026-10-14', 'outbound', at)).toBe(true);
  });

  it('RF-10 y CA-15: retención a los 30 días y a los 12 meses; ninguna columna guarda el número completo', async () => {
    const { prisma } = await database();
    const admin = await makeAdmin(prisma);
    const clock = { now: mx('2026-10-14T10:00') };
    const bot = control(prisma, clock);
    await bot.init();
    await bot.blockManual(NUMBER, '24h', 'Pedidos falsos', admin);
    bot.autoBlock('525500009876', 'repeticion');
    await bot.refresh();
    await bot.setPaused(true, admin, null);
    bot.usage.reserve('outbound', clock.now);
    await bot.flush();
    const rows = await allRows(prisma);
    for (const full of ['5215500001234', '525500001234', '5500001234', '525500009876', '5500009876']) expect(rows).not.toContain(full);

    clock.now = new Date(clock.now.getTime() + 2 * MS.day);
    await bot.maintenance();
    expect(await prisma.botAudit.count({ where: { action: 'block_expired' } })).toBe(2);
    clock.now = new Date(clock.now.getTime() + 31 * MS.day);
    await bot.maintenance();
    expect(await prisma.botBlock.count()).toBe(0);
    clock.now = new Date(clock.now.getTime() + 366 * MS.day);
    await bot.maintenance();
    expect(await prisma.botAudit.count()).toBe(0);
    expect(await prisma.botUsage.count({ where: { periodType: 'day' } })).toBe(0);
  });
});
