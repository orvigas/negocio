import { describe, expect, it } from 'vitest';

import { quoteCalculationResponseSchema, quoteDefaultsResponseSchema } from '@restaurante/contracts';
import { QuoteUnavailableError, type QuoteCatalogSource } from '@restaurante/core/cotizador';

import { ADMIN, call, session, startAdmin, type TestUser } from '../support/admin.ts';

/**
 * Cotizador en la API de administración (REQ-F-046): solo administradores (CA-22), Molotes sin
 * cotizador, "no disponible" con un JSON inválido (P-2) y ajustes fuera de los logs (RF-9, CA-19).
 */

const BIRRIA_EDITOR: TestUser = { username: 'beto', displayName: 'Beto Birria', role: 'editor', businesses: ['birria'] };
const defaultsPath = (business: string) => `/api/v1/admin/${business}/cotizador`;
const calculationsPath = (business: string) => `/api/v1/admin/${business}/cotizador/calculos`;

const start = (options: { quotes?: QuoteCatalogSource } = {}) => startAdmin({ users: [ADMIN, BIRRIA_EDITOR], ...options });

describe('cotizador en la API de administración', () => {
  it('el administrador recibe los campos con los valores del JSON y calcula con sus ajustes', async () => {
    const { url } = await start();
    const auth = await session(url, ADMIN);
    const defaults = await call(url, defaultsPath('birria'), auth);
    expect(defaults.status).toBe(200);
    const { quote } = quoteDefaultsResponseSchema.parse(await defaults.json());
    expect(quote.fields.find(({ key }) => key === 'p.tradicional.f')).toMatchObject({ section: 'paquetes', group: 'Tradicional', defaultValue: '100' });
    expect(quote.fields.find(({ key }) => key === 'i.masa.costo')).toMatchObject({ provisional: true });

    // POST sin efectos: no exige CSRF.
    const res = await call(url, calculationsPath('birria'), auth, { method: 'POST', body: { personas: '60', ajustes: { 'i.carne-res.costo': '200' } }, csrf: null });
    expect(res.status).toBe(200);
    const { result } = quoteCalculationResponseSchema.parse(await res.json());
    expect(result.modified).toEqual(['i.carne-res.costo']);
    expect(result.packages[0]).toMatchObject({ id: 'tradicional', price: 134, eventCost: 4786.57 });
    expect(result.matrix.rows).toEqual([30, 40, 50, 60, 70, 80, 90, 100, 150, 200, 300]);
  });

  it('CA-22: un editor de Birria recibe 403 en los dos endpoints, sin datos', async () => {
    const { url } = await start();
    const auth = await session(url, BIRRIA_EDITOR);
    const defaults = await call(url, defaultsPath('birria'), auth);
    expect(defaults.status).toBe(403);
    expect(await defaults.json()).toEqual({ error: { code: 'FORBIDDEN_ROLE', message: 'Solo los administradores pueden usar el cotizador.' } });
    expect((await call(url, calculationsPath('birria'), auth, { method: 'POST', body: { personas: '60', ajustes: {} } })).status).toBe(403);
  });

  it('sin sesión: 401; Molotes y un negocio desconocido: 404 QUOTE_NOT_FOUND', async () => {
    const { url } = await start();
    expect((await call(url, defaultsPath('birria'), null)).status).toBe(401);
    const auth = await session(url, ADMIN);
    for (const business of ['molotes', 'tacos']) {
      const res = await call(url, defaultsPath(business), auth);
      expect(res.status).toBe(404);
      expect(await res.json()).toMatchObject({ error: { code: 'QUOTE_NOT_FOUND' } });
    }
  });

  it('un catálogo inválido: 503 QUOTE_UNAVAILABLE sin detalles internos', async () => {
    const unavailable: QuoteCatalogSource = { load: () => Promise.reject(new QuoteUnavailableError()) };
    const { url } = await start({ quotes: unavailable });
    const auth = await session(url, ADMIN);
    for (const res of [await call(url, defaultsPath('birria'), auth), await call(url, calculationsPath('birria'), auth, { method: 'POST', body: { personas: '60', ajustes: {} } })]) {
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: { code: 'QUOTE_UNAVAILABLE', message: 'Cotizador no disponible.' } });
    }
  });

  it('CA-19: un cálculo rechazado responde 422 por campo y los logs no llevan los ajustes', async () => {
    const { url, logger } = await start();
    const auth = await session(url, ADMIN);
    const accepted = await call(url, calculationsPath('birria'), auth, { method: 'POST', body: { personas: '61', ajustes: { 'cb.hora': '98765.43' } } });
    expect(accepted.status).toBe(200);
    const res = await call(url, calculationsPath('birria'), auth, { method: 'POST', body: { personas: '61', ajustes: { 'p.tradicional.f': '-87654.32', 'cb.horas': 'texto-secreto' } } });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: { code: string; fields: Record<string, string> } };
    expect(body.error.code).toBe('VALIDATION_FAILED');
    expect(Object.keys(body.error.fields).sort()).toEqual(['cb.horas', 'p.tradicional.f']);
    const unknown = await call(url, calculationsPath('birria'), auth, { method: 'POST', body: { personas: '61', ajustes: { 'p.borrado.a': '1' } } });
    expect(await unknown.json()).toMatchObject({ error: { fields: { '': 'El enlace tiene campos que ya no existen; restablece los valores.' } } });
    // `__proto__` es una clave fuera del patrón más: se rechaza, no se descarta en silencio.
    const proto = await call(url, calculationsPath('birria'), auth, { method: 'POST', body: JSON.parse('{"personas":"61","ajustes":{"__proto__":"1"}}') as unknown });
    expect(proto.status).toBe(422);
    expect(await proto.json()).toMatchObject({ error: { code: 'VALIDATION_FAILED', fields: { '': 'Los ajustes no son válidos; restablece los valores.' } } });

    const logs = logger.lines.join('\n');
    expect(logs).toContain('"quote_validation_failed"');
    for (const secret of ['98765.43', '87654.32', 'texto-secreto', 'cb.hora', 'p.tradicional.f', 'p.borrado']) expect(logs).not.toContain(secret);
  });
});
