import { describe, expect, it } from 'vitest';

import { getActiveBusinessId, getHomeNotice, getMolotesNotice, getWeekday, parseForcedDay } from '../../src/services/business-schedule.ts';

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

describe('getHomeNotice (REQ-F-028)', () => {
  it.each([
    ['2026-10-05T18:00:00Z', 'Mon', 'rest'],
    ['2026-10-06T18:00:00Z', 'Tue', 'molotes'],
    ['2026-10-07T18:00:00Z', 'Wed', 'molotes'],
    ['2026-10-08T18:00:00Z', 'Thu', 'molotes'],
    ['2026-10-09T18:00:00Z', 'Fri', 'molotes'],
    ['2026-10-10T18:00:00Z', 'Sat', null],
    ['2026-10-11T18:00:00Z', 'Sun', null],
  ])('%s (%s) -> %s', (iso, _weekday, expected) => {
    expect(getHomeNotice({ now: new Date(iso), timeZone: MX })).toBe(expected);
  });

  it('CA-11: usa el día de la zona del negocio, no el de UTC (lunes 23:30 CDMX = martes UTC)', () => {
    const now = new Date('2026-10-13T05:30:00Z');
    expect(getHomeNotice({ now, timeZone: MX })).toBe('rest');
    expect(getHomeNotice({ now, timeZone: 'UTC' })).toBe('molotes');
  });

  it('los cambios de día a medianoche en CDMX', () => {
    expect(getHomeNotice({ now: new Date('2026-10-12T05:59:59Z'), timeZone: MX })).toBeNull(); // domingo 23:59:59
    expect(getHomeNotice({ now: new Date('2026-10-12T06:00:00Z'), timeZone: MX })).toBe('rest'); // lunes 00:00
    expect(getHomeNotice({ now: new Date('2026-10-13T06:00:00Z'), timeZone: MX })).toBe('molotes'); // martes 00:00
    expect(getHomeNotice({ now: new Date('2026-10-17T06:00:00Z'), timeZone: MX })).toBeNull(); // sábado 00:00
  });

  it('el día forzado sustituye al calculado', () => {
    const saturday = new Date('2026-10-10T18:00:00Z');
    expect(getHomeNotice({ now: saturday, timeZone: MX, forcedDay: 'Mon' })).toBe('rest');
    expect(getHomeNotice({ now: saturday, timeZone: MX, forcedDay: 'Wed' })).toBe('molotes');
    expect(getHomeNotice({ now: new Date('2026-10-06T18:00:00Z'), timeZone: MX, forcedDay: 'Sun' })).toBeNull();
    expect(getHomeNotice({ now: saturday, timeZone: MX, forcedDay: undefined })).toBeNull();
  });
});

describe('getMolotesNotice (REQ-F-034)', () => {
  it.each([
    ['2026-10-05T18:00:00Z', 'Mon', 'rest'],
    ['2026-10-06T18:00:00Z', 'Tue', null],
    ['2026-10-07T18:00:00Z', 'Wed', null],
    ['2026-10-08T18:00:00Z', 'Thu', null],
    ['2026-10-09T18:00:00Z', 'Fri', null],
    ['2026-10-10T18:00:00Z', 'Sat', 'weekend'],
    ['2026-10-11T18:00:00Z', 'Sun', 'weekend'],
  ])('%s (%s) -> %s', (iso, weekday, expected) => {
    const now = new Date(iso);
    expect(getWeekday(now, MX)).toBe(weekday);
    expect(getMolotesNotice({ now, timeZone: MX })).toBe(expected);
  });

  it('CA-8: viernes -> sábado a las 00:00 de CDMX', () => {
    expect(getMolotesNotice({ now: new Date('2026-10-10T05:59:59Z'), timeZone: MX })).toBeNull(); // viernes 23:59:59
    expect(getMolotesNotice({ now: new Date('2026-10-10T06:00:00Z'), timeZone: MX })).toBe('weekend'); // sábado 00:00
  });

  it('CA-8: domingo -> lunes a las 00:00 de CDMX', () => {
    expect(getMolotesNotice({ now: new Date('2026-10-12T05:59:59Z'), timeZone: MX })).toBe('weekend'); // domingo 23:59:59
    expect(getMolotesNotice({ now: new Date('2026-10-12T06:00:00Z'), timeZone: MX })).toBe('rest'); // lunes 00:00
  });

  it('CA-8: lunes -> martes a las 00:00 de CDMX', () => {
    expect(getMolotesNotice({ now: new Date('2026-10-13T05:59:59Z'), timeZone: MX })).toBe('rest'); // lunes 23:59:59
    expect(getMolotesNotice({ now: new Date('2026-10-13T06:00:00Z'), timeZone: MX })).toBeNull(); // martes 00:00
  });

  it('usa el día de la zona del negocio, no el de UTC', () => {
    const fridayLate = new Date('2026-10-10T05:30:00Z'); // viernes 23:30 CDMX = sábado UTC
    expect(getMolotesNotice({ now: fridayLate, timeZone: MX })).toBeNull();
    expect(getMolotesNotice({ now: fridayLate, timeZone: 'UTC' })).toBe('weekend');
    const mondayLate = new Date('2026-10-13T05:30:00Z'); // lunes 23:30 CDMX = martes UTC
    expect(getMolotesNotice({ now: mondayLate, timeZone: MX })).toBe('rest');
    expect(getMolotesNotice({ now: mondayLate, timeZone: 'UTC' })).toBeNull();
  });

  it('el día forzado sustituye al calculado', () => {
    const tuesday = new Date('2026-10-06T18:00:00Z');
    expect(getMolotesNotice({ now: tuesday, timeZone: MX, forcedDay: 'Sat' })).toBe('weekend');
    expect(getMolotesNotice({ now: tuesday, timeZone: MX, forcedDay: 'Mon' })).toBe('rest');
    expect(getMolotesNotice({ now: new Date('2026-10-10T18:00:00Z'), timeZone: MX, forcedDay: 'Thu' })).toBeNull();
    expect(getMolotesNotice({ now: tuesday, timeZone: MX, forcedDay: undefined })).toBeNull();
  });
});

describe('parseForcedDay (REQ-F-028, RF-11)', () => {
  it.each([
    ['lunes', 'Mon'],
    ['martes', 'Tue'],
    ['miercoles', 'Wed'],
    ['jueves', 'Thu'],
    ['viernes', 'Fri'],
    ['sabado', 'Sat'],
    ['domingo', 'Sun'],
  ])('%s -> %s', (value, expected) => {
    expect(parseForcedDay(value)).toBe(expected);
  });

  it.each([undefined, null, '', 'Lunes', 'miércoles', 'sábado', 'mon', ' lunes', 'toString', 'constructor', '__proto__', ['lunes'], 1])(
    'ignora %j',
    (value) => {
      expect(parseForcedDay(value)).toBeUndefined();
    },
  );
});
