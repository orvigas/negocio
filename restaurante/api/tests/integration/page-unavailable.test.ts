import { describe, expect, it } from 'vitest';

import { ADMIN, MOLOTES_EDITOR, call, session, startAdmin } from '../support/admin.ts';
import { AT_2, molotesFields } from '../support/pages.ts';

/**
 * Datos aún sin importar (REQ-F-044, RF-4; CA-18 en la API): la api nunca escribe ni sirve una página
 * que no existe. Es lo que ocurre dentro del despliegue del corte, entre el arranque de la api nueva y
 * la importación que hace la `app` nueva.
 */

const VERSION = `2@${AT_2}`;

const requests = (business: string) =>
  [
    ['GET', `/api/v1/admin/${business}/pagina`, undefined],
    ['PUT', `/api/v1/admin/${business}/pagina`, { expectedVersion: VERSION, fields: molotesFields() }],
    ['POST', `/api/v1/admin/${business}/pagina/restaurar`, { expectedVersion: VERSION }],
  ] as const;

describe('datos sin importar', () => {
  async function start() {
    const harness = await startAdmin();
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
