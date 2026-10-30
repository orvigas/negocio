import { afterEach, describe, expect, it, vi } from 'vitest';

import { createPrismaBotControlStore } from '@restaurante/db/prisma-bot-control-store';
import { silentLogger } from '@restaurante/core/shared';
import { createBotControl, DEFAULT_BOT_LIMITS } from '@restaurante/core/bot-control';

import { BOT_ENV } from '../helpers.ts';
import { ADMIN_PASSWORD, ADMIN_USER, TEST_BOT_KEYS, createUser, csrfFrom, loginAs, setupAdmin, textOf, type Browser } from '../support/admin.ts';
import { createCloudApiDouble } from '../support/cloud-api-double.ts';
import { startTcpProxy } from '../support/tcp-proxy.ts';
import { testDatabaseConfigs } from '../support/test-database-config.ts';
import { CUSTOMER, inboundPayload, sign } from '../support/whatsapp.ts';

/**
 * Página "Bot" de /admin (REQ-F-025, RF-6, RF-3, RF-9): permisos (CA-7), lista negra con auditoría,
 * lista blanca (CA-8), interruptor de punta a punta con el webhook (CA-12), base caída (CA-13) y
 * ningún número completo en el HTML (CA-15). MySQL real y servidor en 127.0.0.1.
 */

const PATH = '/admin/bot';
const WEBHOOK = '/webhooks/whatsapp';
const FULL = ['5215500001234', '525500001234', '5500001234'];

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()?.();
});

async function csrf(browser: Browser): Promise<string> {
  return csrfFrom((await browser.get(PATH)).text);
}

async function post(browser: Browser, path: string, fields: Record<string, string> = {}) {
  return browser.post(path).type('form').send({ _csrf: await csrf(browser), ...fields });
}

function expectNoFullNumber(html: string): void {
  for (const full of FULL) expect(html).not.toContain(full);
}

async function asAdmin(options: Parameters<typeof setupAdmin>[0] = {}) {
  const context = await setupAdmin({ botKeys: TEST_BOT_KEYS, ...options });
  const admin = await loginAs(context.browser(), ADMIN_USER, ADMIN_PASSWORD);
  return { ...context, admin };
}

describe('permisos (CA-7, RF-3.5)', () => {
  it('un editor no ve el enlace ni puede ver o gestionar la página "Bot"', async () => {
    const context = await asAdmin();
    await createUser(context.users, { username: 'eva' });
    const editor = await loginAs(context.browser(), 'eva');
    expect(textOf((await editor.get('/admin')).text)).not.toContain('Bot');
    expect((await editor.get(PATH)).status).toBe(403);
    const token = csrfFrom((await editor.get('/admin/cuenta')).text);
    for (const path of [`${PATH}/interruptor`, `${PATH}/bloqueos`, `${PATH}/bloqueos/1/quitar`, `${PATH}/topes/${'a'.repeat(32)}/bloquear`]) {
      const res = await editor.post(path).type('form').send({ _csrf: token, accion: 'pausar', telefono: FULL[0] });
      expect(res.status).toBe(403);
    }
    expect(await context.prisma.botAudit.count()).toBe(0);
    expect(await context.prisma.botControl.count()).toBe(0);
    // El administrador sí ve el enlace.
    expect(textOf((await context.admin.get('/admin')).text)).toContain('Topes de gasto, lista negra e interruptor de emergencia.');
  });

  it('sin token CSRF responde 403 y con campos desconocidos 400', async () => {
    const { admin } = await asAdmin();
    expect((await admin.post(`${PATH}/interruptor`).type('form').send({ accion: 'pausar' })).status).toBe(403);
    expect((await post(admin, `${PATH}/interruptor`, { accion: 'pausar', extra: 'x' })).status).toBe(400);
  });
});

