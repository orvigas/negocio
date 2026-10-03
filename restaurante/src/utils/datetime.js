/**
 * Fechas en la zona horaria del negocio (no en la del servidor).
 */

const PARTS_FORMATTERS = new Map();

function partsFormatter(timeZone) {
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
  return PARTS_FORMATTERS.get(timeZone);
}

function wallClock(date, timeZone) {
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

const pad = (value, length = 2) => String(value).padStart(length, '0');

/**
 * ISO 8601 con el desfase de la zona horaria: "2026-10-02T13:45:10-06:00".
 * @param {Date} date
 * @param {string} timeZone Zona IANA ya validada.
 */
export function toZonedIsoString(date, timeZone) {
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

/**
 * Fecha legible para la interfaz de administración: "02/10/2026 13:45".
 * @param {string} iso
 * @param {string} timeZone
 */
export function formatDisplayDate(iso, timeZone) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const wall = wallClock(date, timeZone);
  return `${pad(wall.day)}/${pad(wall.month)}/${wall.year} ${pad(wall.hour)}:${pad(wall.minute)}`;
}
