import { afterEach, describe, expect, it } from 'vitest';

import { botStateResponseSchema } from '@restaurante/contracts';

import { BOT_ENV } from '../helpers.ts';
import { ADMIN_PASSWORD, ADMIN_USER, setupAdmin } from '../support/admin.ts';
import { startServer } from '../support/process.ts';
import { databaseUrl } from '../support/test-database-config.ts';
import { API_ENTRY, P, nextIp } from '../support/users-api-process.ts';

/**
 * Control del bot de `/api/v1/admin` con el proceso real de la API contra MySQL (REQ-F-043): las
 * acciones quedan en `bot_control`, `bot_block` y `bot_audit` con su autor (CA-3, CA-5 y CA-7), y el
 * número completo no aparece en los logs de la API, en las respuestas ni en las tablas (CA-15). Se
 * arranca como proceso hijo: landing-pages nunca importa código de `api/`.
 */

const CUSTOMER = '5215512345678';
const FULL = [CUSTOMER, '525512345678', '5512345678'];
const INVALID = '12345';

const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()?.();
});

async function start(env: Record<string, string | undefined>) {
  const context = await setupAdmin();
  const api = await startServer({ ...env, DATABASE_URL: databaseUrl(context.database.config), INTERNAL_NOTIFY_TOKEN: undefined }, 60_000, { args: [API_ENTRY] });
  cleanups.push(() => api.stop());
  expect(api.started, api.output().stderr).toBe(true);
  const login = await fetch(`${api.url}${P}/sesion`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': nextIp() },
    body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASSWORD }),
  });
  const { session } = (await login.json()) as { session: { id: string; csrfToken: string } };
  const call = (path: string, { method = 'GET', body }: { method?: string; body?: unknown } = {}) =>
    fetch(`${api.url}${P}/bot${path}`, {
      method,
      headers: {
        authorization: `Bearer ${session.id}`,
        ...(method === 'GET' ? {} : { 'x-csrf-token': session.csrfToken }),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  return { context, api, call };
}

describe('control del bot con el proceso real', () => {
  it('pausa, alta y baja quedan en la base con su autor, y el número no se filtra', async () => {
    const { context, api, call } = await start(BOT_ENV);
    const { prisma } = context;
    const bodies: string[] = [];
    const keep = async (res: Response) => {
      bodies.push(await res.clone().text());
      return res;
    };

    const initial = botStateResponseSchema.parse(await (await call('')).json()).bot;
    expect(initial.status).toEqual({ enabled: true, provider: 'meta' });
    expect(initial.canBlock).toBe(true);

    expect((await keep(await call('/interruptor', { method: 'PUT', body: { paused: true, reason: 'Gasto raro' } }))).status).toBe(200);
    expect(await prisma.botControl.findMany()).toMatchObject([{ paused: true, reason: 'Gasto raro' }]);

    expect((await keep(await call('/bloqueos', { method: 'POST', body: { phone: CUSTOMER, duration: '7d', reason: 'Abuso' } }))).status).toBe(201);
    expect((await keep(await call('/bloqueos', { method: 'POST', body: { phone: CUSTOMER, duration: '7d' } }))).status).toBe(409);
    expect((await keep(await call('/bloqueos', { method: 'POST', body: { phone: INVALID, duration: '7d' } }))).status).toBe(422);

    const state = await keep(await call(''));
    const { blocks } = botStateResponseSchema.parse(await state.json()).bot;
    expect(blocks).toMatchObject([{ masked: '*********5678', origin: 'manual' }]);
    expect((await keep(await call(`/bloqueos/${blocks[0]?.id}/quitar`, { method: 'POST', body: {} }))).status).toBe(200);

    const audit = await prisma.botAudit.findMany({ orderBy: { id: 'asc' } });
    expect(audit.map(({ action }) => action)).toEqual(['bot_paused', 'block_added', 'block_removed']);
    expect(audit.every(({ actorKind, actorName }) => actorKind === 'user' && actorName !== null)).toBe(true);
    expect(audit[0]).toMatchObject({ reason: 'Gasto raro' });
    expect(audit[1]).toMatchObject({ masked: '*********5678', origin: 'manual', reason: 'Abuso', details: '7 d' });

    const rows = await prisma.botBlock.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ last4: '5678', removedAt: expect.any(Date) as Date });

    const { stdout, stderr } = api.output();
    const hash = rows[0]?.phoneHash ?? '';
    const responses = bodies.join('\n');
    const everything = [responses, stdout, stderr, JSON.stringify({ rows, audit })].join('\n');
    for (const full of FULL) expect(everything).not.toContain(full);
    expect(`${stdout}${stderr}${responses}`).not.toContain(hash);
    for (const word of ['phoneHash', 'keyId']) expect(responses).not.toContain(word);
  });

  it('sin bot: estado desactivado, permite pausar y el alta responde 409 sin guardar (CA-13, CA-20)', async () => {
    const { context, call } = await start({});
    const { bot } = botStateResponseSchema.parse(await (await call('')).json());
    expect(bot.status).toEqual({ enabled: false, provider: null });
    expect(bot.canBlock).toBe(false);
    expect((await call('/bloqueos', { method: 'POST', body: { phone: CUSTOMER, duration: '7d' } })).status).toBe(409);
    expect(await context.prisma.botBlock.count()).toBe(0);
    expect((await call('/interruptor', { method: 'PUT', body: { paused: true } })).status).toBe(200);
  });
});
