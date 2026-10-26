import { describe, expect, it } from 'vitest';

import { apiErrorSchema, productsResponseSchemas } from '@restaurante/contracts';
import { toPublished } from '@restaurante/core/catalog';
import { createLogger, type Logger } from '@restaurante/core/shared';

import { createApiApp } from '../../src/app.ts';
import { makeStore } from '../support/fixtures.ts';
import { listenLocal } from '../support/http.ts';

/** Endpoint público de productos (REQ-F-038, RF-1; CA-2 y CA-3), en proceso con el store en memoria. */

function recordingLogger(): Logger & { lines: string[] } {
  const lines: string[] = [];
  return { ...createLogger({ write: (line) => lines.push(line) }), lines };
}

async function start() {
  const store = await makeStore();
  const logger = recordingLogger();
  const { url } = await listenLocal(createApiApp({ store, logger }));
  return { store, logger, url };
}

describe('GET /api/v1/public/<negocio>/productos (CA-2)', () => {
  it.each(['molotes', 'birria'] as const)('%s: 200 con los productos publicados, validados por el contrato', async (business) => {
    const { store, url } = await start();
    const res = await fetch(`${url}/api/v1/public/${business}/productos`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    const body: unknown = await res.json();
    expect(productsResponseSchemas[business].safeParse(body).success).toBe(true);
    expect(body).toEqual({ data: toPublished(business, await store.listBusiness(business)) });
  });

  it('respeta el orden por posición y no publica los eliminados', async () => {
    const { url } = await start();
    const molotes = await (await fetch(`${url}/api/v1/public/molotes/productos`)).json();
    expect(molotes).toMatchObject({ data: { menu: [{ id: 'queso' }], drinks: [{ id: 'cafe' }] } });
    const birria = await (await fetch(`${url}/api/v1/public/birria/productos`)).json();
    expect(birria.data.menu.map((item: { slug: string }) => item.slug)).toEqual(['consome', 'tacos', 'refresco']);
  });

  it('HEAD responde 200 sin cuerpo', async () => {
    const { url } = await start();
    const res = await fetch(`${url}/api/v1/public/birria/productos`, { method: 'HEAD' });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('');
  });

  it.each(['tacos', 'MOLOTES', '__proto__', 'constructor'])('negocio desconocido (%s) -> 404 con el formato de error', async (business) => {
    const { url } = await start();
    const res = await fetch(`${url}/api/v1/public/${business}/productos`);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(apiErrorSchema.safeParse(body).success).toBe(true);
    expect(body.error.code).toBe('BUSINESS_NOT_FOUND');
  });

  it.each(['/', '/api/v1/public/birria', '/api/v1/public/birria/productos/1', '/api/v2/public/birria/productos', '/admin'])('otra ruta (%s) -> 404 NOT_FOUND', async (path) => {
    const { url } = await start();
    const res = await fetch(`${url}${path}`);
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe('NOT_FOUND');
  });

  it.each(['POST', 'PUT', 'DELETE', 'PATCH'])('%s -> 405 con Allow y el formato de error', async (method) => {
    const { store, url } = await start();
    const before = structuredClone(store.state.products);
    const res = await fetch(`${url}/api/v1/public/molotes/productos`, { method, body: method === 'DELETE' ? null : '{}' });
    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toBe('GET, HEAD');
    expect((await res.json()).error.code).toBe('METHOD_NOT_ALLOWED');
    expect(store.state.products).toEqual(before);
  });

  it('base no disponible -> 503 sin stack, SQL ni credenciales; el log solo lleva nombre y código', async () => {
    const { store, logger, url } = await start();
    store.failNext();
    const res = await fetch(`${url}/api/v1/public/birria/productos`);
    expect(res.status).toBe(503);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: { code: 'DATABASE_UNAVAILABLE', message: 'Servicio no disponible temporalmente.' } });
    expect(text).not.toMatch(/stack|select|mysql:|password/i);
    const error = logger.lines.map((line) => JSON.parse(line)).find((line) => line.msg === 'request_error');
    expect(error).toMatchObject({ status: 503, name: 'DatabaseUnavailableError' });
    expect(Object.keys(error)).not.toContain('message');
  });

  it('error inesperado -> 500 genérico', async () => {
    const logger = recordingLogger();
    const store = { listBusiness: () => Promise.reject(new Error('SELECT * FROM product; mysql://u:secreto@h/db')) };
    const { url } = await listenLocal(createApiApp({ store, logger }));
    const res = await fetch(`${url}/api/v1/public/birria/productos`);
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'Error interno.' } });
    expect(logger.lines.join('')).not.toContain('secreto');
  });

  it('registra cada petición sin query string', async () => {
    const { logger, url } = await start();
    await fetch(`${url}/api/v1/public/birria/productos?token=x`);
    const request = logger.lines.map((line) => JSON.parse(line)).find((line) => line.msg === 'request');
    expect(request).toMatchObject({ method: 'GET', path: '/api/v1/public/birria/productos', status: 200 });
    expect(JSON.stringify(request)).not.toContain('token');
  });
});

describe('sin caché en la API (CA-3)', () => {
  it('un cambio en el store se ve en la petición siguiente', async () => {
    const { store, url } = await start();
    const get = async () => (await (await fetch(`${url}/api/v1/public/molotes/productos`)).json()).data.menu[0];
    expect(await get()).toMatchObject({ name: 'Molote de Queso', unitPriceCents: 2500 });
    await store.transaction(async (tx) => {
      const [queso] = (await tx.listBusiness('molotes')).filter((product) => product.slug === 'queso');
      await tx.replace({ ...queso!, name: 'Molote Nuevo', priceCents: 2700, version: queso!.version + 1 }, queso!.version);
    });
    expect(await get()).toMatchObject({ name: 'Molote Nuevo', unitPriceCents: 2700 });
  });
});
