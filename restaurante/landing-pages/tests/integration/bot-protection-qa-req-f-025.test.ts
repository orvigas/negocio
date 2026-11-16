import { describe, expect, it, vi } from 'vitest';
import { canonicalPhone, createBotControl, DEFAULT_BOT_LIMITS } from '@restaurante/core/bot-control';
import { silentLogger } from '@restaurante/core/shared';
import { createPrismaBotControlStore } from '@restaurante/db/prisma-bot-control-store';

import { BOT_ENV } from '../helpers.ts';
import { ADMIN_PASSWORD, ADMIN_USER, TEST_BOT_KEYS, createUser, csrfFrom, loginAs, setupAdmin, textOf, type Browser } from '../support/admin.ts';

/**
 * Pruebas de QA de REQ-F-025 del lado de /admin. Desde REQ-F-042 el bot vive en la api: aquí el
 * proceso del bot se representa con su control (`createBotControl` en modo 'bot') sobre la misma base,
 * como en producción. La parte del bot (QA-T1, QA-T2 y los logs del bot en QA-T3) está en
 * api/tests/unit/bot-protection-qa-req-f-025.test.ts.
 *
 * - QA-T3: barrido de privacidad de /admin y de la base con un bloqueo automático del bot (CA-15).
 * - QA-T4 (REQ-F-042, CA-7): la lista "alcanzaron un tope hoy" y su botón ya no están en el /admin
 *   actual; la ruta del botón responde 410 al admin, 403 al editor y no bloquea nada.
 */

const PATH = '/admin/bot';

async function csrf(browser: Browser): Promise<string> {
  return csrfFrom((await browser.get(PATH)).text);
}

async function post(browser: Browser, path: string, fields: Record<string, string> = {}) {
  return browser.post(path).type('form').send({ _csrf: await csrf(browser), ...fields });
}

describe('QA-T3: barrido de privacidad de /admin y de la base (CA-15)', () => {
  it('ni el HTML, ni los logs, ni las 4 tablas contienen números completos, la clave o los seudónimos', async () => {
    const context = await setupAdmin({ env: BOT_ENV, botKeys: TEST_BOT_KEYS, botLimits: undefined });
    const admin = await loginAs(context.browser(), ADMIN_USER, ADMIN_PASSWORD);
    const abuser = '5215500007777';
    const manual = '5215500008888';
    const numbers = [abuser, manual].flatMap((n) => [n, canonicalPhone(n), n.slice(-10)]);
    const html: string[] = [];

    // El bot (la api) da de alta un bloqueo automático por el tope diario de mensajes y cuenta envíos.
    const bot = createBotControl({
      store: createPrismaBotControlStore({ prisma: context.prisma }),
      keys: TEST_BOT_KEYS,
      limits: DEFAULT_BOT_LIMITS,
      timeZone: 'America/Mexico_City',
      staff: [BOT_ENV.WHATSAPP_BOT_STAFF_MOLOTES, BOT_ENV.WHATSAPP_BOT_STAFF_BIRRIA],
      logger: context.logger,
      now: context.clock.now,
    });
    await bot.init();
    bot.autoBlock(canonicalPhone(abuser), 'tope');
    bot.usage.reserve('outbound', context.clock.now());
    await vi.waitFor(async () => expect(await context.prisma.botBlock.count({ where: { origin: 'tope' } })).toBe(1), { timeout: 10_000 });
    await bot.flush();

    // Alta manual con el número escrito con espacios y "+".
    html.push((await post(admin, `${PATH}/bloqueos`, { telefono: '+52 1 55 0000 8888', duracion: 'permanente', motivo: 'Spam' })).text);
    // Errores de formulario con el número escrito.
    html.push((await post(admin, `${PATH}/bloqueos`, { telefono: manual, duracion: '7d', motivo: '' })).text);
    html.push((await post(admin, `${PATH}/bloqueos`, { telefono: '5215500001111', duracion: '7d', motivo: 'llamar al 55 0000 1111' })).text);
    html.push((await post(admin, `${PATH}/bloqueos`, { telefono: BOT_ENV.WHATSAPP_BOT_STAFF_BIRRIA, duracion: '7d', motivo: '' })).text);
    // Interruptor.
    await post(admin, `${PATH}/interruptor`, { accion: 'pausar', motivo: 'QA' });
    await post(admin, `${PATH}/interruptor`, { accion: 'reanudar', motivo: '' });
    context.clock.advance(DEFAULT_BOT_LIMITS.refreshMs);
    const page = await admin.get(PATH);
    html.push(page.text);
    expect(textOf(page.text)).toContain('*********7777');
    html.push((await admin.get('/admin')).text);

    const blocks = await context.prisma.botBlock.findMany();
    expect(blocks.map((b) => b.origin).sort()).toEqual(['manual', 'tope']);
    const rows = JSON.stringify({
      blocks,
      audit: await context.prisma.botAudit.findMany(),
      usage: await context.prisma.botUsage.findMany(),
      control: await context.prisma.botControl.findMany(),
    });
    const logs = JSON.stringify(context.logger.lines);
    const hashes = blocks.map((b) => b.phoneHash);
    const secrets = [BOT_ENV.WHATSAPP_BOT_BLOCKLIST_KEY, '5500001111', BOT_ENV.WHATSAPP_BOT_STAFF_BIRRIA];

    for (const [name, text] of [['html', html.join('\n')], ['logs', logs], ['db', rows]] as const) {
      for (const n of [...numbers, ...secrets]) expect(text, `${name} contiene ${n.slice(-4)}`).not.toContain(n);
      if (name !== 'db') for (const hash of hashes) expect(text, `${name} contiene un seudónimo`).not.toContain(hash);
    }
    // La base guarda solo el seudónimo de 64 hex y los 4 últimos dígitos.
    for (const b of blocks) expect(b.phoneHash).toMatch(/^[0-9a-f]{64}$/);
  }, 60_000);
});

