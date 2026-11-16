import { describe, expect, it } from 'vitest';

import { botBlockResponseSchema, botControlResponseSchema, botStateResponseSchema, validationErrorSchema } from '@restaurante/contracts';

import { ADMIN, MOLOTES_EDITOR, call, session, startAdmin, type AdminHarness } from '../support/admin.ts';

/**
 * Control del bot en `/api/v1/admin` (REQ-F-043, RF-1): permisos (CA-1), CSRF (CA-2), cuerpo cerrado,
 * validación (CA-4, CA-6), sin clave (CA-13), estado (CA-20) y método. Los efectos sobre el bot están
 * en admin-bot-effects.test.ts; con MySQL y el proceso real, en
 * landing-pages/tests/integration/admin-bot-api-process.test.ts.
 */

const P = '/api/v1/admin/bot';
const CUSTOMER = '5215512345678';
const STAFF = '5215511110001';
const TOKEN = 'a'.repeat(32);
const FORBIDDEN = { error: { code: 'FORBIDDEN_ROLE', message: 'No tienes permiso para gestionar el bot.' } };

/** Las 5 rutas, con un cuerpo válido para las escrituras. */
const ROUTES: readonly { method: string; path: string; body?: unknown }[] = [
  { method: 'GET', path: P },
  { method: 'PUT', path: `${P}/interruptor`, body: { paused: true } },
  { method: 'POST', path: `${P}/bloqueos`, body: { phone: CUSTOMER, duration: '7d' } },
  { method: 'POST', path: `${P}/bloqueos/1/quitar`, body: {} },
  { method: 'POST', path: `${P}/topes/${TOKEN}/bloquear`, body: { duration: '7d' } },
];
const WRITES = ROUTES.filter((route) => route.method !== 'GET');

const nothingChanged = async (h: AdminHarness) => {
  const snapshot = await h.botControl.snapshot();
  expect(snapshot.control.paused).toBe(false);
  expect(snapshot.blocks).toEqual([]);
  expect(await h.botStore.recentAudit(10)).toEqual([]);
};

async function asAdmin(options: Parameters<typeof startAdmin>[0] = {}) {
  const h = await startAdmin(options);
  return { h, auth: await session(h.url, ADMIN) };
}

const fieldsOf = async (res: Response) => {
  const body = validationErrorSchema.parse(await res.json());
  return Object.keys(body.error.fields);
};

describe('permisos (RF-1, CA-1)', () => {
  it('sin sesión: 401 en todas las rutas', async () => {
    const h = await startAdmin();
    for (const route of ROUTES) {
      const res = await call(h.url, route.path, null, route);
      expect(res.status, route.path).toBe(401);
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe('UNAUTHENTICATED');
    }
  });

  it('un editor recibe 403 sin datos, con cuerpo, sin cuerpo y con un id inválido', async () => {
    const h = await startAdmin();
    h.botControl.recordReached(CUSTOMER, 'burst');
    const auth = await session(h.url, MOLOTES_EDITOR);
    const attempts = [...ROUTES, ...WRITES.map(({ method, path }) => ({ method, path })), { method: 'POST', path: `${P}/bloqueos/abc/quitar` }];
    for (const route of attempts) {
      const res = await call(h.url, route.path, auth, route);
      expect(res.status, route.path).toBe(403);
      expect(await res.json()).toEqual(FORBIDDEN);
    }
    await nothingChanged(h);
  });

  it('el rol se comprueba antes que el CSRF', async () => {
    const h = await startAdmin();
    const auth = await session(h.url, MOLOTES_EDITOR);
    const res = await call(h.url, `${P}/interruptor`, auth, { method: 'PUT', body: { paused: true }, csrf: null });
    expect(await res.json()).toEqual(FORBIDDEN);
  });
});

describe('CSRF (CA-2)', () => {
  it.each([['sin token', null], ['con otro token', 'token-que-no-es']])('%s: 403 y nada cambia', async (_name, csrf) => {
    const { h, auth } = await asAdmin();
    for (const route of WRITES) {
      const res = await call(h.url, route.path, auth, { ...route, csrf });
      expect(res.status, route.path).toBe(403);
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe('CSRF_INVALID');
    }
    await nothingChanged(h);
  });

  it('el CSRF se comprueba antes de mirar el cuerpo', async () => {
    const { h, auth } = await asAdmin();
    const res = await call(h.url, `${P}/bloqueos`, auth, { method: 'POST', body: { campo: 'desconocido' }, csrf: null });
    expect(res.status).toBe(403);
  });
});

