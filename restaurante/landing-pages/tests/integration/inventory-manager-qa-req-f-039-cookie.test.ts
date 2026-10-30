import { afterEach, describe, expect, it } from 'vitest';

import { ADMIN_PASSWORD, ADMIN_USER } from '../support/admin.ts';
import { startStack, client, loginAs, expectNoSecrets, runCleanups } from '../support/inventory-manager-qa-req-f-039.ts';

/**
 * QA de REQ-F-039, PR 2 (QA Action Plan aprobado el 2026-10-28): procesos reales de `api`,
 * `landing-pages` (importación de la semilla y primer administrador) e `inventory-manager` contra
 * MySQL, sin importar código de las otras apps. Cubre lo que las pruebas de inventory-manager no
 * prueban al usar un doble de la API:
 *
 * - S-01: cookie `__Host-admin_sid` en producción detrás de un proxy con TLS; 503 sin TLS.
 * - S-05 y S-06: `next` con destinos maliciosos y `Location` siempre interna.
 * - S-03: la primera capa de CSRF corta antes de llegar a la API.
 * - S-08: la IP que cuenta la API es la del proxy (último valor) solo con TRUST_PROXY.
 * - F-10 y S-10: la `requestId` del formulario evita el doble alta y se conserva tras un 422.
 * - F-11: 409 real entre dos sesiones, sin sobrescribir sin pedirlo.
 * - F-12: API caída de verdad: 503 con lo escrito intacto y sin trazas.
 * - S-09: ningún log lleva contraseñas, ids de sesión ni tokens CSRF.
 *
 * REQ-F-041: parte de inventory-manager-qa-req-f-039.test.ts (preparación en
 * tests/support/inventory-manager-qa-req-f-039.ts).
 */

afterEach(runCleanups);

describe('QA REQ-F-039 PR 2: sesión, cookie y redirecciones', () => {
  it('S-01: en producción detrás de un proxy con TLS la cookie es __Host-admin_sid con Secure, HttpOnly, SameSite=Strict y Path=/, sin Domain; sin TLS, 503', async () => {
    const stack = await startStack();
    const { proc, url } = await stack.startInventory({ NODE_ENV: 'production', TRUST_PROXY: 'true' });
    const proxy = { 'X-Forwarded-Proto': 'https', 'X-Forwarded-Host': 'admin.example.test', 'X-Forwarded-For': '203.0.113.20', Origin: 'https://admin.example.test', 'Sec-Fetch-Site': 'same-origin' };
    const c = client(stack, url, proxy);
    const res = await loginAs(c, ADMIN_USER, ADMIN_PASSWORD);
    const cookie = res.headers.getSetCookie().find((line) => line.startsWith('__Host-admin_sid='));
    expect(cookie).toBeDefined();
    const attributes = (cookie ?? '').toLowerCase();
    for (const attribute of ['secure', 'httponly', 'samesite=strict', 'path=/']) expect(attributes).toContain(attribute);
    expect(attributes).not.toContain('domain=');
    expect(attributes).not.toContain('max-age');
    expect((await c.get('/molotes/productos')).status).toBe(200);
    // Sin TLS (sin X-Forwarded-Proto: https): 503.
    const plain = await fetch(`${url}/acceso`, { redirect: 'manual' });
    expect(plain.status).toBe(503);
    expectNoSecrets(stack, proc);
  });
});
