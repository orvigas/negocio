import { describe, expect, it } from 'vitest';

import { textOf } from '../support/admin.ts';
import { BOT_PATH, startStack } from '../support/bot-procesos-qa-req-f-042.ts';

/**
 * QA de REQ-F-042 (PR 2): procesos reales de `api` y `landing-pages`. La preparación está en
 * tests/support/bot-procesos-qa-req-f-042.ts.
 */

describe('solo WHATSAPP_BOT_PROVIDER definido (N-06, CA-4)', () => {
  it('T-06, T-07 y N-06: la api en 503 y /admin dice "Desactivado"', async () => {
    const stack = await startStack({ env: { WHATSAPP_BOT_PROVIDER: 'meta' } });
    try {
      for (const method of ['GET', 'POST']) {
        const res = await fetch(stack.webhookUrl, { method });
        expect(res.status).toBe(503);
        expect(((await res.json()) as { error: { code: string } }).error.code).toBe('BOT_DISABLED');
      }
      expect(stack.apiLog().some((line) => line.msg === 'bot_provider_selected')).toBe(false);
      for (const path of ['/', '/molotes', '/birria']) expect((await fetch(`${stack.landing.url}${path}`)).status).toBe(200);
      const admin = await stack.adminBrowser();
      const page = textOf((await admin.get(BOT_PATH)).text);
      expect(page).toContain('Desactivado');
      expect(page).not.toContain('Habilitado');
    } finally {
      await stack.stop();
    }
  }, 60_000);
});