describe('lista negra desde el panel (RF-3, CA-7, CA-8, CA-15)', () => {
  it('el admin bloquea con motivo y duración, lo ve enmascarado y lo quita; todo queda en la auditoría', async () => {
    const { admin, prisma } = await asAdmin();
    const res = await post(admin, `${PATH}/bloqueos`, { telefono: '+52 1 55 0000 1234', duracion: '30d', motivo: 'Pedidos falsos' });
    expect(res.status).toBe(303);
    // DEF-001: solo los 4 últimos dígitos viajan en la URL.
    expect(res.headers.location).toBe(`${PATH}?ok=blocked&n=1234`);
    const page = await admin.get(res.headers.location ?? PATH);
    expect(textOf(page.text)).toContain('Número bloqueado. (*********1234)');
    expect(textOf(page.text)).toMatch(/\*{9}1234 Manual Pedidos falsos dueno \d{2}\/10\/2026 \d{2}:\d{2} \d{2}\/11\/2026/);
    expectNoFullNumber(page.text);

    const id = (await prisma.botBlock.findFirstOrThrow()).id;
    const removed = await post(admin, `${PATH}/bloqueos/${id}/quitar`);
    expect(removed.headers.location).toBe(`${PATH}?ok=unblocked&n=1234`);
    const after = await admin.get(removed.headers.location ?? PATH);
    expect(textOf(after.text)).toContain('Bloqueo quitado: el número vuelve a ser atendido. (*********1234)');
    expectNoFullNumber(after.text);
    // Un valor de `n` que no son 4 dígitos se ignora (nunca se pinta tal cual).
    const forged = await admin.get(`${PATH}?ok=blocked&n=5215500001234`);
    expect(textOf(forged.text)).toContain('Número bloqueado.');
    expectNoFullNumber(forged.text);
    expect((await post(admin, `${PATH}/bloqueos/${id}/quitar`)).status).toBe(404);
    const audit = await prisma.botAudit.findMany({ orderBy: { id: 'asc' } });
    expect(audit.map((row) => [row.action, row.actorKind, row.masked, row.reason])).toEqual([
      ['block_added', 'user', '*********1234', 'Pedidos falsos'],
      ['block_removed', 'user', '*********1234', null],
    ]);
  });

  it('rechaza el número del personal, uno inválido, uno ya bloqueado y un motivo con teléfono, sin devolver el número', async () => {
    const { admin, prisma } = await asAdmin({ env: BOT_ENV, botKeys: undefined });
    const staff = await post(admin, `${PATH}/bloqueos`, { telefono: BOT_ENV.WHATSAPP_BOT_STAFF_MOLOTES, duracion: '7d', motivo: '' });
    expect(staff.status).toBe(422);
    expect(textOf(staff.text)).toContain('Ese número es del personal y no se puede bloquear.');
    expect(staff.text).not.toContain(BOT_ENV.WHATSAPP_BOT_STAFF_MOLOTES);

    const invalid = await post(admin, `${PATH}/bloqueos`, { telefono: '12-34', duracion: '7d', motivo: '' });
    expect(invalid.status).toBe(422);
    expect(textOf(invalid.text)).toContain('Escribe un número válido');

    const withPhone = await post(admin, `${PATH}/bloqueos`, { telefono: FULL[0] ?? '', duracion: '7d', motivo: 'Es el 5215500001234' });
    expect(withPhone.status).toBe(422);
    expect(textOf(withPhone.text)).toContain('No escribas números de teléfono en el motivo.');
    expectNoFullNumber(withPhone.text);

    expect((await post(admin, `${PATH}/bloqueos`, { telefono: FULL[0] ?? '', duracion: '7d', motivo: '' })).status).toBe(303);
    const again = await post(admin, `${PATH}/bloqueos`, { telefono: FULL[1] ?? '', duracion: '24h', motivo: '' });
    expect(again.status).toBe(409);
    expect(textOf(again.text)).toContain('Ese número ya está en la lista');
    expectNoFullNumber(again.text);
    expect(await prisma.botBlock.count()).toBe(1);
  });

  it('bloquea desde "alcanzaron un tope hoy" con un token de un solo uso', async () => {
    const { admin, botControl, prisma } = await asAdmin();
    botControl.recordReached('525500001234', 'messages');
    const page = await admin.get(PATH);
    expect(textOf(page.text)).toMatch(/\*{9}1234 Mensajes del día/);
    expectNoFullNumber(page.text);
    const action = page.text.match(/action="(\/admin\/bot\/topes\/[0-9a-f]{32}\/bloquear)"/)?.[1] ?? '';
    const blocked = await post(admin, action, { duracion: '24h', motivo: '' });
    expect(blocked.headers.location).toBe(`${PATH}?ok=blocked&n=1234`);
    expect((await post(admin, action, { duracion: '24h', motivo: '' })).status).toBe(404);
    expect(await prisma.botBlock.findFirst()).toMatchObject({ origin: 'manual', last4: '1234' });
  });

  it('con el bot desactivado muestra un estado coherente y no permite altas sin clave', async () => {
    const { admin } = await asAdmin({ botKeys: null });
    const page = await admin.get(PATH);
    expect(page.status).toBe(200);
    expect(textOf(page.text)).toContain('Desactivado: sin configuración (el webhook responde 503)');
    expect(textOf(page.text)).toContain('el bot debe estar configurado con su clave');
    expect((await post(admin, `${PATH}/bloqueos`, { telefono: FULL[0] ?? '', duracion: '7d', motivo: '' })).status).toBe(409);
    // El interruptor se puede cambiar y queda guardado.
    expect((await post(admin, `${PATH}/interruptor`, { accion: 'pausar', motivo: '' })).status).toBe(303);
  });
});

