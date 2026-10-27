import { describe, expect, it } from 'vitest';

import { MAX_RESPONSE_BYTES, createPublicApiClient, type FetchFn } from '@restaurante/contracts';

/**
 * Cliente del endpoint público de productos (REQ-F-038, RF-2 y RF-5): valida todo lo que recibe con
 * el contrato y nunca lanza (CA-5: una respuesta inválida, lenta o caída es "API no disponible").
 */

const BIRRIA = {
  data: {
    menu: [
      {
        slug: 'tacos',
        name: 'Tacos',
        tag: 'Crujiente',
        available: true,
        image: { src: '/img/birria/tacos.jpg', alt: 'Tacos', width: 800, height: 600 },
        detailsLabel: 'Incluye:',
        detailsType: 'chips',
        description: 'Dorados.',
        priceCents: 4000,
        priceUnit: 'c/u',
        chips: [{ text: 'Consomé', highlight: true }],
      },
    ],
  },
};

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json; charset=utf-8' }, ...init });

function client(fetchFn: FetchFn, timeoutMs = 200) {
  const calls: { url: string; init: RequestInit }[] = [];
  const api = createPublicApiClient({
    baseUrl: 'http://api.test:3001',
    timeoutMs,
    fetch: (url, init) => {
      calls.push({ url, init });
      return fetchFn(url, init);
    },
  });
  return { api, calls };
}

describe('createPublicApiClient', () => {
  it('pide la ruta del contrato sin seguir redirecciones y devuelve los datos validados', async () => {
    const { api, calls } = client(async () => json(BIRRIA));
    expect(await api.getProducts('birria')).toEqual({ ok: true, data: BIRRIA.data });
    expect(calls[0]!.url).toBe('http://api.test:3001/api/v1/public/birria/productos');
    expect(calls[0]!.init).toMatchObject({ method: 'GET', redirect: 'error' });
  });

  it('descarta los campos que el contrato no conoce (cambio compatible de la API)', async () => {
    const extended = { data: { menu: [{ ...BIRRIA.data.menu[0], nuevoCampo: 1 }] }, meta: {} };
    const result = await client(async () => json(extended)).api.getProducts('birria');
    expect(result).toEqual({ ok: true, data: BIRRIA.data });
  });

  it.each([503, 404, 500, 301])('estado %i -> http_status', async (status) => {
    expect(await client(async () => json({ error: { code: 'X', message: 'x' } }, { status })).api.getProducts('birria')).toEqual({ ok: false, reason: 'http_status', status });
  });

  it.each([
    ['otro Content-Type', () => new Response(JSON.stringify(BIRRIA), { status: 200, headers: { 'content-type': 'text/html' } })],
    ['JSON mal formado', () => new Response('{"data":', { status: 200, headers: { 'content-type': 'application/json' } })],
    ['sin el contrato', () => json({ data: { menu: [{ slug: 'x' }] } })],
    ['precio negativo', () => json({ data: { menu: [{ ...BIRRIA.data.menu[0], priceCents: -1 }] } })],
    ['sin la lista del negocio', () => json({ data: { drinks: [] } })],
    ['más de 1 MiB', () => json({ data: { menu: [], relleno: 'x'.repeat(MAX_RESPONSE_BYTES) } })],
  ])('%s -> invalid_body', async (_name, response) => {
    expect(await client(async () => response()).api.getProducts('birria')).toEqual({ ok: false, reason: 'invalid_body' });
  });

  it('error de red -> network', async () => {
    expect(await client(() => Promise.reject(new TypeError('fetch failed'))).api.getProducts('molotes')).toEqual({ ok: false, reason: 'network' });
  });

  it('más lento que el límite -> timeout (aborta la petición)', async () => {
    const slow: FetchFn = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('La petición se abortó', 'TimeoutError')));
      });
    const started = Date.now();
    expect(await client(slow, 50).api.getProducts('molotes')).toEqual({ ok: false, reason: 'timeout' });
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('valida sus opciones', () => {
    expect(() => createPublicApiClient({ baseUrl: 'http://api:3001/', timeoutMs: 100 })).toThrow(TypeError);
    expect(() => createPublicApiClient({ baseUrl: 'http://api:3001', timeoutMs: 0 })).toThrow(TypeError);
  });
});
