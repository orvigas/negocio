import { afterEach, expect, it } from 'vitest';

import { BOT_ENV } from '../helpers.ts';
import { runCleanups as runApiCleanups } from '../support/admin-bot-qa-req-f-043-proceso.ts';
import { PHONE, csrfOf, noPhone, runCleanups, startReal } from '../support/bot-pantalla-qa-req-f-043.ts';

/**
 * Sonda S-4 de QA de REQ-F-043, PR 2 (QA2-24, QA2-25, QA2-27 y QA2-28; CA-15): el número conocido no
 * aparece en HTML, `Location`, logs de ambos procesos ni tablas, y no se expone nada seudonimizado.
 */

afterEach(async () => {
  await runCleanups();
  await runApiCleanups();
});

it('alta correcta, fallidas, baja y parámetros manipulados', async () => {
  const s = await startReal();
  const seen: string[] = [];
  const keep = <T extends { html: string; location: string }>(res: T): T => {
    seen.push(res.html, res.location);
    return res;
  };
  const csrf = await s.csrf();
  const add = keep(await s.admin.post('/bot/bloqueos', { _csrf: csrf, telefono: PHONE, duracion: '7d', motivo: '<script>alert(1)</script>"\'{{ csrfToken }}' }));
  expect(add.status).toBe(303);
  keep(await s.admin.post('/bot/bloqueos', { _csrf: csrf, telefono: PHONE, duracion: '7d' }));
  keep(await s.admin.post('/bot/bloqueos', { _csrf: csrf, telefono: `+52 55 9876 5432`, duracion: '7d' }));
  keep(await s.admin.post('/bot/bloqueos', { _csrf: csrf, telefono: `${PHONE}999999`, duracion: 'mal' }));
  keep(await s.admin.post('/bot/bloqueos', { _csrf: 'falso', telefono: PHONE, duracion: '7d' }));
  keep(await s.admin.post('/bot/bloqueos', { _csrf: csrf, telefono: PHONE, duracion: '7d', otro: PHONE }));
  keep(await s.admin.post('/bot/interruptor', { _csrf: csrf, accion: 'pausar', motivo: PHONE }));
  const page = keep(await s.admin.get(add.location));

  // QA2-28: motivo escapado.
  expect(page.html).not.toContain('<script>alert');
  expect(page.html).toContain('&lt;script&gt;alert(1)');
  expect(page.html).toContain('{{ csrfToken }}');

  // QA2-27: parámetros de la URL.
  for (const query of ['ok=__proto__', 'ok=constructor', 'ok=<b>x</b>', 'ok=blocked&ok=paused', 'n=1234']) {
    const res = keep(await s.admin.get(`/bot?${query}`));
    expect(res.status, query).toBe(200);
    expect(res.html, query).not.toContain('<b>x</b>');
    expect(res.html, query).not.toContain('Número bloqueado.');
  }
  for (const query of ['ok=blocked&n=<script>', `ok=blocked&n=${PHONE}`]) {
    const res = keep(await s.admin.get(`/bot?${query}`));
    expect(res.html, query).toContain('Número bloqueado.');
    expect(res.html, query).not.toContain('<script>');
  }
  const good = keep(await s.admin.get('/bot?ok=blocked&n=5432'));
  expect(good.html).toContain('*********5432');

  // QA2-24: baja y búsqueda del número en todo lo observado.
  const [block] = (await s.state()).blocks;
  keep(await s.admin.post(`/bot/bloqueos/${String(block?.id)}/quitar`, { _csrf: csrfOf(page.html) }));
  const rows = JSON.stringify([await s.context.prisma.botBlock.findMany(), await s.context.prisma.botAudit.findMany()]);
  const api = JSON.stringify(await s.state());
  const logs = s.logs();
  for (const [where, content] of [['respuestas', seen.join('\n')], ['logs', logs], ['tablas', rows], ['api', api]] as const) {
    noPhone(content, where);
    console.log('QA2-24', where, content.length, 'caracteres');
  }

  // Los logs revisados no están vacíos: traen las operaciones de ambos procesos.
  expect(logs).toContain('"msg":"bot_block_added"');
  expect(s.inventory.output().stdout).toContain('"msg":"server_started"');

  // QA2-25: nada seudonimizado fuera de la base.
  for (const content of [seen.join('\n'), api]) expect(content).not.toMatch(/phoneHash|keyId|phone_hash|key_id/);
  expect(logs).not.toContain(BOT_ENV.WHATSAPP_BOT_BLOCKLIST_KEY);
});
