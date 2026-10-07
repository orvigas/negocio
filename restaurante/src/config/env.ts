import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BUSINESS, BUSINESS_IDS, type BusinessId } from './businesses.ts';
import { parsePasswordHash } from '../services/admin-auth.ts';
import { normalizeUsername, usernameError } from '../services/user-schema.ts';
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

/**
 * Bot de WhatsApp (REQ-F-009, RF-2). null si no se definió ninguna de sus variables: el bot queda
 * deshabilitado y el webhook responde 503. Contiene secretos: nunca se registra ni se muestra.
 */
export type WhatsAppBotConfig = Readonly<{
  accessToken: string;
  phoneNumberId: string;
  appSecret: string;
  verifyToken: string;
  /** Número de WhatsApp del personal de cada negocio (recibe los pedidos y es el contacto directo). */
  staff: Readonly<Record<BusinessId, string>>;
  staffTemplate: Readonly<{ name: string; language: string }>;
  graphApiVersion: string;
}> | null;

export interface Config {
  readonly nodeEnv: NodeEnv;
  readonly isProduction: boolean;
  readonly port: number;
  readonly timezone: string;
  readonly siteUrl: string | undefined;
  readonly whatsapp: Readonly<Record<BusinessId, WhatsAppConfig>>;
  readonly dataDir: string;
  readonly trustProxy: boolean;
  readonly adminBootstrap: AdminBootstrapConfig;
  readonly whatsappBot: WhatsAppBotConfig;
}

// Se amplía el tipo de la lista para poder buscar un string cualquiera.
const isNodeEnv = (value: string): value is NodeEnv => (NODE_ENVS as readonly string[]).includes(value);

const isCompleteWhatsApp = (
  value: Partial<Record<BusinessId, WhatsAppConfig>>,
): value is Record<BusinessId, WhatsAppConfig> => BUSINESS_IDS.every((businessId) => value[businessId] !== undefined);

