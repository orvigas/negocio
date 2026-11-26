import { OCCURRED_ON_WINDOW_DAYS } from './kardex-schema.ts';

/**
 * Fecha del hecho de un documento (REQ-F-051, RN-T3-3 y CA-11): «hoy» es el día en BUSINESS_TIMEZONE,
 * nunca el del servidor; se acepta de hoy a hoy − 31 días, nunca una fecha futura.
 */

const FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let found = FORMATTERS.get(timeZone);
  if (!found) {
    found = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
    FORMATTERS.set(timeZone, found);
  }
  return found;
}

/** `AAAA-MM-DD` del instante `now` en `timeZone`. */
export function businessDate(now: Date, timeZone: string): string {
  const parts = Object.fromEntries(formatter(timeZone).formatToParts(now).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Días desde 1970-01-01 de una fecha `AAAA-MM-DD` válida, o null. */
export function dayNumber(date: string): number | null {
  const match = DATE_PATTERN.exec(date);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const time = Date.UTC(year, month - 1, day);
  const back = new Date(time);
  if (back.getUTCFullYear() !== year || back.getUTCMonth() !== month - 1 || back.getUTCDate() !== day) return null;
  return time / 86_400_000;
}

/** Valida la fecha del hecho contra `today` (`AAAA-MM-DD` del negocio). Devuelve la fecha o el mensaje. */
export function readOccurredOn(raw: unknown, today: string): { value: string } | { error: string } {
  if (typeof raw !== 'string' || raw.trim() === '') return { error: 'Escribe la fecha (AAAA-MM-DD).' };
  const value = raw.trim();
  const day = dayNumber(value);
  const todayNumber = dayNumber(today);
  if (day === null || todayNumber === null) return { error: 'Escribe una fecha válida (AAAA-MM-DD).' };
  if (day > todayNumber) return { error: 'La fecha no puede ser futura.' };
  if (todayNumber - day > OCCURRED_ON_WINDOW_DAYS) return { error: `La fecha puede ser de hasta ${OCCURRED_ON_WINDOW_DAYS} días atrás.` };
  return { value };
}
