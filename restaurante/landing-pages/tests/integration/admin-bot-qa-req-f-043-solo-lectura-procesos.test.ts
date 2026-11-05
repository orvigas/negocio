import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { BOT_ENV } from '../helpers.ts';
import { ADMIN_ENV, csrfFrom, textOf } from '../support/admin.ts';
import { csrfOf, runCleanups, signIn, startInventory } from '../support/bot-pantalla-qa-req-f-043.ts';
import { BOT_PATH, startStack, waitFor, type Stack } from '../support/bot-procesos-qa-req-f-042.ts';
import { appDatabaseUrl, makeTempDir } from '../support/database.ts';
import { startServer } from '../support/process.ts';

/**
 * QA de REQ-F-043, PR 3 (sonda S-2): convivencia con procesos reales. `landing-pages` en solo lectura
 * mientras `inventory-manager` escribe por la `api` (RF-11), y sin ADMIN_NEW_URL, escritura real con
 * auditoría (CA-17). Refresco de 1 s de `startStack`: el plazo de 10 s se mide aparte (M-1).
 */

const NEW_ADMIN = 'https://admin.qa-req-f-043.test';
const SECRET_PHONE = '5215577776666';
const TOKEN = 'd'.repeat(32);
const cleanupsHere: (() => Promise<unknown>)[] = [];

afterEach(async () => {
  while (cleanupsHere.length > 0) await cleanupsHere.pop()?.();
  await runCleanups();
});

const dump = async ({ database: { prisma } }: Stack) =>
  JSON.stringify([
    await prisma.botControl.findMany(),
    await prisma.botBlock.findMany({ orderBy: { id: 'asc' } }),
    await prisma.botAudit.findMany({ orderBy: { id: 'asc' } }),
    await prisma.botUsage.findMany({ orderBy: [{ periodType: 'asc' }, { period: 'asc' }] }),
  ]);

const noControls = (html: string) => /<main[\s\S]*<\/main>/.exec(html)?.[0].match(/<(form|input|select|button)\b/g) ?? [];

