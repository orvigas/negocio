import { describe, expect, it } from 'vitest';

import type { BusinessId } from '@restaurante/core/shared';

import { INTERNAL_NOTIFY_PATH, createInternalApp } from '../../src/internal-app.ts';
import { makeRecordingLogger } from '../helpers.ts';
import { listenLocal } from '../support/http.ts';

/**
 * Puerto interno de landing-pages (REQ-F-039, RF-12 a RF-14; CA-10 y CA-11): el aviso de la API
 * invalida la caché de la landing solo con la credencial correcta. El bot vive en la api desde
 * REQ-F-042: el aviso ya no recarga ningún catálogo.
 */

const TOKEN = 'token-interno-de-prueba-0123456789abcdef';

function setup({ fresh = true }: { fresh?: boolean } = {}) {
  const invalidated: BusinessId[] = [];
  const logger = makeRecordingLogger();
  const app = createInternalApp({
    token: TOKEN,
    landingProducts: {
      invalidate: (business) => invalidated.push(business),
      confirmFresh: async () => fresh,
    },
    logger,
  });
  return { app, invalidated, logger };
}

const notify = (server: Awaited<ReturnType<typeof listenLocal>>, { token = TOKEN, business = 'birria' }: { token?: string | null; business?: unknown } = {}) => {
  const req = server.request().post(INTERNAL_NOTIFY_PATH).set('Content-Type', 'application/json');
  if (token !== null) req.set('Authorization', `Bearer ${token}`);
  return req.send(JSON.stringify({ business }));
};

describe('aviso interno de la API (POST /internal/v1/productos-cambiados)', () => {
  it('con la credencial: invalida la landing y responde { landing }', async () => {
    const { app, invalidated, logger } = setup();
    const server = await listenLocal(app);
    const res = await notify(server);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ landing: true });
    expect(res.headers['cache-control']).toBe('no-store');
    expect(invalidated).toEqual(['birria']);
    expect(logger.lines).toContainEqual(expect.objectContaining({ msg: 'products_change_notified', business: 'birria', landing: true }));
  });

  it('la landing aún sin los datos nuevos: landing false (la API lo marca como pendiente)', async () => {
    const server = await listenLocal(setup({ fresh: false }).app);
    expect((await notify(server)).body).toEqual({ landing: false });
  });

  it.each([
    ['sin credencial', null],
    ['credencial incorrecta', 'otra-credencial-de-la-misma-longitud-0000'],
    ['credencial vacía', ''],
  ])('%s: 401 y no invalida nada (CA-10, RF-14); el log no lleva la credencial', async (_name, token) => {
    const { app, invalidated, logger } = setup();
    const server = await listenLocal(app);
    const res = await notify(server, { token });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: 'INVALID_CREDENTIALS', message: 'Credencial no válida.' } });
    expect(invalidated).toEqual([]);
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
