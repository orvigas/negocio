import { describe, expect, it } from 'vitest';

import { formatDisplayDate, toZonedIsoString } from '../../src/utils/datetime.ts';
import { diffMenuData } from '../../src/services/menu-diff.ts';

describe('toZonedIsoString', () => {
  it('usa la zona horaria del negocio con su desfase', () => {
    const date = new Date('2026-10-09T18:00:05Z');
    expect(toZonedIsoString(date, 'America/Mexico_City')).toBe('2026-10-09T12:00:05-06:00');
    expect(toZonedIsoString(date, 'UTC')).toBe('2026-10-09T18:00:05+00:00');
    expect(toZonedIsoString(date, 'Asia/Kolkata')).toBe('2026-10-09T23:30:05+05:30');
  });

  it('el resultado representa el mismo instante', () => {
    const date = new Date('2026-03-01T05:59:59Z');
    expect(new Date(toZonedIsoString(date, 'America/Mexico_City')).getTime()).toBe(date.getTime());
  });

  it('formatea la fecha para la interfaz', () => {
    expect(formatDisplayDate('2026-10-09T12:00:05-06:00', 'America/Mexico_City')).toBe('09/10/2026 12:00');
  });
});

describe('diffMenuData', () => {
  it('lista solo las hojas modificadas con su valor anterior y nuevo', () => {
    const before = { a: { b: 1, c: [{ d: 'x' }, { d: 'y' }] }, e: true };
    const after = { a: { b: 2, c: [{ d: 'x' }, { d: 'z' }] }, e: true };
    expect(diffMenuData(before, after)).toEqual([
      { field: 'a.b', before: 1, after: 2 },
      { field: 'a.c.1.d', before: 'y', after: 'z' },
    ]);
  });

  it('sin cambios devuelve una lista vacía', () => {
    expect(diffMenuData({ a: [1] }, { a: [1] })).toEqual([]);
  });
});