describe('QA-T4: la lista "alcanzaron un tope hoy" vuelve en el admin nuevo (REQ-F-042, RF-8, CA-7)', () => {
  it('la página muestra el aviso en lugar de la lista; el botón ya no existe y su ruta no bloquea nada', async () => {
    const context = await setupAdmin({ env: BOT_ENV, botKeys: TEST_BOT_KEYS });
    const admin = await loginAs(context.browser(), ADMIN_USER, ADMIN_PASSWORD);
    await createUser(context.users, { username: 'eva' });
    const editor = await loginAs(context.browser(), 'eva');
    // Aunque el control de este proceso tuviera una entrada (no la tiene: el bot vive en la api).
    context.botControl.recordReached(canonicalPhone('5215500004444'), 'messages');

    const page = await admin.get(PATH);
    expect(textOf(page.text)).toContain('La lista de números que alcanzaron un tope hoy está en el admin nuevo.');
    expect(page.text).not.toMatch(/\/admin\/bot\/topes\//);
    expect(textOf(page.text)).not.toContain('*********4444');

    const action = `${PATH}/topes/${'a'.repeat(32)}/bloquear`;
    const editorCsrf = csrfFrom((await editor.get('/admin/cuenta')).text);
    expect((await editor.post(action).type('form').send({ _csrf: editorCsrf, duracion: '24h', motivo: '' })).status).toBe(403);
    const gone = await post(admin, action, { duracion: '24h', motivo: '' });
    expect(gone.status).toBe(410);
    expect(textOf(gone.text)).toContain('está en el admin nuevo');
    // Sin CSRF, el mismo 403 que el resto de /admin.
    expect((await admin.post(action).type('form').send({ duracion: '24h', motivo: '' })).status).toBe(403);
    expect(await context.prisma.botBlock.count()).toBe(0);
  });

  it('el control de /admin es el panel: su mantenimiento no audita caducidades (RF-11, CA-13)', async () => {
    const context = await setupAdmin({ env: BOT_ENV, botKeys: TEST_BOT_KEYS });
    const admin = await loginAs(context.browser(), ADMIN_USER, ADMIN_PASSWORD);
    expect((await post(admin, `${PATH}/bloqueos`, { telefono: '5215500002222', duracion: '24h', motivo: '' })).status).toBe(303);
    context.clock.advance(25 * 60 * 60 * 1000);
    await context.botControl.maintenance();
    expect(await context.prisma.botAudit.count({ where: { action: 'block_expired' } })).toBe(0);

    // El proceso del bot (la api) la audita una sola vez.
    const bot = createBotControl({
      store: createPrismaBotControlStore({ prisma: context.prisma }),
      keys: TEST_BOT_KEYS,
      limits: DEFAULT_BOT_LIMITS,
      timeZone: 'America/Mexico_City',
      staff: [],
      logger: silentLogger,
      now: context.clock.now,
    });
    await bot.init();
    await bot.maintenance();
    await bot.maintenance();
    expect(await context.prisma.botAudit.count({ where: { action: 'block_expired' } })).toBe(1);
  });
});
