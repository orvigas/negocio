import { describe, expect, it } from 'vitest';

import { pageStateResponseSchema } from '@restaurante/contracts';

import { ADMIN, MOLOTES_EDITOR, call, session, startAdmin } from '../support/admin.ts';
import { AT_2, BIRRIA_PAGE, molotesFields, seedPages } from '../support/pages.ts';

/** `GET /api/v1/admin/<negocio>/pagina` (REQ-F-044, RF-6 y RF-7). */

const path = (business: string) => `/api/v1/admin/${business}/pagina`;

async function start() {
  const harness = await startAdmin();
  seedPages(harness.pageStore);
  return harness;
}

describe('leer la página en la API de administración', () => {
  it('devuelve el estado, los valores del formulario y los campos', async () => {
    const { url } = await start();
    const res = await call(url, path('molotes'), await session(url, ADMIN));
    expect(res.status).toBe(200);
    const body: unknown = await res.json();
    const parsed = pageStateResponseSchema.parse(body);
    expect(parsed.page).toEqual({ version: `2@${AT_2}`, updatedAt: AT_2, updatedBy: 'Ana Admin', hasPrevious: true, values: molotesFields() });
    expect(parsed.fields.map((field) => field.name)).toEqual(Object.keys(molotesFields()));
  });

  it('el administrador lee ambos negocios', async () => {
    const { url } = await start();
    const res = await call(url, path('birria'), await session(url, ADMIN));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ page: { values: { 'hero.showcase.title': BIRRIA_PAGE.hero.showcase.title } } });
  });

  it('sin sesión: 401', async () => {
    const { url } = await start();
    expect((await call(url, path('molotes'), null)).status).toBe(401);
  });

  it('negocio desconocido: 404', async () => {
    const { url } = await start();
    expect((await call(url, path('tacos'), await session(url, ADMIN))).status).toBe(404);
  });

  it('CA-10: un editor de Molotes recibe 403 en Birria, sin datos', async () => {
    const { url } = await start();
    const auth = await session(url, MOLOTES_EDITOR);
    expect((await call(url, path('molotes'), auth)).status).toBe(200);
    const res = await call(url, path('birria'), auth);
    expect(res.status).toBe(403);
    expect(await res.text()).not.toContain(BIRRIA_PAGE.hero.showcase.title);
  });

  it('con la base caída: 503 DATABASE_UNAVAILABLE, distinto de "no disponible"', async () => {
    const { url, pageStore } = await start();
    const auth = await session(url, ADMIN);
    pageStore.failNext();
    const res = await call(url, path('molotes'), auth);
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: { code: 'DATABASE_UNAVAILABLE' } });
  });
});
