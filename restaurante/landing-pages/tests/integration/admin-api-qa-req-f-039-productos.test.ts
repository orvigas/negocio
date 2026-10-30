import { afterEach, describe, expect, it } from 'vitest';

import { ADMIN_PASSWORD, ADMIN_USER } from '../support/admin.ts';
import { EDITOR, startStack, session, call, molotesInput, birriaInput, type ProductBody, expectNoSecrets, runCleanups } from '../support/admin-api-qa-req-f-039.ts';

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

describe('QA REQ-F-039 PR 1: reglas de producto', () => {
  it('N-06: ?sobrescribir=1 con una versión desfasada responde 409 y no guarda nada (RF-9)', async () => {
    const stack = await startStack();
    const eli = await session(stack, EDITOR.username, EDITOR.password);
    const ana = await session(stack, ADMIN_USER, ADMIN_PASSWORD);
    const created = (await (await call(stack, '/molotes/productos', eli, { method: 'POST', body: molotesInput('Molote Sobrescrito') })).json()) as ProductBody;
    const id = created.product.id;
    const edit = (name: string, version: number) => ({ ...molotesInput(name), available: false, version });
    expect((await call(stack, `/molotes/productos/${id}`, ana, { method: 'PUT', body: edit('Molote De Ana Uno', 1) })).status).toBe(200);
    expect((await call(stack, `/molotes/productos/${id}`, ana, { method: 'PUT', body: edit('Molote De Ana Dos', 2) })).status).toBe(200);
    // Eli sobrescribe con la versión 2 (la que vio en el 409 anterior), pero ya hay una 3.
    const stale = await call(stack, `/molotes/productos/${id}?sobrescribir=1`, eli, { method: 'PUT', body: edit('Molote De Eli', 2) });
    expect(stale.status).toBe(409);
    const current = (await (await call(stack, `/molotes/productos/${id}`, eli)).json()) as ProductBody;
    expect(current.product).toMatchObject({ name: 'Molote De Ana Dos', version: 3 });
  });

  // DEF-002 (QA del PR 1), corregido: la clave se recuerda por usuario, negocio y cuerpo.
  it('N-12: la misma Idempotency-Key del mismo usuario en otro negocio no devuelve el producto del primero', async () => {
    const stack = await startStack();
    const ana = await session(stack, ADMIN_USER, ADMIN_PASSWORD);
    const headers = { 'Idempotency-Key': 'clave-qa-req-f-039-0001' };
    const molotes = await call(stack, '/molotes/productos', ana, { method: 'POST', body: molotesInput('Molote Idempotente'), headers });
    expect(molotes.status).toBe(201);
    const birria = await call(stack, '/birria/productos', ana, { method: 'POST', body: birriaInput('Taco Idempotente'), headers });
    const birriaBody = (await birria.json()) as ProductBody;
    expect(birria.headers.get('location') ?? '').toMatch(/^\/api\/v1\/admin\/birria\/productos\/\d+$/);
    expect(birriaBody.product.name).toBe('Taco Idempotente');
    const list = (await (await call(stack, '/birria/productos', ana)).json()) as { products: { name: string }[] };
    expect(list.products.map((product) => product.name)).toContain('Taco Idempotente');
  });

  it('N-12b (ronda 2): la misma clave en el mismo negocio con otro cuerpo responde 422 IDEMPOTENCY_KEY_REUSED sin crear nada; con el mismo cuerpo, el mismo producto', async () => {
    const stack = await startStack();
    const ana = await session(stack, ADMIN_USER, ADMIN_PASSWORD);
    const headers = { 'Idempotency-Key': 'clave-qa-req-f-039-0002' };
    const names = async () => ((await (await call(stack, '/molotes/productos', ana)).json()) as { products: { name: string }[] }).products.map((product) => product.name);
    const first = (await (await call(stack, '/molotes/productos', ana, { method: 'POST', body: molotesInput('Molote Clave Uno'), headers })).json()) as ProductBody;
    const before = await names();
    const reused = await call(stack, '/molotes/productos', ana, { method: 'POST', body: molotesInput('Molote Clave Dos'), headers });
    expect(reused.status).toBe(422);
    expect(((await reused.json()) as { error: { code: string } }).error.code).toBe('IDEMPOTENCY_KEY_REUSED');
    expect(await names()).toEqual(before);
    const replay = await call(stack, '/molotes/productos', ana, { method: 'POST', body: molotesInput('Molote Clave Uno'), headers });
    expect(replay.status).toBe(201);
    expect(((await replay.json()) as ProductBody).product.id).toBe(first.product.id);
    expect((await names()).filter((name) => name === 'Molote Clave Uno')).toHaveLength(1);
    // Otro usuario con la misma clave: alta propia.
    const eli = await session(stack, EDITOR.username, EDITOR.password);
    const other = (await (await call(stack, '/molotes/productos', eli, { method: 'POST', body: molotesInput('Molote Clave Uno'), headers })).json()) as ProductBody;
    expect(other.product.id).not.toBe(first.product.id);
    expectNoSecrets(stack);
  });
});