describe('cuerpo', () => {
  const raw = (h: AdminHarness, path: string, method: string, auth: { id: string; csrfToken: string }, type: string, body: string) =>
    fetch(`${h.url}${path}`, { method, headers: { Authorization: `Bearer ${auth.id}`, 'X-CSRF-Token': auth.csrfToken, 'Content-Type': type }, body });

  it('415, 400 y 413 con el formato de error; nada cambia', async () => {
    const { h, auth } = await asAdmin();
    for (const route of WRITES) {
      expect((await raw(h, route.path, route.method, auth, 'text/plain', '{}')).status, route.path).toBe(415);
      expect((await raw(h, route.path, route.method, auth, 'application/json', '{')).status, route.path).toBe(400);
      expect((await raw(h, route.path, route.method, auth, 'application/json', JSON.stringify({ reason: 'x'.repeat(5000) }))).status, route.path).toBe(413);
    }
    await nothingChanged(h);
  });

  it('campos desconocidos o un cuerpo que no es objeto: 422', async () => {
    const { h, auth } = await asAdmin();
    for (const route of WRITES) {
      expect(await fieldsOf(await call(h.url, route.path, auth, { method: route.method, body: { sobra: 1 } })), route.path).toEqual(['sobra']);
      expect((await call(h.url, route.path, auth, { method: route.method, body: [] })).status, route.path).toBe(422);
    }
    await nothingChanged(h);
  });

  it('otro método en una ruta conocida: 405 con Allow', async () => {
    const { h, auth } = await asAdmin();
    const res = await call(h.url, `${P}/interruptor`, auth);
    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toContain('PUT');
  });
});

describe('interruptor (RF-3)', () => {
  it('pausa y reanuda, con motivo opcional', async () => {
    const { h, auth } = await asAdmin();
    const paused = await call(h.url, `${P}/interruptor`, auth, { method: 'PUT', body: { paused: true, reason: 'Gasto raro' } });
    expect(paused.status).toBe(200);
    expect(botControlResponseSchema.parse(await paused.json()).control).toMatchObject({ paused: true, changedByName: ADMIN.displayName, reason: 'Gasto raro' });
    const resumed = await call(h.url, `${P}/interruptor`, auth, { method: 'PUT', body: { paused: false } });
    expect(botControlResponseSchema.parse(await resumed.json()).control).toMatchObject({ paused: false, reason: null });
  });

  it('CA-4: un motivo con 8 o más dígitos seguidos da 422 y el estado no cambia', async () => {
    const { h, auth } = await asAdmin();
    for (const reason of ['llamar al 55 1234 5678', '12345678']) {
      expect(await fieldsOf(await call(h.url, `${P}/interruptor`, auth, { method: 'PUT', body: { paused: true, reason } }))).toEqual(['reason']);
    }
    await nothingChanged(h);
  });

  it.each([[{ reason: 'x' }, ['paused']], [{ paused: 'si' }, ['paused']], [{ paused: true, reason: 5 }, ['reason']], [{ paused: true, reason: 'x'.repeat(201) }, ['reason']]])('%j: 422', async (body, fields) => {
    const { h, auth } = await asAdmin();
    expect(await fieldsOf(await call(h.url, `${P}/interruptor`, auth, { method: 'PUT', body }))).toEqual(fields);
    await nothingChanged(h);
  });
});

