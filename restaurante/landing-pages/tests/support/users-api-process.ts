import { join } from 'node:path';

import { expect } from 'vitest';

import { CSRF_HEADER } from '@restaurante/contracts';

import { ADMIN_PASSWORD, ADMIN_USER, USER_PASSWORD, setupAdmin, type Browser } from './admin.ts';
import { startServer } from './process.ts';
import { databaseUrl } from './test-database-config.ts';

/**
 * Usuarios por la API con los procesos reales (REQ-F-040) en los archivos
 * users-api-process*.test.ts. REQ-F-041: preparación compartida por los archivos en que se partió
 * users-api-process.test.ts, sin cambios.
 */

export const API_ENTRY = join('..', 'api', 'src', 'server.ts');
export const P = '/api/v1/admin';
export const NEW_PASSWORD = 'contraseña-nueva-de-040';
export const REPETITIONS = 10;

export const cleanups: (() => Promise<unknown>)[] = [];
/** Limpieza de la prueba (procesos, bases, proxies): cada archivo la registra con afterEach. */
export async function runCleanups(): Promise<void> {
  while (cleanups.length > 0) await cleanups.pop()?.();
}

export interface ApiSession {
  id: string;
  csrfToken: string;
}

export let ipCounter = 0;
export const nextIp = () => `198.51.100.${(ipCounter++ % 250) + 1}`;

export async function startStack() {
  const context = await setupAdmin();
  const api = await startServer({ DATABASE_URL: databaseUrl(context.database.config), INTERNAL_NOTIFY_TOKEN: undefined }, 60_000, { args: [API_ENTRY] });
  cleanups.push(() => api.stop());
  expect(api.started, api.output().stderr).toBe(true);

  async function apiLogin(username: string, password: string): Promise<Response> {
    return fetch(`${api.url}${P}/sesion`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': nextIp() },
      body: JSON.stringify({ username, password }),
    });
  }
  async function apiSession(username: string, password = USER_PASSWORD): Promise<ApiSession> {
    const res = await apiLogin(username, password);
    if (res.status !== 201) throw new Error(`El acceso de ${username} a la API respondió ${res.status}`);
    return ((await res.json()) as { session: ApiSession }).session;
  }
  function apiCall(path: string, auth: ApiSession, { method = 'GET', body }: { method?: string; body?: unknown } = {}): Promise<Response> {
    const headers: Record<string, string> = { authorization: `Bearer ${auth.id}` };
    if (method !== 'GET') headers[CSRF_HEADER] = auth.csrfToken;
    if (body !== undefined) headers['content-type'] = 'application/json';
    return fetch(`${api.url}${path}`, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  }
  const apiStatus = async (auth: ApiSession) => (await apiCall(`${P}/sesion`, auth)).status;
  /** 200 si la sesión del /admin actual sigue valiendo; 303 (al acceso) si no. */
  const landingStatus = async (browser: Browser) => (await browser.get('/admin')).status;
  const activeAdmins = () => context.prisma.user.findMany({ where: { role: 'admin', active: true }, select: { username: true }, orderBy: { id: 'asc' } });
  const audit = () => context.prisma.userAudit.findMany({ orderBy: { id: 'asc' } });
  return { context, api, apiLogin, apiSession, apiCall, apiStatus, landingStatus, activeAdmins, audit };
}

export type Stack = Awaited<ReturnType<typeof startStack>>;

export const ownerSession = (stack: Stack) => stack.apiSession(ADMIN_USER, ADMIN_PASSWORD);
