import { afterEach, describe, expect, it } from 'vitest';

import { ADMIN_PASSWORD, ADMIN_USER } from '../support/admin.ts';
import { EDITOR, sleep, startStack, session, call, molotesInput, type ProductBody, landingHas, logLines, holdingProxy, runCleanups } from '../support/admin-api-qa-req-f-039.ts';

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
  // DEF-001 (QA del PR 1), corregido: la escritura que llega con un intento en vuelo recibe otro aviso al
  // terminar ese intento, así que llega a la landing antes de la red de seguridad de 60 s.
  it('N-09: una segunda escritura mientras el primer aviso sigue en curso también llega a la landing antes de la recarga de 60 s', async () => {
    // El proxy reenvía el aviso al momento (landing-pages recarga ya) y retiene la respuesta 1,2 s
    // (menos que el límite de 1,5 s del notificador, así que el intento termina bien): mientras tanto,
    // la cadena de avisos de Molotes sigue "en curso" y llega otra escritura.
    const stack = await startStack({ notifyTarget: (internal) => holdingProxy(internal, 1200) });
    const eli = await session(stack, EDITOR.username, EDITOR.password);
    const ana = await session(stack, ADMIN_USER, ADMIN_PASSWORD);
    const createdB = (await (await call(stack, '/molotes/productos', ana, { method: 'POST', body: molotesInput('Molote Segundo QA') })).json()) as ProductBody;
    await sleep(1500);
    // Primera escritura (Eli): su aviso llega a landing-pages al momento y la respuesta tarda 1,2 s.
    const first = call(stack, '/molotes/productos', eli, { method: 'POST', body: molotesInput('Molote Primero QA') });
    await sleep(400);
    // Segunda escritura (Ana), confirmada en la base después de la recarga de landing-pages.
    const second = await call(stack, `/molotes/productos/${createdB.product.id}`, ana, { method: 'PUT', body: { ...molotesInput('Molote Segundo QA'), available: true, version: createdB.product.version } });
    expect(second.status).toBe(200);
    const secondBody = (await second.json()) as ProductBody;
    expect((await first).status).toBe(201);
    let visible = false;
    for (let attempt = 0; attempt < 16 && !visible; attempt += 1) {
      await sleep(500);
      visible = await landingHas(stack, 'Molote Segundo QA');
    }
    // Su frescura es la del aviso que empezó después de ella: según cuánto retenga el proxy, `confirmed`
    // (llegó dentro de los 2 s) o `pending` (llegó después). En los dos casos la landing la muestra.
    expect(['confirmed', 'pending']).toContain(secondBody.meta?.freshness);
    expect(visible).toBe(true);
  });

  it('N-09b (ronda 2): con un aviso en vuelo corto, la segunda escritura responde confirmed y la landing ya la muestra al responder', async () => {
    // Retención de 300 ms: el intento que empieza tras la segunda escritura termina muy por debajo de 2 s.
    const stack = await startStack({ notifyTarget: (internal) => holdingProxy(internal, 300) });
    const eli = await session(stack, EDITOR.username, EDITOR.password);
    const ana = await session(stack, ADMIN_USER, ADMIN_PASSWORD);
    const createdB = (await (await call(stack, '/molotes/productos', ana, { method: 'POST', body: molotesInput('Molote Tercero QA') })).json()) as ProductBody;
    await sleep(600);
    const first = call(stack, '/molotes/productos', eli, { method: 'POST', body: molotesInput('Molote Cuarto QA') });
    await sleep(120);
    const second = await call(stack, `/molotes/productos/${createdB.product.id}`, ana, { method: 'PUT', body: { ...molotesInput('Molote Tercero QA'), available: true, version: createdB.product.version } });
    expect(second.status).toBe(200);
    expect(((await second.json()) as ProductBody).meta).toEqual({ freshness: 'confirmed' });
    // confirmed es veraz: la landing ya muestra el cambio sin esperar.
    expect(await landingHas(stack, 'Molote Tercero QA')).toBe(true);
    expect((await first).status).toBe(201);
    // Nunca dos avisos en paralelo del mismo negocio: los avisos recibidos no se solapan.
    // Se espera a las líneas de log (tubería de stdout del hijo), que pueden llegar después de la respuesta.
    await expect.poll(() => logLines(stack.landing.output().stdout).filter((line) => line.msg === 'products_change_notified' && line.business === 'molotes').length).toBeGreaterThanOrEqual(3);
  });
});
