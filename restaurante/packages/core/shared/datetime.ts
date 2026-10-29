/**
 * Fechas en la zona horaria del negocio (no en la del servidor). En core/shared desde REQ-F-039: las
 * usan landing-pages y la API (fechas de los productos en `/api/v1/admin`).
 */

const PARTS_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  if (!PARTS_FORMATTERS.has(timeZone)) {
    PARTS_FORMATTERS.set(
      timeZone,
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    );
  }
  // Siempre presente: se acaba de crear arriba si no existía.
  return PARTS_FORMATTERS.get(timeZone) as Intl.DateTimeFormat;
}

interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function wallClock(date: Date, timeZone: string): WallClock {
  const parts = Object.fromEntries(partsFormatter(timeZone).formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

const pad = (value: number, length = 2): string => String(value).padStart(length, '0');

/**
 * ISO 8601 con el desfase de la zona horaria: "2026-10-02T13:45:10-06:00".
 * `timeZone`: zona IANA ya validada.
 */
export function toZonedIsoString(date: Date, timeZone: string): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw new TypeError('Fecha inválida');
  const wall = wallClock(date, timeZone);
  const wallAsUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  const offsetMinutes = Math.round((wallAsUtc - Math.floor(date.getTime() / 1000) * 1000) / 60_000);
  const sign = offsetMinutes < 0 ? '-' : '+';
  const abs = Math.abs(offsetMinutes);
  return (
    `${pad(wall.year, 4)}-${pad(wall.month)}-${pad(wall.day)}T${pad(wall.hour)}:${pad(wall.minute)}:${pad(wall.second)}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

/** Fecha legible para la interfaz de administración: "02/10/2026 13:45". */
export function formatDisplayDate(iso: string, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const wall = wallClock(date, timeZone);
  return `${pad(wall.day)}/${pad(wall.month)}/${wall.year} ${pad(wall.hour)}:${pad(wall.minute)}`;
}

/** Minutos transcurridos desde la medianoche local (0 a 1439) en `timeZone` (REQ-F-009). */
export function getLocalMinutes(date: Date, timeZone: string): number {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw new TypeError('Fecha inválida');
  const wall = wallClock(date, timeZone);
  return wall.hour * 60 + wall.minute;
}
