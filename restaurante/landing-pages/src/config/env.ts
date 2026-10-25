import { isIP } from 'node:net';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BUSINESS, BUSINESS_IDS, type BusinessId } from './businesses.ts';
import { parsePasswordHash } from '../services/admin-auth.ts';
import { normalizeUsername, usernameError } from '../services/user-schema.ts';
import { BOT_PROVIDERS, type BotProvider } from '../services/whatsapp-bot/chat-bot.ts';
import { DEFAULT_BOT_LIMITS, MS, type BotLimits } from '../services/whatsapp-bot/protection/limits.ts';
import {
  MAX_MESSAGE_LENGTH,
  PHONE_PATTERN,
  buildWhatsAppLink,
  isHttpsUrl,
} from '../services/whatsapp.ts';

/**
 * Carga y valida la configuración a partir de variables de entorno.
 * Falla rápido: reúne todos los problemas y lanza un único ConfigError.
 * Los mensajes nunca incluyen los valores recibidos (pueden ser sensibles).
 */

export const NODE_ENVS = Object.freeze(['development', 'production', 'test'] as const);

export type NodeEnv = (typeof NODE_ENVS)[number];
/** Variables de entorno sin validar (process.env o un objeto de prueba). */
export type Env = Readonly<Record<string, string | undefined>>;

export interface WhatsAppConfig {
  readonly url: string | undefined;
  readonly phone: string | undefined;
  readonly message: string | undefined;
  readonly href: string;
}

/**
 * Credencial del primer administrador (REQ-F-007, D-4): solo se usa si la base de datos no tiene
 * usuarios. null si no se definió.
 */
export type AdminBootstrapConfig = Readonly<{ user: string; passwordHash: string }> | null;

/** Versión de la Graph API por defecto (vigente en 2026-10; REQ-F-009). */
export const DEFAULT_GRAPH_API_VERSION = 'v26.0';
export const DEFAULT_STAFF_TEMPLATE_LANGUAGE = 'es_MX';

/** Datos comunes a los dos proveedores del bot (REQ-F-012, RF-2). */
interface BotConfigBase {
  /** Meta: ID del número en la Cloud API. Twilio: Account SID. */
  readonly accountId: string;
  /** Meta: token permanente. Twilio: Auth Token (también firma el webhook). Secreto. */
  readonly accessToken: string;
  /** Número de WhatsApp del personal de cada negocio (recibe los pedidos y es el contacto directo). */
  readonly staff: Readonly<Record<BusinessId, string>>;
}

/** Bot con la WhatsApp Cloud API de Meta (producción). */
export interface MetaBotConfig extends BotConfigBase {
  readonly provider: 'meta';
  readonly appSecret: string;
  readonly verifyToken: string;
  readonly staffTemplate: Readonly<{ name: string; language: string }>;
  readonly graphApiVersion: string;
}

/** Bot con Twilio (desarrollo; nunca en producción, D-5). */
export interface TwilioBotConfig extends BotConfigBase {
  readonly provider: 'twilio';
  /** URL pública completa del webhook, tal como está configurada en Twilio (firma y StatusCallback). */
  readonly webhookUrl: string;
  /** Content Template (`HX…`) del aviso al personal; sin él, el aviso va como texto libre (D-6). */
  readonly staffContentSid: string | undefined;
  /** Número emisor (dígitos de WHATSAPP_MOLOTES, el número del bot; D-8). */
  readonly sender: string;
}

/**
 * Bot de WhatsApp (REQ-F-009 RF-2; REQ-F-012 RF-2). null si no se definió ninguna variable de datos
 * del bot: el bot queda deshabilitado y el webhook responde 503. Contiene secretos: nunca se
 * registra ni se muestra.
 */
export type ChatBotConfig = MetaBotConfig | TwilioBotConfig | null;

/**
 * Conexión a MySQL (REQ-F-014, RF-5), a partir de DATABASE_URL. Contiene la contraseña: nunca se
 * registra ni se incluye en errores o respuestas.
 */
