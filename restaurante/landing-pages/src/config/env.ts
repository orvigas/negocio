import { isIP } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BUSINESS_IDS, MAX_MESSAGE_LENGTH, PHONE_PATTERN, buildWhatsAppLink, isHttpsUrl, type BusinessId } from '@restaurante/core/shared';

/**
 * Carga y valida la configuración a partir de variables de entorno.
 * Falla rápido: reúne todos los problemas y lanza un único ConfigError.
 * Los mensajes nunca incluyen los valores recibidos (pueden ser sensibles).
 *
 * Las landings no usan base de datos, carpeta de datos, administración ni bot (REQ-F-045, RF-2): las
 * variables de esas partes se ignoran sin validarse.
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
  readonly trustProxy: boolean;
  /**
   * ADMIN_NEW_URL (REQ-F-039, RF-15): URL del admin nuevo (inventory-manager). Con ella, GET y HEAD de
   * /admin* redirigen a su raíz y el resto de métodos responde 410 (REQ-F-045, RF-1); sin ella, 404.
   */
  readonly adminNewUrl: string | undefined;
  /**
   * Puerto interno del aviso de la API (REQ-F-039, RF-13): INTERNAL_PORT e INTERNAL_NOTIFY_TOKEN.
   * Obligatorio en producción; null sin token fuera de ella: no se abre el puerto (recarga de 60 s).
   */
  readonly internalNotify: { readonly port: number; readonly token: string } | null;
}

// Se amplía el tipo de la lista para poder buscar un string cualquiera.
const isNodeEnv = (value: string): value is NodeEnv => (NODE_ENVS as readonly string[]).includes(value);

const isCompleteWhatsApp = (
  value: Partial<Record<BusinessId, WhatsAppConfig>>,
): value is Record<BusinessId, WhatsAppConfig> => BUSINESS_IDS.every((businessId) => value[businessId] !== undefined);

/** Raíz del workspace de la app (restaurante/landing-pages/; en la imagen, /app/landing-pages). */
export const PROJECT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
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

  const trustProxy = parseBoolean(readVar(env, 'TRUST_PROXY'), 'TRUST_PROXY', false, issues);
  const adminNewUrl = parseAdminNewUrl(readVar(env, 'ADMIN_NEW_URL'), nodeEnv, issues);
  const internalNotify = parseInternalNotify(env, nodeEnv, port, issues);

  // Cada valor undefined ya dejó su problema en `issues`; las comprobaciones extra solo estrechan tipos.
  if (
    issues.length > 0 ||
    nodeEnv === undefined ||
    !isNodeEnv(nodeEnv) ||
    host === undefined ||
    port === undefined ||
    apiInternalUrl === undefined ||
    trustProxy === undefined ||
    adminNewUrl === undefined ||
    internalNotify === undefined ||
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
    trustProxy,
    adminNewUrl: adminNewUrl ?? undefined,
    internalNotify: internalNotify ? Object.freeze(internalNotify) : null,
  });
}
