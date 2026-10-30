import { afterEach, describe, expect, it } from 'vitest';

import { freePort } from '../support/process.ts';
import { EDITOR, sleep, startStack, session, call, molotesInput, type ProductBody, publishMolote, landingHas, logLines, expectNoSecrets, runCleanups } from '../support/admin-api-qa-req-f-039.ts';

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
  it('F-13: tras una escritura confirmada, la landing muestra el cambio sin reiniciar y el bot recarga (CA-9 en proceso)', async () => {
    const stack = await startStack();
    const eli = await session(stack, EDITOR.username, EDITOR.password);
    expect(await landingHas(stack, 'Molote Avisado QA')).toBe(false);
    const published = await publishMolote(stack, eli, 'Molote Avisado QA');
    expect(published.meta).toEqual({ freshness: 'confirmed' });
    expect(await landingHas(stack, 'Molote Avisado QA')).toBe(true);
    // La línea de log llega por la tubería de stdout del hijo y puede hacerlo después de la respuesta.
    const notifiedLines = () => logLines(stack.landing.output().stdout).filter((line) => line.msg === 'products_change_notified');
    await expect.poll(() => notifiedLines().length).toBeGreaterThan(0);
    expect(notifiedLines().at(-1)).toMatchObject({ business: 'molotes', landing: true, bot: true });
    expectNoSecrets(stack);
  });

  it('F-14: con el aviso caído la escritura se confirma como pending y el fallo queda en el log, sin el token (CA-11)', async () => {
    const deadPort = await freePort();
    const stack = await startStack({ notifyTarget: async () => `http://127.0.0.1:${deadPort}` });
    const eli = await session(stack, EDITOR.username, EDITOR.password);
    const created = await call(stack, '/molotes/productos', eli, { method: 'POST', body: molotesInput('Molote Sin Aviso') });
    expect(created.status).toBe(201);
    expect(((await created.json()) as ProductBody).meta).toEqual({ freshness: 'pending' });
    await sleep(1800);
    const failures = logLines(stack.api.output().stdout).filter((line) => line.msg === 'products_notify_failed');
    expect(failures.length).toBeGreaterThanOrEqual(2);
    expect(failures[0]).toMatchObject({ business: 'molotes', attempt: 1, reason: 'network' });
    expectNoSecrets(stack);
  });
});
