import { createServer, type Server, type ServerResponse } from 'node:http';
import { join } from 'node:path';

import { expect } from 'vitest';

import { adminPaths, type BotState } from '@restaurante/contracts';

import { ADMIN_PASSWORD, ADMIN_USER } from './admin.ts';
import { start } from './admin-bot-qa-req-f-043-proceso.ts';
import { startServer } from './process.ts';

/**
 * Sondas de QA de REQ-F-043, PR 2 (pantalla "Bot"), de caja negra: `inventory-manager` es siempre un
 * proceso real, sin importar su código (una app nunca importa otra app). Enfrente, la `api` real con
 * MySQL de pruebas y el webhook firmado, o una `api` falsa de `node:http` que da fallos a voluntad.
 */

export const INVENTORY_ENTRY = join('..', 'inventory-manager', 'src', 'server.ts');
/** Número de prueba conocido: se busca completo, sin prefijo y con separadores. */
export const PHONE = '525598765432';
export const PHONE_LOCAL = '5598765432';
export const PHONE_PIECES = [PHONE, PHONE_LOCAL, '55 9876 5432', '55-9876-5432'];
export const UNCONFIRMED = 'No pudimos confirmar el cambio. Revisa el estado antes de repetirlo.';
export const SAVED_CLAIM = /no se (?:guardó|ha guardado|pudo guardar)|sin guardar|nada guardado/i;
const SID = 'qa-sesion-falsa-de-req-f-043';

export const cleanups: (() => Promise<unknown>)[] = [];
export async function runCleanups(): Promise<void> {
  while (cleanups.length > 0) await cleanups.pop()?.();
}

export async function startInventory(apiUrl: string) {
  const proc = await startServer({ NODE_ENV: 'development', API_INTERNAL_URL: apiUrl }, 60_000, { args: [INVENTORY_ENTRY] });
  cleanups.push(() => proc.stop());
  expect(proc.started, proc.output().stderr).toBe(true);
  return proc;
}

export interface Seen {
  status: number;
  location: string;
  html: string;
}

/** Un navegador sin JavaScript: su cookie, mismo origen, sin seguir redirecciones. */
export function browser(url: string, initialCookie = '') {
  let cookie = initialCookie;
  const same = { Origin: url, 'Sec-Fetch-Site': 'same-origin' };
  async function read(res: Response): Promise<Seen> {
    for (const line of res.headers.getSetCookie()) {
      const pair = line.split(';')[0] ?? '';
      cookie = pair.endsWith('=') ? '' : pair;
    }
    return { status: res.status, location: res.headers.get('location') ?? '', html: await res.text() };
  }
  const headers = (extra: Record<string, string>) => ({ ...same, ...(cookie ? { Cookie: cookie } : {}), ...extra });
  return {
    get: async (path: string, extra: Record<string, string> = {}) => read(await fetch(`${url}${path}`, { redirect: 'manual', headers: headers(extra) })),
    post: async (path: string, form: Record<string, string>, extra: Record<string, string> = {}) =>
      read(await fetch(`${url}${path}`, { method: 'POST', redirect: 'manual', headers: headers({ 'Content-Type': 'application/x-www-form-urlencoded', ...extra }), body: new URLSearchParams(form).toString() })),
    /** Cuerpo tal cual (tamaños, tipos y formularios mal formados). */
    send: async (path: string, body: string, type: string) => read(await fetch(`${url}${path}`, { method: 'POST', redirect: 'manual', headers: headers({ 'Content-Type': type }), body })),
  };
}
export type Browser = ReturnType<typeof browser>;

export const csrfOf = (html: string): string => /name="_csrf" value="([^"]*)"/.exec(html)?.[1] ?? '';
/** Campo del alta (`b-telefono`, `b-motivo`): la pantalla tiene varios `motivo`. */
export const inputOf = (html: string, name: string): string => new RegExp(`<input[^>]*id="b-${name}"[^>]*>`).exec(html)?.[0] ?? '';
export const valueOf = (html: string, name: string): string | undefined => /value="([^"]*)"/.exec(inputOf(html, name))?.[1];
export const selectedDuration = (html: string): string | undefined => /id="b-duracion"[\s\S]*?<option value="([^"]*)" selected/.exec(html)?.[1];
export const noPhone = (content: string, where: string): void => {
  for (const piece of PHONE_PIECES) expect(content.includes(piece), `${piece} en ${where}`).toBe(false);
};

export async function signIn(url: string, username = ADMIN_USER, password = ADMIN_PASSWORD): Promise<Browser> {
  const b = browser(url);
  const res = await b.post('/acceso', { username, password, next: '/bot' });
  expect(res.status, res.html.slice(0, 200)).toBe(303);
  return b;
}

