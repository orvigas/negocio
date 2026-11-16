import { describe, expect, it } from 'vitest';

import { flowTraces, loadGolden, templateTraces } from '../support/bot-golden.ts';

/**
 * REQ-F-029: el formato de los textos del bot cambia, pero no lo que recibe el personal ni el flujo.
 * Los valores esperados (tests/fixtures/bot-golden/) se generaron con el código anterior al cambio;
 * si una de estas pruebas falla, el cambio alteró la plantilla o el flujo y no solo la presentación.
 */

describe('invariantes del cambio de formato (REQ-F-029)', () => {
  it('CA-8: parámetros, cuerpo de la plantilla y aviso en texto libre idénticos a los de antes', () => {
    expect(templateTraces()).toEqual(loadGolden('template'));
  });

  it('CA-9: mismos pasos, carrito, total, código, datos y número de respuestas por turno', async () => {
    expect(await flowTraces()).toEqual(loadGolden('flow'));
  });
});
