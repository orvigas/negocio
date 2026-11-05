import { describe, expect, it } from 'vitest';

import { apiErrorSchema, pageResponseSchemas } from '@restaurante/contracts';
import { createMemoryPageStore, type MemoryPageStore } from '@restaurante/core/catalog';

import { createApiApp } from '../../src/app.ts';
import { createApiPages } from '../../src/page-cutover.ts';
import { recordingLogger } from '../support/admin.ts';
import { makeStore } from '../support/fixtures.ts';
import { listenLocal } from '../support/http.ts';
import { BIRRIA_PAGE, MOLOTES_PAGE, seedPages, stored } from '../support/pages.ts';

/** `GET /api/v1/public/<negocio>/pagina` (REQ-F-044, RF-4 y RF-5). */

async function start(prepare: (store: MemoryPageStore) => void = seedPages) {
  const pageStore = createMemoryPageStore();
  prepare(pageStore);
  const logger = recordingLogger();
  const pages = createApiPages({ store: pageStore, timeZone: 'America/Mexico_City', logger, cutover: true });
  const { url } = await listenLocal(createApiApp({ store: await makeStore(), pages, logger }));
  return { url, pageStore, logger };
}

describe('GET /api/v1/public/<negocio>/pagina', () => {
  it.each([
    ['molotes', MOLOTES_PAGE],
    ['birria', BIRRIA_PAGE],
  ] as const)('%s: 200 con los datos, validados por el contrato y sin caché', async (business, page) => {
    const { url } = await start();
    const res = await fetch(`${url}/api/v1/public/${business}/pagina`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body: unknown = await res.json();
    expect(pageResponseSchemas[business].safeParse(body).success).toBe(true);
    expect(body).toEqual({ data: page });
  });

  it('no expone autor, versión ni nada más que los datos', async () => {
    const { url } = await start();
    const text = await (await fetch(`${url}/api/v1/public/birria/pagina`)).text();
    expect(text).not.toContain('Ana');
    expect(text).not.toContain('revision');
  });

  it('sin caché: un dato nuevo en la base se ve en la siguiente lectura', async () => {
    const { url, pageStore } = await start(() => undefined);
    expect((await fetch(`${url}/api/v1/public/birria/pagina`)).status).toBe(503);
    pageStore.seed('birria', { current: stored(1, null, null, BIRRIA_PAGE), previous: null });
    expect((await fetch(`${url}/api/v1/public/birria/pagina`)).status).toBe(200);
  });

  it('sin datos: 503 PAGE_UNAVAILABLE con el formato común', async () => {
    const { url } = await start(() => undefined);
    const res = await fetch(`${url}/api/v1/public/molotes/pagina`);
    expect(res.status).toBe(503);
    const body: unknown = await res.json();
    expect(apiErrorSchema.safeParse(body).success).toBe(true);
    expect(body).toMatchObject({ error: { code: 'PAGE_UNAVAILABLE' } });
  });

  it('una fila inválida responde 503 sin filtrar su contenido', async () => {
    const { url, logger } = await start((store) => store.seed('birria', { current: { ...stored(1, null, null, {}), data: '{"secreto":1}' }, previous: null }));
    const res = await fetch(`${url}/api/v1/public/birria/pagina`);
    expect(res.status).toBe(503);
    expect(await res.text()).not.toContain('secreto');
    expect(logger.lines.join('\n')).not.toContain('secreto');
  });

  it('con la base caída: 503 DATABASE_UNAVAILABLE', async () => {
    const { url, pageStore } = await start();
    pageStore.failNext();
    const res = await fetch(`${url}/api/v1/public/birria/pagina`);
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: { code: 'DATABASE_UNAVAILABLE' } });
  });

  it('negocio desconocido: 404', async () => {
    const { url } = await start();
    const res = await fetch(`${url}/api/v1/public/tacos/pagina`);
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: { code: 'BUSINESS_NOT_FOUND' } });
  });

  it('otro método: 405 con Allow', async () => {
    const { url } = await start();
    const res = await fetch(`${url}/api/v1/public/birria/pagina`, { method: 'POST' });
    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toBe('GET, HEAD');
  });

  it('sin repositorio de página en la app, la ruta no existe', async () => {
    const { url } = await listenLocal(createApiApp({ store: await makeStore() }));
    expect((await fetch(`${url}/api/v1/public/birria/pagina`)).status).toBe(404);
  });
});