/** `api` real (MySQL y webhook firmado) e `inventory-manager` real, con el administrador dentro. */
export async function startReal(env: Record<string, string> = {}) {
  const api = await start(env);
  const inventory = await startInventory(api.running.api.url);
  const admin = await signIn(inventory.url);
  const page = async (b: Browser = admin) => (await b.get('/bot')).html;
  const csrf = async (b: Browser = admin) => csrfOf(await page(b));
  const logs = () => [api.running.api, inventory].flatMap((proc) => [proc.output().stdout, proc.output().stderr]).join('\n');
  const auditActions = async () => (await api.context.prisma.botAudit.findMany({ orderBy: { id: 'asc' } })).map(({ action }) => action);
  return { ...api, inventory, admin, page, csrf, logs, auditActions };
}

export type Reply = { status: number; body?: unknown } | 'destroy' | 'invalid' | 'hang';
const http = (status: number, code: string, message = 'Fallo de prueba.', fields?: Record<string, string>): Reply => ({ status, body: { error: { code, message, ...(fields ? { fields } : {}) } } });
export const FAILURES: Readonly<Record<string, Reply>> = Object.freeze({
  '503': http(503, 'SERVICE_UNAVAILABLE'),
  '500': http(500, 'INTERNAL_ERROR'),
  '502': http(502, 'BAD_GATEWAY'),
  network: 'destroy',
  invalid: 'invalid',
  'api anterior (404 NOT_FOUND)': http(404, 'NOT_FOUND', 'No encontrado.'),
  '429': http(429, 'RATE_LIMITED', 'Demasiadas peticiones.'),
  '400': http(400, 'INVALID_BODY', 'Cuerpo inválido.'),
});
export const failure = http;

export function emptyBot(): BotState {
  return {
    status: { enabled: true, provider: 'meta' },
    control: { paused: false, changedAt: null, changedByName: null, reason: null },
    usage: {
      day: '2026-11-05',
      month: '2026-11',
      timeZone: 'America/Mexico_City',
      counters: [
        { id: 'templates_day', used: 1, limit: 50, reached: false },
        { id: 'templates_month', used: 1, limit: 900, reached: false },
        { id: 'outbound_day', used: 1, limit: 500, reached: false },
        { id: 'outbound_month', used: 1, limit: 9000, reached: false },
        { id: 'budget', used: 1, limit: 25_000_000, reached: false },
      ],
    },
    reached: [],
    blocks: [],
    canBlock: true,
    previousKeyBlocks: 0,
    storeHealthy: true,
  };
}

/** `api` falsa, solo en 127.0.0.1: `session`, `read` y `write` deciden la siguiente respuesta. */
export async function startFakeApi() {
  const fake = {
    url: '',
    bot: emptyBot(),
    session: null as Reply | null,
    read: null as Reply | null,
    write: null as Reply | null,
    /** Lo que llegó a la API, con cuerpo: el teléfono solo puede estar aquí. */
    seen: [] as string[],
  };
  const answer = (res: ServerResponse, reply: Reply): void => {
    if (reply === 'hang') return;
    if (reply === 'destroy') {
      res.destroy();
      return;
    }
    if (reply === 'invalid') {
      res.writeHead(200, { 'content-type': 'application/json' }).end('{"inesperado":true}');
      return;
    }
    res.writeHead(reply.status, { 'content-type': 'application/json' }).end(JSON.stringify(reply.body));
  };
  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      fake.seen.push(`${req.method ?? ''} ${req.url ?? ''} ${Buffer.concat(chunks).toString()}`);
      if (req.url === adminPaths.session) return answer(res, fake.session ?? { status: 200, body: { user: { id: 1, name: 'Ana Admin', role: 'admin', businesses: ['molotes', 'birria'] }, csrfToken: 'csrf-de-prueba' } });
      if (req.method === 'GET' && req.url === adminPaths.bot) return answer(res, fake.read ?? { status: 200, body: { bot: fake.bot } });
      return answer(res, fake.write ?? { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Sin respuesta preparada.' } } });
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  fake.url = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
  cleanups.push(() => new Promise((resolve) => {
    server.closeAllConnections();
    server.close(resolve);
  }));
  return fake;
}

/** `inventory-manager` real contra la `api` falsa, con una sesión ya abierta. */
export async function startAgainstFake() {
  const fake = await startFakeApi();
  const inventory = await startInventory(fake.url);
  return { fake, inventory, admin: browser(inventory.url, `admin_sid=${SID}`) };
}

export const TOKEN = 'a'.repeat(32);
/** Los 4 POST de la pantalla. */
export const WRITES: readonly (readonly [string, Record<string, string>])[] = [
  ['/bot/interruptor', { _csrf: 'csrf-de-prueba', accion: 'pausar', motivo: 'Prueba' }],
  ['/bot/bloqueos', { _csrf: 'csrf-de-prueba', telefono: PHONE, duracion: '30d', motivo: 'Prueba' }],
  ['/bot/bloqueos/7/quitar', { _csrf: 'csrf-de-prueba' }],
  [`/bot/topes/${TOKEN}/bloquear`, { _csrf: 'csrf-de-prueba', duracion: '30d', motivo: 'Prueba' }],
];
