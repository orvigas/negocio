import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { FAILURES, PHONE, SAVED_CLAIM, TOKEN, UNCONFIRMED, WRITES, emptyBot, failure, inputOf, noPhone, runCleanups, selectedDuration, startAgainstFake, valueOf, type Browser } from '../support/bot-pantalla-qa-req-f-043.ts';

/**
 * Sonda S-6 de QA de REQ-F-043, PR 2: `inventory-manager` real frente a una `api` falsa que falla (RF-12,
 * H-10, D-4, CA-18 y CA-19). Una escritura sin confirmar nunca afirma que no se guardó, y el teléfono no
 * vuelve a aparecer por ninguna salida.
 */

let stack: Awaited<ReturnType<typeof startAgainstFake>>;
let admin: Browser;
const logs = () => `${stack.inventory.output().stdout}\n${stack.inventory.output().stderr}`;

beforeAll(async () => {
  stack = await startAgainstFake();
  admin = stack.admin;
});
afterAll(runCleanups);
beforeEach(() => {
  Object.assign(stack.fake, { session: null, read: null, write: null, bot: emptyBot() });
});

describe('leer con la API caída (QA2-40)', () => {
  it.each(Object.entries(FAILURES))('%s: 503 con aviso y sin detalles internos', async (_name, reply) => {
    stack.fake.read = reply;
    const res = await admin.get('/bot');
    expect(res.status).toBe(503);
    expect(res.html).toContain('Servicio no disponible.');
    expect(res.html).not.toMatch(/stack|ECONN|127\.0\.0\.1|INTERNAL_ERROR|NOT_FOUND/);
  });
});

describe('escribir sin confirmación (QA2-41, QA2-42, QA2-44 y QA2-20)', () => {
  const cases = Object.entries(FAILURES).flatMap(([name, reply]) => WRITES.map(([path, form]) => [name, path, reply, form] as const));
  it.each(cases)('%s en %s: 503, sin confirmar y sin afirmar que no se guardó', async (_name, path, reply, form) => {
    stack.fake.write = reply;
    const res = await admin.post(path, form);
    expect(res.status).toBe(503);
    expect(res.html).toContain(UNCONFIRMED);
    expect(res.html).toContain('href="/bot"');
    expect(res.html).not.toMatch(SAVED_CLAIM);
    noPhone(res.html, 'HTML');
    if (path === '/bot/bloqueos') {
      expect(valueOf(res.html, 'telefono') ?? '').toBe('');
      expect(valueOf(res.html, 'motivo')).toBe('Prueba');
      expect(selectedDuration(res.html)).toBe('30d');
    }
  });

  it('un 404 con code del bot es "no encontrado", con la lista actual', async () => {
    stack.fake.write = failure(404, 'BOT_BLOCK_NOT_FOUND', 'Ese bloqueo ya no existe.');
    const baja = await admin.post('/bot/bloqueos/7/quitar', { _csrf: 'x' });
    expect(baja.status).toBe(404);
    expect(baja.html).toContain('Ese bloqueo ya no existe.');
    expect(baja.html).toContain('Lista negra');
    stack.fake.write = failure(404, 'BOT_REACHED_NOT_FOUND', 'Esa entrada ya no está.');
    const tope = await admin.post(`/bot/topes/${TOKEN}/bloquear`, { _csrf: 'x', duracion: '7d' });
    expect(tope.status).toBe(404);
    expect(tope.html).toContain('Alcanzaron un tope hoy');
  });

  it('un 409 inesperado no se presenta como ya bloqueado', async () => {
    stack.fake.write = failure(409, 'OTRO_CONFLICTO', 'Conflicto.');
    const alta = await admin.post('/bot/bloqueos', { _csrf: 'x', telefono: PHONE, duracion: '7d' });
    expect(alta.status).toBe(503);
    expect(alta.html).toContain(UNCONFIRMED);
    noPhone(alta.html, 'HTML');
  });
});

