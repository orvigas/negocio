import { describe, expect, it } from 'vitest';

import { createAdminApiClient, type AdminFetch } from '@restaurante/contracts';

/** Cliente de /api/v1/admin (packages/contracts, REQ-F-039): nunca lanza y valida con el contrato. */

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const USER = { id: 1, name: 'Ana', role: 'admin', businesses: ['molotes'] };

function client(reply: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetch: AdminFetch = async (url, init) => {
    calls.push({ url, init });
    return reply(url, init);
  };
  return { api: createAdminApiClient({ baseUrl: 'http://api:3001', timeoutMs: 200, fetch }), calls };
}

const header = (init: RequestInit | undefined, name: string) => new Headers(init?.headers).get(name);

describe('createAdminApiClient', () => {
  it('login: reenvía la IP del visitante y valida la respuesta 201', async () => {
    const { api, calls } = client(() => json(201, { session: { id: 's'.repeat(43), csrfToken: 'c' }, user: USER }));
    const result = await api.login({ username: 'ana', password: 'x' }, '203.0.113.9');
    expect(result).toMatchObject({ ok: true, status: 201, data: { user: { name: 'Ana' } } });
    expect(calls[0]?.url).toBe('http://api:3001/api/v1/admin/sesion');
    expect(header(calls[0]?.init, 'x-forwarded-for')).toBe('203.0.113.9');
    expect(calls[0]?.init.redirect).toBe('error');
  });

  it('reenvía la sesión como Bearer; el token CSRF solo en escrituras; la clave de idempotencia en el alta', async () => {
    const product = { id: 1, business: 'molotes', category: 'bebida', detailsType: null, slug: 'a', name: 'A', available: false, position: 1, version: 1, deleted: false, deletedAt: null, createdAt: 'x', updatedAt: 'x', updatedBy: null };
    const { api, calls } = client((url, init) => (init.method === 'GET' ? json(200, { products: [] }) : json(201, { product, meta: { freshness: 'pending' } })));
    await api.listProducts({ sessionId: 'sid', csrfToken: 'tok' }, 'molotes', { deleted: true });
    expect(calls[0]?.url).toBe('http://api:3001/api/v1/admin/molotes/productos?eliminados=1');
    expect(header(calls[0]?.init, 'authorization')).toBe('Bearer sid');
    expect(header(calls[0]?.init, 'x-csrf-token')).toBeNull();
    const created = await api.createProduct({ sessionId: 'sid', csrfToken: 'tok' }, 'molotes', { name: 'A' }, 'clave-idempotencia-0001');
    expect(created).toMatchObject({ ok: true, data: { meta: { freshness: 'pending' } } });
    expect(header(calls[1]?.init, 'x-csrf-token')).toBe('tok');
    expect(header(calls[1]?.init, 'idempotency-key')).toBe('clave-idempotencia-0001');
    expect(calls[1]?.init.body).toBe(JSON.stringify({ name: 'A' }));
  });

  it('un error de la API vuelve con su código, sus campos y la versión vigente', async () => {
    const { api } = client(() => json(409, { error: { code: 'VERSION_CONFLICT', message: 'Cambió', current: { id: 1, version: 3, updatedAt: 'x', updatedBy: 'Luis' } } }));
    const result = await api.updateProduct({ sessionId: 's', csrfToken: 't' }, 'molotes', 1, {}, { overwrite: true });
    expect(result).toEqual({ ok: false, kind: 'http', status: 409, error: { code: 'VERSION_CONFLICT', message: 'Cambió', current: { id: 1, version: 3, updatedAt: 'x', updatedBy: 'Luis' } } });
  });

  it('nunca lanza: red caída, límite de tiempo, cuerpo que no es JSON o que no cumple el contrato', async () => {
    expect(await client(() => Promise.reject(new TypeError('fetch failed'))).api.session({ sessionId: 's' })).toEqual({ ok: false, kind: 'network' });
    const slow = client((_url, init) => new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('t'), { name: 'TimeoutError' })))));
    expect(await slow.api.session({ sessionId: 's' })).toEqual({ ok: false, kind: 'timeout' });
    expect(await client(() => new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } })).api.session({ sessionId: 's' })).toMatchObject({ ok: false, kind: 'invalid_response' });
    expect(await client(() => json(200, { user: { id: 'x' } })).api.session({ sessionId: 's' })).toMatchObject({ ok: false, kind: 'invalid_response' });
  });

  it('salir: 204 sin cuerpo', async () => {
    const { api } = client(() => new Response(null, { status: 204 }));
    expect(await api.logout({ sessionId: 's', csrfToken: 't' })).toEqual({ ok: true, status: 204, data: null });
  });

  it('exige baseUrl sin barra final y un límite positivo', () => {
    expect(() => createAdminApiClient({ baseUrl: 'http://api/', timeoutMs: 1 })).toThrow(TypeError);
    expect(() => createAdminApiClient({ baseUrl: 'http://api', timeoutMs: 0 })).toThrow(TypeError);
  });
});

