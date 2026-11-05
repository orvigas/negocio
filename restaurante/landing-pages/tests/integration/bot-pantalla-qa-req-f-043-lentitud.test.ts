import { afterEach, describe, expect, it } from 'vitest';

import { PHONE, SAVED_CLAIM, UNCONFIRMED, noPhone, runCleanups, selectedDuration, startFakeApi, startInventory, browser, valueOf } from '../support/bot-pantalla-qa-req-f-043.ts';

/**
 * Sonda S-7 de QA de REQ-F-043, PR 2 (QA2-43): tiempo agotado de verdad, con los 5 s de `API_TIMEOUT_MS`
 * de `server.ts`. Aparte, para no alargar S-6.
 */

afterEach(runCleanups);

describe('API que no contesta a una escritura', () => {
  it('QA2-43: el alta no afirma nada y el teléfono vuelve vacío', async () => {
    const fake = await startFakeApi();
    const inventory = await startInventory(fake.url);
    fake.write = 'hang';
    const admin = browser(inventory.url, 'admin_sid=qa-sesion-falsa-de-req-f-043');
    const res = await admin.post('/bot/bloqueos', { _csrf: 'x', telefono: PHONE, duracion: '30d', motivo: 'Prueba' });
    expect(res.status).toBe(503);
    expect(res.html).toContain(UNCONFIRMED);
    expect(res.html).not.toMatch(SAVED_CLAIM);
    noPhone(res.html, 'HTML');
    expect(valueOf(res.html, 'telefono') ?? '').toBe('');
    expect(valueOf(res.html, 'motivo')).toBe('Prueba');
    expect(selectedDuration(res.html)).toBe('30d');
    expect(inventory.output().stdout).toContain('"reason":"timeout"');
  });
});
