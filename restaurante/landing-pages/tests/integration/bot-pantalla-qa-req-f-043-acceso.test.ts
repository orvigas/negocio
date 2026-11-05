import { afterEach, describe, expect, it } from 'vitest';

import { hashPassword } from '@restaurante/core/identity';
import { createUserRepository } from '@restaurante/db/user-repository';

import { TEST_HASH_PARAMS } from '../support/admin.ts';
import { runCleanups as runApiCleanups } from '../support/admin-bot-qa-req-f-043-proceso.ts';
import { PHONE, browser, csrfOf, runCleanups, signIn, startReal, TOKEN } from '../support/bot-pantalla-qa-req-f-043.ts';

/**
 * Sonda S-3 de QA de REQ-F-043, PR 2 (QA2-30 a QA2-35): acceso, CSRF, mismo origen y lista cerrada de
 * campos contra la `api` real.
 */

const EDITOR = { username: 'eli', password: 'contraseña-de-eli-QA-043-pr2' };

afterEach(async () => {
  await runCleanups();
  await runApiCleanups();
});

const posts = (csrf: string): [string, Record<string, string>][] => [
  ['/bot/interruptor', { _csrf: csrf, accion: 'pausar' }],
  ['/bot/bloqueos', { _csrf: csrf, telefono: PHONE, duracion: '7d' }],
  ['/bot/bloqueos/1/quitar', { _csrf: csrf }],
  [`/bot/topes/${TOKEN}/bloquear`, { _csrf: csrf, duracion: '7d' }],
];

describe('acceso a la pantalla', () => {
  it('QA2-30 a QA2-35', async () => {
    const s = await startReal();
    const unchanged = async () => {
      expect((await s.state()).control.paused).toBe(false);
      expect(await s.context.prisma.botBlock.count()).toBe(0);
      expect(await s.context.prisma.botAudit.count()).toBe(0);
    };
    const passwordHash = await hashPassword(EDITOR.password, TEST_HASH_PARAMS);
    await createUserRepository({ prisma: s.context.prisma }).create({ username: EDITOR.username, displayName: 'Eli Molotes', role: 'editor', businesses: ['molotes'], passwordHash }, { kind: 'system' });
    const editor = await signIn(s.inventory.url, EDITOR.username, EDITOR.password);

    // QA2-30.
    const home = await editor.get('/molotes/productos');
    expect(home.html).not.toContain('href="/bot"');
    expect(await s.page()).toContain('href="/bot"');
    const denied = await editor.get('/bot');
    expect(denied.status).toBe(403);
    expect(denied.html).not.toMatch(/Lista negra|Uso|name="telefono"|\*{9}/);

    // QA2-31: con cuerpo válido y vacío.
    const csrf = csrfOf(home.html);
    for (const [path, form] of posts(csrf)) {
      expect((await editor.post(path, form)).status, path).toBe(403);
      expect((await editor.post(path, {})).status, `${path} vacío`).toBe(403);
    }

    // QA2-32 (R-4): el formulario se mira antes que el rol, igual que en Usuarios.
    const rows: [string, number, number][] = [];
    const big = new URLSearchParams({ a: 'x'.repeat(70_000) }).toString();
    const bot = '/bot/interruptor';
    rows.push(['campo desconocido', (await editor.post(bot, { _csrf: csrf, otro: '1' })).status, (await editor.post('/usuarios', { _csrf: csrf, otro: '1' })).status]);
    rows.push(['cuerpo grande', (await editor.send(bot, big, 'application/x-www-form-urlencoded')).status, (await editor.send('/usuarios', big, 'application/x-www-form-urlencoded')).status]);
    rows.push(['otro tipo', (await editor.send(bot, 'hola', 'text/plain')).status, (await editor.send('/usuarios', 'hola', 'text/plain')).status]);
    console.log('QA2-32', JSON.stringify(rows));
    for (const [, botStatus, usersStatus] of rows) expect(botStatus).toBe(usersStatus);
    await unchanged();

    // QA2-33.
    const anon = browser(s.inventory.url);
    const goLogin = await anon.get('/bot');
    expect([goLogin.status, goLogin.location]).toEqual([303, '/acceso?next=%2Fbot']);
    for (const [path, form] of posts('x')) {
      const res = await anon.post(path, form);
      expect([res.status, res.location], path).toEqual([303, '/acceso?next=%2Fbot&expirada=1']);
    }
    const stale = browser(s.inventory.url, 'admin_sid=sesion-que-no-existe-en-la-api');
    expect((await stale.get('/bot')).location).toBe('/acceso?next=%2Fbot');

    // QA2-34: CSRF ausente o falso.
    for (const [path, form] of posts('falso')) {
      expect((await s.admin.post(path, form)).status, path).toBe(403);
      const sinToken = Object.fromEntries(Object.entries(form).filter(([name]) => name !== '_csrf'));
      expect((await s.admin.post(path, sinToken)).status, `${path} sin token`).toBe(403);
    }

    // QA2-35: otro origen y campos de más.
    const good = await s.csrf();
    for (const [path, form] of posts(good)) {
      expect((await s.admin.post(path, form, { Origin: 'https://evil.example', 'Sec-Fetch-Site': 'cross-site' })).status, path).toBe(403);
      expect((await s.admin.post(path, { ...form, role: 'admin' })).status, `${path} con campo de más`).toBe(400);
    }
    await unchanged();
  });
});