describe('control del bot (REQ-F-043)', () => {
  const BOT = {
    status: { enabled: true, provider: 'meta' },
    control: { paused: false, changedAt: null, changedByName: null, reason: null },
    usage: { day: '2026-11-04', month: '2026-11', timeZone: 'America/Mexico_City', counters: [{ id: 'budget', used: 0, limit: 20_000_000, reached: false }] },
    reached: [{ token: 'a'.repeat(32), masked: '*********5678', cap: 'burst', at: '2026-11-04T12:00:00-06:00' }],
    blocks: [{ id: null, pending: true, masked: '*********5678', origin: 'tope', reason: null, author: null, since: '2026-11-04T12:00:00-06:00', until: null }],
    canBlock: true,
    previousKeyBlocks: 0,
    storeHealthy: true,
  };
  const AUTH = { sessionId: 's', csrfToken: 'c' };
  const P = 'http://api:3001/api/v1/admin/bot';
  const MASKED = { block: { masked: '*********5678' } };

  it('lee el estado sin token CSRF y valida la respuesta', async () => {
    const { api, calls } = client(() => json(200, { bot: BOT }));
    expect(await api.getBot(AUTH)).toMatchObject({ ok: true, data: { bot: { canBlock: true } } });
    expect(calls[0]?.url).toBe(P);
    expect(header(calls[0]?.init, 'x-csrf-token')).toBeNull();
  });

  it('una respuesta que no cumple el contrato es `invalid_response`', async () => {
    const { api } = client(() => json(200, { bot: { ...BOT, canBlock: 'si' } }));
    expect(await api.getBot(AUTH)).toMatchObject({ ok: false, kind: 'invalid_response' });
  });

  it('las escrituras usan su método, su ruta y el token CSRF; el teléfono viaja solo en el cuerpo', async () => {
    const replies: [number, unknown][] = [[200, { control: BOT.control }], [201, MASKED], [200, MASKED], [201, MASKED]];
    const { api, calls } = client(() => {
      const [status, body] = replies.shift() as [number, unknown];
      return json(status, body);
    });
    expect((await api.setBotPaused(AUTH, { paused: true })).ok).toBe(true);
    expect((await api.blockNumber(AUTH, { phone: '5215512345678', duration: '7d' })).ok).toBe(true);
    expect((await api.unblockNumber(AUTH, 7)).ok).toBe(true);
    expect((await api.blockReached(AUTH, 'a b', { duration: '7d' })).ok).toBe(true);
    expect(calls.map(({ url, init }) => `${init.method} ${url}`)).toEqual([
      `PUT ${P}/interruptor`,
      `POST ${P}/bloqueos`,
      `POST ${P}/bloqueos/7/quitar`,
      `POST ${P}/topes/a%20b/bloquear`,
    ]);
    for (const call of calls) expect(header(call.init, 'x-csrf-token')).toBe('c');
    expect(calls.map(({ url }) => url).join()).not.toContain('5215512345678');
    expect(calls[1]?.init.body).toContain('5215512345678');
  });

  it('un error de dominio llega con su código', async () => {
    const { api } = client(() => json(409, { error: { code: 'BOT_NUMBER_ALREADY_BLOCKED', message: 'Ya está.' } }));
    expect(await api.blockNumber(AUTH, { phone: 'x', duration: '7d' })).toMatchObject({ ok: false, kind: 'http', status: 409, error: { code: 'BOT_NUMBER_ALREADY_BLOCKED' } });
  });
});

