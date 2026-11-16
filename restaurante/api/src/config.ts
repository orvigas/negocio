import { isIP } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseBotKeys, parseBotLimits, type BotKeys, type BotLimits } from '@restaurante/core/bot-control';
import { BUSINESS_IDS, PHONE_PATTERN, type BusinessId } from '@restaurante/core/shared';
import { parseDatabaseUrl, type DatabaseConfig } from '@restaurante/db/database-config';

import { parseChatBot, type ChatBotConfig } from './bot/config.ts';

/**
 * Configuración de la API (REQ-F-038, REQ-F-039 y REQ-F-042, con el bot de WhatsApp): solo sus variables, validadas al arrancar (fallo
 * rápido). Los mensajes nunca repiten los valores (la URL de la base y el token son secretos).
 */

export const NODE_ENVS = ['development', 'test', 'production'] as const;
export type NodeEnv = (typeof NODE_ENVS)[number];

/** Carpeta del workspace api (la que contiene src/). */
export const API_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const API_DEFAULTS = Object.freeze({
  HOST: '127.0.0.1',
  PORT: 3001,
  // Puerto del webhook del bot (REQ-F-042, P-1): una app que solo atiende /webhooks/whatsapp.
  WEBHOOK_PORT: 3004,
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
   * las dos o ninguna; obligatorias en producción (PR 3 de REQ-F-039, compose.prod.yaml). null fuera de
   * producción sin ellas: no se avisa (queda la red de seguridad de 60 s).
   */
  readonly landingNotify: { readonly url: string; readonly token: string } | null;
  /**
   * WEBHOOK_PORT (REQ-F-042, P-1): puerto de la app del webhook del bot, en la misma HOST. Es el único
   * que publica Traefik (solo /webhooks/whatsapp); el de PORT sigue siendo de la red interna.
   */
  readonly webhookPort: number;
  /**
   * Bot de WhatsApp (REQ-F-009 RF-2; REQ-F-012 RF-2; en api desde REQ-F-042). null sin ninguna
   * variable de datos del bot: el webhook responde 503. Contiene secretos: nunca se registra.
   */
  readonly whatsappBot: ChatBotConfig;
  /** Umbrales de la protección del bot (REQ-F-025, RF-5). */
  readonly botLimits: BotLimits;
  /** Claves de la lista negra (REQ-F-025, D-T1); null sin bot. */
  readonly botKeys: BotKeys | null;
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

/**
 * Números de WHATSAPP_MOLOTES y WHATSAPP_BIRRIA (los del CTA de las landings): el bot solo los usa
 * para D-6 y como emisor con Twilio (D-8). Mismo texto que la validación de landing-pages. Sus
 * variantes _URL y _MESSAGE son solo de las landings.
 */
function parseBotPhones(env: Env, issues: string[]): Partial<Record<BusinessId, string>> {
  const phones: Partial<Record<BusinessId, string>> = {};
  for (const businessId of BUSINESS_IDS) {
    const name = `WHATSAPP_${businessId.toUpperCase()}`;
    const phone = readVar(env, name);
    if (phone === undefined) continue;
    if (PHONE_PATTERN.test(phone)) phones[businessId] = phone;
    else issues.push(`${name} debe tener solo dígitos en formato internacional (8 a 15), sin "+" ni espacios`);
  }
  return phones;
}

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
  if (nodeEnv === 'production' && (notifyUrl === undefined || notifyToken === undefined)) {
    issues.push('En producción, LANDING_INTERNAL_URL e INTERNAL_NOTIFY_TOKEN son obligatorias (aviso interno a landing-pages)');
  }

  const rawWebhookPort = readVar(env, 'WEBHOOK_PORT');
  const webhookPort = rawWebhookPort === undefined ? API_DEFAULTS.WEBHOOK_PORT : /^\d{1,5}$/.test(rawWebhookPort) ? Number(rawWebhookPort) : Number.NaN;
  if (!Number.isInteger(webhookPort) || webhookPort < 1 || webhookPort > 65535) issues.push('WEBHOOK_PORT debe ser un entero entre 1 y 65535');
  else if (webhookPort === port) issues.push('WEBHOOK_PORT debe ser distinto de PORT');

  // Bot de WhatsApp (REQ-F-042, RF-6): mismas reglas y textos que tenía landing-pages.
  const phones = parseBotPhones(env, issues);
  const whatsappBot = parseChatBot(env, nodeEnv, phones.molotes, issues);
  const botLimits = parseBotLimits(env, issues);
  // La clave solo se exige con el resto del bot ya válido: así cada error del bot se ve una vez.
  const botKeys = parseBotKeys(env, whatsappBot !== null && whatsappBot !== undefined, issues);
  // D-6 (REQ-F-009): con el bot, los CTA de las dos landings abren el chat del mismo número (el del bot).
  if (whatsappBot && phones.molotes !== undefined && phones.birria !== undefined && phones.molotes !== phones.birria) {
    issues.push('Con el bot de WhatsApp, WHATSAPP_MOLOTES y WHATSAPP_BIRRIA deben ser el mismo número (el del bot)');
  }

  if (
    issues.length > 0 ||
    database === undefined ||
    nodeEnv === undefined ||
    !isNodeEnv(nodeEnv) ||
    whatsappBot === undefined ||
    botLimits === undefined ||
    botKeys === undefined
  ) {
    throw new ApiConfigError(issues);
  }
  return Object.freeze({
    nodeEnv,
    host,
    port,
    database,
    allowNewerSchema: rawAllow === 'true',
    timezone,
    productImagesDir,
    landingNotify: notifyUrl !== undefined && notifyToken !== undefined ? Object.freeze({ url: notifyUrl, token: notifyToken }) : null,
    webhookPort,
    whatsappBot,
    botLimits,
    botKeys,
  });
}
