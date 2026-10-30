import { DEFAULT_BOT_LIMITS, MS, type BotLimits } from './limits.ts';

/**
 * Lectura y validación de la configuración de la protección del bot (REQ-F-025): claves de la lista
 * negra y umbrales. En core desde REQ-F-042 (H-4) porque la usan el bot y la página "Bot" de /admin
 * con los mismos mensajes. Funciones puras sobre las variables de entorno: reúnen los problemas en
 * `issues` (fallo rápido en el arranque de cada app) y nunca incluyen los valores recibidos.
 */

/** Variables de entorno sin validar (process.env o un objeto de prueba). */
export type BotEnv = Readonly<Record<string, string | undefined>>;

/** Normaliza: string recortado o undefined si está vacío o ausente. */
function readVar(env: BotEnv, name: string): string | undefined {
  const value = env[name];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

/**
 * Claves del identificador seudonimizado de la lista negra (REQ-F-025, D-T1). Secretas: nunca se
 * registran ni se guardan en la base de datos. null si no se definió (sin bot).
 */
export interface BotKeys {
  readonly current: Buffer;
  /** Clave anterior durante una rotación. */
  readonly previous: Buffer | undefined;
}

export const BOT_KEY_VARS = Object.freeze({ current: 'WHATSAPP_BOT_BLOCKLIST_KEY', previous: 'WHATSAPP_BOT_BLOCKLIST_KEY_PREVIOUS' });
const BOT_KEY_HINT = 'al menos 32 bytes aleatorios en base64, base64url o hexadecimal (p. ej. openssl rand -base64 32)';
const HEX_KEY = /^(?:[0-9a-fA-F]{2}){32,256}$/;
const BASE64_KEY = /^[A-Za-z0-9+/_-]{43,344}={0,2}$/;

function decodeKey(raw: string): Buffer | undefined {
  if (HEX_KEY.test(raw)) return Buffer.from(raw, 'hex');
  if (!BASE64_KEY.test(raw)) return undefined;
  const key = Buffer.from(raw, 'base64');
  return key.length >= 32 ? key : undefined;
}

/**
 * Claves de la lista negra (REQ-F-025, D-T1): obligatoria la actual si el bot está habilitado; sin
 * bot se ignoran. Los mensajes nunca incluyen los valores.
 */
export function parseBotKeys(env: BotEnv, botEnabled: boolean, issues: string[]): BotKeys | null | undefined {
  if (!botEnabled) return null;
  const rawCurrent = readVar(env, BOT_KEY_VARS.current);
  const rawPrevious = readVar(env, BOT_KEY_VARS.previous);
  const before = issues.length;
  if (rawCurrent === undefined) {
    issues.push(`${BOT_KEY_VARS.current} es obligatoria si se configura el bot de WhatsApp: ${BOT_KEY_HINT}`);
    return undefined;
  }
  const current = decodeKey(rawCurrent);
  if (current === undefined) issues.push(`${BOT_KEY_VARS.current} no es válida: ${BOT_KEY_HINT}`);
  const previous = rawPrevious === undefined ? undefined : decodeKey(rawPrevious);
  if (rawPrevious !== undefined && previous === undefined) issues.push(`${BOT_KEY_VARS.previous} no es válida: ${BOT_KEY_HINT}`);
  if (current !== undefined && previous !== undefined && current.equals(previous)) {
    issues.push(`${BOT_KEY_VARS.previous} debe ser distinta de ${BOT_KEY_VARS.current}`);
  }
  if (issues.length > before || current === undefined) return undefined;
  return Object.freeze({ current, previous });
}

type IntegerRule = Readonly<{ name: string; min: number; max: number; unit: number }>;

/** Umbrales enteros (REQ-F-025, RF-5): variable, rango admitido y factor a la unidad interna. */
const LIMIT_RULES = Object.freeze({
  ordersPerNumberDay: { name: 'BOT_LIMIT_ORDERS_PER_NUMBER_DAY', min: 1, max: 100, unit: 1 },
  messagesPerNumberDay: { name: 'BOT_LIMIT_MESSAGES_PER_NUMBER_DAY', min: 5, max: 10_000, unit: 1 },
  messagesPerMinute: { name: 'BOT_LIMIT_MESSAGES_PER_MINUTE', min: 1, max: 1000, unit: 1 },
  burst: { name: 'BOT_LIMIT_BURST', min: 1, max: 100, unit: 1 },
  burstWindowMs: { name: 'BOT_LIMIT_BURST_WINDOW_SECONDS', min: 1, max: 3600, unit: MS.second },
  templatesDay: { name: 'BOT_LIMIT_TEMPLATES_DAY', min: 1, max: 100_000, unit: 1 },
  templatesMonth: { name: 'BOT_LIMIT_TEMPLATES_MONTH', min: 1, max: 100_000, unit: 1 },
  outboundDay: { name: 'BOT_LIMIT_OUTBOUND_DAY', min: 1, max: 1_000_000, unit: 1 },
  outboundMonth: { name: 'BOT_LIMIT_OUTBOUND_MONTH', min: 1, max: 1_000_000, unit: 1 },
  freeServiceMonth: { name: 'BOT_FREE_SERVICE_MONTH', min: 0, max: 1_000_000, unit: 1 },
  repeatCount: { name: 'BOT_REPEAT_COUNT', min: 2, max: 100, unit: 1 },
  repeatWindowMs: { name: 'BOT_REPEAT_WINDOW_MINUTES', min: 1, max: 1440, unit: MS.minute },
  cooldownMs: { name: 'BOT_COOLDOWN_MINUTES', min: 1, max: 1440, unit: MS.minute },
  capBlockMs: { name: 'BOT_BLOCK_CAP_DAYS', min: 1, max: 365, unit: MS.day },
  blockHistoryMs: { name: 'BOT_BLOCK_HISTORY_DAYS', min: 1, max: 365, unit: MS.day },
  auditRetentionMonths: { name: 'BOT_AUDIT_RETENTION_MONTHS', min: 1, max: 120, unit: 1 },
  queueMax: { name: 'BOT_QUEUE_MAX', min: 1, max: 10_000, unit: 1 },
  refreshMs: { name: 'BOT_CONTROL_REFRESH_SECONDS', min: 1, max: 300, unit: MS.second },
} satisfies Partial<Record<keyof BotLimits, IntegerRule>>);

type MoneyRule = Readonly<{ name: string; max: number; decimals: number; positive: boolean }>;
/** Importes en USD (punto decimal), convertidos a micro-USD. */
const MONEY_RULES = Object.freeze({
  budgetMonthMicros: { name: 'BOT_BUDGET_MONTH_USD', max: 10_000, decimals: 4, positive: true },
  utilityCostMicros: { name: 'BOT_COST_UTILITY_USD', max: 1, decimals: 6, positive: false },
  serviceCostMicros: { name: 'BOT_COST_SERVICE_USD', max: 1, decimals: 6, positive: false },
} satisfies Partial<Record<keyof BotLimits, MoneyRule>>);
const REPEAT_STEPS_VAR = 'BOT_BLOCK_REPEAT_STEPS_HOURS';

function parseInteger(raw: string | undefined, rule: IntegerRule, fallback: number, issues: string[]): number | undefined {
  if (raw === undefined) return fallback;
  const value = /^\d{1,9}$/.test(raw) ? Number(raw) : Number.NaN;
  if (!Number.isInteger(value) || value < rule.min || value > rule.max) {
    issues.push(`${rule.name} no es válida: entero de ${rule.min} a ${rule.max}`);
    return undefined;
  }
  return value * rule.unit;
}

function parseMoney(raw: string | undefined, rule: MoneyRule, fallback: number, issues: string[]): number | undefined {
  if (raw === undefined) return fallback;
  const match = new RegExp(`^(\\d{1,6})(?:\\.(\\d{1,${rule.decimals}}))?$`).exec(raw);
  const micros = match ? Number(match[1]) * 1_000_000 + Number((match[2] ?? '').padEnd(6, '0')) : Number.NaN;
  if (!Number.isSafeInteger(micros) || micros > rule.max * 1_000_000 || (rule.positive && micros === 0)) {
    issues.push(`${rule.name} no es válida: importe en USD ${rule.positive ? 'mayor que 0' : 'de 0'} hasta ${rule.max}, con punto decimal y hasta ${rule.decimals} decimales`);
    return undefined;
  }
  return micros;
}

function parseRepeatSteps(raw: string | undefined, issues: string[]): readonly number[] | undefined {
  if (raw === undefined) return DEFAULT_BOT_LIMITS.repeatBlockStepsMs;
  const parts = raw.split(',').map((part) => part.trim());
  const hours = parts.map((part) => (/^\d{1,4}$/.test(part) ? Number(part) : Number.NaN));
  const valid = hours.length >= 1 && hours.length <= 5 && hours.every((value, index) => value >= 1 && value <= 8760 && (index === 0 || value > (hours[index - 1] ?? 0)));
  if (!valid) {
    issues.push(`${REPEAT_STEPS_VAR} no es válida: de 1 a 5 horas crecientes separadas por comas (de 1 a 8760), p. ej. 24,168,720`);
    return undefined;
  }
  return Object.freeze(hours.map((value) => value * MS.hour));
}

/** Umbrales de la protección (REQ-F-025, RF-5 y CA-14): sin variables, los valores por defecto. */
export function parseBotLimits(env: BotEnv, issues: string[]): BotLimits | undefined {
  const before = issues.length;
  const values: Record<string, unknown> = {};
  for (const [key, rule] of Object.entries(LIMIT_RULES)) {
    values[key] = parseInteger(readVar(env, rule.name), rule, DEFAULT_BOT_LIMITS[key as keyof typeof LIMIT_RULES], issues);
  }
  for (const [key, rule] of Object.entries(MONEY_RULES)) {
    values[key] = parseMoney(readVar(env, rule.name), rule, DEFAULT_BOT_LIMITS[key as keyof typeof MONEY_RULES], issues);
  }
  values.repeatBlockStepsMs = parseRepeatSteps(readVar(env, REPEAT_STEPS_VAR), issues);
  if (issues.length > before) return undefined;
  // Sin problemas, todos los valores están definidos y tienen el tipo de BotLimits.
  const limits = Object.freeze(values) as unknown as BotLimits;
  if (limits.templatesDay > limits.templatesMonth) issues.push(`${LIMIT_RULES.templatesDay.name} no puede ser mayor que ${LIMIT_RULES.templatesMonth.name}`);
  if (limits.outboundDay > limits.outboundMonth) issues.push(`${LIMIT_RULES.outboundDay.name} no puede ser mayor que ${LIMIT_RULES.outboundMonth.name}`);
  return issues.length > before ? undefined : limits;
}
