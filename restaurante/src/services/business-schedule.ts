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

/**
 * Aviso de la página de inicio (REQ-F-028): `/` muestra siempre Birria y, según el día en la
 * zona del negocio, abre un modal.
 *   lunes            -> 'rest'    (descanso: ningún negocio abre)
 *   martes a viernes -> 'molotes' (la birria es de fin de semana)
 *   sábado y domingo -> null
 */
export type HomeNotice = 'molotes' | 'rest';

const HOME_NOTICES: Readonly<Record<Weekday, HomeNotice | null>> = Object.freeze({
  Mon: 'rest',
  Tue: 'molotes',
  Wed: 'molotes',
  Thu: 'molotes',
  Fri: 'molotes',
  Sat: null,
  Sun: null,
});

/** `forcedDay`: día forzado en desarrollo (`?dia=`); si llega, sustituye al calculado. */
export function getHomeNotice({ now = new Date(), timeZone, forcedDay }: { now?: Date; timeZone: string; forcedDay?: Weekday | undefined }): HomeNotice | null {
  return HOME_NOTICES[forcedDay ?? getWeekday(now, timeZone)];
}

/** Valores de `?dia=` (solo en desarrollo), sin acentos para escribirlos fácil en la URL. */
const FORCED_DAYS: Readonly<Record<string, Weekday>> = Object.freeze({
  lunes: 'Mon',
  martes: 'Tue',
  miercoles: 'Wed',
  jueves: 'Thu',
  viernes: 'Fri',
  sabado: 'Sat',
  domingo: 'Sun',
});

/** Traduce `?dia=` a un día; cualquier otro valor (o ninguno) se ignora. */
export function parseForcedDay(value: unknown): Weekday | undefined {
  return typeof value === 'string' && Object.hasOwn(FORCED_DAYS, value) ? FORCED_DAYS[value] : undefined;
}
