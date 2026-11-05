import { describe, expect, it } from 'vitest';

import { pageWriteResponseSchema } from '@restaurante/contracts';

import { ADMIN, MOLOTES_EDITOR, call, session, startAdmin } from '../support/admin.ts';
import { AT_2, MOLOTES_PAGE, molotesFields, seedPages } from '../support/pages.ts';

/** Guardar y restaurar la página (REQ-F-044, RF-6 a RF-9; CA-8 a CA-12). */

const path = '/api/v1/admin/molotes/pagina';
const VERSION = `2@${AT_2}`;
const NOW = '2026-10-26T12:00:00-06:00';

async function start() {
  const harness = await startAdmin();
  seedPages(harness.pageStore);
  return { ...harness, auth: await session(harness.url, ADMIN) };
}

const snapshot = (harness: Awaited<ReturnType<typeof start>>) => structuredClone(harness.pageStore.state);

describe('guardar', () => {
  it('escribe, con el autor de la sesión, avisa a la landing y dice si ya se ve', async () => {
    const harness = await start();
    const res = await call(harness.url, path, harness.auth, { method: 'PUT', body: { expectedVersion: VERSION, fields: molotesFields({ 'promo.title': 'Nueva' }) } });
    expect(res.status).toBe(200);
    const body = pageWriteResponseSchema.parse(await res.json());
    expect(body).toMatchObject({ page: { version: `3@${NOW}`, updatedBy: 'Ana Admin', values: { 'promo.title': 'Nueva' } }, meta: { freshness: 'confirmed' } });
    expect(harness.notified).toEqual(['molotes']);
    expect(harness.pageStore.state.changes).toEqual([
      { at: NOW, business: 'molotes', author: 'Ana Admin', authorId: harness.ids.ana, action: 'save', changes: [{ field: 'promo.title', before: 'Dos por uno', after: 'Nueva' }] },
    ]);
  });

  it('CA-8: si el aviso no se confirma, responde pending, y lo guardado queda', async () => {
    const harness = await start();
    harness.notifier.freshness = 'pending';
    const res = await call(harness.url, path, harness.auth, { method: 'PUT', body: { expectedVersion: VERSION, fields: molotesFields({ 'promo.title': 'Nueva' }) } });
    expect(await res.json()).toMatchObject({ meta: { freshness: 'pending' } });
    expect(harness.pageStore.state.changes).toHaveLength(1);
  });

  it('CA-9: la segunda persona con la misma versión recibe 409 con quién y cuándo, y puede sobrescribir', async () => {
    const harness = await start();
    const eli = await session(harness.url, MOLOTES_EDITOR);
    await call(harness.url, path, harness.auth, { method: 'PUT', body: { expectedVersion: VERSION, fields: molotesFields({ 'promo.title': 'De Ana' }) } });
    const conflict = await call(harness.url, path, eli, { method: 'PUT', body: { expectedVersion: VERSION, fields: molotesFields({ 'promo.title': 'De Eli' }) } });
    expect(conflict.status).toBe(409);
    const { error } = (await conflict.json()) as { error: { code: string; currentPage: { version: string; updatedAt: string; updatedBy: string } } };
    expect(error).toMatchObject({ code: 'PAGE_CONFLICT', currentPage: { version: `3@${NOW}`, updatedAt: NOW, updatedBy: 'Ana Admin' } });
    expect(harness.pageStore.state.changes).toHaveLength(1);

    const forced = await call(harness.url, path, eli, { method: 'PUT', body: { expectedVersion: error.currentPage.version, overwrite: true, fields: molotesFields({ 'promo.title': 'De Eli' }) } });
    expect(forced.status).toBe(200);
    expect(harness.pageStore.state.changes.at(-1)).toMatchObject({ action: 'overwrite_after_conflict', author: 'Eli Molotes' });
  });

  it('`overwrite` no salta el control de versión', async () => {
    const harness = await start();
    const res = await call(harness.url, path, harness.auth, { method: 'PUT', body: { expectedVersion: '1@vieja', overwrite: true, fields: molotesFields() } });
    expect(res.status).toBe(409);
  });

  it('CA-11: precio inválido o texto largo: 422 por campo y nada escrito', async () => {
    const harness = await start();
    const before = snapshot(harness);
    const res = await call(harness.url, path, harness.auth, { method: 'PUT', body: { expectedVersion: VERSION, fields: molotesFields({ 'hero.showcase.priceCents': '-1', 'promo.title': 'x'.repeat(121) }) } });
    expect(res.status).toBe(422);
    const { error } = (await res.json()) as { error: { code: string; fields: Record<string, string> } };
    expect(error.code).toBe('VALIDATION_FAILED');
    expect(Object.keys(error.fields).sort()).toEqual(['hero.showcase.priceCents', 'promo.title']);
    expect(snapshot(harness)).toEqual(before);
    expect(harness.notified).toEqual([]);
  });

  it.each([
    ['campo desconocido en el cuerpo', { expectedVersion: VERSION, fields: molotesFields(), autor: 'Otro' }],
    ['sin versión', { fields: molotesFields() }],
    ['campos que no son texto', { expectedVersion: VERSION, fields: { 'promo.title': 1 } }],
    ['campo que no es de la página', { expectedVersion: VERSION, fields: molotesFields({ 'menu.items': 'x' }) }],
  ])('422 sin escribir: %s', async (_, body) => {
    const harness = await start();
    const before = snapshot(harness);
    expect((await call(harness.url, path, harness.auth, { method: 'PUT', body })).status).toBe(422);
    expect(snapshot(harness)).toEqual(before);
  });

  it('el autor no se puede indicar: siempre sale de la sesión', async () => {
    const harness = await start();
    await call(harness.url, path, harness.auth, { method: 'PUT', body: { expectedVersion: VERSION, fields: molotesFields({ 'promo.title': 'Nueva', updatedBy: 'Otro' }) } });
    expect(harness.pageStore.state.changes).toEqual([]);
  });

  it('sin CSRF: 403 y nada escrito', async () => {
    const harness = await start();
    const before = snapshot(harness);
    const res = await call(harness.url, path, harness.auth, { method: 'PUT', csrf: null, body: { expectedVersion: VERSION, fields: molotesFields() } });
    expect(res.status).toBe(403);
    expect(snapshot(harness)).toEqual(before);
  });

  it('CA-10: un editor de Molotes no escribe en Birria', async () => {
    const harness = await start();
    const before = snapshot(harness);
    const eli = await session(harness.url, MOLOTES_EDITOR);
    const res = await call(harness.url, '/api/v1/admin/birria/pagina', eli, { method: 'PUT', body: { expectedVersion: VERSION, fields: {} } });
    expect(res.status).toBe(403);
    const restore = await call(harness.url, '/api/v1/admin/birria/pagina/restaurar', eli, { method: 'POST', body: { expectedVersion: VERSION } });
    expect(restore.status).toBe(403);
    expect(snapshot(harness)).toEqual(before);
  });

  describe('límite del cuerpo (64 KiB)', () => {
    const LIMIT = 64 * 1024;
    /** Cuerpo JSON de `bytes` bytes exactos, con el relleno en un campo de la página. */
    function bodyOf(bytes: number) {
      const empty = { expectedVersion: VERSION, fields: molotesFields({ 'promo.title': '' }) };
      const body = { expectedVersion: VERSION, fields: molotesFields({ 'promo.title': 'x'.repeat(bytes - Buffer.byteLength(JSON.stringify(empty))) }) };
      expect(Buffer.byteLength(JSON.stringify(body))).toBe(bytes);
      return body;
    }

    it('64 KiB + 1: 413 sin escribir ni avisar', async () => {
      const harness = await start();
      const before = snapshot(harness);
      const res = await call(harness.url, path, harness.auth, { method: 'PUT', body: bodyOf(LIMIT + 1) });
      expect(res.status).toBe(413);
      expect(await res.json()).toMatchObject({ error: { code: 'PAYLOAD_TOO_LARGE' } });
      expect(snapshot(harness)).toEqual(before);
      expect(harness.notified).toEqual([]);
    });

    it('64 KiB exactos se leen: el texto largo se rechaza por su campo', async () => {
      const harness = await start();
      const res = await call(harness.url, path, harness.auth, { method: 'PUT', body: bodyOf(LIMIT) });
      expect(res.status).toBe(422);
      expect(await res.json()).toMatchObject({ error: { code: 'VALIDATION_FAILED', fields: { 'promo.title': 'Máximo 120 caracteres.' } } });
    });
  });

  it('RF-9: con la base caída responde 503 y no avisa', async () => {
    const harness = await start();
    harness.pageStore.failNext();
    const res = await call(harness.url, path, harness.auth, { method: 'PUT', body: { expectedVersion: VERSION, fields: molotesFields() } });
    expect(res.status).toBe(503);
    expect(harness.notified).toEqual([]);
  });
});

