import { describe, expect, it } from 'vitest';

import { BUSINESS_IDS, type BusinessId } from '@restaurante/core/shared';
import { BUSINESS_HOURS, getBusinessHours, type BusinessHours, type Weekday } from '@restaurante/core/schedule';
import type { MenuDocument } from '@restaurante/core/catalog';
import { createRenderer } from '@restaurante/web';

import { DEFAULT_VIEWS_DIR } from '../../src/app.ts';
import { getBusinessContent } from '../../src/content/index.ts';
import { loadSeedDocument } from '../../src/content/seeds.ts';
import { renderLandingPage } from '../../src/views/landings/index.ts';
import { makeConfig } from '../helpers.ts';
import { findDayGroups, findTimes, sortDays } from '../support/schedule-text.ts';

/**
 * REQ-F-010 (D-6, RN-2, CA-4): los textos de horario de las landings coinciden con la fuente
 * estructurada de packages/core/schedule/business-hours.ts (REQ-F-042, RF-7). Si se cambia la fuente sin cambiar los textos (o al revés),
 * estas pruebas fallan.
 */

const ALL_DAYS: readonly Weekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface ScheduleRow {
  days: string;
  hours: string;
}

/** Textos de una línea con días y horas de servicio. */
interface ScheduleTexts {
  lines: readonly string[];
  /** Tablas (filas de días con su horario o con "cerrado") que cubren la semana completa. */
  tables: Readonly<Record<string, readonly ScheduleRow[]>>;
  /** Textos que solo mencionan días cerrados. */
  closedNotes: readonly string[];
}

function scheduleTexts(businessId: BusinessId): ScheduleTexts {
  if (businessId === 'molotes') {
    const c = getBusinessContent('molotes');
    return {
      lines: [c.announcement, c.service.schedule.hours],
      tables: { 'pie de página': c.footer.hours.rows },
      closedNotes: [c.service.schedule.note],
    };
  }
  const c = getBusinessContent('birria');
  return {
    lines: [],
    tables: { 'tarjetas de Horarios de Servicio': c.locations.schedule.slots, 'pie de página': c.footer.hours.rows },
    closedNotes: [],
  };
}

const closedDaysOf = (hours: BusinessHours) => ALL_DAYS.filter((day) => !hours.days.includes(day));

/** Un texto abierto nombra exactamente los días de servicio y su par de horas es apertura–cierre. */
function expectOpenText(text: string, hours: BusinessHours) {
  const groups = findDayGroups(text);
  expect(groups, text).toHaveLength(1);
  expect(sortDays(groups[0]!), text).toEqual(sortDays(hours.days));
  expect(findTimes(text), text).toEqual([hours.opens, hours.closes]);
}

/** Texto visible de una página: sin scripts, estilos ni etiquetas. */
const visibleText = (html: string) =>
  html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');

const renderer = createRenderer({ viewsDir: DEFAULT_VIEWS_DIR });

describe('fuente estructurada de horarios (D-6)', () => {
  it('define el horario de cada negocio según RN-1', () => {
    expect(BUSINESS_HOURS).toEqual({
      molotes: { days: ['Tue', 'Wed', 'Thu', 'Fri'], opens: '08:30', closes: '15:00' },
      birria: { days: ['Sat', 'Sun'], opens: '08:00', closes: '15:00' },
    });
  });

  it.each(BUSINESS_IDS)('%s: es inmutable y se obtiene con getBusinessHours', (businessId) => {
    const hours = getBusinessHours(businessId);
    expect(hours).toBe(BUSINESS_HOURS[businessId]);
    expect(Object.isFrozen(hours)).toBe(true);
    expect(Object.isFrozen(hours.days)).toBe(true);
  });

  it('falla rápido con un negocio desconocido', () => {
    expect(() => getBusinessHours('tacos' as BusinessId)).toThrow('No hay horario para el negocio: tacos');
  });
});

describe.each(BUSINESS_IDS)('%s: coherencia de los textos de horario con la fuente (RN-2)', (businessId) => {
  const hours = getBusinessHours(businessId);
  const texts = scheduleTexts(businessId);

  it('cada texto de una línea publica los días y las horas de la fuente', () => {
    for (const line of texts.lines) expectOpenText(line, hours);
  });

  it.each(Object.entries(texts.tables))('la tabla "%s" cubre la semana sin contradecir la fuente', (_name, rows) => {
    const covered: Weekday[] = [];
    for (const row of rows) {
      const text = `${row.days} ${row.hours}`;
      if (findTimes(row.hours).length > 0) {
        expectOpenText(text, hours);
      } else {
        // Fila cerrada: ninguno de sus días es de servicio.
        for (const day of findDayGroups(row.days).flat()) expect(hours.days, text).not.toContain(day);
      }
      covered.push(...findDayGroups(row.days).flat());
    }
    // Cada día aparece una sola vez y la semana queda completa.
    expect(covered).toHaveLength(ALL_DAYS.length);
    expect(sortDays(covered)).toEqual(ALL_DAYS);
  });

  it('las notas de cierre mencionan exactamente los días cerrados', () => {
    for (const note of texts.closedNotes) {
      expect(findTimes(note), note).toEqual([]);
      expect(sortDays(findDayGroups(note).flat()), note).toEqual(closedDaysOf(hours));
    }
  });

  it('toda hora visible en la landing es la apertura o el cierre de la fuente (CA-1, CA-2)', () => {
    const menu = (loadSeedDocument(businessId) as MenuDocument).data;
    const html = renderLandingPage({ renderer, config: makeConfig(), businessId, menu }).toString();
    const times = findTimes(visibleText(html));
    expect(times.length).toBeGreaterThan(0);
    expect(new Set(times)).toEqual(new Set([hours.opens, hours.closes]));
  });
});

describe('intérprete de textos de horario (tests/support/schedule-text.ts)', () => {
  it.each([
    ['Mar - Vie', [['Tue', 'Wed', 'Thu', 'Fri']]],
    ['Martes a Viernes', [['Tue', 'Wed', 'Thu', 'Fri']]],
    ['Sábados y Domingos:', [['Sat', 'Sun']]],
    ['Miércoles - Viernes:', [['Wed', 'Thu', 'Fri']]],
    ['Lunes a Viernes', [['Mon', 'Tue', 'Wed', 'Thu', 'Fri']]],
    ['Vie – Lun', [['Fri', 'Sat', 'Sun', 'Mon']]],
    ['Horario de Comal: Mar - Vie 08:30 a 15:00 hrs', [['Tue', 'Wed', 'Thu', 'Fri']]],
    ['* Lunes cerramos. Sábados y domingos te esperamos.', [['Mon'], ['Sat', 'Sun']]],
    ['Consomé matutino', []],
  ])('días de "%s"', (text, expected) => {
    expect(findDayGroups(text)).toEqual(expected);
  });

  it.each([
    ['08:30 - 15:00', ['08:30', '15:00']],
    ['de 8:30 AM a 3:00 PM', ['08:30', '15:00']],
    ['08:00 AM – 03:00 PM', ['08:00', '15:00']],
    ['12:00 AM a 12:30 PM', ['00:00', '12:30']],
    ['Cerrado por nixtamal', []],
  ])('horas de "%s"', (text, expected) => {
    expect(findTimes(text)).toEqual(expected);
  });

  it('falla ante un rango o una hora que no entiende', () => {
    expect(() => findDayGroups('Lunes a')).not.toThrow();
    expect(() => findDayGroups('Lunes Martes')).toThrow('Secuencia de días no reconocida');
    expect(() => findTimes('13:00 PM')).toThrow('Hora de 12 h inválida');
  });
});
