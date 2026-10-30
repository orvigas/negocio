import { afterEach, describe, expect, it } from 'vitest';

import { ADMIN_PASSWORD, ADMIN_USER } from '../support/admin.ts';
import { startStack, client, loginAs, hidden, expectNoSecrets, runCleanups } from '../support/inventory-manager-qa-req-f-039.ts';

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
  it('S-02: al entrar se sustituye la cookie previa por un id nuevo; una cookie inventada no da acceso y se borra; al salir la sesión deja de valer', async () => {
    const stack = await startStack();
    const c = client(stack);
    await loginAs(c, ADMIN_USER, ADMIN_PASSWORD);
    const first = c.cookie();
    await loginAs(c, ADMIN_USER, ADMIN_PASSWORD);
    expect(c.cookie()).not.toBe(first);
    const old = await fetch(`${stack.url}/molotes/productos`, { redirect: 'manual', headers: { Cookie: first } });
    expect([200, 303]).toContain(old.status);
    const forged = await fetch(`${stack.url}/molotes/productos`, { redirect: 'manual', headers: { Cookie: 'admin_sid=inventadoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' } });
    expect(forged.status).toBe(303);
    expect(forged.headers.getSetCookie().join(';')).toMatch(/admin_sid=;/);
    const page = await (await c.get('/molotes/productos')).text();
    const csrf = hidden(page, '_csrf');
    const current = c.cookie();
    const out = await c.post('/salir', { _csrf: csrf });
    expect(out.status).toBe(303);
    expect(out.headers.get('location')).toBe('/acceso');
    const after = await fetch(`${stack.url}/molotes/productos`, { redirect: 'manual', headers: { Cookie: current } });
    expect(after.status).toBe(303);
    expect(after.headers.get('location')).toMatch(/^\/acceso/);
  });

  it('S-05 y S-06: next solo acepta pantallas del admin; todo Location es una ruta interna', async () => {
    const stack = await startStack();
    const malicious = ['//evil.example', '/\\evil', 'https://evil.example', 'javascript:alert(1)', '/%2F%2Fevil', '/MOLOTES/productos', '/molotes/productos/', '/molotes/productos?x=1', '/molotes/productos/0/editar', '/salir', '/acceso', ' /molotes/productos', '/molotes/productos\r\nSet-Cookie: x=1'];
    for (const next of malicious) {
      const res = await client(stack).post('/acceso', { username: ADMIN_USER, password: ADMIN_PASSWORD, next });
      expect(res.headers.get('location'), JSON.stringify(next)).toBe('/');
    }
    for (const next of ['/molotes/productos', '/birria/productos/nuevo', '/molotes/productos/eliminados', '/molotes/productos/3/editar', '/molotes/productos/3/eliminar']) {
      const res = await client(stack).post('/acceso', { username: ADMIN_USER, password: ADMIN_PASSWORD, next });
      expect(res.headers.get('location')).toBe(next);
    }
    const anonymous = await fetch(`${stack.url}/molotes/productos/3/editar`, { redirect: 'manual' });
    expect(anonymous.headers.get('location')).toBe('/acceso?next=%2Fmolotes%2Fproductos%2F3%2Feditar');
    const page = await (await fetch(`${stack.url}/acceso?next=${encodeURIComponent('//evil.example')}`)).text();
    expect(hidden(page, 'next')).toBe('/');
    expectNoSecrets(stack);
  });
});

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
