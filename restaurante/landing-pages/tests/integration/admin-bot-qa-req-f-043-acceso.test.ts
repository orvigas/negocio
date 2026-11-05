import { afterEach, describe, expect, it } from 'vitest';

import { BOT_ENV, TWILIO_BOT_ENV } from '../helpers.ts';
import { ADMIN_PASSWORD, ADMIN_USER, USER_PASSWORD, createUser, setupAdmin } from '../support/admin.ts';
import { adminSql } from '../support/database.ts';
import { startServer } from '../support/process.ts';
import { databaseUrl } from '../support/test-database-config.ts';
import { API_ENTRY, P, nextIp } from '../support/users-api-process.ts';

/**
 * QA de REQ-F-043 (PR 1, sonda S-2): matriz de acceso y casos negativos de `/api/v1/admin/bot*` con el
 * proceso real de la API contra MySQL. Orden: 401 -> 403 de rol -> CSRF -> cuerpo -> dominio. Se
 * arranca como proceso hijo: landing-pages nunca importa código de `api/`.
 */

const CUSTOMER = '5215512345678';
const STAFF = BOT_ENV.WHATSAPP_BOT_STAFF_MOLOTES;
const TOKEN = 'a'.repeat(32);
const BIG = JSON.stringify({ reason: 'x'.repeat(5000) });

interface Session { id: string; csrfToken: string }
interface Raw { session?: Session | undefined; bearer?: string; csrf?: string | null; body?: string; type?: string | null; method?: string }

const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()?.();
});

async function start(env: Record<string, string | undefined>) {
  const context = await setupAdmin();
  await createUser(context.users, { username: 'em', businesses: ['molotes'] });
  await createUser(context.users, { username: 'eb', businesses: ['birria'] });
  await createUser(context.users, { username: 'segunda', role: 'admin' });
  const api = await startServer({ ...env, DATABASE_URL: databaseUrl(context.database.config), INTERNAL_NOTIFY_TOKEN: undefined }, 60_000, { args: [API_ENTRY] });
  cleanups.push(() => api.stop());
  expect(api.started, api.output().stderr).toBe(true);
  const login = async (username: string, password = USER_PASSWORD) => {
    const res = await fetch(`${api.url}${P}/sesion`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': nextIp() },
      body: JSON.stringify({ username, password }),
    });
    return ((await res.json()) as { session: Session }).session;
  };
  const owner = await login(ADMIN_USER, ADMIN_PASSWORD);
  const raw = (path: string, { session, bearer, csrf, body, type = 'application/json', method = 'POST' }: Raw) => {
    const headers: Record<string, string> = {};
    if (session) headers.authorization = `Bearer ${session.id}`;
    if (bearer) headers.authorization = bearer;
    const token = csrf === undefined ? session?.csrfToken : csrf;
    if (token) headers['x-csrf-token'] = token;
    if (body !== undefined && type) headers['content-type'] = type;
    return fetch(`${api.url}${P}${path}`, { method, headers, ...(body === undefined ? {} : { body }) });
  };
  const json = (path: string, method: string, body: unknown, session = owner) => raw(path, { session, method, body: JSON.stringify(body) });
  const state = async () => ((await (await raw('/bot', { session: owner, method: 'GET' })).json()) as { bot: { control: { paused: boolean; reason: string | null }; blocks: { id: number | null }[]; canBlock: boolean; status: unknown; storeHealthy: boolean } }).bot;
  const tables = async () => ({ blocks: await context.prisma.botBlock.count(), audit: await context.prisma.botAudit.count(), control: JSON.stringify(await context.prisma.botControl.findMany()) });
  return { context, api, login, owner, raw, json, state, tables };
}

const WRITES: readonly [string, string][] = [
  ['PUT', '/bot/interruptor'],
  ['POST', '/bot/bloqueos'],
  ['POST', '/bot/bloqueos/1/quitar'],
  ['POST', `/bot/topes/${TOKEN}/bloquear`],
];
const ALL: readonly [string, string][] = [['GET', '/bot'], ...WRITES];

