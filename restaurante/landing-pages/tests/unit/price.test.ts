import { describe, expect, it } from 'vitest';

import { MAX_PRICE_CENTS, PRICE_ERRORS, centsToInput, isValidPriceCents, parsePesosInput } from '../../src/services/price.ts';

describe('parsePesosInput (RN-1)', () => {
  it.each([
    ['0.01', 1], // CA-11
    ['5000', 500_000], // CA-12
    ['5000.00', 500_000], // CA-12
    ['45', 4500],
    ['45.5', 4550], // CA-15: se guarda como 45.50
    ['45.50', 4550],
    ['  130.00  ', 13_000],
    ['1999.99', 199_999],
  ])('acepta "%s" -> %i centavos', (input, cents) => {
    expect(parsePesosInput(input)).toEqual({ ok: true, cents });
  });

  it.each([
    ['0', PRICE_ERRORS.min], // CA-10
    ['0.00', PRICE_ERRORS.min], // CA-10
    ['5000.01', PRICE_ERRORS.max], // CA-12
    ['99999', PRICE_ERRORS.max],
    ['45.505', PRICE_ERRORS.format], // CA-13
    ['-10', PRICE_ERRORS.format], // CA-13
    ['abc', PRICE_ERRORS.format], // CA-13
    ['', PRICE_ERRORS.required], // CA-13
    ['   ', PRICE_ERRORS.required],
    ['1e3', PRICE_ERRORS.format],
    ['45,50', PRICE_ERRORS.format],
    ['$45', PRICE_ERRORS.format],
    ['.5', PRICE_ERRORS.format],
    ['45.', PRICE_ERRORS.format],
    ['0x10', PRICE_ERRORS.format],
    ['Infinity', PRICE_ERRORS.format],
    [undefined, PRICE_ERRORS.required],
  ])('rechaza %j con el mensaje adecuado', (input, error) => {
    expect(parsePesosInput(input)).toEqual({ ok: false, error });
  });

  it('los mensajes indican el mínimo y el máximo', () => {
    expect(PRICE_ERRORS.min).toMatch(/mayor que \$0/);
    expect(PRICE_ERRORS.max).toMatch(/\$5,000\.00/);
  });
});

describe('centsToInput / isValidPriceCents', () => {
  it('formatea con 2 decimales para el formulario', () => {
    expect(centsToInput(4550)).toBe('45.50');
    expect(centsToInput(4500)).toBe('45.00');
    expect(centsToInput(1)).toBe('0.01');
    expect(centsToInput(MAX_PRICE_CENTS)).toBe('5000.00');
  });

  it('valida el rango en centavos', () => {
    expect(isValidPriceCents(1)).toBe(true);
    expect(isValidPriceCents(MAX_PRICE_CENTS)).toBe(true);
    expect(isValidPriceCents(0)).toBe(false);
    expect(isValidPriceCents(MAX_PRICE_CENTS + 1)).toBe(false);
    expect(isValidPriceCents(45.5)).toBe(false);
    expect(isValidPriceCents('4500')).toBe(false);
  });
});
