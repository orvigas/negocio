import { afterEach, describe, expect, it } from 'vitest';

import { ADMIN_PASSWORD, ADMIN_USER } from '../support/admin.ts';
import { startStack, session, call, expectNoSecrets, runCleanups } from '../support/admin-api-qa-req-f-039.ts';

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

describe('QA REQ-F-039 PR 1: aviso interno con los procesos reales', () => {
  it('N-10: con la base caída, /api/v1/admin responde 503 sin trazas, SQL ni credenciales', async () => {
    const stack = await startStack({ routeDatabase: true });
    const ana = await session(stack, ADMIN_USER, ADMIN_PASSWORD);
    await stack.dbProxy?.down();
    const res = await call(stack, '/molotes/productos', ana);
    expect(res.status).toBe(503);
    const text = await res.text();
    expect(JSON.parse(text)).toMatchObject({ error: { code: 'DATABASE_UNAVAILABLE' } });
    expect(text + stack.api.output().stdout + stack.api.output().stderr).not.toMatch(/\n\s+at |SELECT |mysql:\/\//);
    expectNoSecrets(stack);
  });
});