describe('acceso', () => {
  it('QA-20 a QA-23: un editor siempre recibe 403 de rol, sin datos ni cambios; sin sesión, 401', async () => {
    const { login, raw, tables, context } = await start(BOT_ENV);
    const before = await tables();
    const sessions = [await login('em'), await login('eb')];
    const variants: Omit<Raw, 'session' | 'method'>[] = [
      {},
      { body: JSON.stringify({ paused: true, phone: CUSTOMER, duration: '7d' }) },
      { body: '{"phone":' },
      { body: BIG },
      { body: 'hola', type: 'text/plain' },
      { body: '{}', csrf: null },
      { body: '{}', csrf: 'x'.repeat(40) },
    ];
    let checked = 0;
    for (const session of sessions) {
      for (const [method, path] of [...ALL, ['POST', '/bot/bloqueos/abc/quitar'], ['POST', '/bot/topes/noesuntoken/bloquear']] as [string, string][]) {
        for (const variant of method === 'GET' ? [{}] : variants) {
          const res = await raw(path, { ...variant, session, method });
          const text = await res.text();
          expect([method, path, res.status]).toEqual([method, path, 403]);
          expect(JSON.parse(text)).toEqual({ error: { code: 'FORBIDDEN_ROLE', message: 'No tienes permiso para gestionar el bot.' } });
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(70);
    expect(await tables()).toEqual(before);

    const eli = await login('segunda');
    expect((await raw('/bot', { session: eli, method: 'GET' })).status).toBe(200);
    await context.prisma.user.updateMany({ where: { username: 'segunda' }, data: { role: 'editor' } });
    expect((await raw('/bot', { session: eli, method: 'GET' })).status).toBe(403);
    expect((await raw('/bot/interruptor', { session: eli, method: 'PUT', body: '{"paused":true}' })).status).toBe(403);

    for (const [method, path] of ALL) {
      for (const bearer of [undefined, 'Bearer aaaaaaaaaaaaaaaa', 'Basic abc', 'Bearer !!']) {
        const res = await raw(path, { ...(bearer ? { bearer } : {}), method, ...(method === 'GET' ? {} : { body: '{}' }) });
        expect([path, res.status, ((await res.json()) as { error: { code: string } }).error.code]).toEqual([path, 401, 'UNAUTHENTICATED']);
      }
    }
    expect(await tables()).toEqual(before);
  });

  it('QA-24 a QA-26: CSRF antes que cuerpo, cuerpo antes que dominio, y rutas', async () => {
    const { login, owner, raw, json, tables } = await start(BOT_ENV);
    const before = await tables();
    const other = await login('segunda');
    for (const [method, path] of WRITES) {
      for (const csrf of [null, 'x'.repeat(40), other.csrfToken]) {
        for (const body of ['{"paused":true}', '{"phone":', BIG]) {
          const res = await raw(path, { session: owner, method, csrf, body });
          expect([path, res.status, ((await res.json()) as { error: { code: string } }).error.code]).toEqual([path, 403, 'CSRF_INVALID']);
        }
      }
      expect((await raw(path, { session: owner, method, body: BIG })).status).toBe(413);
      expect((await raw(path, { session: owner, method, body: 'hola', type: 'text/plain' })).status).toBe(415);
      expect((await raw(path, { session: owner, method, body: '{"phone":' })).status).toBe(400);
      expect((await raw(path, { session: owner, method, body: '[]' })).status).toBe(422);
      expect((await raw(path, { session: owner, method, body: '{"otro":1}' })).status).toBe(422);
    }
    expect((await raw('/bot/bloqueos/abc/quitar', { session: owner, body: '{"otro":1}' })).status).toBe(422);
    expect((await json('/bot/bloqueos/abc/quitar', 'POST', {})).status).toBe(404);
    // Observación: el formato del token se mira antes que `duration`; uno bien formado, después.
    expect((await raw('/bot/topes/noesuntoken/bloquear', { session: owner, body: '{"duration":"nope"}' })).status).toBe(404);
    expect((await raw(`/bot/topes/${TOKEN}/bloquear`, { session: owner, body: '{"duration":"nope"}' })).status).toBe(422);
    expect((await json('/bot/topes/noesuntoken/bloquear', 'POST', { duration: '7d' })).status).toBe(404);
    expect(await tables()).toEqual(before);

    const notAllowed = await raw('/bot/interruptor', { session: owner, method: 'GET' });
    expect(notAllowed.status).toBe(405);
    expect(notAllowed.headers.get('allow')).toContain('PUT');
    expect((await raw('/bot', { session: owner, method: 'DELETE', csrf: owner.csrfToken })).status).toBe(405);
    expect((await raw('/bot/productos', { session: owner, method: 'GET' })).status).toBe(404);
    expect((await raw('/bot/productos', { session: owner, method: 'POST', body: '{}' })).status).toBe(404);
    expect((await raw('/bot/bloqueos/1/quitar/extra', { session: owner, body: '{}' })).status).toBe(404);
    const editor = await login('em');
    const head = await raw('/bot', { session: editor, method: 'HEAD' });
    expect(head.status).toBe(403);
    expect(await head.text()).toBe('');
    expect(((await (await raw('/usuarios', { session: editor, method: 'GET' })).json()) as { error: { message: string } }).error.message).toContain('gestionar usuarios');
  });
});

describe('validación y dominio', () => {
  it('QA-30: el motivo', async () => {
    const { json, state } = await start(BOT_ENV);
    const put = async (body: unknown) => (await json('/bot/interruptor', 'PUT', body)).status;
    for (const reason of ['12345678', 'tel 5512345678 ya', 'a'.repeat(201), 123, null, {}]) {
      expect([reason, await put({ paused: true, reason })]).toEqual([reason, 422]);
      expect((await state()).control.paused).toBe(false);
    }
    for (const paused of ['true', 1, null, undefined]) expect(await put({ paused })).toBe(422);
    expect((await state()).control.paused).toBe(false);
    expect(await put({ paused: true, reason: '1234567' })).toBe(200);
    expect((await state()).control.reason).toBe('1234567');
    expect(await put({ paused: false, reason: 'a'.repeat(200) })).toBe(200);
    expect(await put({ paused: true, reason: '   ' })).toBe(200);
    expect((await state()).control).toMatchObject({ paused: true, reason: null });
  });

  it('QA-31 y QA-32: teléfonos y ids', async () => {
    const { context, json, state, tables } = await start(BOT_ENV);
    const post = (body: unknown) => json('/bot/bloqueos', 'POST', body);
    for (const phone of ['12345', 'abc', '', 123, null, '1234567890123456', '55-1234-567x']) expect([phone, (await post({ phone, duration: '7d' })).status]).toEqual([phone, 422]);
    for (const phone of [STAFF, '525511110001', '5511110001', '+52 1 55 1111 0001', BOT_ENV.WHATSAPP_BOT_STAFF_BIRRIA]) expect([phone, (await post({ phone, duration: '7d' })).status]).toEqual([phone, 422]);
    for (const duration of ['1d', '', 7, undefined, 'constructor', '__proto__']) expect([duration, (await post({ phone: CUSTOMER, duration })).status]).toEqual([duration, 422]);
    expect((await tables()).blocks).toBe(0);

    expect((await post({ phone: CUSTOMER, duration: '7d' })).status).toBe(201);
    for (const phone of ['+52 55 1234 5678', '525512345678', '5512345678', '(55) 1234-5678', '+52 1 55 1234 5678']) expect([phone, (await post({ phone, duration: '24h' })).status]).toEqual([phone, 409]);
    expect((await tables()).blocks).toBe(1);

    const id = (await state()).blocks[0]?.id ?? 0;
    expect((await json(`/bot/bloqueos/${String(id)}/quitar`, 'POST', {})).status).toBe(200);
    const statuses: Record<string, number> = {};
    for (const bad of [String(id), '0', '-1', '1e3', '999999', '2147483647', '2147483648', '4294967296', '9999999999', '99999999999']) {
      statuses[bad] = (await json(`/bot/bloqueos/${bad}/quitar`, 'POST', {})).status;
    }
    expect(statuses).toEqual(Object.fromEntries(Object.keys(statuses).map((key) => [key, 404])));
    expect(await context.prisma.botAudit.count({ where: { action: 'block_removed' } })).toBe(1);
  });

  it('QA-33, QA-35 y QA-38: sin bot, sin clave, sin personal', async () => {
    const { context, api, raw, json, state } = await start({ WHATSAPP_BOT_BLOCKLIST_KEY: BOT_ENV.WHATSAPP_BOT_BLOCKLIST_KEY });
    expect(api.started).toBe(true);
    const bot = await state();
    expect(bot.status).toEqual({ enabled: false, provider: null });
    expect(bot.canBlock).toBe(false);
    for (const body of [{ phone: CUSTOMER, duration: '7d' }, { phone: 'x', duration: 'y' }, { phone: STAFF, duration: '7d' }]) {
      const res = await json('/bot/bloqueos', 'POST', body);
      expect([res.status, ((await res.json()) as { error: { code: string } }).error.code]).toEqual([409, 'BOT_KEY_MISSING']);
    }
    expect((await raw('/bot/bloqueos', { session: undefined, method: 'POST' })).status).toBe(401);
    expect((await json(`/bot/topes/${TOKEN}/bloquear`, 'POST', { duration: '7d' })).status).toBe(404);
    expect(await context.prisma.botBlock.count()).toBe(0);
    expect((await json('/bot/interruptor', 'PUT', { paused: true })).status).toBe(200);
  });

  it('QA-33: con bot y sin clave, la API no arranca', async () => {
    const context = await setupAdmin();
    const api = await startServer({ ...BOT_ENV, WHATSAPP_BOT_BLOCKLIST_KEY: undefined, DATABASE_URL: databaseUrl(context.database.config), INTERNAL_NOTIFY_TOKEN: undefined }, 20_000, { args: [API_ENTRY] });
    cleanups.push(() => api.stop());
    expect(api.started).toBe(false);
    expect(api.output().stderr).toContain('WHATSAPP_BOT_BLOCKLIST_KEY');
  });

  it('QA-35: el estado sale del bot realmente creado', async () => {
    const twilio = await start(TWILIO_BOT_ENV);
    expect((await twilio.state()).status).toEqual({ enabled: true, provider: 'twilio' });
    const only = await start({ WHATSAPP_BOT_PROVIDER: 'meta' });
    expect((await only.state()).status).toEqual({ enabled: false, provider: null });
  });

  it('QA-34: fallo parcial real: última copia en la lectura y 503 sin detalles en la escritura', async () => {
    const { context, api, json, raw, state } = await start({ ...BOT_ENV, BOT_CONTROL_REFRESH_SECONDS: '1' });
    expect((await json('/bot/bloqueos', 'POST', { phone: CUSTOMER, duration: '7d' })).status).toBe(201);
    const { name } = context.database;
    await adminSql(name, 'RENAME TABLE bot_block TO bot_block_qa');
    cleanups.push(() => adminSql(name, 'RENAME TABLE bot_block_qa TO bot_block').catch(() => undefined));
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const bot = await state();
    expect(bot.storeHealthy).toBe(false);
    expect(bot.blocks).toHaveLength(1);
    const res = await json('/bot/bloqueos', 'POST', { phone: '5215587654321', duration: '7d' });
    const text = await res.text();
    expect([res.status, JSON.parse(text)]).toMatchObject([503, { error: { code: 'DATABASE_UNAVAILABLE' } }]);
    for (const word of ['bot_block', 'Prisma', 'SELECT', 'INSERT', 'stack']) expect(text).not.toContain(word);
    expect((await raw('/bot', { session: undefined, method: 'GET' })).status).toBe(401);
    expect(api.output().stdout).not.toContain('5587654321');
    await adminSql(name, 'RENAME TABLE bot_block_qa TO bot_block');
    await new Promise((resolve) => setTimeout(resolve, 1200));
    expect((await state()).storeHealthy).toBe(true);
  });
});