describe('landing en solo lectura, inventory-manager escribe por la api', () => {
  it('QA3-30 a QA3-32: refleja los cambios, no escribe, ni al reiniciar, y no registra números', async () => {
    const stack = await startStack({ env: { ...BOT_ENV, ADMIN_NEW_URL: NEW_ADMIN } });
    cleanupsHere.push(() => stack.stop());
    const inventory = await startInventory(stack.apiUrl);
    const staffer = await signIn(inventory.url);
    const landing = await stack.adminBrowser();
    const csrf = async () => csrfOf((await staffer.get('/bot')).html);
    const page = () => landing.get(BOT_PATH);

    expect((await staffer.post('/bot/interruptor', { _csrf: await csrf(), accion: 'pausar', motivo: 'Desde el admin nuevo' })).status).toBe(303);
    const paused = await waitFor(page, ({ text }) => text.includes('Desde el admin nuevo'), 3000);
    expect(textOf(paused.text)).toContain('Bot pausado');
    expect(noControls(paused.text)).toEqual([]);

    expect((await staffer.post('/bot/bloqueos', { _csrf: await csrf(), telefono: SECRET_PHONE, duracion: '7d', motivo: 'Convivencia' })).status).toBe(303);
    const blocked = await waitFor(page, ({ text }) => text.includes('*********6666'), 3000);
    expect(textOf(blocked.text)).toContain('Convivencia');
    expect(blocked.text).not.toContain(SECRET_PHONE);

    // QA3-31: un formulario antiguo no pisa lo que escribió inventory-manager.
    const before = await dump(stack);
    const token = csrfFrom((await landing.get('/admin/cuenta')).text);
    const id = (await stack.database.prisma.botBlock.findFirstOrThrow()).id;
    for (const [path, fields] of [
      [`${BOT_PATH}/interruptor`, { accion: 'reanudar', motivo: 'Pestaña antigua' }],
      [`${BOT_PATH}/bloqueos`, { telefono: SECRET_PHONE, duracion: '30d', motivo: '' }],
      [`${BOT_PATH}/bloqueos/${String(id)}/quitar`, {}],
      [`${BOT_PATH}/topes/${TOKEN}/bloquear`, { duracion: '7d', motivo: '' }],
    ] as const) {
      expect((await landing.post(path, { _csrf: token, ...fields })).status, path).toBe(410);
    }
    expect(await dump(stack)).toBe(before);
    const output = stack.landing.output();
    const logs = `${output.stdout}\n${output.stderr}`;
    for (const piece of [SECRET_PHONE, '5577776666', '77776666']) expect(logs).not.toContain(piece);
    const lines = output.stdout.split('\n').filter(Boolean).map((line) => JSON.parse(line) as Record<string, unknown>);
    const moved = lines.filter((line) => line['msg'] === 'admin_bot_moved');
    expect(moved.map((line) => line['action'])).toEqual(['toggle', 'block', 'unblock', 'block_reached']);
    expect(JSON.stringify(moved)).not.toContain(TOKEN);
    // QA3-26: la línea `request` de siempre sí trae la ruta.
    expect(lines.filter((line) => line['msg'] === 'request' && String(line['path']).includes(TOKEN)).map((line) => line['status'])).toEqual([410]);

    // QA3-32: reinicio de la app: arranca con clave, personal y topes, y no escribe.
    await stack.landing.stop();
    const temp = await makeTempDir('qa3-');
    cleanupsHere.push(temp.cleanup);
    const again = await startServer({ ...BOT_ENV, ...ADMIN_ENV, ADMIN_NEW_URL: NEW_ADMIN, DATABASE_URL: appDatabaseUrl(stack.database.name), DATA_DIR: join(temp.dir, 'data'), API_INTERNAL_URL: stack.apiUrl }, 30_000, { args: ['src/server.ts'] });
    cleanupsHere.push(() => again.stop());
    expect(again.started, again.output().stderr).toBe(true);
    expect(await dump(stack)).toBe(before);
  });
});

describe('sin ADMIN_NEW_URL, /admin/bot sigue escribiendo', () => {
  it('QA3-13 y QA3-14: pausa, reanudar, alta y baja auditadas; topes en 410 sin escribir', async () => {
    const stack = await startStack({ env: BOT_ENV });
    cleanupsHere.push(() => stack.stop());
    const admin = await stack.adminBrowser();
    expect((await stack.adminPost(admin, `${BOT_PATH}/interruptor`, { accion: 'pausar', motivo: '' })).status).toBe(303);
    expect((await stack.adminPost(admin, `${BOT_PATH}/interruptor`, { accion: 'reanudar', motivo: '' })).status).toBe(303);
    expect((await stack.adminPost(admin, `${BOT_PATH}/bloqueos`, { telefono: SECRET_PHONE, duracion: '7d', motivo: '' })).status).toBe(303);
    const { prisma } = stack.database;
    const { id } = await prisma.botBlock.findFirstOrThrow();
    expect((await stack.adminPost(admin, `${BOT_PATH}/bloqueos/${String(id)}/quitar`)).status).toBe(303);
    const before = await dump(stack);
    expect((await stack.adminPost(admin, `${BOT_PATH}/topes/${TOKEN}/bloquear`, { duracion: '7d', motivo: '' })).status).toBe(410);
    expect(await dump(stack)).toBe(before);
    const actions = (await prisma.botAudit.findMany({ orderBy: { id: 'asc' } })).map(({ action }) => action);
    expect(actions).toEqual(['bot_paused', 'bot_resumed', 'block_added', 'block_removed']);
    const page = await admin.get(BOT_PATH);
    expect(textOf(page.text)).toContain('Mientras tanto, puedes bloquear un número');
    expect(textOf(page.text)).not.toContain('El bot ahora se controla');
  });
});
