import { describe, expect, it } from 'vitest';

import { getActiveBusinessId, getWeekday } from '../../src/services/business-schedule.ts';

const MX = 'America/Mexico_City';

describe('getActiveBusinessId', () => {
  // Semana del lunes 5 al domingo 11 de octubre de 2026, al mediodía en CDMX (UTC-6).
  it.each([
    ['2026-10-05T18:00:00Z', 'Mon', 'molotes'],
    ['2026-10-06T18:00:00Z', 'Tue', 'molotes'],
    ['2026-10-07T18:00:00Z', 'Wed', 'molotes'],
    ['2026-10-08T18:00:00Z', 'Thu', 'molotes'],
    ['2026-10-09T18:00:00Z', 'Fri', 'molotes'],
    ['2026-10-10T18:00:00Z', 'Sat', 'birria'],
    ['2026-10-11T18:00:00Z', 'Sun', 'birria'],
  ])('%s (%s) -> %s', (iso, weekday, expected) => {
    const now = new Date(iso);
    expect(getWeekday(now, MX)).toBe(weekday);
    expect(getActiveBusinessId({ now, timeZone: MX })).toBe(expected);
  });

  it('usa la zona del negocio: viernes 23:30 en CDMX ya es sábado en UTC', () => {
    const now = new Date('2026-10-10T05:30:00Z');
    expect(getActiveBusinessId({ now, timeZone: MX })).toBe('molotes');
    expect(getActiveBusinessId({ now, timeZone: 'UTC' })).toBe('birria');
  });

  it('usa la zona del negocio: domingo 23:30 en CDMX ya es lunes en UTC', () => {
    const now = new Date('2026-10-12T05:30:00Z');
    expect(getActiveBusinessId({ now, timeZone: MX })).toBe('birria');
    expect(getActiveBusinessId({ now, timeZone: 'UTC' })).toBe('molotes');
  });

  it('cambia exactamente a medianoche local (sábado 00:00 CDMX)', () => {
    expect(getActiveBusinessId({ now: new Date('2026-10-10T05:59:59Z'), timeZone: MX })).toBe('molotes');
    expect(getActiveBusinessId({ now: new Date('2026-10-10T06:00:00Z'), timeZone: MX })).toBe('birria');
  });

  it('cambia exactamente a medianoche local (lunes 00:00 CDMX)', () => {
    // Domingo 11 de octubre de 2026, 23:59:59 en CDMX (UTC-6) -> lunes 12, 00:00:00.
    expect(getActiveBusinessId({ now: new Date('2026-10-12T05:59:59Z'), timeZone: MX })).toBe('birria');
    expect(getActiveBusinessId({ now: new Date('2026-10-12T06:00:00Z'), timeZone: MX })).toBe('molotes');
  });

  it('lanza RangeError con una zona horaria inválida', () => {
    expect(() => getActiveBusinessId({ now: new Date(), timeZone: 'Mars/Olympus' })).toThrow(RangeError);
  });

  it('lanza TypeError con una fecha inválida', () => {
    expect(() => getActiveBusinessId({ now: new Date('nope'), timeZone: MX })).toThrow(TypeError);
    // @ts-expect-error: un string en lugar de Date, a propósito.
    expect(() => getActiveBusinessId({ now: '2026-10-10', timeZone: MX })).toThrow(TypeError);
  });
});
