import { afterEach, describe, expect, it } from 'vitest';

import { ADMIN_PASSWORD, ADMIN_USER } from '../support/admin.ts';
import { EDITOR, startStack, client, loginAs, hidden, molotesForm, productNames, expectNoSecrets, runCleanups } from '../support/inventory-manager-qa-req-f-039.ts';

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

describe('QA REQ-F-039 PR 2: CSRF, IP y permisos con los procesos reales', () => {
  it('S-03: la primera capa de CSRF responde 403 sin llamar a la API ni cambiar nada', async () => {
    const stack = await startStack();
    const c = client(stack);
    await loginAs(c, ADMIN_USER, ADMIN_PASSWORD);
    const page = await (await c.get('/molotes/productos')).text();
    const csrf = hidden(page, '_csrf');
    const before = (stack.api.output().stdout.match(/\/mover/g) ?? []).length;
    const attempts: Record<string, string>[] = [{ Origin: 'http://evil.example' }, { Origin: 'null', 'Sec-Fetch-Site': 'cross-site' }, { 'Sec-Fetch-Site': 'cross-site' }, { 'Sec-Fetch-Site': 'same-site' }];
    for (const extra of attempts) {
      const res = await c.post('/molotes/productos/3/subir', { _csrf: csrf, version: '1' }, extra);
      expect(res.status, JSON.stringify(extra)).toBe(403);
    }
    expect((stack.api.output().stdout.match(/\/mover/g) ?? []).length).toBe(before);
    const order = (html: string) => html.match(/action="\/molotes\/productos\/\d+\/subir"/g) ?? [];
    expect(order(await productNames(c))).toEqual(order(page));
  });

  it('S-08: con TRUST_PROXY la API cuenta el último valor de X-Forwarded-For; sin él, la IP del socket aunque el navegador mande la cabecera', async () => {
    const stack = await startStack();
    await client(stack, stack.url, { ...stack.browser, 'X-Forwarded-For': '203.0.113.99' }).post('/acceso', { username: ADMIN_USER, password: ADMIN_PASSWORD });
    const { proc, url } = await stack.startInventory({ NODE_ENV: 'development', TRUST_PROXY: 'true' });
    await client(stack, url, { Origin: url, 'Sec-Fetch-Site': 'same-origin', 'X-Forwarded-For': '10.1.1.1, 203.0.113.98' }).post('/acceso', { username: ADMIN_USER, password: ADMIN_PASSWORD });
    const ips = stack.api
      .output()
      .stdout.split('\n')
      .filter((line) => line.includes('"admin_login_succeeded"'))
      .map((line) => (JSON.parse(line) as { ip: string }).ip);
    expect(ips).toEqual(['127.0.0.1', '203.0.113.98']);
    expectNoSecrets(stack, proc);
  });
});

describe('QA REQ-F-039 PR 2: formularios con la API real', () => {
  it('F-10 y S-10: la requestId es distinta en cada formulario, se conserva tras un 422 y evita el doble alta', async () => {
    const stack = await startStack();
    const c = client(stack);
    await loginAs(c, EDITOR.username, EDITOR.password);
    const formA = await (await c.get('/molotes/productos/nuevo?categoria=platillo')).text();
    const formB = await (await c.get('/molotes/productos/nuevo?categoria=platillo')).text();
    const requestId = hidden(formA, 'requestId');
    expect(requestId).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(hidden(formB, 'requestId')).not.toBe(requestId);
    const csrf = hidden(formA, '_csrf');
    // 422: vuelve a pintar lo escrito con la misma requestId.
    const invalid = await c.post('/molotes/productos', { _csrf: csrf, requestId, ...molotesForm('Molote Doble QA2'), price: 'abc' });
    expect(invalid.status).toBe(422);
    const invalidHtml = await invalid.text();
    expect(hidden(invalidHtml, 'requestId')).toBe(requestId);
    expect(invalidHtml).toContain('Molote Doble QA2');
    // Doble envío con la misma requestId: un solo producto.
    const first = await c.post('/molotes/productos', { _csrf: csrf, requestId, ...molotesForm('Molote Doble QA2') });
    const second = await c.post('/molotes/productos', { _csrf: csrf, requestId, ...molotesForm('Molote Doble QA2') });
    expect([first.status, second.status]).toEqual([303, 303]);
    const list = await productNames(c);
    // Una fila por producto: el título de la fila es `<span>N.</span> nombre</p>`.
    expect(list.split('</span> Molote Doble QA2</p>').length - 1).toBe(1);
    // Una requestId con formato inválido no llega a la API: el servidor la sustituye por una nueva y
    // el alta se hace una sola vez, sin errores ni trazas.
    const forged = await c.post('/molotes/productos', { _csrf: csrf, requestId: 'corta', ...molotesForm('Molote Forjado QA2') });
    expect(forged.status).toBe(303);
    expect((await productNames(c)).split('</span> Molote Forjado QA2</p>').length - 1).toBe(1);
    expect(stack.api.output().stdout).not.toContain('INVALID_IDEMPOTENCY_KEY');
    expectNoSecrets(stack);
  });
});