describe('alta con fallos en cadena (QA2-20, QA2-23, QA2-45 y QA2-46)', () => {
  it('sesión sin comprobar: formulario suelto y `_csrf` escapado, sin teléfono ni motivo con número', async () => {
    stack.fake.session = 'destroy';
    const res = await admin.post('/bot/bloqueos', { _csrf: '"><script>alert(1)</script>', telefono: PHONE, duracion: '24h', motivo: 'llamó el 55 9876 5432' });
    expect(res.status).toBe(503);
    expect(res.html).toContain(UNCONFIRMED);
    expect(res.html).not.toContain('<script>alert');
    expect(res.html).not.toMatch(SAVED_CLAIM);
    noPhone(res.html, 'HTML');
    expect(valueOf(res.html, 'telefono') ?? '').toBe('');
    expect(valueOf(res.html, 'motivo') ?? '').toBe('');
    expect(selectedDuration(res.html)).toBe('24h');

    stack.fake.session = null;
    stack.fake.write = { status: 201, body: { block: { masked: '*********5432' } } };
    const repeat = await admin.post('/bot/bloqueos', { _csrf: 'csrf-de-prueba', telefono: PHONE, duracion: '24h', motivo: '' });
    expect([repeat.status, repeat.location]).toEqual([303, '/bot?ok=blocked&n=5432']);
  });

  it('desvío 6: 422 con relectura caída, formulario suelto sin afirmar nada', async () => {
    stack.fake.write = failure(422, 'VALIDATION_FAILED', 'Los datos no son válidos.', { phone: 'Número inválido.' });
    stack.fake.read = failure(503, 'SERVICE_UNAVAILABLE');
    const res = await admin.post('/bot/bloqueos', { _csrf: 'x', telefono: PHONE, duracion: '30d', motivo: 'Prueba' });
    expect(res.status).toBe(503);
    expect(res.html).toContain(UNCONFIRMED);
    expect(res.html).not.toContain('Número inválido.');
    noPhone(res.html, 'HTML');
    expect(valueOf(res.html, 'motivo')).toBe('Prueba');
  });

  it('una duración fuera de lista vuelve a 7d y el motivo con teléfono se vacía con la API caída', async () => {
    stack.fake.write = 'destroy';
    const res = await admin.post('/bot/bloqueos', { _csrf: 'x', telefono: PHONE, duracion: 'siempre', motivo: `cliente ${PHONE}` });
    expect(res.status).toBe(503);
    expect(selectedDuration(res.html)).toBe('7d');
    expect(valueOf(res.html, 'motivo') ?? '').toBe('');
    noPhone(res.html, 'HTML');
  });
});

describe('errores del propio formulario, con el teléfono en el cuerpo (QA2-20)', () => {
  it('400 por campo desconocido y 413 por tamaño: sin eco ni llamada a la API', async () => {
    const before = stack.fake.seen.length;
    const extra = await admin.post('/bot/bloqueos', { _csrf: 'x', telefono: PHONE, duracion: '7d', otro: '1' });
    expect(extra.status).toBe(400);
    noPhone(extra.html, 'HTML del 400');
    const big = await admin.send('/bot/bloqueos', new URLSearchParams({ _csrf: 'x', telefono: PHONE, motivo: 'a'.repeat(5000) }).toString(), 'application/x-www-form-urlencoded');
    expect(big.status).toBe(413);
    noPhone(big.html, 'HTML del 413');
    expect(stack.fake.seen.slice(before).filter((line) => line.includes('/bot/bloqueos'))).toEqual([]);
  });
});

describe('desvío 5, R-3 y CA-19', () => {
  it('desvío 5: un :id que no es número da la página 404 común, sin llamar a la API de baja', async () => {
    for (const id of ['abc', '0', '-1', '12345678901', '1e3']) {
      const before = stack.fake.seen.length;
      const res = await admin.post(`/bot/bloqueos/${id}/quitar`, { _csrf: 'x' });
      expect(res.status, id).toBe(404);
      expect(res.html, id).toContain('href="/bot"');
      expect(stack.fake.seen.slice(before).filter((line) => line.includes('quitar'))).toEqual([]);
    }
  });

  it('R-3: 422 en /topes con una fila presente pinta el error junto a su campo', async () => {
    stack.fake.bot.reached.push({ token: TOKEN, masked: '*********1111', cap: 'burst', at: '2026-11-05T09:00:00-06:00' });
    stack.fake.write = failure(422, 'VALIDATION_FAILED', 'Los datos no son válidos.', { reason: 'Motivo no válido por prueba.' });
    const res = await admin.post(`/bot/topes/${TOKEN}/bloquear`, { _csrf: 'x', duracion: '30d', motivo: 'Prueba' });
    expect(res.status).toBe(422);
    expect(res.html).toContain('Motivo no válido por prueba.');
  });

  it('R-3: 422 en /topes con la fila ya fuera de la lista también se explica', async () => {
    stack.fake.write = failure(422, 'VALIDATION_FAILED', 'Los datos no son válidos.', { reason: 'Motivo no válido por prueba.' });
    const res = await admin.post(`/bot/topes/${TOKEN}/bloquear`, { _csrf: 'x', duracion: '30d', motivo: 'Prueba' });
    expect(res.status).toBe(422);
    expect(res.html).toContain('Motivo no válido por prueba.');
  });

  it('CA-19: `storeHealthy` falso muestra el aviso de última copia conocida', async () => {
    stack.fake.bot.storeHealthy = false;
    const res = await admin.get('/bot');
    expect(res.status).toBe(200);
    expect(res.html).toContain('última copia conocida');
  });

  it('la API nunca recibe el teléfono en la URL y ningún log lo lleva', () => {
    expect(stack.fake.seen.some((line) => line.split(' ')[1]?.includes(PHONE))).toBe(false);
    expect(stack.fake.seen.some((line) => line.includes(PHONE))).toBe(true);
    noPhone(logs(), 'logs de inventory-manager');
  });
});

it('inputOf encuentra el campo teléfono en la pantalla', async () => {
  const { html } = await admin.get('/bot');
  expect(inputOf(html, 'telefono')).toContain('inputmode="tel"');
});
