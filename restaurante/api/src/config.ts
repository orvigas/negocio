import { isIP } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseDatabaseUrl, type DatabaseConfig } from '@restaurante/db/database-config';

/**
 * Configuración de la API (REQ-F-038 y REQ-F-039): solo sus variables, validadas al arrancar (fallo
 * rápido). Los mensajes nunca repiten los valores (la URL de la base y el token son secretos).
 */

export const NODE_ENVS = ['development', 'test', 'production'] as const;
export type NodeEnv = (typeof NODE_ENVS)[number];

/** Carpeta del workspace api (la que contiene src/). */
export const API_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const API_DEFAULTS = Object.freeze({
  HOST: '127.0.0.1',
  PORT: 3001,
  BUSINESS_TIMEZONE: 'America/Mexico_City',
  // Imágenes publicadas de las landings (REQ-F-039, RF-11): en el repositorio y en la imagen Docker
  // de la api están en la misma ruta relativa.
  PRODUCT_IMAGES_DIR: resolve(API_DIR, '../landing-pages/public'),
});

/** Longitud mínima de la credencial del aviso interno (REQ-F-039, RF-13). */
export const MIN_NOTIFY_TOKEN_LENGTH = 32;

export interface ApiConfig {
  readonly nodeEnv: NodeEnv;
  readonly host: string;
  readonly port: number;
  readonly database: DatabaseConfig;
  /** DATABASE_ALLOW_NEWER_SCHEMA (REQ-F-016, D-1): solo la pone deploy.sh al volver atrás. */
  readonly allowNewerSchema: boolean;
  /** BUSINESS_TIMEZONE: zona de las fechas de los productos en /api/v1/admin (REQ-F-039). */
  readonly timezone: string;
  /** PRODUCT_IMAGES_DIR: carpeta con img/ (copia de las imágenes de las landings, RF-11). */
  readonly productImagesDir: string;
  /**
   * Aviso interno a landing-pages (REQ-F-039, RF-13): LANDING_INTERNAL_URL e INTERNAL_NOTIFY_TOKEN,
   * las dos o ninguna. null: no se avisa (queda la red de seguridad de 60 s). Pasan a ser obligatorias
   * en producción con el despliegue del admin nuevo (PR 3 de REQ-F-039, compose.prod.yaml).
   */
  readonly landingNotify: { readonly url: string; readonly token: string } | null;
}

export class ApiConfigError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Configuración de la API inválida:\n- ${issues.join('\n- ')}`);
    this.name = 'ApiConfigError';
    this.issues = issues;
  }
}

type Env = Readonly<Record<string, string | undefined>>;

function readVar(env: Env, name: string): string | undefined {
  const value = env[name]?.trim();
  return value === undefined || value === '' ? undefined : value;
}

const isNodeEnv = (value: string): value is NodeEnv => (NODE_ENVS as readonly string[]).includes(value);

function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** URL de un servicio interno: http(s), sin credenciales, ruta, query ni fragmento. */
function isServiceUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.username === '' && url.password === '' && url.pathname === '/' && url.search === '' && url.hash === '' && !value.endsWith('/');
  } catch {
    return false;
  }
}

const isNotifyToken = (value: string): boolean => value.length >= MIN_NOTIFY_TOKEN_LENGTH && /^[\x21-\x7e]+$/.test(value);

/** @throws {ApiConfigError} */
export function loadApiConfig(env: Env = process.env): ApiConfig {
  const issues: string[] = [];

  const nodeEnv = readVar(env, 'NODE_ENV');
  if (nodeEnv === undefined || !isNodeEnv(nodeEnv)) issues.push(`NODE_ENV es obligatorio: debe ser uno de ${NODE_ENVS.join(', ')}`);

  const host = readVar(env, 'HOST') ?? API_DEFAULTS.HOST;
  if (isIP(host) === 0) issues.push('HOST debe ser una IP literal IPv4 o IPv6 (p. ej. 127.0.0.1 o 0.0.0.0), no un nombre de máquina');

  const rawPort = readVar(env, 'PORT');
  const port = rawPort === undefined ? API_DEFAULTS.PORT : /^\d{1,5}$/.test(rawPort) ? Number(rawPort) : Number.NaN;
  if (!Number.isInteger(port) || port < 1 || port > 65535) issues.push('PORT debe ser un entero entre 1 y 65535');

  const database = parseDatabaseUrl(readVar(env, 'DATABASE_URL'), 'DATABASE_URL', issues);

  const rawAllow = readVar(env, 'DATABASE_ALLOW_NEWER_SCHEMA') ?? 'false';
  if (rawAllow !== 'true' && rawAllow !== 'false') issues.push('DATABASE_ALLOW_NEWER_SCHEMA debe ser true o false');

  const timezone = readVar(env, 'BUSINESS_TIMEZONE') ?? API_DEFAULTS.BUSINESS_TIMEZONE;
  if (!isValidTimeZone(timezone)) issues.push('BUSINESS_TIMEZONE debe ser una zona horaria IANA válida (p. ej. America/Mexico_City)');

  const productImagesDir = resolve(readVar(env, 'PRODUCT_IMAGES_DIR') ?? API_DEFAULTS.PRODUCT_IMAGES_DIR);

  const notifyUrl = readVar(env, 'LANDING_INTERNAL_URL');
  const notifyToken = readVar(env, 'INTERNAL_NOTIFY_TOKEN');
  if (notifyUrl !== undefined && !isServiceUrl(notifyUrl)) issues.push('LANDING_INTERNAL_URL debe ser una URL http(s) absoluta sin credenciales, ruta ni query (p. ej. http://app:3002)');
  if (notifyToken !== undefined && !isNotifyToken(notifyToken)) {
    issues.push(`INTERNAL_NOTIFY_TOKEN debe tener al menos ${MIN_NOTIFY_TOKEN_LENGTH} caracteres visibles, sin espacios (p. ej. openssl rand -hex 32)`);
  }
  if ((notifyUrl === undefined) !== (notifyToken === undefined)) issues.push('LANDING_INTERNAL_URL e INTERNAL_NOTIFY_TOKEN van juntas: define las dos o ninguna');

  if (issues.length > 0 || database === undefined || nodeEnv === undefined || !isNodeEnv(nodeEnv)) throw new ApiConfigError(issues);
  return Object.freeze({
    nodeEnv,
    host,
    port,
    database,
    allowNewerSchema: rawAllow === 'true',
    timezone,
    productImagesDir,
    landingNotify: notifyUrl !== undefined && notifyToken !== undefined ? Object.freeze({ url: notifyUrl, token: notifyToken }) : null,
  });
}
