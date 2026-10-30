import { join } from 'node:path';

import { expect } from 'vitest';

import { CSRF_HEADER } from '@restaurante/contracts';

import { ADMIN_PASSWORD, ADMIN_USER, USER_PASSWORD, setupAdmin } from './admin.ts';
import { startServer } from './process.ts';
import { databaseUrl } from './test-database-config.ts';

/**
 * QA de REQ-F-040 con los procesos reales en los archivos users-api-qa-req-f-040*.test.ts.
 * REQ-F-041: preparación compartida por los archivos en que se partió
 * users-api-qa-req-f-040.test.ts, sin cambios.
 */

export const API_ENTRY = join('..', 'api', 'src', 'server.ts');
export const P = '/api/v1/admin';
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
export const nextIp = () => `203.0.113.${(ipCounter++ % 250) + 1}`;

export async function startStack() {
  const context = await setupAdmin();
  const api = await startServer({ DATABASE_URL: databaseUrl(context.database.config), INTERNAL_NOTIFY_TOKEN: undefined }, 60_000, { args: [API_ENTRY] });
  cleanups.push(() => api.stop());
  expect(api.started, api.output().stderr).toBe(true);

  async function apiSession(username: string, password = USER_PASSWORD): Promise<ApiSession> {
    const res = await fetch(`${api.url}${P}/sesion`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': nextIp() },
      body: JSON.stringify({ username, password }),
    });
    if (res.status !== 201) throw new Error(`El acceso de ${username} a la API respondió ${res.status}`);
    return ((await res.json()) as { session: ApiSession }).session;
  }
  /** Petición con la sesión y el CSRF; `raw` envía el texto tal cual (claves que JSON.stringify no conserva). */
  function apiCall(path: string, auth: ApiSession, { method = 'GET', body, raw }: { method?: string; body?: unknown; raw?: string } = {}): Promise<Response> {
    const headers: Record<string, string> = { authorization: `Bearer ${auth.id}` };
    if (method !== 'GET' && method !== 'HEAD') headers[CSRF_HEADER] = auth.csrfToken;
    const payload = raw ?? (body === undefined ? undefined : JSON.stringify(body));
    if (payload !== undefined) headers['content-type'] = 'application/json';
    return fetch(`${api.url}${path}`, { method, headers, ...(payload === undefined ? {} : { body: payload }) });
  }
  const snapshot = async () => ({
    users: await context.prisma.user.findMany({ include: { businesses: true }, orderBy: { id: 'asc' } }),
    audit: await context.prisma.userAudit.findMany({ orderBy: { id: 'asc' } }),
  });
  const activeAdmins = () => context.prisma.user.findMany({ where: { role: 'admin', active: true }, select: { username: true } });
  return { context, api, apiSession, apiCall, snapshot, activeAdmins };
}

export type Stack = Awaited<ReturnType<typeof startStack>>;

export const ownerSession = (stack: Stack) => stack.apiSession(ADMIN_USER, ADMIN_PASSWORD);
export const errorOf = async (res: Response) => ((await res.json()) as { error: { code: string; fields?: Record<string, string> } }).error;
