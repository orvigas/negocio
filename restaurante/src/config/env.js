import { BUSINESS_IDS } from './businesses.js';
import {
  MAX_MESSAGE_LENGTH,
  PHONE_PATTERN,
  buildWhatsAppLink,
  isHttpsUrl,
} from '../services/whatsapp.js';

/**
 * Carga y valida la configuración a partir de variables de entorno.
 * Falla rápido: reúne todos los problemas y lanza un único ConfigError.
 * Los mensajes nunca incluyen los valores recibidos (pueden ser sensibles).
 */

export const NODE_ENVS = Object.freeze(['development', 'production', 'test']);
export const DEFAULTS = Object.freeze({
  NODE_ENV: 'development',
  PORT: 3000,
  BUSINESS_TIMEZONE: 'America/Mexico_City',
});

export class ConfigError extends Error {
  /** @param {string[]} issues */
  constructor(issues) {
    super(`Configuración inválida:\n  - ${issues.join('\n  - ')}`);
    this.name = 'ConfigError';
    this.issues = issues;
  }
}

/** @param {unknown} timeZone */
export function isValidTimeZone(timeZone) {
  if (typeof timeZone !== 'string' || timeZone.trim() === '') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Normaliza: string recortado o undefined si está vacío/ausente. */
function readVar(env, name) {
  const value = env[name];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function parsePort(raw, issues) {
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
function parseSiteUrl(raw, issues) {
  if (raw === undefined) return undefined;
  let url;
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

function parseWhatsApp(env, businessId, issues) {
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
 * @param {Record<string, string | undefined>} [env]
 * @returns {Readonly<{
 *   nodeEnv: 'development'|'production'|'test',
 *   isProduction: boolean,
 *   port: number,
 *   timezone: string,
 *   siteUrl?: string,
 *   whatsapp: Readonly<Record<'molotes'|'birria', Readonly<{ url?: string, phone?: string, message?: string, href: string }>>>
 * }>}
 * @throws {ConfigError}
 */
export function loadConfig(env = process.env) {
  const issues = [];

  const nodeEnv = readVar(env, 'NODE_ENV') ?? DEFAULTS.NODE_ENV;
  if (!NODE_ENVS.includes(nodeEnv)) {
    issues.push(`NODE_ENV debe ser uno de: ${NODE_ENVS.join(', ')}`);
  }

  const port = parsePort(readVar(env, 'PORT'), issues);

  const timezone = readVar(env, 'BUSINESS_TIMEZONE') ?? DEFAULTS.BUSINESS_TIMEZONE;
  if (!isValidTimeZone(timezone)) {
    issues.push('BUSINESS_TIMEZONE debe ser una zona horaria IANA válida (p. ej. America/Mexico_City)');
  }

  const siteUrl = parseSiteUrl(readVar(env, 'SITE_URL'), issues);

  const whatsapp = {};
  for (const businessId of BUSINESS_IDS) {
    whatsapp[businessId] = parseWhatsApp(env, businessId, issues);
  }

  if (issues.length > 0) throw new ConfigError(issues);

  return Object.freeze({
    nodeEnv,
    isProduction: nodeEnv === 'production',
    port,
    timezone,
    siteUrl,
    whatsapp: Object.freeze(whatsapp),
  });
}
