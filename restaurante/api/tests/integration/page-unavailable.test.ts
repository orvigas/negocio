import { describe, expect, it } from 'vitest';

import { createMemoryPageStore } from '@restaurante/core/catalog';

import { ADMIN, MOLOTES_EDITOR, call, session, startAdmin } from '../support/admin.ts';
import { createApiPages, PAGE_CUTOVER } from '../../src/page-cutover.ts';
import { AT_2, molotesFields, seedPages } from '../support/pages.ts';

/**
 * Ventana hasta el corte (REQ-F-044, RF-4; CA-18 en la API): la api nunca es un segundo escritor. Dos
 * casos: datos aún sin importar y, sobre todo, una imagen anterior al corte **con filas**, que es lo
 * que se encuentra tras una vuelta atrás del PR 3.
 */

const VERSION = `2@${AT_2}`;

const requests = (business: string) =>
  [
    ['GET', `/api/v1/admin/${business}/pagina`, undefined],
    ['PUT', `/api/v1/admin/${business}/pagina`, { expectedVersion: VERSION, fields: molotesFields() }],
    ['POST', `/api/v1/admin/${business}/pagina/restaurar`, { expectedVersion: VERSION }],
  ] as const;

describe.each([
  ['datos sin importar', { pageCutover: true, seeded: false }],
  ['imagen anterior al corte con filas (vuelta atrás)', { pageCutover: false, seeded: true }],
])('%s', (_, { pageCutover, seeded }) => {
  async function start() {
    const harness = await startAdmin({ pageCutover });
    if (seeded) seedPages(harness.pageStore);
    return { ...harness, before: structuredClone(harness.pageStore.state) };
  }

  it('lectura, guardado y restauración responden 503 PAGE_UNAVAILABLE y no escriben nada', async () => {
    const { url, pageStore, before, notified } = await start();
    const auth = await session(url, ADMIN);
    for (const [method, path, body] of requests('molotes')) {
      const res = await call(url, path, auth, { method, ...(body ? { body } : {}) });
      expect(res.status).toBe(503);
      expect(await res.json()).toMatchObject({ error: { code: 'PAGE_UNAVAILABLE' } });
    }
    expect(pageStore.state).toEqual(before);
    expect(notified).toEqual([]);
  });

  it('el endpoint público tampoco sirve datos', async () => {
    const { url } = await start();
    const res = await fetch(`${url}/api/v1/public/molotes/pagina`);
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: { code: 'PAGE_UNAVAILABLE' } });
  });

  it('un cuerpo inválido no cambia la respuesta: "no disponible" va antes', async () => {
    const { url } = await start();
    const auth = await session(url, ADMIN);
    expect((await call(url, '/api/v1/admin/molotes/pagina', auth, { method: 'PUT', body: { otro: 1 } })).status).toBe(503);
    expect((await call(url, '/api/v1/admin/molotes/pagina/restaurar', auth, { method: 'POST', body: { otro: 1 } })).status).toBe(503);
  });

  it('los permisos y el CSRF se comprueban igual, antes que la disponibilidad', async () => {
    const { url } = await start();
    expect((await call(url, '/api/v1/admin/molotes/pagina', null)).status).toBe(401);
    const editor = await session(url, MOLOTES_EDITOR);
    expect((await call(url, '/api/v1/admin/birria/pagina', editor)).status).toBe(403);
    expect((await call(url, '/api/v1/admin/molotes/pagina', editor, { method: 'PUT', csrf: null, body: {} })).status).toBe(403);
  });
});

describe('la constante del corte', () => {
  it('sigue apagada en esta imagen', () => {
    expect(PAGE_CUTOVER).toBe(false);
  });

  it('createApiPages, tal como la llama server.ts, no lee ni escribe aunque haya filas', async () => {
    const store = createMemoryPageStore();
    seedPages(store);
    const before = structuredClone(store.state);
    const pages = createApiPages({ store, timeZone: 'America/Mexico_City' });
    store.failNext(99);
    await expect(pages.get('molotes')).rejects.toMatchObject({ name: 'PageUnavailableError' });
    await expect(pages.save('molotes', { data: {}, expectedVersion: VERSION, author: { id: 1, name: 'Ana' } })).rejects.toMatchObject({ name: 'PageUnavailableError' });
    await expect(pages.restorePrevious('molotes', { expectedVersion: VERSION, author: { id: 1, name: 'Ana' } })).rejects.toMatchObject({ name: 'PageUnavailableError' });
    expect(store.state).toEqual(before);
  });
});
