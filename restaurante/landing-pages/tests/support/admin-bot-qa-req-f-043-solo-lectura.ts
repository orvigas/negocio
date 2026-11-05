import { JSDOM } from 'jsdom';
import { expect } from 'vitest';

import { ADMIN_PASSWORD, ADMIN_USER, TEST_BOT_KEYS, csrfFrom, loginAs, setupAdmin, type Browser } from './admin.ts';

/**
 * QA de REQ-F-043, PR 3 (sonda S-1): preparación compartida por
 * admin-bot-qa-req-f-043-solo-lectura{,-rechazos,-estados}.test.ts, partidos para no pasar de ~10 s
 * por archivo. Datos propios: filas en las 4 tablas, un bloqueo manual y uno automático.
 */

export const PATH = '/admin/bot';
export const NEW_ADMIN = 'https://admin.qa-req-f-043.test';
export const NOTICE = 'El bot ahora se controla en el admin nuevo.';
export const NOT_SAVED = 'No se guardó nada: este cambio se hace en el admin nuevo.';
const PHONE = '5215512340000';
export const SECRET_PHONE = '5215577776666';
const SECRET_PIECES = [SECRET_PHONE, '5577776666', '77776666'];
export const TOKEN = 'b'.repeat(32);
export const DAY = 11 * 1000; // Más que el refresco por defecto.

export async function bot(env: Record<string, string> = { ADMIN_NEW_URL: NEW_ADMIN }, options: Parameters<typeof setupAdmin>[0] = {}) {
  const context = await setupAdmin({ botKeys: TEST_BOT_KEYS, env, ...options });
  const owner = await context.prisma.user.findFirstOrThrow();
  const actor = { kind: 'user' as const, id: owner.id, name: owner.displayName };
  await context.botControl.blockManual(PHONE, '7d', 'Fila manual', actor);
  await context.botControl.setPaused(true, actor, 'Pausa de QA');
  const [row] = await context.prisma.botBlock.findMany();
  const { id, ...copy } = row!;
  expect(id).toBeGreaterThan(0);
  await context.prisma.botBlock.create({ data: { ...copy, phoneHash: 'c'.repeat(64), last4: '5555', origin: 'tope', reason: null } });
  await context.prisma.botUsage.createMany({
    data: [
      { periodType: 'day', period: '2026-10-09', templates: 3, outbound: 41, updatedAt: context.clock.now() },
      { periodType: 'month', period: '2026-10', templates: 8, outbound: 96, updatedAt: context.clock.now() },
    ],
  });
  // Las filas directas entran en la copia con el siguiente refresco.
  context.clock.advance(DAY);
  const admin = await loginAs(context.browser(), ADMIN_USER, ADMIN_PASSWORD);
  const dump = async () =>
    JSON.stringify([
      await context.prisma.botControl.findMany(),
      await context.prisma.botBlock.findMany({ orderBy: { id: 'asc' } }),
      await context.prisma.botAudit.findMany({ orderBy: { id: 'asc' } }),
      await context.prisma.botUsage.findMany({ orderBy: [{ periodType: 'asc' }, { period: 'asc' }] }),
    ]);
  const memory = async () => {
    const { control, blocks } = await context.botControl.snapshot();
    return JSON.stringify({ control, blocks });
  };
  return { ...context, admin, dump, memory, blockId: row!.id };
}

export const posts = (id: number | string, token = TOKEN): [string, Record<string, string>][] => [
  [`${PATH}/interruptor`, { accion: 'reanudar', motivo: 'Cambio' }],
  [`${PATH}/bloqueos`, { telefono: SECRET_PHONE, duracion: '30d', motivo: 'Otro' }],
  [`${PATH}/bloqueos/${String(id)}/quitar`, {}],
  [`${PATH}/topes/${token}/bloquear`, { duracion: '7d', motivo: '' }],
];

export const csrf = async (browser: Browser) => csrfFrom((await browser.get('/admin/cuenta')).text);
export const dom = (html: string) => new JSDOM(html).window.document;
export const movedLines = (lines: readonly Record<string, unknown>[]) => lines.filter((line) => line['msg'] === 'admin_bot_moved');

export function expectNoSecret(content: string): void {
  for (const piece of SECRET_PIECES) expect(content).not.toContain(piece);
}
