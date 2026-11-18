import { afterEach, describe, expect, it, vi } from 'vitest';

import { canonicalPhone, createBotControl, createMemoryBotControlStore, DEFAULT_BOT_LIMITS, MS, type BotControlStore } from '@restaurante/core/bot-control';
import type { BusinessId } from '@restaurante/core/shared';
import { silentLogger } from '@restaurante/core/shared';

import { CATALOG_RELOAD_MS, startCatalogReload } from '../../src/bot/catalog-reload.ts';
import { BOT_MAINTENANCE_MS, startBotControlTimers } from '../../src/bot/control-timers.ts';
import { BOT_ENV } from '../helpers.ts';

/**
 * Temporizadores del bot en la api (REQ-F-042): la pausa y los bloqueos que escribe otra instancia del
 * control sobre el mismo store (un hecho fuera del proceso) llegan al bot como mucho `refreshMs`
 * después, sin que llegue ningún mensaje (RF-9, CA-5); el mantenimiento horario audita cada caducidad
 * una sola vez (RF-11, CA-13); y la recarga del catálogo cada 60 s.
 */

const KEYS = { current: Buffer.from(BOT_ENV.WHATSAPP_BOT_BLOCKLIST_KEY), previous: undefined };
const CUSTOMER = canonicalPhone('5215512345678');
const ADMIN = { kind: 'user', id: 1, name: 'Ana' } as const;

afterEach(() => {
  vi.useRealTimers();
});

async function twoProcesses(store: BotControlStore = createMemoryBotControlStore()) {
  vi.useFakeTimers({ now: new Date('2026-10-20T16:00:00Z') });
  const common = { store, keys: KEYS, limits: DEFAULT_BOT_LIMITS, timeZone: 'America/Mexico_City', staff: [], logger: silentLogger };
  const writer = createBotControl(common);
  const bot = createBotControl(common);
  await writer.init();
  await bot.init();
  const stop = startBotControlTimers({ botControl: bot, refreshMs: DEFAULT_BOT_LIMITS.refreshMs });
  return { writer, bot, store, stop };
}

describe('refresco periódico del control en la api (RF-9, CA-5)', () => {
  it('una pausa escrita por otra instancia llega al bot pasados refreshMs, sin ningún mensaje; la reanudación también', async () => {
    const { writer, bot, stop } = await twoProcesses();
    try {
      await writer.setPaused(true, ADMIN, 'Incidente');
      // El estado del bot no cambia hasta su refresco (la copia en memoria).
      expect(bot.isPaused()).toBe(false);
      await vi.advanceTimersByTimeAsync(DEFAULT_BOT_LIMITS.refreshMs);
      // El primer mensaje después de refreshMs ya se descarta (antes, el refresco perezoso lo atendía).
      expect(bot.isPaused()).toBe(true);
      await writer.setPaused(false, ADMIN, null);
      await vi.advanceTimersByTimeAsync(DEFAULT_BOT_LIMITS.refreshMs);
      expect(bot.isPaused()).toBe(false);
    } finally {
      stop();
    }
  });

  it('un alta y una baja escritas por otra instancia llegan al bot pasados refreshMs (CA-5, CA-8)', async () => {
    const { writer, bot, stop } = await twoProcesses();
    try {
      expect(await writer.blockManual('+52 1 55 1234 5678', '7d', null, ADMIN)).toBe('blocked');
      expect(bot.isBlocked(CUSTOMER)).toBe(false);
      await vi.advanceTimersByTimeAsync(DEFAULT_BOT_LIMITS.refreshMs);
      expect(bot.isBlocked(CUSTOMER)).toBe(true);
      const [block] = (await writer.snapshot()).blocks;
      expect(await writer.unblock(block?.id ?? 0, ADMIN)).toBe('5678');
      await vi.advanceTimersByTimeAsync(DEFAULT_BOT_LIMITS.refreshMs);
      expect(bot.isBlocked(CUSTOMER)).toBe(false);
    } finally {
      stop();
    }
  });

  it('al detener los temporizadores ya no refresca', async () => {
    const { writer, bot, stop } = await twoProcesses();
    stop();
    await writer.setPaused(true, ADMIN, null);
    await vi.advanceTimersByTimeAsync(DEFAULT_BOT_LIMITS.refreshMs * 3);
    expect(bot.isPaused()).toBe(false);
  });
});

describe('mantenimiento solo en la api (RF-11, CA-13)', () => {
  it('cada hora audita cada caducidad una sola vez', async () => {
    const store = createMemoryBotControlStore();
    const { writer, stop } = await twoProcesses(store);
    const expired = async () => (await store.recentAudit(50)).filter((entry) => entry.action === 'block_expired').length;
    try {
      expect(await writer.blockManual('5215512345678', '24h', null, ADMIN)).toBe('blocked');
      await vi.advanceTimersByTimeAsync(MS.day + MS.minute);
      // Las 25 horas avanzadas ya incluían varias pasadas del mantenimiento: la caducidad se auditó en
      // la primera después de vencer.
      expect(await expired()).toBe(1);
      await vi.advanceTimersByTimeAsync(BOT_MAINTENANCE_MS * 2);
      expect(await expired()).toBe(1);
    } finally {
      stop();
    }
  });
});

describe('recarga periódica del catálogo del bot (REQ-F-039, RF-13: cada 60 s)', () => {
  it('cada 60 s recarga los dos negocios; al detenerla, ya no', () => {
    vi.useFakeTimers();
    const reloaded: BusinessId[] = [];
    const stop = startCatalogReload({ products: { reload: async (business) => (reloaded.push(business), true) } });
    vi.advanceTimersByTime(CATALOG_RELOAD_MS - 1);
    expect(reloaded).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(reloaded).toEqual(['molotes', 'birria']);
    vi.advanceTimersByTime(CATALOG_RELOAD_MS);
    expect(reloaded).toHaveLength(4);
    stop();
    vi.advanceTimersByTime(CATALOG_RELOAD_MS * 3);
    expect(reloaded).toHaveLength(4);
  });
});
