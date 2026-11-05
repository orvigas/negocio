import { afterEach, describe, expect, it } from 'vitest';

import { EDITOR, startStack, client, loginAs, hidden, molotesForm, productNames, expectNoSecrets, runCleanups } from '../support/inventory-manager-qa-req-f-039.ts';

/**
 * QA de REQ-F-039, PR 2: procesos reales de `api`, `landing-pages` e `inventory-manager` contra MySQL.
 * F-10 y S-10: la `requestId` del formulario evita el doble alta y se conserva tras un 422.
 *
 * Parte de inventory-manager-qa-req-f-039-csrf.test.ts, que llegó a 20,1 s en el CI.
 */

afterEach(runCleanups);

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
