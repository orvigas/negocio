import { BUSINESS, type BusinessId } from '@restaurante/core/shared';
import type { Weekday } from '@restaurante/core/schedule';

import { birriaHours } from './birria/hours.ts';
import { molotesHours } from './molotes/hours.ts';

/**
 * Fuente única del horario de servicio de cada negocio (REQ-F-010, D-6).
 * La consumen las pruebas de coherencia de las landings y el bot de WhatsApp (REQ-F-009).
 *
 * Las horas son locales, en la zona horaria del negocio (`BUSINESS_TIMEZONE`, `config.timezone`):
 * la fuente no guarda la zona para no duplicar la configuración.
 */

/** Hora local `HH:MM` en formato de 24 horas. */
export type ClockTime = `${string}:${string}`;

export interface BusinessHours {
  /** Días de servicio, con las abreviaturas de `getWeekday()`. */
  readonly days: readonly Weekday[];
  readonly opens: ClockTime;
  readonly closes: ClockTime;
}

const CLOCK_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const WEEKDAYS: readonly Weekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Valida y congela un horario; falla al cargar el módulo si los datos no son coherentes. */
function defineHours(businessId: BusinessId, hours: BusinessHours): BusinessHours {
  const problems: string[] = [];
  if (hours.days.length === 0) problems.push('sin días de servicio');
  if (new Set(hours.days).size !== hours.days.length) problems.push('días repetidos');
  if (!hours.days.every((day) => WEEKDAYS.includes(day))) problems.push('día desconocido');
  if (!CLOCK_TIME.test(hours.opens) || !CLOCK_TIME.test(hours.closes)) problems.push('hora con formato distinto de HH:MM');
  else if (hours.opens >= hours.closes) problems.push('la apertura no es anterior al cierre');
  if (problems.length > 0) throw new Error(`Horario inválido de ${businessId}: ${problems.join(', ')}`);
  return Object.freeze({ ...hours, days: Object.freeze([...hours.days]) });
}

export const BUSINESS_HOURS: { readonly [Id in BusinessId]: BusinessHours } = Object.freeze({
  [BUSINESS.MOLOTES]: defineHours(BUSINESS.MOLOTES, molotesHours),
  [BUSINESS.BIRRIA]: defineHours(BUSINESS.BIRRIA, birriaHours),
});

/** @throws {Error} Si el negocio no existe. */
export function getBusinessHours(businessId: BusinessId): BusinessHours {
  if (!Object.hasOwn(BUSINESS_HOURS, businessId)) {
    throw new Error(`No hay horario para el negocio: ${businessId}`);
  }
  return BUSINESS_HOURS[businessId];
}
