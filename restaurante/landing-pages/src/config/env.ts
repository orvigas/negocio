import { isIP } from 'node:net';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BUSINESS, BUSINESS_IDS, MAX_MESSAGE_LENGTH, PHONE_PATTERN, buildWhatsAppLink, isHttpsUrl, type BusinessId } from '@restaurante/core/shared';
import { normalizeUsername, parsePasswordHash, usernameError } from '@restaurante/core/identity';
import { parseDatabaseUrl, type DatabaseConfig } from '@restaurante/db/database-config';

import { BOT_PROVIDERS, type BotProvider } from '../services/whatsapp-bot/chat-bot.ts';
import { parseBotKeys, parseBotLimits, type BotKeys, type BotLimits } from '@restaurante/core/bot-control';

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

export interface Config {
  readonly nodeEnv: NodeEnv;
  readonly isProduction: boolean;
  /** Dirección IP literal en la que escucha el servidor (REQ-F-015; 127.0.0.1 por defecto). */
  readonly host: string;
  readonly port: number;
  readonly timezone: string;
  readonly siteUrl: string | undefined;
  /** API_INTERNAL_URL (REQ-F-038): base de la API propia, de la que las landings leen los productos. */
  readonly apiInternalUrl: string;
  readonly whatsapp: Readonly<Record<BusinessId, WhatsAppConfig>>;
  readonly dataDir: string;
  readonly database: DatabaseConfig;
  /**
   * DATABASE_ALLOW_NEWER_SCHEMA (REQ-F-016, D-1): tolera migraciones aplicadas que este código no
   * conoce. Solo la pone el script de despliegue al volver a la versión anterior; nunca va en `.env`.
   */
  readonly allowNewerSchema: boolean;
  readonly trustProxy: boolean;
  /**
   * ADMIN_NEW_URL (REQ-F-039, RF-15): URL del admin nuevo (inventory-manager). Con ella, la edición de
   * productos del /admin actual queda en solo lectura y enlaza ahí; sin ella, /admin funciona como antes.
   */
  readonly adminNewUrl: string | undefined;
  /**
   * Puerto interno del aviso de la API (REQ-F-039, RF-13): INTERNAL_PORT e INTERNAL_NOTIFY_TOKEN.
   * Obligatorio en producción; null sin token fuera de ella: no se abre el puerto (recarga de 60 s).
   */
  readonly internalNotify: { readonly port: number; readonly token: string } | null;
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
  INTERNAL_PORT: 3002,
});

/** Longitud mínima de la credencial del aviso interno (REQ-F-039, RF-13). */
export const MIN_NOTIFY_TOKEN_LENGTH = 32;

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

const API_URL_FORMAT = 'URL http(s) sin usuario, contraseña, parámetros ni fragmento, p. ej. http://127.0.0.1:3001 en desarrollo o http://api:3001 en Docker';

/**
 * Base de la API propia (REQ-F-038, RF-3 y CA-15): obligatoria en todos los entornos. Se devuelve
 * sin barra final. Los mensajes nunca repiten el valor.
 */
function parseApiInternalUrl(raw: string | undefined, issues: string[]): string | undefined {
  if (raw === undefined) {
    issues.push(`API_INTERNAL_URL es obligatoria (${API_URL_FORMAT})`);
    return undefined;
  }
  let url: URL | undefined;
  try {
    url = new URL(raw);
  } catch {
    url = undefined;
  }
  if (!url || !['http:', 'https:'].includes(url.protocol) || url.username !== '' || url.password !== '' || url.search !== '' || url.hash !== '' || raw.includes('?') || raw.includes('#')) {
    issues.push(`API_INTERNAL_URL no es válida (${API_URL_FORMAT})`);
    return undefined;
  }
  return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
}

/**
 * URL del admin nuevo (REQ-F-039, RF-15): opcional; http(s) sin credenciales, query ni fragmento, y
 * https en producción. Se devuelve sin barra final. Los mensajes nunca repiten el valor.
 */
function parseAdminNewUrl(raw: string | undefined, nodeEnv: string | undefined, issues: string[]): string | null | undefined {
  if (raw === undefined) return null;
  let url: URL | undefined;
  try {
    url = new URL(raw);
  } catch {
    url = undefined;
  }
  const protocols = nodeEnv === 'production' ? ['https:'] : ['http:', 'https:'];
  if (!url || !protocols.includes(url.protocol) || url.username !== '' || url.password !== '' || url.search !== '' || url.hash !== '' || raw.includes('?') || raw.includes('#')) {
    issues.push(`ADMIN_NEW_URL debe ser una URL ${nodeEnv === 'production' ? 'https' : 'http(s)'} sin credenciales, query ni fragmento (p. ej. https://admin.birriaelmuneco.com)`);
    return undefined;
  }
  return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
}

/**
 * Aviso interno de la API (REQ-F-039, RF-13 y RF-14): token de 32 caracteres visibles como mínimo; el
 * puerto interno no puede ser el de la app (el que enruta Traefik). Obligatorio en producción (PR 3 de
 * REQ-F-039); fuera de ella, sin token no se abre el puerto y queda la recarga de 60 s.
 */
function parseInternalNotify(env: Env, nodeEnv: string | undefined, appPort: number | undefined, issues: string[]): { port: number; token: string } | null | undefined {
  const token = readVar(env, 'INTERNAL_NOTIFY_TOKEN');
  const rawPort = readVar(env, 'INTERNAL_PORT');
  const port = rawPort === undefined ? DEFAULTS.INTERNAL_PORT : /^\d{1,5}$/.test(rawPort) ? Number(rawPort) : Number.NaN;
  let valid = true;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    issues.push('INTERNAL_PORT debe ser un entero entre 1 y 65535');
    valid = false;
  } else if (port === appPort) {
    issues.push('INTERNAL_PORT debe ser distinto de PORT (el aviso interno no se sirve en el puerto público)');
    valid = false;
  }
  if (token === undefined) {
    if (nodeEnv === 'production') {
      issues.push('INTERNAL_NOTIFY_TOKEN es obligatoria en producción (aviso interno de la API; p. ej. openssl rand -hex 32)');
      return undefined;
    }
    return valid ? null : undefined;
  }
  if (token.length < MIN_NOTIFY_TOKEN_LENGTH || !/^[\x21-\x7e]+$/.test(token)) {
    issues.push(`INTERNAL_NOTIFY_TOKEN debe tener al menos ${MIN_NOTIFY_TOKEN_LENGTH} caracteres visibles, sin espacios (p. ej. openssl rand -hex 32)`);
    return undefined;
  }
  return valid ? { port, token } : undefined;
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
  const apiInternalUrl = parseApiInternalUrl(readVar(env, 'API_INTERNAL_URL'), issues);

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
  const adminNewUrl = parseAdminNewUrl(readVar(env, 'ADMIN_NEW_URL'), nodeEnv, issues);
  const internalNotify = parseInternalNotify(env, nodeEnv, port, issues);
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
    apiInternalUrl === undefined ||
    dataDir === undefined ||
    database === undefined ||
    allowNewerSchema === undefined ||
    adminBootstrap === undefined ||
    trustProxy === undefined ||
    adminNewUrl === undefined ||
    internalNotify === undefined ||
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
    apiInternalUrl,
    whatsapp: Object.freeze(whatsapp),
    dataDir,
    database,
    allowNewerSchema,
    trustProxy,
    adminNewUrl: adminNewUrl ?? undefined,
    internalNotify: internalNotify ? Object.freeze(internalNotify) : null,
    adminBootstrap,
    whatsappBot,
    botLimits,
    botKeys,
  });
}
