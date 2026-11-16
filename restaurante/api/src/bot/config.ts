import type { BusinessId } from '@restaurante/core/shared';
import {
  BOT_VARS,
  botVarReaders,
  checkBotBasics,
  isBotConfigured,
  parseBotProvider,
  parseBotStaff,
  type BotEnv,
  type BotVarRule,
} from '@restaurante/core/bot-control';

/**
 * Configuración del bot de WhatsApp en la api (REQ-F-009 RF-2; REQ-F-012 RF-2; en api desde
 * REQ-F-042, RF-6): proveedor, credenciales, personal y plantilla. Las reglas comunes con la página
 * "Bot" de /admin (proveedor, personal, claves y umbrales) están en core/bot-control, con los mismos
 * textos. Los mensajes nunca incluyen los valores (contienen secretos).
 */

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

/** Reglas de formato de cada proveedor (D-3). */
const META_RULES = Object.freeze({
  accountId: { name: BOT_VARS.accountId, pattern: /^\d{5,20}$/, hint: 'con meta, el ID del número en la Cloud API (solo dígitos, 5 a 20)' },
  accessToken: { name: BOT_VARS.accessToken, pattern: /^\S{1,4096}$/, hint: 'con meta, sin espacios y hasta 4096 caracteres' },
  appSecret: { name: BOT_VARS.appSecret, pattern: /^[A-Za-z0-9]{16,128}$/, hint: 'letras y dígitos (16 a 128)' },
  verifyToken: { name: BOT_VARS.verifyToken, pattern: /^[A-Za-z0-9._~-]{16,128}$/, hint: 'letras, dígitos y . _ ~ - (16 a 128)' },
  template: { name: BOT_VARS.template, pattern: /^[a-z0-9_]{1,512}$/, hint: 'con meta, minúsculas, dígitos y _ (nombre de la plantilla en Meta)' },
  language: { name: BOT_VARS.language, pattern: /^[a-z]{2,3}(_[A-Z]{2})?$/, hint: 'código de idioma de la plantilla (p. ej. es_MX)' },
  graphApiVersion: { name: BOT_VARS.graphApiVersion, pattern: /^v\d{1,3}\.\d$/, hint: 'versión de la Graph API (p. ej. v26.0)' },
} satisfies Record<string, BotVarRule>);
const TWILIO_RULES = Object.freeze({
  accountId: { name: BOT_VARS.accountId, pattern: /^AC[0-9a-fA-F]{32}$/, hint: 'con twilio, el Account SID (AC seguido de 32 caracteres hexadecimales)' },
  accessToken: { name: BOT_VARS.accessToken, pattern: /^[0-9a-fA-F]{32}$/, hint: 'con twilio, el Auth Token (32 caracteres hexadecimales)' },
  template: { name: BOT_VARS.template, pattern: /^HX[0-9a-fA-F]{32}$/, hint: 'con twilio, el ContentSid del Content Template (HX seguido de 32 caracteres hexadecimales)' },
} satisfies Record<string, BotVarRule>);
/** Ruta del webhook del bot (la misma con los dos proveedores; D-10). */
export const BOT_WEBHOOK_PATH = '/webhooks/whatsapp';

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
 * Configuración del bot (REQ-F-012, RF-2). Sin ninguna variable de datos vale null; con alguna,
 * el proveedor y sus obligatorias deben estar y ser válidas. Las variables que solo usa el otro
 * proveedor se ignoran (D-15). Los mensajes nunca incluyen los valores.
 */
export function parseChatBot(env: BotEnv, nodeEnv: string | undefined, sender: string | undefined, issues: string[]): ChatBotConfig | undefined {
  const before = issues.length;
  checkBotBasics(env, issues);
  const provider = parseBotProvider(env, nodeEnv, issues);
  if (!isBotConfigured(env)) return issues.length > before ? undefined : null;

  const { read, required, check, optional, requiredRule } = botVarReaders(env, issues);
  if (read(BOT_VARS.provider) === undefined) issues.push(`${BOT_VARS.provider} es obligatoria si se configura el bot de WhatsApp (meta o twilio)`);
  // Comunes: se exigen aunque el proveedor falte o no sea válido (lista completa de problemas).
  const rawAccountId = required(BOT_VARS.accountId);
  const rawAccessToken = required(BOT_VARS.accessToken);
  const staff = parseBotStaff(env, issues);
  if (provider === undefined) return undefined;

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
