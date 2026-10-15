import { describe, expect, it, vi } from 'vitest';

import { canonicalPhone } from '../../src/services/whatsapp-bot/phone.ts';
import { MS } from '../../src/services/whatsapp-bot/protection/limits.ts';
import { BOT_ENV } from '../helpers.ts';
import { ADMIN_PASSWORD, ADMIN_USER, createUser, csrfFrom, loginAs, setupAdmin, textOf, type Browser } from '../support/admin.ts';
import { createCloudApiDouble } from '../support/cloud-api-double.ts';
import { CUSTOMER, STAFF, inboundPayload, makeBotHarness, mx, sign, type BotHarness } from '../support/whatsapp.ts';

/**
 * Pruebas de QA de REQ-F-025 (QA Action Plan aprobado): QA-T1 tope de pedidos alcanzado durante una
 * conversación con el alias 521/52 (CA-1, CA-9), QA-T2 frontera del presupuesto y cambio de día y
 * de mes en la zona del negocio (CA-5), QA-T3 barrido de privacidad de un flujo completo (CA-15) y
 * QA-T4 token de "Bloquear" (un solo uso, editor y cambio de día). Nunca se llama a Meta.
 */

const PATH = '/admin/bot';
const WEBHOOK = '/webhooks/whatsapp';

async function readyToConfirm(h: BotHarness, from: string): Promise<void> {
  for (const text of ['Hola', '2', '9', '1', '4', 'Ana Pérez, recoger']) await h.ask(text, { from });
}

const templates = (h: BotHarness) => h.double.sent.filter((m) => m.template !== undefined);

describe('QA-T1: tope de pedidos alcanzado durante una conversación (CA-1 escenario 2, CA-9)', () => {
  it('dos conversaciones del mismo número (521 y 52): la segunda confirmación recibe el contacto sin plantilla', async () => {
    const h = await makeBotHarness({ protection: { limits: { ordersPerNumberDay: 1, repeatCount: 100 } } });
    const short = canonicalPhone(CUSTOMER);
    expect(short).not.toBe(CUSTOMER);
    await readyToConfirm(h, CUSTOMER);
    await readyToConfirm(h, short);
    expect(await h.ask('1', { from: CUSTOMER })).toContain('fue enviado a Moloteando');
    expect(templates(h)).toHaveLength(1);

    // El proveedor de Meta responde siempre al número con 521 (toCloudApiRecipient): se lee de ahí.
    const before = h.double.textsTo(CUSTOMER).length;
    await h.ask('1', { from: short });
    const second = h.double.textsTo(CUSTOMER).slice(before).join('\n');
    expect(second).not.toContain('fue enviado a Moloteando');
    expect(second).toContain('no se pudo enviar automáticamente al personal de Moloteando');
    expect(second).toContain(`wa.me/${STAFF.molotes}`);
    expect(second).toMatch(/[A-Z]+-T\d{3}/);
    expect(templates(h)).toHaveLength(1);
  });
});

describe('QA-T2: presupuesto y periodos en America/Mexico_City (CA-5)', () => {
  // 1 USD por mensaje de servicio, 2 gratis, presupuesto 2 USD: 4 salientes caben (2 gratis + 2 USD).
  const budget = { freeServiceMonth: 2, serviceCostMicros: 1_000_000, utilityCostMicros: 1_000_000, budgetMonthMicros: 2_000_000, repeatCount: 100 };

  it('el gasto igual al presupuesto se permite; el siguiente se silencia y hay un solo error de presupuesto', async () => {
    const h = await makeBotHarness({ at: mx('2026-10-20T10:00'), protection: { limits: budget } });
    for (let i = 0; i < 6; i += 1) await h.ask('ayuda');
    expect(h.double.textsTo(CUSTOMER)).toHaveLength(4);
    const errors = h.logger.lines.filter((line) => line.level === 'error');
    expect(errors).toEqual([expect.objectContaining({ msg: 'bot_monthly_cap_reached', cap: 'budget', limit: 2 })]);
  });

  it('el mes cambia a las 00:00 de la zona del negocio, no en UTC', async () => {
    // 31 de octubre 23:00 en México = 1 de noviembre 05:00 UTC.
    const h = await makeBotHarness({ at: mx('2026-10-31T23:00'), protection: { limits: budget } });
    for (let i = 0; i < 6; i += 1) await h.ask('ayuda');
    expect(h.double.textsTo(CUSTOMER)).toHaveLength(4);
    h.clock.now = mx('2026-10-31T23:58');
    expect(await h.say('ayuda')).toEqual([]);
    h.clock.now = mx('2026-11-01T00:01');
    expect(await h.say('ayuda')).not.toEqual([]);
  });

  it('el tope diario de salientes se reinicia a las 00:00 de la zona del negocio', async () => {
    const h = await makeBotHarness({ at: mx('2026-10-20T23:50'), protection: { limits: { outboundDay: 2, repeatCount: 100 } } });
    for (let i = 0; i < 4; i += 1) await h.ask('ayuda');
    expect(h.double.textsTo(CUSTOMER)).toHaveLength(2);
    h.clock.now = mx('2026-10-21T00:00');
    expect(await h.say('ayuda')).not.toEqual([]);
  });
});

async function csrf(browser: Browser): Promise<string> {
  return csrfFrom((await browser.get(PATH)).text);
}

async function post(browser: Browser, path: string, fields: Record<string, string> = {}) {
  return browser.post(path).type('form').send({ _csrf: await csrf(browser), ...fields });
}

