import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

import { ADMIN_PASSWORD, ADMIN_USER, TEST_BOT_KEYS, createUser, csrfFrom, loginAs, setupAdmin, textOf, type Browser } from '../support/admin.ts';

/**
 * Modo de solo lectura de "Bot" en el /admin actual (REQ-F-043, RF-10, CA-16 y CA-17; D-2): con
 * ADMIN_NEW_URL el bot se controla en el admin nuevo. La página muestra estado, uso y lista, sin
 * formularios, con el aviso y el enlace; los 4 POST pasan sesión, permiso, cuerpo y CSRF, y responden
 * 410 sin escribir. Sin la variable, todo sigue igual (admin-bot.test.ts), salvo el texto de la lista
 * de topes, que ya no dice que esa lista "vuelve".
 */

const PATH = '/admin/bot';
const NEW_ADMIN = 'https://admin.birriaelmuneco.test';
const ENV = { ADMIN_NEW_URL: NEW_ADMIN };
const PHONE = '5215500001234';
const OTHER_PHONE = '5215500009876';
const TOKEN = 'a'.repeat(32);
const NOTICE = 'El bot ahora se controla en el admin nuevo.';
const REACHED = 'La lista de números que alcanzaron un tope hoy está en el admin nuevo.';

/** Un bloqueo, una pausa y uso guardados, para que un POST que escribiera cambiara algo. */
async function movedBot(env: Record<string, string> = ENV) {
  const context = await setupAdmin({ botKeys: TEST_BOT_KEYS, env });
  const owner = await context.prisma.user.findFirstOrThrow();
  const actor = { kind: 'user' as const, id: owner.id, name: owner.displayName };
  await context.botControl.blockManual(PHONE, '7d', 'Pedidos falsos', actor);
  await context.botControl.setPaused(true, actor, 'Revisión');
  await context.prisma.botUsage.create({ data: { periodType: 'day', period: '2026-10-14', templates: 2, outbound: 7, updatedAt: context.clock.now() } });
  const [block] = await context.prisma.botBlock.findMany();
  const admin = await loginAs(context.browser(), ADMIN_USER, ADMIN_PASSWORD);
  /** Las 4 tablas del bot, completas: nada debe cambiar. */
  const tables = async () =>
    JSON.stringify([
      await context.prisma.botControl.findMany(),
      await context.prisma.botBlock.findMany({ orderBy: { id: 'asc' } }),
      await context.prisma.botAudit.findMany({ orderBy: { id: 'asc' } }),
      await context.prisma.botUsage.findMany({ orderBy: [{ periodType: 'asc' }, { period: 'asc' }] }),
    ]);
  return { ...context, admin, tables, blockId: block!.id };
}

const posts = (blockId: number): [string, Record<string, string>][] => [
  [`${PATH}/interruptor`, { accion: 'reanudar', motivo: 'Listo' }],
  [`${PATH}/bloqueos`, { telefono: OTHER_PHONE, duracion: '30d', motivo: 'Otro' }],
  [`${PATH}/bloqueos/${blockId}/quitar`, {}],
  [`${PATH}/topes/${TOKEN}/bloquear`, { duracion: '7d' }],
];

async function csrf(browser: Browser): Promise<string> {
  return csrfFrom((await browser.get('/admin/cuenta')).text);
}

const mainOf = (html: string): Element => {
  const main = new JSDOM(html).window.document.querySelector('main');
  if (!main) throw new Error('La página no tiene <main>');
  return main;
};

function expectReadOnly(html: string): void {
  const main = mainOf(html);
  expect(main.querySelectorAll('form, input, select, button')).toHaveLength(0);
  expect(main.querySelector(`a[href="${NEW_ADMIN}/bot"]`)?.textContent).toBe('Ir al control del bot en el admin nuevo');
  const text = textOf(main.outerHTML);
  expect(text).toContain(NOTICE);
  expect(text).not.toContain('Acción');
  expect(text).not.toContain('Bloquear un número');
}

