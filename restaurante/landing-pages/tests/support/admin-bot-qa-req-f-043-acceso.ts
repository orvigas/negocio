import { expect } from 'vitest';

import { BOT_ENV } from '../helpers.ts';
import { ADMIN_PASSWORD, ADMIN_USER, USER_PASSWORD, createUser, setupAdmin } from './admin.ts';
import { startServer } from './process.ts';
import { databaseUrl } from './test-database-config.ts';
import { API_ENTRY, P, nextIp } from './users-api-process.ts';

/**
 * Sonda S-2 de QA de REQ-F-043 con el proceso real de la API: preparación compartida por los archivos
 * admin-bot-qa-req-f-043-{acceso,validacion,estado}.test.ts, partidos para no pasar de 20 s en el CI
 * (.claude/rules/testing.md), sin cambiar los casos.
 */

export const CUSTOMER = '5215512345678';
export const STAFF = BOT_ENV.WHATSAPP_BOT_STAFF_MOLOTES;
export const TOKEN = 'a'.repeat(32);
export const BIG = JSON.stringify({ reason: 'x'.repeat(5000) });

interface Session { id: string; csrfToken: string }
export interface Raw { session?: Session | undefined; bearer?: string; csrf?: string | null; body?: string; type?: string | null; method?: string }

export const cleanups: (() => Promise<unknown>)[] = [];
/** Limpieza de la prueba: cada archivo la registra con afterEach. */
export async function runCleanups(): Promise<void> {
  while (cleanups.length > 0) await cleanups.pop()?.();
}

export async function start(env: Record<string, string | undefined>) {
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

export const WRITES: readonly [string, string][] = [
  ['PUT', '/bot/interruptor'],
  ['POST', '/bot/bloqueos'],
  ['POST', '/bot/bloqueos/1/quitar'],
  ['POST', `/bot/topes/${TOKEN}/bloquear`],
];
export const ALL: readonly [string, string][] = [['GET', '/bot'], ...WRITES];
