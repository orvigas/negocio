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
