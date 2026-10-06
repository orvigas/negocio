import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BUSINESS_IDS, type BusinessId } from './businesses.ts';
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

  // Cada valor undefined ya dejó su problema en `issues`; las comprobaciones extra solo estrechan tipos.
  if (
    issues.length > 0 ||
    !isNodeEnv(nodeEnv) ||
    port === undefined ||
    dataDir === undefined ||
    adminBootstrap === undefined ||
    trustProxy === undefined ||
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
  });
}
