import type { Weekday } from '../../src/services/business-schedule.ts';

/**
 * Intérprete mínimo de los textos de horario en español de las landings (REQ-F-010).
 * Solo para pruebas: entiende el vocabulario actual y falla ante lo desconocido, para
 * que un texto nuevo con otra forma obligue a revisar la prueba de coherencia.
 *
 * - Días completos o abreviados, en singular o plural: "Martes", "Mar", "Sábados".
 * - Rangos con "a", "-" o "–" ("Martes a Viernes", "Mar - Vie") y conjunción "y".
 * - Horas "HH:MM" (24 h) o "H:MM AM/PM", normalizadas a "HH:MM" de 24 h.
 */

const WEEK: readonly Weekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const DAY_WORDS: Readonly<Record<string, Weekday>> = Object.freeze({
  lunes: 'Mon',
  lun: 'Mon',
  martes: 'Tue',
  mar: 'Tue',
  miercoles: 'Wed',
  mie: 'Wed',
  jueves: 'Thu',
  jue: 'Thu',
  viernes: 'Fri',
  vie: 'Fri',
  sabado: 'Sat',
  sabados: 'Sat',
  sab: 'Sat',
  domingo: 'Sun',
  domingos: 'Sun',
  dom: 'Sun',
});

const RANGE_WORDS = new Set(['a', '-', '–']);
const AND_WORD = 'y';

/** Minúsculas, sin acentos y sin puntuación en los extremos. */
const normalizeWord = (word: string) =>
  word
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/^[^\p{L}\d–-]+|[^\p{L}\d–-]+$/gu, '');

const isDay = (word: string) => Object.hasOwn(DAY_WORDS, word);
const isConnector = (word: string) => RANGE_WORDS.has(word) || word === AND_WORD;

/** Días de la semana entre `from` y `to`, ambos incluidos (el rango puede cruzar el domingo). */
function dayRange(from: Weekday, to: Weekday): Weekday[] {
  const days: Weekday[] = [];
  for (let i = WEEK.indexOf(from); ; i = (i + 1) % WEEK.length) {
    days.push(WEEK[i]!);
    if (WEEK[i] === to) return days;
  }
}

/** Interpreta una secuencia como "Mar - Vie" o "Sábado y Domingo". */
function parseDayRun(words: readonly string[]): Weekday[] {
  const days: Weekday[] = [];
  let index = 0;
  while (index < words.length) {
    const from = DAY_WORDS[words[index]!]!;
    const connector = words[index + 1];
    if (connector !== undefined && RANGE_WORDS.has(connector)) {
      const to = words[index + 2];
      if (to === undefined || !isDay(to)) throw new Error(`Rango de días incompleto: "${words.join(' ')}"`);
      days.push(...dayRange(from, DAY_WORDS[to]!));
      index += 3;
    } else {
      days.push(from);
      index += 1;
    }
    if (index < words.length) {
      if (words[index] !== AND_WORD || !isDay(words[index + 1] ?? '')) {
        throw new Error(`Secuencia de días no reconocida: "${words.join(' ')}"`);
      }
      index += 1;
    }
  }
  return days;
}

/** Ordena según la semana y elimina repetidos, para comparar conjuntos de días. */
export const sortDays = (days: Iterable<Weekday>): Weekday[] => {
  const set = new Set(days);
  return WEEK.filter((day) => set.has(day));
};

/** Todos los grupos de días mencionados en el texto, en orden de aparición. */
export function findDayGroups(text: string): Weekday[][] {
  const words = text.split(/\s+/).map(normalizeWord).filter(Boolean);
  const groups: Weekday[][] = [];
  let index = 0;
  while (index < words.length) {
    if (!isDay(words[index]!)) {
      index += 1;
      continue;
    }
    const run: string[] = [];
    while (index < words.length && (isDay(words[index]!) || isConnector(words[index]!))) run.push(words[index++]!);
    // Un conector final no forma parte de los días ("Lunes y …" no ocurre, pero se descarta por seguridad).
    while (run.length > 0 && !isDay(run[run.length - 1]!)) run.pop();
    groups.push(parseDayRun(run));
  }
  return groups;
}

/** Horas mencionadas en el texto, normalizadas a "HH:MM" de 24 h. */
export function findTimes(text: string): string[] {
  return [...text.matchAll(/\b(\d{1,2}):(\d{2})(?:\s*(AM|PM)\b)?/gi)].map(([, h, m, period]) => {
    let hours = Number(h);
    if (period !== undefined) {
      if (hours < 1 || hours > 12) throw new Error(`Hora de 12 h inválida: ${h}:${m} ${period}`);
      hours = (hours % 12) + (period.toUpperCase() === 'PM' ? 12 : 0);
    }
    return `${String(hours).padStart(2, '0')}:${m}`;
  });
}