describe('datos de página (REQ-F-044)', () => {
  const auth = { sessionId: 'sesion', csrfToken: 'csrf' };
  const PAGE = { version: '3@2026-10-26T12:00:00-06:00', updatedAt: '2026-10-26T12:00:00-06:00', updatedBy: 'Ana', hasPrevious: true, values: { 'promo.title': 'Promo' } };
  const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  function clientReturning(response: Response) {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetch: AdminFetch = async (url, init) => {
      calls.push({ url, init });
      return response;
    };
    return { client: createAdminApiClient({ baseUrl: 'http://api:3001', timeoutMs: 100, fetch }), calls };
  }

  it('lee la página con sus campos', async () => {
    const fields = [{ name: 'promo.title', group: 'Promoción', kind: 'text', label: 'Título', max: 120, optional: false }];
    const { client, calls } = clientReturning(jsonResponse({ page: PAGE, fields }));
    await expect(client.getPage(auth, 'birria')).resolves.toEqual({ ok: true, status: 200, data: { page: PAGE, fields } });
    expect(calls[0]?.url).toBe('http://api:3001/api/v1/admin/birria/pagina');
  });

  it('guarda con PUT y el token CSRF', async () => {
    const { client, calls } = clientReturning(jsonResponse({ page: PAGE, meta: { freshness: 'pending' } }));
    const input = { expectedVersion: '2@x', fields: { 'promo.title': 'Nueva' } };
    await expect(client.savePage(auth, 'molotes', input)).resolves.toMatchObject({ ok: true, data: { meta: { freshness: 'pending' } } });
    expect(calls[0]).toMatchObject({ url: 'http://api:3001/api/v1/admin/molotes/pagina', init: { method: 'PUT', body: JSON.stringify(input) } });
    expect(new Headers(calls[0]?.init.headers).get('x-csrf-token')).toBe('csrf');
  });

  it('restaura por POST con la versión esperada', async () => {
    const { client, calls } = clientReturning(jsonResponse({ page: PAGE, meta: { freshness: 'confirmed' } }));
    await client.restorePage(auth, 'molotes', { expectedVersion: '2@x' });
    expect(calls[0]).toMatchObject({ url: 'http://api:3001/api/v1/admin/molotes/pagina/restaurar', init: { method: 'POST', body: '{"expectedVersion":"2@x"}' } });
  });

  it('un 409 conserva quién y cuándo guardó', async () => {
    const currentPage = { version: '4@y', updatedAt: 'y', updatedBy: 'Eli' };
    const { client } = clientReturning(jsonResponse({ error: { code: 'PAGE_CONFLICT', message: 'x', currentPage } }, 409));
    await expect(client.savePage(auth, 'molotes', { expectedVersion: '2@x', fields: {} })).resolves.toMatchObject({ ok: false, kind: 'http', status: 409, error: { code: 'PAGE_CONFLICT', currentPage } });
  });

  it('el 503 "no disponible" llega con su código, distinto de una caída', async () => {
    const { client } = clientReturning(jsonResponse({ error: { code: 'PAGE_UNAVAILABLE', message: 'x' } }, 503));
    await expect(client.getPage(auth, 'birria')).resolves.toMatchObject({ ok: false, kind: 'http', status: 503, error: { code: 'PAGE_UNAVAILABLE' } });
  });
});