describe('QA-T3: barrido de privacidad de un flujo completo (CA-15)', () => {
  it('ni el HTML, ni los logs, ni las 4 tablas contienen números completos, la clave o los seudónimos', async () => {
    const double = createCloudApiDouble();
    const context = await setupAdmin({ env: BOT_ENV, providerFetch: double.fetch, botLimits: undefined });
    const admin = await loginAs(context.browser(), ADMIN_USER, ADMIN_PASSWORD);
    const abuser = '5215500007777';
    const manual = '5215500008888';
    const reached = '5215500006666';
    const numbers = [abuser, manual, reached].flatMap((n) => [n, canonicalPhone(n), n.slice(-10)]);
    const html: string[] = [];

    // Tope diario de mensajes por número (60) → bloqueo automático "tope".
    const deliver = async (from: string, text: string) => {
      const body = JSON.stringify(inboundPayload('text', { from, text, at: context.clock.now() }));
      const res = await context.request().post(WEBHOOK).set('Content-Type', 'application/json').set('X-Hub-Signature-256', sign(body)).send(body);
      expect(res.status).toBe(200);
    };
    for (let i = 0; i < 62; i += 1) {
      context.clock.advance(4 * MS.second);
      const before = double.requests.length;
      await deliver(abuser, `mensaje ${i}`);
      await vi.waitFor(() => expect(double.requests.length).toBeGreaterThan(before), { timeout: 1000 }).catch(() => undefined);
    }
    await vi.waitFor(async () => expect(await context.prisma.botBlock.count({ where: { origin: 'tope' } })).toBe(1), { timeout: 10_000 });

    // Alta manual con el número escrito con espacios y "+", y bloqueo desde "alcanzaron un tope hoy".
    html.push((await post(admin, `${PATH}/bloqueos`, { telefono: '+52 1 55 0000 8888', duracion: 'permanente', motivo: 'Spam' })).text);
    context.botControl.recordReached(canonicalPhone(reached), 'burst');
    const page = await admin.get(PATH);
    html.push(page.text);
    const action = page.text.match(/action="(\/admin\/bot\/topes\/[0-9a-f]{32}\/bloquear)"/g)?.map((m) => m.slice(8, -1)) ?? [];
    expect(action.length).toBeGreaterThan(0);
    for (const path of action) html.push((await post(admin, path, { duracion: '24h', motivo: '' })).text);
    // Errores de formulario con el número escrito.
    html.push((await post(admin, `${PATH}/bloqueos`, { telefono: manual, duracion: '7d', motivo: '' })).text);
    html.push((await post(admin, `${PATH}/bloqueos`, { telefono: '5215500001111', duracion: '7d', motivo: 'llamar al 55 0000 1111' })).text);
    html.push((await post(admin, `${PATH}/bloqueos`, { telefono: BOT_ENV.WHATSAPP_BOT_STAFF_BIRRIA, duracion: '7d', motivo: '' })).text);
    // Interruptor.
    await post(admin, `${PATH}/interruptor`, { accion: 'pausar', motivo: 'QA' });
    await post(admin, `${PATH}/interruptor`, { accion: 'reanudar', motivo: '' });
    html.push((await admin.get(PATH)).text);
    html.push((await admin.get('/admin')).text);
    await context.botControl.flush();

    const blocks = await context.prisma.botBlock.findMany();
    expect(blocks.map((b) => b.origin).sort()).toEqual(['manual', 'manual', 'tope']);
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
  }, 120_000);
});

describe('QA-T4: el token de "Bloquear" (D-T11)', () => {
  it('un editor no puede usar un token válido, que sigue sirviendo una sola vez al admin; tras el cambio de día ya no vale', async () => {
    const context = await setupAdmin({ env: BOT_ENV });
    const admin = await loginAs(context.browser(), ADMIN_USER, ADMIN_PASSWORD);
    await createUser(context.users, { username: 'eva' });
    const editor = await loginAs(context.browser(), 'eva');

    context.botControl.recordReached(canonicalPhone('5215500004444'), 'messages');
    const action = (await admin.get(PATH)).text.match(/action="(\/admin\/bot\/topes\/[0-9a-f]{32}\/bloquear)"/)?.[1] ?? '';
    expect(action).not.toBe('');
    const editorCsrf = csrfFrom((await editor.get('/admin/cuenta')).text);
    expect((await editor.post(action).type('form').send({ _csrf: editorCsrf, duracion: '24h', motivo: '' })).status).toBe(403);
    expect(await context.prisma.botBlock.count()).toBe(0);
    expect((await post(admin, action, { duracion: '24h', motivo: '' })).status).toBe(303);
    expect((await post(admin, action, { duracion: '24h', motivo: '' })).status).toBe(404);

    context.botControl.recordReached(canonicalPhone('5215500003333'), 'messages');
    const next = (await admin.get(PATH)).text.match(/action="(\/admin\/bot\/topes\/[0-9a-f]{32}\/bloquear)"/)?.[1] ?? '';
    expect(next).not.toBe('');
    context.clock.advance(MS.day);
    // La sesión caduca en un día: se vuelve a entrar.
    const again = await loginAs(context.browser(), ADMIN_USER, ADMIN_PASSWORD);
    const page = await again.get(PATH);
    expect(textOf(page.text)).not.toContain('*********3333');
    expect((await post(again, next, { duracion: '24h', motivo: '' })).status).toBe(404);
    expect(await context.prisma.botBlock.count()).toBe(1);
  });
});
