import { describe, expect, it } from 'vitest';

import {
  UNIT_CONVERSION_CODES,
  UnitConversionError,
  convertToBase,
  divideRounded,
  equivalences,
  formatDecimal,
  multiplyDecimals,
  parseDecimal,
  readFactor,
  type ConvertibleItem,
} from '@restaurante/core/inventory';

/** Decimales exactos y conversiones del inventario (REQ-F-049: RN-3, RN-14, PV-13, CA-4, CA-5 y CA-6). */

const qty = (text: string): bigint => {
  const parsed = parseDecimal(text);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.value;
};
const MASA: ConvertibleItem = { baseUnit: 'kg', units: [{ name: 'bulto', factor: qty('25') }] };
const COCA: ConvertibleItem = { baseUnit: 'pza', units: [{ name: 'Caja', factor: qty('24') }] };

const conversionError = (run: () => unknown): UnitConversionError => {
  try {
    run();
  } catch (err) {
    if (err instanceof UnitConversionError) return err;
    throw err;
  }
  throw new Error('No lanzó UnitConversionError');
};

describe('punto fijo', () => {
  it('lee enteros y hasta 3 decimales, sin redondear', () => {
    expect(parseDecimal('24')).toEqual({ ok: true, value: 24_000n });
    expect(parseDecimal(' 0.355 ')).toEqual({ ok: true, value: 355n });
    expect(parseDecimal('9999999999.999')).toEqual({ ok: true, value: 9_999_999_999_999n });
    expect(parseDecimal('007.5')).toEqual({ ok: true, value: 7_500n });
  });

  it('rechaza coma, signo, notación científica, más decimales o más dígitos de los permitidos', () => {
    expect(parseDecimal('0,5')).toEqual({ ok: false, error: 'Usa punto decimal, no coma (p. ej. 0.5).' });
    expect(parseDecimal('0.0001')).toEqual({ ok: false, error: 'Máximo 3 decimales.' });
    expect(parseDecimal('10000000000')).toEqual({ ok: false, error: 'Máximo 10 dígitos antes del punto.' });
    for (const raw of ['-1', '1e3', '.5', '5.', '1 000', 'abc', '', 24, null]) expect(parseDecimal(raw).ok, String(raw)).toBe(false);
  });

  it('escribe siempre con la escala completa', () => {
    expect(formatDecimal(24_000n)).toBe('24.000');
    expect(formatDecimal(5n)).toBe('0.005');
    expect(formatDecimal(-1_500n)).toBe('-1.500');
    expect(formatDecimal(12_345n, 4)).toBe('1.2345');
  });

  it('redondea la mitad hacia arriba (sobre el valor absoluto)', () => {
    expect(divideRounded(5n, 10n)).toBe(1n);
    expect(divideRounded(4n, 10n)).toBe(0n);
    expect(divideRounded(15n, 10n)).toBe(2n);
    expect(divideRounded(-15n, 10n)).toBe(-2n);
    expect(() => divideRounded(1n, 0n)).toThrow(RangeError);
    // 1.005 × 0.5 = 0.5025 -> 0.503 (escala 3).
    expect(multiplyDecimals(1_005n, 3, 500n, 3, 3)).toBe(503n);
  });
});

describe('conversión a la unidad base', () => {
  it('CA-4: 2 cajas de 24 son 48 pza; el nombre del empaque no distingue mayúsculas', () => {
    expect(formatDecimal(convertToBase(qty('2'), 'caja', COCA))).toBe('48.000');
    expect(formatDecimal(convertToBase(qty('0.5'), 'CAJA', COCA))).toBe('12.000');
  });

  it('CA-5: 500 g son 0.5 kg, y entre unidades fijas de la misma magnitud en ambos sentidos', () => {
    expect(formatDecimal(convertToBase(qty('500'), 'g', MASA))).toBe('0.500');
    expect(formatDecimal(convertToBase(qty('2'), 'bulto', MASA))).toBe('50.000');
    expect(formatDecimal(convertToBase(qty('1.5'), 'L', { baseUnit: 'ml', units: [] }))).toBe('1500.000');
    expect(formatDecimal(convertToBase(qty('0.4'), 'kg', MASA))).toBe('0.400');
  });

  it('CA-5: sin factor entre magnitudes se rechaza con un mensaje claro', () => {
    const error = conversionError(() => convertToBase(qty('1'), 'pza', MASA));
    expect(error.code).toBe(UNIT_CONVERSION_CODES.UNAVAILABLE);
    expect(error.message).toBe('No hay factor para convertir pza a kg en este artículo.');
    expect(conversionError(() => convertToBase(qty('1'), 'ml', MASA)).code).toBe(UNIT_CONVERSION_CODES.UNAVAILABLE);
  });

  it('rechaza una unidad que el artículo no tiene y la conversión en un padre', () => {
    expect(conversionError(() => convertToBase(qty('1'), 'costal', MASA)).code).toBe(UNIT_CONVERSION_CODES.UNKNOWN_UNIT);
    expect(conversionError(() => convertToBase(qty('1'), 'kg', { baseUnit: null, units: [] })).code).toBe(UNIT_CONVERSION_CODES.UNAVAILABLE);
  });

  it('redondea a 3 decimales y rechaza lo que se redondea a 0 o supera el máximo', () => {
    // 0.5 g = 0.0005 kg -> 0.001 kg (mitad hacia arriba); 0.4 g -> 0 -> se rechaza.
    expect(formatDecimal(convertToBase(qty('0.5'), 'g', MASA))).toBe('0.001');
    expect(conversionError(() => convertToBase(qty('0.4'), 'g', MASA)).code).toBe(UNIT_CONVERSION_CODES.TOO_SMALL);
    const huge: ConvertibleItem = { baseUnit: 'pza', units: [{ name: 'tarima', factor: qty('1000000') }] };
    expect(conversionError(() => convertToBase(qty('9999999999'), 'tarima', huge)).code).toBe(UNIT_CONVERSION_CODES.TOO_LARGE);
  });

  it('RF-4: equivalencias de la ficha (empaques y unidades de la misma magnitud)', () => {
    expect(equivalences(MASA).map(({ unit, quantity }) => [unit, formatDecimal(quantity)])).toEqual([
      ['bulto', '25.000'],
      ['g', '0.001'],
    ]);
    expect(equivalences({ baseUnit: 'g', units: [] }).map(({ unit, quantity }) => [unit, formatDecimal(quantity)])).toEqual([['kg', '1000.000']]);
    expect(equivalences({ baseUnit: null, units: [] })).toEqual([]);
  });
});

describe('factor de empaque (CA-6)', () => {
  it('acepta un factor positivo con hasta 3 decimales y hasta 1 000 000', () => {
    expect(readFactor('0.355')).toEqual({ value: 355n });
    expect(readFactor('1000000')).toEqual({ value: 1_000_000_000n });
  });

  it('rechaza 0, negativo, no numérico, con 4 decimales o mayor que 1 000 000', () => {
    expect(readFactor('0')).toEqual({ error: 'El factor debe ser mayor que 0.' });
    expect(readFactor('0.000')).toEqual({ error: 'El factor debe ser mayor que 0.' });
    expect(readFactor('-24')).toHaveProperty('error');
    expect(readFactor('veinte')).toHaveProperty('error');
    expect(readFactor('0.3555')).toEqual({ error: 'Máximo 3 decimales.' });
    expect(readFactor('1000000.001')).toEqual({ error: 'El factor no puede pasar de 1 000 000.' });
    expect(readFactor('')).toEqual({ error: 'Escribe el factor.' });
  });
});
