import { afterEach, describe, expect, it, vi } from 'vitest';

import { canonicalPhone, createBotControl, createMemoryBotControlStore, DEFAULT_BOT_LIMITS, MS, type BotControlStore } from '@restaurante/core/bot-control';
import type { BusinessId } from '@restaurante/core/shared';
import { silentLogger } from '@restaurante/core/shared';

import { CATALOG_RELOAD_MS, startCatalogReload } from '../../src/bot/catalog-reload.ts';
import { BOT_MAINTENANCE_MS, startBotControlTimers } from '../../src/bot/control-timers.ts';
import { BOT_ENV } from '../helpers.ts';

/**
 * Temporizadores del bot en la api (REQ-F-042): la pausa y los bloqueos que cambia el /admin actual
 * (otro proceso, aquí otra instancia del control sobre el mismo store) llegan al bot como mucho
 * `refreshMs` después, sin que llegue ningún mensaje (RF-9, CA-5); el mantenimiento corre solo en la
 * api y cada caducidad se audita una vez (RF-11, CA-13); y la recarga del catálogo cada 60 s.
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
  const panel = createBotControl({ ...common, mode: 'panel' });
  const bot = createBotControl(common);
  await panel.init();
  await bot.init();
  const stop = startBotControlTimers({ botControl: bot, refreshMs: DEFAULT_BOT_LIMITS.refreshMs });
  return { panel, bot, store, stop };
}

describe('refresco periódico del control en la api (RF-9, CA-5)', () => {
  it('una pausa en /admin llega al bot pasados refreshMs, sin ningún mensaje; la reanudación también', async () => {
    const { panel, bot, stop } = await twoProcesses();
    try {
      await panel.setPaused(true, ADMIN, 'Incidente');
      // El estado del bot no cambia hasta su refresco (la copia en memoria).
      expect(bot.isPaused()).toBe(false);
      await vi.advanceTimersByTimeAsync(DEFAULT_BOT_LIMITS.refreshMs);
      // El primer mensaje después de refreshMs ya se descarta (antes, el refresco perezoso lo atendía).
      expect(bot.isPaused()).toBe(true);
      await panel.setPaused(false, ADMIN, null);
      await vi.advanceTimersByTimeAsync(DEFAULT_BOT_LIMITS.refreshMs);
      expect(bot.isPaused()).toBe(false);
    } finally {
      stop();
    }
  });

  it('un alta y una baja en /admin llegan al bot pasados refreshMs (CA-5, CA-8)', async () => {
    const { panel, bot, stop } = await twoProcesses();
    try {
      expect(await panel.blockManual('+52 1 55 1234 5678', '7d', null, ADMIN)).toBe('blocked');
      expect(bot.isBlocked(CUSTOMER)).toBe(false);
      await vi.advanceTimersByTimeAsync(DEFAULT_BOT_LIMITS.refreshMs);
      expect(bot.isBlocked(CUSTOMER)).toBe(true);
      const [block] = (await panel.snapshot()).blocks;
      expect(await panel.unblock(block?.id ?? 0, ADMIN)).toBe('5678');
      await vi.advanceTimersByTimeAsync(DEFAULT_BOT_LIMITS.refreshMs);
      expect(bot.isBlocked(CUSTOMER)).toBe(false);
    } finally {
      stop();
    }
  });

  it('al detener los temporizadores ya no refresca', async () => {
    const { panel, bot, stop } = await twoProcesses();
    stop();
    await panel.setPaused(true, ADMIN, null);
    await vi.advanceTimersByTimeAsync(DEFAULT_BOT_LIMITS.refreshMs * 3);
    expect(bot.isPaused()).toBe(false);
  });
});

describe('mantenimiento solo en la api (RF-11, CA-13)', () => {
  it('cada hora audita las caducidades una sola vez; el panel no audita', async () => {
    const store = createMemoryBotControlStore();
    const { panel, stop } = await twoProcesses(store);
    try {
      expect(await panel.blockManual('5215512345678', '24h', null, ADMIN)).toBe('blocked');
      await vi.advanceTimersByTimeAsync(MS.day + MS.minute);
      await panel.maintenance();
      const expiredBefore = (await store.recentAudit(50)).filter((entry) => entry.action === 'block_expired').length;
      await vi.advanceTimersByTimeAsync(BOT_MAINTENANCE_MS * 2);
      const expired = (await store.recentAudit(50)).filter((entry) => entry.action === 'block_expired');
      expect(expired).toHaveLength(1);
      // Las 25 horas avanzadas ya incluían varias pasadas del mantenimiento del bot: la caducidad se
      // auditó en la primera después de vencer, nunca en el panel.
      expect(expiredBefore).toBe(1);
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
