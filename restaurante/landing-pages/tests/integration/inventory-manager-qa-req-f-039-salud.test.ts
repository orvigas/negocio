import { afterEach, describe, expect, it } from 'vitest';

import { startStack, runCleanups } from '../support/inventory-manager-qa-req-f-039.ts';

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

describe('QA REQ-F-039 PR 2: salud en producción', () => {
  // DEF-005 (QA del PR 2), corregido: /salud responde sin exigir TLS (el HEALTHCHECK del contenedor
  // habla por HTTP con 127.0.0.1); el resto del admin sigue solo por HTTPS en producción.
  it('DEF-005: /salud responde 200 en producción aunque la petición no llegue por TLS (healthcheck interno)', async () => {
    const stack = await startStack();
    const { url } = await stack.startInventory({ NODE_ENV: 'production', TRUST_PROXY: 'true' });
    const res = await fetch(`${url}/salud`, { redirect: 'manual' });
    expect(res.status).toBe(200);
  });
});