describe('restaurar la versión anterior', () => {
  const restorePath = `${path}/restaurar`;

  it('CA-12: intercambia las versiones, y repetirlo con la versión nueva lo deshace', async () => {
    const harness = await start();
    const first = await call(harness.url, restorePath, harness.auth, { method: 'POST', body: { expectedVersion: VERSION } });
    expect(first.status).toBe(200);
    const body = pageWriteResponseSchema.parse(await first.json());
    expect(body.page.values['promo.title']).toBe('Promo anterior');
    expect(harness.notified).toEqual(['molotes']);
    const second = await call(harness.url, restorePath, harness.auth, { method: 'POST', body: { expectedVersion: body.page.version } });
    expect(pageWriteResponseSchema.parse(await second.json()).page.values['promo.title']).toBe(MOLOTES_PAGE.promo.title);
  });

  it('D-10: exige la versión; repetir con la de antes no deshace nada', async () => {
    const harness = await start();
    expect((await call(harness.url, restorePath, harness.auth, { method: 'POST', body: {} })).status).toBe(422);
    expect(harness.pageStore.state.changes).toEqual([]);
    await call(harness.url, restorePath, harness.auth, { method: 'POST', body: { expectedVersion: VERSION } });
    const repeated = await call(harness.url, restorePath, harness.auth, { method: 'POST', body: { expectedVersion: VERSION } });
    expect(repeated.status).toBe(409);
    expect(await repeated.json()).toMatchObject({ error: { code: 'PAGE_CONFLICT' } });
    expect(harness.pageStore.state.changes).toHaveLength(1);
  });

  it('sin CSRF: 403 y nada escrito', async () => {
    const harness = await start();
    const before = snapshot(harness);
    expect((await call(harness.url, restorePath, harness.auth, { method: 'POST', csrf: null, body: { expectedVersion: VERSION } })).status).toBe(403);
    expect(snapshot(harness)).toEqual(before);
  });

  it('CA-12: sin versión anterior válida, 409 sin cambios', async () => {
    const harness = await start();
    const entry = harness.pageStore.state.pages.get('molotes');
    harness.pageStore.seed('molotes', { current: entry?.current ?? null, previous: null });
    const res = await call(harness.url, restorePath, harness.auth, { method: 'POST', body: { expectedVersion: VERSION } });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: { code: 'PAGE_NO_PREVIOUS' } });
    expect(harness.pageStore.state.changes).toEqual([]);
    expect(harness.notified).toEqual([]);
  });
});
