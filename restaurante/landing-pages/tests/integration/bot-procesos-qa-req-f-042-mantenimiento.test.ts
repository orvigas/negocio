import { describe, expect, it } from 'vitest';

import { createPrismaBotControlStore } from '@restaurante/db/prisma-bot-control-store';

import { startStack, waitFor } from '../support/bot-procesos-qa-req-f-042.ts';
import { makeDatabase } from '../support/database.ts';

/**
 * QA de REQ-F-042 (PR 2): procesos reales de `api` y `landing-pages`. La preparación está en
 * tests/support/bot-procesos-qa-req-f-042.ts.
 */

describe('mantenimiento en un solo proceso (T-19, CA-13)', () => {
  it('una caducidad se audita una sola vez, solo en la api y sin repetirse al reiniciar', async () => {
    const database = await makeDatabase();
    const expired = async () => database.prisma.botAudit.count({ where: { action: 'block_expired' } });
    const store = createPrismaBotControlStore({ prisma: database.prisma });
    const past = new Date(Date.now() - 2 * 24 * 3600 * 1000);
    await store.addBlock(
      { phoneHash: 'a'.repeat(64), keyId: 'qa000000', last4: '0006', origin: 'tope', reason: null, expiresAt: new Date(past.getTime() + 3600 * 1000), masked: '*********0006', duration: '1 h' },
      { kind: 'system' },
      past,
    );
    try {
      const first = await startStack({ reuse: database, beforeApi: async () => expect(await expired()).toBe(0) });
      expect(await waitFor(expired, (count) => count > 0)).toBe(1);
      await first.stop();
      const second = await startStack({ reuse: database });
      await second.stop();
      expect(await expired()).toBe(1);
    } finally {
      await database.cleanup();
    }
  }, 60_000);
});
