import { BUSINESS, type BusinessId } from '../config/businesses.ts';

/**
 * Selección del negocio activo según el día de la semana en la zona horaria
 * del negocio (no la del servidor):
 *   lunes a viernes  -> molotes
 *   sábado y domingo -> birria
 */

const WEEKEND_DAYS = new Set(['Sat', 'Sun']);

/** Un formateador por zona horaria; las zonas provienen solo de la configuración. */
const weekdayFormatters = new Map<string, Intl.DateTimeFormat>();

export type Weekday = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

function getWeekdayFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = weekdayFormatters.get(timeZone);
  if (!formatter) {
    // Lanza RangeError si la zona horaria no es válida.
    formatter = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' });
    weekdayFormatters.set(timeZone, formatter);
  }
  return formatter;
}

function assertValidDate(date: unknown): asserts date is Date {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new TypeError('Se esperaba una fecha (Date) válida');
  }
}

/** `timeZone`: zona horaria IANA. */
export function getWeekday(date: Date, timeZone: string): Weekday {
  assertValidDate(date);
  // Intl con `weekday: 'short'` y locale en-US solo produce estas siete abreviaturas.
  return getWeekdayFormatter(timeZone).format(date) as Weekday;
}

/** `now` es inyectable para pruebas. */
export function getActiveBusinessId({ now = new Date(), timeZone }: { now?: Date; timeZone: string }): BusinessId {
  return WEEKEND_DAYS.has(getWeekday(now, timeZone)) ? BUSINESS.BIRRIA : BUSINESS.MOLOTES;
}