/** Raíz del proyecto (restaurante/). */
export const PROJECT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
/** Carpeta de datos por defecto fuera de producción (está en .gitignore). */
export const DEFAULT_DATA_DIR = join(PROJECT_DIR, 'data');
export const DEFAULTS = Object.freeze({
  NODE_ENV: 'development',
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
function parseDataDir(raw: string | undefined, nodeEnv: string, issues: string[]): string | undefined {
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

/** Variables del bot (REQ-F-009). Definir cualquiera habilita el bot y exige las obligatorias. */
const BOT_VARS = Object.freeze({
  accessToken: { name: 'WHATSAPP_BOT_ACCESS_TOKEN', pattern: /^\S{1,4096}$/, hint: 'sin espacios, hasta 4096 caracteres' },
  phoneNumberId: { name: 'WHATSAPP_BOT_PHONE_NUMBER_ID', pattern: /^\d{5,20}$/, hint: 'solo dígitos (5 a 20)' },
  appSecret: { name: 'WHATSAPP_BOT_APP_SECRET', pattern: /^[A-Za-z0-9]{16,128}$/, hint: 'letras y dígitos (16 a 128)' },
  verifyToken: { name: 'WHATSAPP_BOT_VERIFY_TOKEN', pattern: /^[A-Za-z0-9._~-]{16,128}$/, hint: 'letras, dígitos y . _ ~ - (16 a 128)' },
  staffMolotes: { name: 'WHATSAPP_BOT_STAFF_MOLOTES', pattern: PHONE_PATTERN, hint: 'solo dígitos en formato internacional (8 a 15)' },
  staffBirria: { name: 'WHATSAPP_BOT_STAFF_BIRRIA', pattern: PHONE_PATTERN, hint: 'solo dígitos en formato internacional (8 a 15)' },
  template: { name: 'WHATSAPP_BOT_STAFF_TEMPLATE', pattern: /^[a-z0-9_]{1,512}$/, hint: 'minúsculas, dígitos y _ (nombre de la plantilla en Meta)' },
});
const BOT_OPTIONAL_VARS = Object.freeze({
  language: { name: 'WHATSAPP_BOT_STAFF_TEMPLATE_LANGUAGE', pattern: /^[a-z]{2,3}(_[A-Z]{2})?$/, hint: 'código de idioma de la plantilla (p. ej. es_MX)' },
  graphApiVersion: { name: 'WHATSAPP_GRAPH_API_VERSION', pattern: /^v\d{1,3}\.\d$/, hint: 'versión de la Graph API (p. ej. v26.0)' },
});

/**
 * Configuración del bot (REQ-F-009, RF-2): todas o ninguna. Sin ninguna variable vale null; con
 * alguna, las obligatorias deben estar y ser válidas. Los mensajes nunca incluyen los valores.
 */
function parseWhatsAppBot(env: Env, issues: string[]): WhatsAppBotConfig | undefined {
  const all = [...Object.values(BOT_VARS), ...Object.values(BOT_OPTIONAL_VARS)];
  if (all.every(({ name }) => readVar(env, name) === undefined)) return null;

  const before = issues.length;
  const read = ({ name, pattern, hint }: { name: string; pattern: RegExp; hint: string }, required: boolean): string | undefined => {
    const value = readVar(env, name);
    if (value === undefined) {
      if (required) issues.push(`${name} es obligatoria si se configura el bot de WhatsApp (o no definas ninguna WHATSAPP_BOT_*)`);
      return undefined;
    }
    if (!pattern.test(value)) {
      issues.push(`${name} no es válida: ${hint}`);
      return undefined;
    }
    return value;
  };
  const accessToken = read(BOT_VARS.accessToken, true);
  const phoneNumberId = read(BOT_VARS.phoneNumberId, true);
  const appSecret = read(BOT_VARS.appSecret, true);
  const verifyToken = read(BOT_VARS.verifyToken, true);
  const staffMolotes = read(BOT_VARS.staffMolotes, true);
  const staffBirria = read(BOT_VARS.staffBirria, true);
  const template = read(BOT_VARS.template, true);
  const language = read(BOT_OPTIONAL_VARS.language, false) ?? DEFAULT_STAFF_TEMPLATE_LANGUAGE;
  const graphApiVersion = read(BOT_OPTIONAL_VARS.graphApiVersion, false) ?? DEFAULT_GRAPH_API_VERSION;

  if (
    issues.length > before ||
    accessToken === undefined ||
    phoneNumberId === undefined ||
    appSecret === undefined ||
    verifyToken === undefined ||
    staffMolotes === undefined ||
    staffBirria === undefined ||
    template === undefined
  ) {
    return undefined;
  }
  return Object.freeze({
    accessToken,
    phoneNumberId,
    appSecret,
    verifyToken,
    staff: Object.freeze({ [BUSINESS.MOLOTES]: staffMolotes, [BUSINESS.BIRRIA]: staffBirria }),
    staffTemplate: Object.freeze({ name: template, language }),
    graphApiVersion,
  });
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
 * Solo la carpeta de datos, con las mismas reglas que loadConfig (REQ-F-007): la usa el comando
 * de recuperación, que no necesita el resto de la configuración (WhatsApp, etc.).
 * @throws {ConfigError}
 */
export function loadDataDir(env: Env = process.env): string {
  const issues: string[] = [];
  const nodeEnv = readVar(env, 'NODE_ENV') ?? DEFAULTS.NODE_ENV;
  const dataDir = parseDataDir(readVar(env, 'DATA_DIR'), nodeEnv, issues);
  if (issues.length > 0 || dataDir === undefined) throw new ConfigError(issues);
  return dataDir;
}

/** @throws {ConfigError} */
export function loadConfig(env: Env = process.env): Config {
  const issues: string[] = [];

  const nodeEnv = readVar(env, 'NODE_ENV') ?? DEFAULTS.NODE_ENV;
  if (!isNodeEnv(nodeEnv)) {
    issues.push(`NODE_ENV debe ser uno de: ${NODE_ENVS.join(', ')}`);
  }

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
  const adminBootstrap = parseAdminBootstrap(env, issues);
  const trustProxy = parseBoolean(readVar(env, 'TRUST_PROXY'), 'TRUST_PROXY', false, issues);
  const whatsappBot = parseWhatsAppBot(env, issues);
  // D-6 (REQ-F-009): con el bot, los CTA de las dos landings abren el chat del mismo número (el del bot).
  const molotesPhone = whatsapp.molotes?.phone;
  const birriaPhone = whatsapp.birria?.phone;
  if (whatsappBot && molotesPhone !== undefined && birriaPhone !== undefined && molotesPhone !== birriaPhone) {
    issues.push('Con el bot de WhatsApp, WHATSAPP_MOLOTES y WHATSAPP_BIRRIA deben ser el mismo número (el del bot)');
  }

  // Cada valor undefined ya dejó su problema en `issues`; las comprobaciones extra solo estrechan tipos.
  if (
    issues.length > 0 ||
    !isNodeEnv(nodeEnv) ||
    port === undefined ||
    dataDir === undefined ||
    adminBootstrap === undefined ||
    trustProxy === undefined ||
    whatsappBot === undefined ||
    !isCompleteWhatsApp(whatsapp)
  ) {
    throw new ConfigError(issues);
  }

  return Object.freeze({
    nodeEnv,
    isProduction: nodeEnv === 'production',
    port,
    timezone,
    siteUrl,
    whatsapp: Object.freeze(whatsapp),
    dataDir,
    trustProxy,
    adminBootstrap,
    whatsappBot,
  });
}