describe('alta manual (RF-7, CA-6)', () => {
  it('responde solo el número enmascarado', async () => {
    const { h, auth } = await asAdmin();
    const res = await call(h.url, `${P}/bloqueos`, auth, { method: 'POST', body: { phone: CUSTOMER, duration: '7d', reason: 'Abuso' } });
    expect(res.status).toBe(201);
    expect(botBlockResponseSchema.parse(await res.json())).toEqual({ block: { masked: '*********5678' } });
  });

  it('inválido, personal, duración fuera de la lista y motivo: 422 por campo, sin escribir', async () => {
    const { h, auth } = await asAdmin();
    const send = (body: unknown) => call(h.url, `${P}/bloqueos`, auth, { method: 'POST', body });
    expect(await fieldsOf(await send({ phone: '123', duration: '7d' }))).toEqual(['phone']);
    expect(await fieldsOf(await send({ phone: 5215512345678, duration: '7d' }))).toEqual(['phone']);
    expect(await fieldsOf(await send({ phone: STAFF, duration: '7d' }))).toEqual(['phone']);
    expect(await fieldsOf(await send({ phone: CUSTOMER, duration: '1h' }))).toEqual(['duration']);
    expect(await fieldsOf(await send({ phone: CUSTOMER }))).toEqual(['duration']);
    expect(await fieldsOf(await send({ phone: CUSTOMER, duration: '7d', reason: '5512345678' }))).toEqual(['reason']);
    expect(await fieldsOf(await send({ phone: 'x', duration: 'x', reason: '12345678' }))).toEqual(['phone', 'duration', 'reason']);
    await nothingChanged(h);
  });

  it('ya bloqueado: 409 sin duplicar', async () => {
    const { h, auth } = await asAdmin();
    const body = { phone: CUSTOMER, duration: '7d' };
    await call(h.url, `${P}/bloqueos`, auth, { method: 'POST', body });
    const res = await call(h.url, `${P}/bloqueos`, auth, { method: 'POST', body });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('BOT_NUMBER_ALREADY_BLOCKED');
    expect((await h.botControl.snapshot()).blocks).toHaveLength(1);
  });

  it('CA-13: sin clave, 409 sin guardar, aunque el resto no sea válido', async () => {
    const { h, auth } = await asAdmin({ bot: { keys: null, provider: null } });
    for (const body of [{ phone: CUSTOMER, duration: '7d' }, { phone: 'x', duration: 'x' }]) {
      const res = await call(h.url, `${P}/bloqueos`, auth, { method: 'POST', body });
      expect(res.status).toBe(409);
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe('BOT_KEY_MISSING');
    }
    await nothingChanged(h);
    const { bot } = botStateResponseSchema.parse(await (await call(h.url, P, auth)).json());
    expect(bot.canBlock).toBe(false);
  });
});

describe('id y token', () => {
  it('CA-7: un id inexistente o con mal formato da 404', async () => {
    const { h, auth } = await asAdmin();
    for (const id of ['99', '0', 'abc', '-1', '12345678901']) {
      const res = await call(h.url, `${P}/bloqueos/${id}/quitar`, auth, { method: 'POST', body: {} });
      expect(res.status, id).toBe(404);
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe('BOT_BLOCK_NOT_FOUND');
    }
  });

  it('CA-10: un token inexistente o con mal formato da 404; una duración inválida, 422', async () => {
    const { h, auth } = await asAdmin();
    for (const token of [TOKEN, 'abc', 'A'.repeat(32)]) {
      const res = await call(h.url, `${P}/topes/${token}/bloquear`, auth, { method: 'POST', body: { duration: '7d' } });
      expect(res.status, token).toBe(404);
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe('BOT_REACHED_NOT_FOUND');
    }
    expect(await fieldsOf(await call(h.url, `${P}/topes/${TOKEN}/bloquear`, auth, { method: 'POST', body: { duration: '1h' } }))).toEqual(['duration']);
  });
});

describe('estado (RF-2, RF-4, CA-20)', () => {
  it.each([['meta'], ['twilio']] as const)('con el bot en marcha dice su proveedor (%s)', async (provider) => {
    const { h, auth } = await asAdmin({ bot: { provider } });
    const { bot } = botStateResponseSchema.parse(await (await call(h.url, P, auth)).json());
    expect(bot.status).toEqual({ enabled: true, provider });
  });

  it('CA-20: sin bot dice que está desactivado y permite pausar', async () => {
    const { h, auth } = await asAdmin({ bot: { keys: null, provider: null } });
    const { bot } = botStateResponseSchema.parse(await (await call(h.url, P, auth)).json());
    expect(bot.status).toEqual({ enabled: false, provider: null });
    expect((await call(h.url, `${P}/interruptor`, auth, { method: 'PUT', body: { paused: true } })).status).toBe(200);
    expect(h.botControl.isPaused()).toBe(true);
  });

  it('devuelve los periodos y la zona, con los 5 contadores', async () => {
    const { h, auth } = await asAdmin();
    const { bot } = botStateResponseSchema.parse(await (await call(h.url, P, auth)).json());
    expect(bot.usage).toMatchObject({ day: '2026-10-26', month: '2026-10', timeZone: 'America/Mexico_City' });
    expect(bot.usage.counters).toHaveLength(5);
    expect(bot.storeHealthy).toBe(true);
  });
});
