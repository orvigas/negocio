import { afterEach, expect, it } from 'vitest';

import { setupAdmin } from '../support/admin.ts';
import { databaseUrl } from '../support/test-database-config.ts';
import { freePort, startServer } from '../support/process.ts';
import { API_ENTRY } from '../support/users-api-process.ts';
import { PHONE, csrfOf, noPhone, runCleanups, signIn, startInventory, cleanups } from '../support/bot-pantalla-qa-req-f-043.ts';

/** Sonda S-1b de QA de REQ-F-043, PR 2 (QA2-08, QA2-09, CA-13 y CA-20): bot sin configurar y sin clave, contra la `api` real. */

afterEach(runCleanups);

it('QA2-08 y QA2-09: dice "Desactivado", permite pausar y no ofrece el alta', async () => {
  const context = await setupAdmin();
  const api = await startServer({ DATABASE_URL: databaseUrl(context.database.config), WEBHOOK_PORT: String(await freePort()), INTERNAL_NOTIFY_TOKEN: undefined }, 60_000, { args: [API_ENTRY] });
  cleanups.push(() => api.stop());
  expect(api.started, api.output().stderr).toBe(true);
  const inventory = await startInventory(api.url);
  const admin = await signIn(inventory.url);
  const page = (await admin.get('/bot')).html;
  expect(page).toContain('Desactivado');
  expect(page).not.toContain('name="telefono"');
  expect(page).toContain('WHATSAPP_BOT_BLOCKLIST_KEY');
  const add = await admin.post('/bot/bloqueos', { _csrf: csrfOf(page), telefono: PHONE, duracion: '7d' });
  expect(add.status).toBe(409);
  expect(add.html).toContain('role="alert"');
  noPhone(add.html, 'HTML');
  expect(await context.prisma.botBlock.count()).toBe(0);
  const pause = await admin.post('/bot/interruptor', { _csrf: csrfOf(page), accion: 'pausar', motivo: 'Sin bot' });
  expect([pause.status, pause.location]).toEqual([303, '/bot?ok=paused']);
  expect((await context.prisma.botAudit.findMany()).map(({ action }) => action)).toEqual(['bot_paused']);
});