describe('interruptor de emergencia de punta a punta (CA-12)', () => {
  it('pausado: el webhook responde 200 sin enviar nada, las landings siguen en 200, se audita y sobrevive a un reinicio', async () => {
    const double = createCloudApiDouble();
    const { admin, prisma, clock, request } = await asAdmin({ env: BOT_ENV, botKeys: undefined, providerFetch: double.fetch });
    const deliver = async (text: string) => {
      const body = JSON.stringify(inboundPayload('text', { text, at: clock.now() }));
      return request().post(WEBHOOK).set('Content-Type', 'application/json').set('X-Hub-Signature-256', sign(body)).send(body);
    };

    expect((await post(admin, `${PATH}/interruptor`, { accion: 'pausar', motivo: 'Incidente' })).headers.location).toBe(`${PATH}?ok=paused`);
    expect((await deliver('Hola')).status).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(double.requests).toHaveLength(0);
    for (const path of ['/', '/molotes', '/birria']) expect((await request().get(path)).status).toBe(200);
    expect(textOf((await admin.get(PATH)).text)).toContain('Bot pausado');
    expect(await prisma.botAudit.findFirst({ where: { action: 'bot_paused' } })).toMatchObject({ actorKind: 'user', reason: 'Incidente' });

    // Un proceso nuevo sobre la misma base arranca pausado.
    const restarted = createBotControl({
      store: createPrismaBotControlStore({ prisma }),
      keys: TEST_BOT_KEYS,
      limits: DEFAULT_BOT_LIMITS,
      timeZone: 'America/Mexico_City',
      staff: [],
      logger: silentLogger,
    });
    await restarted.init();
    expect(restarted.isPaused()).toBe(true);

    expect((await post(admin, `${PATH}/interruptor`, { accion: 'reanudar', motivo: '' })).headers.location).toBe(`${PATH}?ok=resumed`);
    expect((await deliver('Hola de nuevo')).status).toBe(200);
    await vi.waitFor(() => expect(double.textsTo(CUSTOMER)).toHaveLength(1));
  });
});

describe('base de datos caída (CA-13)', () => {
  it('el bot sigue aplicando la última copia de la lista negra y registra el error', async () => {
    const { app: target } = testDatabaseConfigs();
    const proxy = await startTcpProxy(target);
    cleanups.push(() => proxy.down());
    const double = createCloudApiDouble();
    const context = await asAdmin({ env: BOT_ENV, botKeys: undefined, providerFetch: double.fetch, routeDatabase: (config) => ({ ...config, host: proxy.host, port: proxy.port }) });
    expect((await post(context.admin, `${PATH}/bloqueos`, { telefono: CUSTOMER, duracion: '7d', motivo: '' })).status).toBe(303);

    await proxy.down();
    context.clock.advance(11_000);
    const deliver = async (from: string) => {
      const body = JSON.stringify(inboundPayload('text', { from, text: 'Hola', at: context.clock.now() }));
      return context.request().post(WEBHOOK).set('Content-Type', 'application/json').set('X-Hub-Signature-256', sign(body)).send(body);
    };
    expect((await deliver(CUSTOMER)).status).toBe(200);
    expect((await deliver('5215500005678')).status).toBe(200);
    await vi.waitFor(() => expect(double.textsTo('5215500005678')).toHaveLength(1), { timeout: 15_000 });
    expect(double.textsTo(CUSTOMER)).toHaveLength(0);
    await vi.waitFor(() => expect(context.logger.lines.some((line) => line.msg === 'bot_control_store_failed')).toBe(true), { timeout: 15_000 });
    const failure = JSON.stringify(context.logger.lines.filter((line) => line.msg === 'bot_control_store_failed'));
    expect(failure).not.toMatch(/mysql:\/\/|127\.0\.0\.1|SELECT/i);
    await proxy.up();
  }, 90_000);
});
