import { getLocalMinutes, type BusinessId } from '@restaurante/core/shared';
import { getBusinessHours, getWeekday, type BusinessHours, type ClockTime, type Weekday } from '@restaurante/core/schedule';

/**
 * Horario del bot (REQ-F-009, RF-6 y D-16) sobre la fuente única de REQ-F-010
 * (packages/core/schedule/business-hours.ts). Funciones puras: `now` y la zona horaria llegan como argumentos.
 */

const WEEK: readonly Weekday[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const WEEKDAY_NAMES: Readonly<Record<Weekday, string>> = Object.freeze({
  Mon: 'lunes',
  Tue: 'martes',
  Wed: 'miércoles',
  Thu: 'jueves',
  Fri: 'viernes',
  Sat: 'sábado',
  Sun: 'domingo',
});

const toMinutes = (time: ClockTime): number => {
  const [hours = '0', minutes = '0'] = time.split(':');
  return Number(hours) * 60 + Number(minutes);
};

/** ¿Está abierto el negocio en este momento? */
export function isOpen(business: BusinessId, now: Date, timeZone: string): boolean {
  const hours = getBusinessHours(business);
  const minutes = getLocalMinutes(now, timeZone);
  return hours.days.includes(getWeekday(now, timeZone)) && minutes >= toMinutes(hours.opens) && minutes < toMinutes(hours.closes);
}

export interface Opening {
  /** 0 = hoy, 1 = mañana... */
  readonly inDays: number;
  readonly weekday: Weekday;
  readonly time: ClockTime;
}

/** Próxima apertura (hoy más tarde o un día siguiente). Con el negocio abierto, la de otro día. */
export function nextOpening(business: BusinessId, now: Date, timeZone: string): Opening {
  const hours = getBusinessHours(business);
  const today = WEEK.indexOf(getWeekday(now, timeZone));
  const minutes = getLocalMinutes(now, timeZone);
  for (let inDays = 0; inDays <= 7; inDays += 1) {
    const weekday = WEEK[(today + inDays) % 7] as Weekday;
    if (hours.days.includes(weekday) && (inDays > 0 || minutes < toMinutes(hours.opens))) return { inDays, weekday, time: hours.opens };
  }
  // defineHours garantiza al menos un día de servicio: el bucle siempre encuentra uno.
  throw new Error(`Sin días de servicio: ${business}`);
}

/**
 * D-16: fuera de horario, el pedido solo se acepta si el negocio abre ese mismo día o al día
 * siguiente. Se comprueba al empezar el pedido (PT-2 A).
 */
export function acceptsOrders(business: BusinessId, now: Date, timeZone: string): boolean {
  return isOpen(business, now, timeZone) || nextOpening(business, now, timeZone).inDays <= 1;
}

/** "hoy a las 08:30", "mañana martes a las 08:30" o "el sábado a las 08:00". */
export function describeOpening({ inDays, weekday, time }: Opening): string {
  if (inDays === 0) return `hoy a las ${time}`;
  if (inDays === 1) return `mañana ${WEEKDAY_NAMES[weekday]} a las ${time}`;
  return `el ${WEEKDAY_NAMES[weekday]} a las ${time}`;
}

/** "martes a viernes de 08:30 a 15:00" o "sábado y domingo de 08:00 a 15:00". */
export function describeHours(hours: BusinessHours): string {
  const names = hours.days.map((day) => WEEKDAY_NAMES[day]);
  const first = names[0] ?? '';
  const last = names[names.length - 1] ?? '';
  // Lunes primero: "sábado y domingo", "martes a viernes".
  const order = hours.days.map((day) => (WEEK.indexOf(day) + 6) % 7);
  const consecutive = order.every((value, index) => index === 0 || value === (order[index - 1] ?? -2) + 1);
  let days: string;
  if (names.length === 1) days = first;
  else if (names.length === 2) days = `${first} y ${last}`;
  else if (consecutive) days = `${first} a ${last}`;
  else days = `${names.slice(0, -1).join(', ')} y ${last}`;
  return `${days} de ${hours.opens} a ${hours.closes}`;
}