describe('/admin/bot con ADMIN_NEW_URL (CA-16)', () => {
  it('muestra estado, uso y lista, sin formularios, con el aviso y el enlace', async () => {
    const { admin } = await movedBot();
    const res = await admin.get(PATH);
    expect(res.status).toBe(200);
    expectReadOnly(res.text);
    const text = textOf(res.text);
    expect(text).toContain('Bot pausado');
    expect(text).toContain('motivo: Revisión');
    expect(text).toContain('Mensajes del bot (hoy)');
    expect(text).toContain(REACHED);
    expect(text).toMatch(/\*{9}1234 Manual Pedidos falsos dueno/);
    expect(text).not.toContain('Mientras tanto');
    expect(res.text).not.toContain(PHONE);
  });

  it('una URL antigua con ?ok= no anuncia un cambio que ya no se hace aquí', async () => {
    const { admin } = await movedBot();
    const res = await admin.get(`${PATH}?ok=paused`);
    expect(res.status).toBe(200);
    expect(textOf(res.text)).not.toContain('no se envía ningún mensaje');
  });

  it('los 4 POST responden 410 con la misma página y no cambian las 4 tablas ni la copia en memoria', async () => {
    const { admin, botControl, blockId, logger, tables } = await movedBot();
    const before = await tables();
    expect(JSON.parse(before).every((rows: unknown[]) => rows.length > 0)).toBe(true);
    const token = await csrf(admin);
    for (const [path, fields] of posts(blockId)) {
      const res = await admin.post(path).type('form').send({ _csrf: token, ...fields });
      expect(res.status, path).toBe(410);
      expect(res.headers.location).toBeUndefined();
      expectReadOnly(res.text);
      expect(textOf(res.text)).toContain('No se guardó nada: este cambio se hace en el admin nuevo.');
      expect(res.text).not.toContain(OTHER_PHONE);
    }
    expect(await tables()).toBe(before);
    const snapshot = await botControl.snapshot();
    expect(snapshot.control.paused).toBe(true);
    expect(snapshot.blocks).toHaveLength(1);
    const moved = logger.lines.filter((line) => line.msg === 'admin_bot_moved');
    expect(moved.map((line) => line['action'])).toEqual(['toggle', 'block', 'unblock', 'block_reached']);
    expect(JSON.stringify(logger.lines)).not.toContain(OTHER_PHONE);
    expect(JSON.stringify(moved)).not.toContain(TOKEN);
  });

  it('un motivo con teléfono da 410 sin validar nada ni repetirlo', async () => {
    const { admin, tables } = await movedBot();
    const before = await tables();
    const res = await admin.post(`${PATH}/interruptor`).type('form').send({ _csrf: await csrf(admin), accion: 'pausar', motivo: OTHER_PHONE });
    expect(res.status).toBe(410);
    expect(res.text).not.toContain(OTHER_PHONE);
    expect(await tables()).toBe(before);
  });

  it('el orden es sesión, permiso, cuerpo y CSRF, y ninguno llega a escribir', async () => {
    const { admin, users, blockId, browser, logger, tables } = await movedBot();
    await createUser(users, { username: 'eva' });
    const editor = await loginAs(browser(), 'eva');
    const before = await tables();
    const adminToken = await csrf(admin);
    const editorToken = await csrf(editor);
    const anonymous = browser();
    for (const [path, fields] of posts(blockId)) {
      const noSession = await anonymous.post(path).type('form').send(fields);
      expect(noSession.status, path).toBe(303);
      expect(noSession.headers.location).toContain('/admin/login');
      expect((await editor.post(path).type('form').send({ _csrf: editorToken, ...fields })).status, path).toBe(403);
      expect((await admin.post(path).type('form').send(fields)).status, path).toBe(403);
      expect((await admin.post(path).type('form').send({ _csrf: adminToken, ...fields, extra: 'x' })).status, path).toBe(400);
    }
    expect(await tables()).toBe(before);
    expect(logger.lines.some((line) => line.msg === 'admin_bot_moved')).toBe(false);
    expect((await editor.get(PATH)).status).toBe(403);
  });
});

describe('/admin/bot sin ADMIN_NEW_URL (CA-17)', () => {
  it('conserva sus formularios y solo cambia el texto de la lista de topes', async () => {
    const { admin } = await movedBot({});
    const res = await admin.get(PATH);
    expect(res.status).toBe(200);
    const main = mainOf(res.text);
    expect(main.querySelector(`form[action="${PATH}/interruptor"]`)).not.toBeNull();
    expect(main.querySelector(`form[action="${PATH}/bloqueos"]`)).not.toBeNull();
    expect(main.querySelector(`form[action$="/quitar"]`)).not.toBeNull();
    const text = textOf(res.text);
    expect(text).toContain('Acción');
    expect(text).toContain(REACHED);
    expect(text).toContain('Mientras tanto, puedes bloquear un número');
    expect(text).not.toContain('vuelve con el control');
    expect(text).not.toContain(NOTICE);
    expect(res.text).not.toContain(NEW_ADMIN);
  });

  it('sigue escribiendo, y la lista de topes sigue en 410 con su aviso', async () => {
    const { admin, blockId, prisma } = await movedBot({});
    const token = await csrf(admin);
    const gone = await admin.post(`${PATH}/topes/${TOKEN}/bloquear`).type('form').send({ _csrf: token, duracion: '7d' });
    expect(gone.status).toBe(410);
    expect(textOf(gone.text)).toContain(REACHED);
    expect(textOf(gone.text)).not.toContain(NOTICE);
    const res = await admin.post(`${PATH}/interruptor`).type('form').send({ _csrf: token, accion: 'reanudar' });
    expect(res.status).toBe(303);
    expect((await prisma.botControl.findFirstOrThrow()).paused).toBe(false);
    const removed = await admin.post(`${PATH}/bloqueos/${blockId}/quitar`).type('form').send({ _csrf: token });
    expect(removed.status).toBe(303);
  });
});