export interface DatabaseConfig {
  readonly host: string;
  readonly port: number;
  readonly user: string;
  readonly password: string;
  readonly database: string;
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

export interface Config {
  readonly nodeEnv: NodeEnv;
  readonly isProduction: boolean;
  /** Dirección IP literal en la que escucha el servidor (REQ-F-015; 127.0.0.1 por defecto). */
  readonly host: string;
  readonly port: number;
  readonly timezone: string;
  readonly siteUrl: string | undefined;
  readonly whatsapp: Readonly<Record<BusinessId, WhatsAppConfig>>;
  readonly dataDir: string;
  readonly database: DatabaseConfig;
  /**
   * DATABASE_ALLOW_NEWER_SCHEMA (REQ-F-016, D-1): tolera migraciones aplicadas que este código no
   * conoce. Solo la pone el script de despliegue al volver a la versión anterior; nunca va en `.env`.
   */
  readonly allowNewerSchema: boolean;
  readonly trustProxy: boolean;
  readonly adminBootstrap: AdminBootstrapConfig;
  readonly whatsappBot: ChatBotConfig;
  /** Umbrales de la protección del bot (REQ-F-025, RF-5). */
  readonly botLimits: BotLimits;
  readonly botKeys: BotKeys | null;
}

// Se amplía el tipo de la lista para poder buscar un string cualquiera.
const isNodeEnv = (value: string): value is NodeEnv => (NODE_ENVS as readonly string[]).includes(value);

const isCompleteWhatsApp = (
  value: Partial<Record<BusinessId, WhatsAppConfig>>,
): value is Record<BusinessId, WhatsAppConfig> => BUSINESS_IDS.every((businessId) => value[businessId] !== undefined);

/** Raíz del workspace de la app (restaurante/landing-pages/; en la imagen, /app/landing-pages). */
export const PROJECT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
/** Carpeta de datos por defecto fuera de producción (está en .gitignore). */
export const DEFAULT_DATA_DIR = join(PROJECT_DIR, 'data');
// NODE_ENV no tiene valor por defecto (REQ-F-015, RF-3): sin él la app no arranca.
export const DEFAULTS = Object.freeze({
  HOST: '127.0.0.1',
  PORT: 3000,
  BUSINESS_TIMEZONE: 'America/Mexico_City',
});

export class ConfigError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Configuración inválida:\n  - ${issues.join('\n  - ')}`);
    this.name = 'ConfigError';
    this.issues = issues;
  }
}

export function isValidTimeZone(timeZone: unknown): timeZone is string {
  if (typeof timeZone !== 'string' || timeZone.trim() === '') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Normaliza: string recortado o undefined si está vacío/ausente. */
function readVar(env: Env, name: string): string | undefined {
  const value = env[name];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

/**
 * Dirección de escucha (REQ-F-015, RF-6 y RF-7): solo una IP literal IPv4 o IPv6 (isIP; incluye
 * IPv6 con zona). Escuchar en todas las interfaces exige pedirlo (0.0.0.0 o ::).
 */
function parseHost(raw: string | undefined, issues: string[]): string | undefined {
  if (raw === undefined) return DEFAULTS.HOST;
  if (isIP(raw) === 0) {
    issues.push('HOST debe ser una IP literal IPv4 o IPv6 (p. ej. 127.0.0.1, 0.0.0.0, ::1 o ::), no un nombre de máquina');
    return undefined;
  }
  return raw;
}

function parsePort(raw: string | undefined, issues: string[]): number | undefined {
  if (raw === undefined) return DEFAULTS.PORT;
  const port = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isInteger(port) || port < 1 || port > 65535) {
    issues.push('PORT debe ser un entero entre 1 y 65535');
    return undefined;
  }
  return port;
}

/**
 * URL pública opcional del sitio (origen + ruta base) para URLs canónicas absolutas,
 * og:url y og:image. Solo http(s), sin credenciales, query ni fragmento.
 * Devuelve el valor normalizado sin "/" final o undefined.
 */
function parseSiteUrl(raw: string | undefined, issues: string[]): string | undefined {
  if (raw === undefined) return undefined;
  let url: URL | undefined;
  try {
    url = new URL(raw);
  } catch {
    url = undefined;
  }
  if (
    !url ||
    !['http:', 'https:'].includes(url.protocol) ||
    url.username !== '' ||
    url.password !== '' ||
    url.search !== '' ||
    url.hash !== ''
  ) {
    issues.push('SITE_URL debe ser una URL http(s) sin credenciales, query ni fragmento');
    return undefined;
  }
  return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
}

const isInside = (child: string, parent: string): boolean => {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
};

/**
 * Carpeta de los datos editables (REQ-F-001, DT-4). Obligatoria y absoluta en producción;
 * nunca dentro de src/ ni de public/ (no debe servirse ni mezclarse con el código).
 */
function parseDataDir(raw: string | undefined, nodeEnv: string | undefined, issues: string[]): string | undefined {
  if (raw === undefined) {
    if (nodeEnv === 'production') {
      issues.push('DATA_DIR es obligatoria en producción (ruta absoluta de la carpeta de datos editables)');
      return undefined;
    }
    return DEFAULT_DATA_DIR;
  }
  if (nodeEnv === 'production' && !isAbsolute(raw)) {
    issues.push('DATA_DIR debe ser una ruta absoluta en producción');
    return undefined;
  }
  const dataDir = resolve(PROJECT_DIR, raw);
  if (['src', 'public'].some((dir) => isInside(dataDir, join(PROJECT_DIR, dir)))) {
    issues.push('DATA_DIR no puede estar dentro de src/ ni de public/');
    return undefined;
  }
  return dataDir;
}

/**
 * Credencial del primer administrador (REQ-F-001 DT-7 y REQ-F-007 DT-11): sin ninguna de las dos
 * variables vale null; con una sola, con un usuario inválido o con un hash mal formado, la
 * configuración es inválida (aunque ya haya usuarios y se vaya a ignorar).
 */
function parseAdminBootstrap(env: Env, issues: string[]): AdminBootstrapConfig | undefined {
  const rawUser = readVar(env, 'ADMIN_USER');
  const user = rawUser === undefined ? undefined : normalizeUsername(rawUser);
  const passwordHash = readVar(env, 'ADMIN_PASSWORD_HASH');
  if (user === undefined && passwordHash === undefined) return null;

  const before = issues.length;
  if (user === undefined || passwordHash === undefined) {
    issues.push('Define ADMIN_USER y ADMIN_PASSWORD_HASH juntas (o ninguna para deshabilitar la administración)');
  }
  if (user !== undefined && usernameError(user) !== null) {
    issues.push('ADMIN_USER no es un usuario válido (1 a 60 caracteres, sin caracteres de control)');
  }
  if (passwordHash !== undefined && parsePasswordHash(passwordHash) === null) {
    issues.push('ADMIN_PASSWORD_HASH no tiene un formato válido (genéralo con `npm run admin:hash-password`)');
  }
  if (issues.length > before || user === undefined || passwordHash === undefined) return undefined;
  return Object.freeze({ user, passwordHash });
}

function parseBoolean(raw: string | undefined, name: string, defaultValue: boolean, issues: string[]): boolean | undefined {
  if (raw === undefined) return defaultValue;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  issues.push(`${name} debe ser true o false`);
  return undefined;
}

type VarRule = Readonly<{ name: string; pattern: RegExp; hint: string }>;

const STAFF_HINT = 'solo dígitos en formato internacional (8 a 15)';

/**
 * Variables del bot (REQ-F-009; REQ-F-012 RF-2). Definir cualquiera de ellas habilita el bot;
 * `WHATSAPP_BOT_PROVIDER` no lo habilita por sí sola (D-2). Un valor vacío cuenta como no definido.
 */
const BOT_VARS = Object.freeze({
  provider: 'WHATSAPP_BOT_PROVIDER',
  accountId: 'WHATSAPP_BOT_ACCOUNT_ID',
  accessToken: 'WHATSAPP_BOT_ACCESS_TOKEN',
  appSecret: 'WHATSAPP_BOT_APP_SECRET',
  verifyToken: 'WHATSAPP_BOT_VERIFY_TOKEN',
  staffMolotes: 'WHATSAPP_BOT_STAFF_MOLOTES',
  staffBirria: 'WHATSAPP_BOT_STAFF_BIRRIA',
  template: 'WHATSAPP_BOT_STAFF_TEMPLATE',
  language: 'WHATSAPP_BOT_STAFF_TEMPLATE_LANGUAGE',
  webhookUrl: 'WHATSAPP_BOT_WEBHOOK_URL',
  graphApiVersion: 'WHATSAPP_GRAPH_API_VERSION',
});
/** Nombre anterior de WHATSAPP_BOT_ACCOUNT_ID (D-1): sin compatibilidad, falla con un aviso claro. */
const LEGACY_PHONE_NUMBER_ID = 'WHATSAPP_BOT_PHONE_NUMBER_ID';
const ENABLING_VARS = Object.values(BOT_VARS).filter((name) => name !== BOT_VARS.provider);

/** Reglas de formato de cada proveedor (D-3). */
const META_RULES = Object.freeze({
  accountId: { name: BOT_VARS.accountId, pattern: /^\d{5,20}$/, hint: 'con meta, el ID del número en la Cloud API (solo dígitos, 5 a 20)' },
  accessToken: { name: BOT_VARS.accessToken, pattern: /^\S{1,4096}$/, hint: 'con meta, sin espacios y hasta 4096 caracteres' },
  appSecret: { name: BOT_VARS.appSecret, pattern: /^[A-Za-z0-9]{16,128}$/, hint: 'letras y dígitos (16 a 128)' },
  verifyToken: { name: BOT_VARS.verifyToken, pattern: /^[A-Za-z0-9._~-]{16,128}$/, hint: 'letras, dígitos y . _ ~ - (16 a 128)' },
  template: { name: BOT_VARS.template, pattern: /^[a-z0-9_]{1,512}$/, hint: 'con meta, minúsculas, dígitos y _ (nombre de la plantilla en Meta)' },
  language: { name: BOT_VARS.language, pattern: /^[a-z]{2,3}(_[A-Z]{2})?$/, hint: 'código de idioma de la plantilla (p. ej. es_MX)' },
  graphApiVersion: { name: BOT_VARS.graphApiVersion, pattern: /^v\d{1,3}\.\d$/, hint: 'versión de la Graph API (p. ej. v26.0)' },
} satisfies Record<string, VarRule>);
const TWILIO_RULES = Object.freeze({
  accountId: { name: BOT_VARS.accountId, pattern: /^AC[0-9a-fA-F]{32}$/, hint: 'con twilio, el Account SID (AC seguido de 32 caracteres hexadecimales)' },
  accessToken: { name: BOT_VARS.accessToken, pattern: /^[0-9a-fA-F]{32}$/, hint: 'con twilio, el Auth Token (32 caracteres hexadecimales)' },
  template: { name: BOT_VARS.template, pattern: /^HX[0-9a-fA-F]{32}$/, hint: 'con twilio, el ContentSid del Content Template (HX seguido de 32 caracteres hexadecimales)' },
} satisfies Record<string, VarRule>);
const STAFF_RULES = Object.freeze({
  molotes: { name: BOT_VARS.staffMolotes, pattern: PHONE_PATTERN, hint: STAFF_HINT },
  birria: { name: BOT_VARS.staffBirria, pattern: PHONE_PATTERN, hint: STAFF_HINT },
} satisfies Record<BusinessId, VarRule>);

/** Ruta del webhook del bot (la misma con los dos proveedores; D-10). */
export const BOT_WEBHOOK_PATH = '/webhooks/whatsapp';

const isBotProvider = (value: string): value is BotProvider => (BOT_PROVIDERS as readonly string[]).includes(value);

/** URL del webhook para Twilio: https, sin credenciales, query ni fragmento, con la ruta exacta. */
function isValidWebhookUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  return url.protocol === 'https:' && url.username === '' && url.password === '' && url.search === '' && url.hash === '' && !raw.includes('?') && !raw.includes('#') && url.pathname === BOT_WEBHOOK_PATH;
}

/**
 * Proveedor del bot (D-4, D-5, D-12): sin distinguir mayúsculas; si está definido se valida
 * siempre, y con NODE_ENV=production nunca puede ser twilio, esté o no habilitado el bot.
 */
function parseBotProvider(env: Env, nodeEnv: string | undefined, issues: string[]): BotProvider | undefined {
  const raw = readVar(env, BOT_VARS.provider);
  if (raw === undefined) return undefined;
  const provider = raw.toLowerCase();
  if (!isBotProvider(provider)) {
    issues.push(`${BOT_VARS.provider} debe ser uno de: ${BOT_PROVIDERS.join(', ')}`);
    return undefined;
  }
  if (provider === 'twilio' && nodeEnv === 'production') {
    issues.push(`${BOT_VARS.provider}=twilio no se permite con NODE_ENV=production: en producción el bot usa meta`);
    return undefined;
  }
  return provider;
}

/**
 * Configuración del bot (REQ-F-012, RF-2). Sin ninguna variable de datos vale null; con alguna,
 * el proveedor y sus obligatorias deben estar y ser válidas. Las variables que solo usa el otro
 * proveedor se ignoran (D-15). Los mensajes nunca incluyen los valores.
 */
function parseChatBot(env: Env, nodeEnv: string | undefined, sender: string | undefined, issues: string[]): ChatBotConfig | undefined {
  const before = issues.length;
  if (readVar(env, LEGACY_PHONE_NUMBER_ID) !== undefined) {
    issues.push(`${LEGACY_PHONE_NUMBER_ID} ya no se usa: renómbrala a ${BOT_VARS.accountId}`);
  }
  const provider = parseBotProvider(env, nodeEnv, issues);
  if (ENABLING_VARS.every((name) => readVar(env, name) === undefined)) return issues.length > before ? undefined : null;

  const required = (name: string): string | undefined => {
    const value = readVar(env, name);
    if (value === undefined) issues.push(`${name} es obligatoria si se configura el bot de WhatsApp (o no definas ninguna WHATSAPP_BOT_*)`);
    return value;
  };
  const check = ({ name, pattern, hint }: VarRule, value: string | undefined): string | undefined => {
    if (value === undefined) return undefined;
    if (pattern.test(value)) return value;
    issues.push(`${name} no es válida: ${hint}`);
    return undefined;
  };
  const optional = (rule: VarRule): string | undefined => check(rule, readVar(env, rule.name));
  const requiredRule = (rule: VarRule): string | undefined => check(rule, required(rule.name));

  if (readVar(env, BOT_VARS.provider) === undefined) issues.push(`${BOT_VARS.provider} es obligatoria si se configura el bot de WhatsApp (meta o twilio)`);
  // Comunes: se exigen aunque el proveedor falte o no sea válido (lista completa de problemas).
  const rawAccountId = required(BOT_VARS.accountId);
  const rawAccessToken = required(BOT_VARS.accessToken);
  const staffMolotes = requiredRule(STAFF_RULES.molotes);
  const staffBirria = requiredRule(STAFF_RULES.birria);
  if (provider === undefined) return undefined;
  const staff =
    staffMolotes === undefined || staffBirria === undefined ? undefined : Object.freeze({ [BUSINESS.MOLOTES]: staffMolotes, [BUSINESS.BIRRIA]: staffBirria });

  if (provider === 'meta') {
    const accountId = check(META_RULES.accountId, rawAccountId);
    const accessToken = check(META_RULES.accessToken, rawAccessToken);
    const appSecret = requiredRule(META_RULES.appSecret);
    const verifyToken = requiredRule(META_RULES.verifyToken);
    const template = requiredRule(META_RULES.template);
    const language = optional(META_RULES.language) ?? DEFAULT_STAFF_TEMPLATE_LANGUAGE;
    const graphApiVersion = optional(META_RULES.graphApiVersion) ?? DEFAULT_GRAPH_API_VERSION;
    if (
      issues.length > before ||
      staff === undefined ||
      accountId === undefined ||
      accessToken === undefined ||
      appSecret === undefined ||
      verifyToken === undefined ||
      template === undefined
    ) {
      return undefined;
    }
    return Object.freeze({
      provider,
      accountId,
      accessToken,
      appSecret,
      verifyToken,
      staff,
      staffTemplate: Object.freeze({ name: template, language }),
      graphApiVersion,
    });
  }

  const accountId = check(TWILIO_RULES.accountId, rawAccountId);
  const accessToken = check(TWILIO_RULES.accessToken, rawAccessToken);
  const staffContentSid = optional(TWILIO_RULES.template);
  const rawWebhookUrl = required(BOT_VARS.webhookUrl);
  if (rawWebhookUrl !== undefined && !isValidWebhookUrl(rawWebhookUrl)) {
    issues.push(`${BOT_VARS.webhookUrl} no es válida: URL https completa del webhook, sin credenciales, query ni fragmento, terminada en ${BOT_WEBHOOK_PATH}`);
  }
  if (sender === undefined) {
    issues.push('Con twilio, WHATSAPP_MOLOTES es obligatoria como número: es el número emisor del bot');
  }
  if (issues.length > before || staff === undefined || accountId === undefined || accessToken === undefined || rawWebhookUrl === undefined || sender === undefined) {
    return undefined;
  }
  return Object.freeze({ provider, accountId, accessToken, staff, webhookUrl: rawWebhookUrl, staffContentSid, sender });
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
function parseBotKeys(env: Env, botEnabled: boolean, issues: string[]): BotKeys | null | undefined {
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
function parseBotLimits(env: Env, issues: string[]): BotLimits | undefined {
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

function parseWhatsApp(env: Env, businessId: BusinessId, issues: string[]): WhatsAppConfig | undefined {
  const prefix = `WHATSAPP_${businessId.toUpperCase()}`;
  const url = readVar(env, `${prefix}_URL`);
  const phone = readVar(env, prefix);
  const message = readVar(env, `${prefix}_MESSAGE`);
  const before = issues.length;

  if (url !== undefined && !isHttpsUrl(url)) {
    issues.push(`${prefix}_URL debe ser una URL https válida`);
  }
  if (phone !== undefined && !PHONE_PATTERN.test(phone)) {
    issues.push(`${prefix} debe tener solo dígitos en formato internacional (8 a 15), sin "+" ni espacios`);
  }
  if (message !== undefined && message.length > MAX_MESSAGE_LENGTH) {
    issues.push(`${prefix}_MESSAGE no puede superar ${MAX_MESSAGE_LENGTH} caracteres`);
  }
  if (url === undefined && phone === undefined) {
    issues.push(`Define ${prefix}_URL o ${prefix} para el CTA de pedidos`);
  }
  if (issues.length > before) return undefined;

  return Object.freeze({ url, phone, message, href: buildWhatsAppLink({ url, phone, message }) });
}

const DATABASE_NAME = /^[A-Za-z0-9_]{1,64}$/;
const DATABASE_URL_FORMAT = 'mysql://usuario:contraseña@host:puerto/base, sin parámetros; los caracteres especiales de la contraseña van codificados (%40 para @)';

/**
 * URL de MySQL (REQ-F-014, RF-5): `mysql://usuario:contraseña@host[:puerto]/base`, sin parámetros
 * (las opciones de conexión las fija src/db/client.ts). Los mensajes nunca incluyen el valor.
 * Exportada para el soporte de pruebas, que valida sus propias URL con las mismas reglas.
 */
export function parseDatabaseUrl(raw: string | undefined, name: string, issues: string[]): DatabaseConfig | undefined {
  if (raw === undefined) {
    issues.push(`${name} es obligatoria (${DATABASE_URL_FORMAT})`);
    return undefined;
  }
  const invalid = (): undefined => {
    issues.push(`${name} no es válida (${DATABASE_URL_FORMAT})`);
    return undefined;
  };
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return invalid();
  }
  if (url.protocol !== 'mysql:' || url.hostname === '' || url.username === '' || url.search !== '' || url.hash !== '') return invalid();
  const port = url.port === '' ? 3306 : Number(url.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return invalid();
  const database = url.pathname.replace(/^\//, '');
  if (!DATABASE_NAME.test(database)) return invalid();
  let user: string;
  let password: string;
  try {
    user = decodeURIComponent(url.username);
    password = decodeURIComponent(url.password);
  } catch {
    return invalid();
  }
  // IPv6 entre corchetes en la URL ([::1]); el driver espera la dirección sin ellos.
  const host = url.hostname.replace(/^\[(.*)\]$/, '$1');
  return Object.freeze({ host, port, user, password, database });
}

/**
 * Solo la conexión a la base de datos (REQ-F-014, RF-11): la usa el comando de recuperación, que
 * no necesita el resto de la configuración (WhatsApp, etc.).
 * @throws {ConfigError}
 */
export function loadDatabaseConfig(env: Env = process.env): DatabaseConfig {
  const issues: string[] = [];
  const database = parseDatabaseUrl(readVar(env, 'DATABASE_URL'), 'DATABASE_URL', issues);
  if (issues.length > 0 || database === undefined) throw new ConfigError(issues);
  return database;
}

/** @throws {ConfigError} */
export function loadConfig(env: Env = process.env): Config {
  const issues: string[] = [];

  // Sin valor por defecto (REQ-F-015, RF-1): ausente, vacío o solo espacios impide arrancar.
  const nodeEnv = readVar(env, 'NODE_ENV');
  if (nodeEnv === undefined) {
    issues.push(`NODE_ENV es obligatorio: debe ser uno de ${NODE_ENVS.join(', ')}`);
  } else if (!isNodeEnv(nodeEnv)) {
    issues.push(`NODE_ENV debe ser uno de: ${NODE_ENVS.join(', ')}`);
  }

  const host = parseHost(readVar(env, 'HOST'), issues);
  const port = parsePort(readVar(env, 'PORT'), issues);

  const timezone = readVar(env, 'BUSINESS_TIMEZONE') ?? DEFAULTS.BUSINESS_TIMEZONE;
  if (!isValidTimeZone(timezone)) {
    issues.push('BUSINESS_TIMEZONE debe ser una zona horaria IANA válida (p. ej. America/Mexico_City)');
  }

  const siteUrl = parseSiteUrl(readVar(env, 'SITE_URL'), issues);

  const whatsapp: Partial<Record<BusinessId, WhatsAppConfig>> = {};
  for (const businessId of BUSINESS_IDS) {
    const parsed = parseWhatsApp(env, businessId, issues);
    if (parsed !== undefined) whatsapp[businessId] = parsed;
  }

  const dataDir = parseDataDir(readVar(env, 'DATA_DIR'), nodeEnv, issues);
  const database = parseDatabaseUrl(readVar(env, 'DATABASE_URL'), 'DATABASE_URL', issues);
  const adminBootstrap = parseAdminBootstrap(env, issues);
  const allowNewerSchema = parseBoolean(readVar(env, 'DATABASE_ALLOW_NEWER_SCHEMA'), 'DATABASE_ALLOW_NEWER_SCHEMA', false, issues);
  const trustProxy = parseBoolean(readVar(env, 'TRUST_PROXY'), 'TRUST_PROXY', false, issues);
  const whatsappBot = parseChatBot(env, nodeEnv, whatsapp.molotes?.phone, issues);
  const botLimits = parseBotLimits(env, issues);
  // La clave solo se exige con el resto del bot ya válido: así cada error del bot se ve una vez.
  const botKeys = parseBotKeys(env, whatsappBot !== null && whatsappBot !== undefined, issues);
  // D-6 (REQ-F-009): con el bot, los CTA de las dos landings abren el chat del mismo número (el del bot).
  const molotesPhone = whatsapp.molotes?.phone;
  const birriaPhone = whatsapp.birria?.phone;
  if (whatsappBot && molotesPhone !== undefined && birriaPhone !== undefined && molotesPhone !== birriaPhone) {
    issues.push('Con el bot de WhatsApp, WHATSAPP_MOLOTES y WHATSAPP_BIRRIA deben ser el mismo número (el del bot)');
  }

  // Cada valor undefined ya dejó su problema en `issues`; las comprobaciones extra solo estrechan tipos.
  if (
    issues.length > 0 ||
    nodeEnv === undefined ||
    !isNodeEnv(nodeEnv) ||
    host === undefined ||
    port === undefined ||
    dataDir === undefined ||
    database === undefined ||
    allowNewerSchema === undefined ||
    adminBootstrap === undefined ||
    trustProxy === undefined ||
    whatsappBot === undefined ||
    botLimits === undefined ||
    botKeys === undefined ||
    !isCompleteWhatsApp(whatsapp)
  ) {
    throw new ConfigError(issues);
  }

  return Object.freeze({
    nodeEnv,
    isProduction: nodeEnv === 'production',
    host,
    port,
    timezone,
    siteUrl,
    whatsapp: Object.freeze(whatsapp),
    dataDir,
    database,
    allowNewerSchema,
    trustProxy,
    adminBootstrap,
    whatsappBot,
    botLimits,
    botKeys,
  });
}
