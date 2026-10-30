import { afterEach, describe, expect, it } from 'vitest';

import { ADMIN_PASSWORD, ADMIN_USER } from '../support/admin.ts';
import { P, nextIp, type Session, startStack, login, session, expectNoSecrets, runCleanups } from '../support/admin-api-qa-req-f-039.ts';

/**
 * QA de REQ-F-039, PR 1 (QA Action Plan aprobado el 2026-10-27): procesos reales de `api` y de
 * `landing-pages` contra MySQL, sin importar código de `api/`. Cubre los huecos que la suite del PR
 * no prueba:
 *
 * - N-02 y N-03: el límite de intentos cuenta el último valor de X-Forwarded-For (también IPv6).
 * - N-13: el login nunca adopta un id recibido (fijación de sesión).
 * - N-06: `?sobrescribir=1` con una versión desfasada no guarda en silencio (RF-9).
 * - N-12: la misma Idempotency-Key en otro negocio no devuelve el producto del primero.
 * - F-13 y F-14: el aviso real hace que la landing muestre el cambio sin reiniciar; con el aviso
 *   caído, la escritura se confirma como `pending` y el fallo queda en el log (CA-11).
 * - N-09: una segunda escritura mientras el primer aviso sigue en curso también llega a la landing.
 * - N-10: con la base caída, 503 sin detalles.
 * - S-01: ningún log de los dos procesos lleva contraseñas, ids de sesión, tokens CSRF ni la
 *   credencial del aviso (CA-16).
 *
 * REQ-F-041: parte de admin-api-qa-req-f-039.test.ts (preparación en
 * tests/support/admin-api-qa-req-f-039.ts).
 */

afterEach(runCleanups);

describe('QA REQ-F-039 PR 1: acceso a /api/v1/admin', () => {
  it('N-02 y N-03: el límite cuenta el último valor de X-Forwarded-For; el primero no lo evita; IPv6 y espacios valen', async () => {
    const stack = await startStack();
    const victim = '203.0.113.77';
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const res = await login(stack, ADMIN_USER, 'contraseña-equivocada', `10.0.0.${attempt}, ${victim}`);
      expect(res.status).toBe(attempt < 5 ? 401 : 429);
    }
    // Cambiar el primer valor (lo que podría fijar un cliente) no evita el bloqueo, ni con la contraseña correcta.
    const spoofed = await login(stack, ADMIN_USER, ADMIN_PASSWORD, `10.9.9.9, ${victim}`);
    expect(spoofed.status).toBe(429);
    expect(spoofed.headers.get('retry-after')).toMatch(/^\d+$/);
    // Otra IP como último valor: no afectada.
    expect((await login(stack, ADMIN_USER, ADMIN_PASSWORD, `${victim}, 203.0.113.78`)).status).toBe(201);
    // IPv6 y espacios alrededor.
    expect((await login(stack, ADMIN_USER, ADMIN_PASSWORD, '2001:db8::1')).status).toBe(201);
    expect((await login(stack, ADMIN_USER, ADMIN_PASSWORD, '  203.0.113.79  ')).status).toBe(201);
    // Sin IP válida: 400 sin contar el intento.
    for (const xff of [null, '', 'unknown', '203.0.113.80, no-es-ip']) {
      const res = await login(stack, ADMIN_USER, ADMIN_PASSWORD, xff);
      expect(res.status, String(xff)).toBe(400);
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe('CLIENT_IP_REQUIRED');
    }
    expectNoSecrets(stack);
  });

  it('N-13: el login nunca adopta un id recibido; cada login da un id nuevo de 256 bits; un id inventado no vale', async () => {
    const stack = await startStack();
    const first = await session(stack, ADMIN_USER, ADMIN_PASSWORD);
    const res = await login(stack, ADMIN_USER, ADMIN_PASSWORD, nextIp(), { Authorization: `Bearer ${first.id}` });
    expect(res.status).toBe(201);
    const second = ((await res.json()) as { session: Session }).session;
    stack.secrets.push(second.id, second.csrfToken);
    expect(second.id).not.toBe(first.id);
    expect(second.csrfToken).not.toBe(first.csrfToken);
    for (const id of [first.id, second.id]) expect(id).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const invented = await fetch(`${stack.apiUrl}${P}/sesion`, { headers: { Authorization: 'Bearer inventado-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' } });
    expect(invented.status).toBe(401);
    expectNoSecrets(stack);
  });
});
