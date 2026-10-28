import { describe, expect, it, vi } from 'vitest';

import type { BusinessId } from '@restaurante/core/shared';

import { INTERNAL_NOTIFY_PATH, createInternalApp } from '../../src/internal-app.ts';
import { CATALOG_RELOAD_MS, startCatalogReload } from '../../src/services/catalog-reload.ts';
import { makeRecordingLogger } from '../helpers.ts';
import { listenLocal } from '../support/http.ts';

/**
 * Puerto interno de landing-pages (REQ-F-039, RF-12 a RF-14; CA-10 y CA-11): el aviso de la API
 * invalida la caché de la landing y recarga el catálogo del bot solo con la credencial correcta.
 */

const TOKEN = 'token-interno-de-prueba-0123456789abcdef';

function setup({ reload = true, fresh = true }: { reload?: boolean; fresh?: boolean } = {}) {
  const invalidated: BusinessId[] = [];
  const reloaded: BusinessId[] = [];
  const logger = makeRecordingLogger();
  const app = createInternalApp({
    token: TOKEN,
    products: {
      async reload(business) {
        reloaded.push(business);
        return reload;
      },
    },
    landingProducts: {
      invalidate: (business) => invalidated.push(business),
      confirmFresh: async () => fresh,
    },
    logger,
  });
  return { app, invalidated, reloaded, logger };
}

const notify = (server: Awaited<ReturnType<typeof listenLocal>>, { token = TOKEN, business = 'birria' }: { token?: string | null; business?: unknown } = {}) => {
  const req = server.request().post(INTERNAL_NOTIFY_PATH).set('Content-Type', 'application/json');
  if (token !== null) req.set('Authorization', `Bearer ${token}`);
  return req.send(JSON.stringify({ business }));
};

describe('aviso interno de la API (POST /internal/v1/productos-cambiados)', () => {
  it('con la credencial: invalida la landing, recarga el bot y responde { landing, bot }', async () => {
    const { app, invalidated, reloaded, logger } = setup();
    const server = await listenLocal(app);
    const res = await notify(server);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ landing: true, bot: true });
    expect(res.headers['cache-control']).toBe('no-store');
    expect(invalidated).toEqual(['birria']);
    expect(reloaded).toEqual(['birria']);
    expect(logger.lines).toContainEqual(expect.objectContaining({ msg: 'products_change_notified', business: 'birria', landing: true, bot: true }));
  });

  it('la landing aún sin los datos nuevos: landing false (la API lo marca como pendiente)', async () => {
    const server = await listenLocal(setup({ fresh: false }).app);
    expect((await notify(server)).body).toEqual({ landing: false, bot: true });
  });

  it('si la recarga del catálogo del bot falla: 503 (la API reintenta)', async () => {
    const server = await listenLocal(setup({ reload: false }).app);
    const res = await notify(server);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('RELOAD_FAILED');
  });

  it.each([
    ['sin credencial', null],
    ['credencial incorrecta', 'otra-credencial-de-la-misma-longitud-0000'],
    ['credencial vacía', ''],
  ])('%s: 401 y no invalida nada (CA-10, RF-14); el log no lleva la credencial', async (_name, token) => {
    const { app, invalidated, reloaded, logger } = setup();
    const server = await listenLocal(app);
    const res = await notify(server, { token });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: 'INVALID_CREDENTIALS', message: 'Credencial no válida.' } });
    expect(invalidated).toEqual([]);
    expect(reloaded).toEqual([]);
    expect(JSON.stringify(logger.lines)).not.toContain(TOKEN);
    if (token) expect(JSON.stringify(logger.lines)).not.toContain(token);
  });

  it('una petición que pasó por un proxy (X-Forwarded-For), otra ruta u otro método: 404', async () => {
    const { app, invalidated } = setup();
    const server = await listenLocal(app);
    const proxied = await server.request().post(INTERNAL_NOTIFY_PATH).set('Authorization', `Bearer ${TOKEN}`).set('X-Forwarded-For', '203.0.113.9').send({ business: 'birria' });
    expect(proxied.status).toBe(404);
    expect((await server.request().get(INTERNAL_NOTIFY_PATH).set('Authorization', `Bearer ${TOKEN}`)).status).toBe(404);
    expect((await server.request().get('/molotes')).status).toBe(404);
    expect(invalidated).toEqual([]);
  });

  it('negocio desconocido: 400; cuerpo que no es JSON: 415', async () => {
    const { app, invalidated } = setup();
    const server = await listenLocal(app);
    expect((await notify(server, { business: 'tacos' })).status).toBe(400);
    const text = await server.request().post(INTERNAL_NOTIFY_PATH).set('Authorization', `Bearer ${TOKEN}`).set('Content-Type', 'text/plain').send('birria');
    expect(text.status).toBe(415);
    expect(invalidated).toEqual([]);
  });
});

describe('recarga periódica del catálogo del bot (RF-13: cada 60 s)', () => {
  it('cada 60 s recarga los dos negocios; al detenerla, ya no', () => {
    vi.useFakeTimers();
    try {
      const reloaded: BusinessId[] = [];
      const stop = startCatalogReload({ products: { reload: async (business) => (reloaded.push(business), true) } });
      vi.advanceTimersByTime(CATALOG_RELOAD_MS - 1);
      expect(reloaded).toEqual([]);
      vi.advanceTimersByTime(1);
      expect(reloaded).toEqual(['molotes', 'birria']);
      vi.advanceTimersByTime(CATALOG_RELOAD_MS);
      expect(reloaded).toHaveLength(4);
      stop();
      vi.advanceTimersByTime(CATALOG_RELOAD_MS * 3);
      expect(reloaded).toHaveLength(4);
    } finally {
      vi.useRealTimers();
    }
  });
});
