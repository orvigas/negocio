import { BUSINESS } from '../config/businesses.js';

/**
 * Selección del negocio activo según el día de la semana en la zona horaria
 * del negocio (no la del servidor):
 *   lunes a viernes  -> molotes
 *   sábado y domingo -> birria
 */

const WEEKEND_DAYS = new Set(['Sat', 'Sun']);

/** Un formateador por zona horaria; las zonas provienen solo de la configuración. */
const weekdayFormatters = new Map();

function getWeekdayFormatter(timeZone) {
  let formatter = weekdayFormatters.get(timeZone);
  if (!formatter) {
    // Lanza RangeError si la zona horaria no es válida.
    formatter = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' });
    weekdayFormatters.set(timeZone, formatter);
  }
  return formatter;
}

function assertValidDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new TypeError('Se esperaba una fecha (Date) válida');
  }
}

/**
 * @param {Date} date
 * @param {string} timeZone Zona horaria IANA.
 * @returns {'Mon'|'Tue'|'Wed'|'Thu'|'Fri'|'Sat'|'Sun'}
 */
export function getWeekday(date, timeZone) {
  assertValidDate(date);
  return getWeekdayFormatter(timeZone).format(date);
}

/**
 * @param {{ now?: Date, timeZone: string }} options `now` es inyectable para pruebas.
 * @returns {'molotes'|'birria'}
 */
export function getActiveBusinessId({ now = new Date(), timeZone }) {
  return WEEKEND_DAYS.has(getWeekday(now, timeZone)) ? BUSINESS.BIRRIA : BUSINESS.MOLOTES;
}
