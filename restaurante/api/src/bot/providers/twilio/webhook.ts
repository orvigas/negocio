import { createHmac, timingSafeEqual } from 'node:crypto';

import { MAX_TEXT_LENGTH, type InboundDelivery, type InboundMessage, type InboundStatus, type SignatureCheck } from '../../chat-bot.ts';

/**
 * Webhook de Twilio para WhatsApp (REQ-F-012, RF-3; DT-6).
 *
 * - Firma: `X-Twilio-Signature`, HMAC-SHA1 en Base64 con el Auth Token de la **URL configurada**
 *   (`WHATSAPP_BOT_WEBHOOK_URL`, nunca la que reconstruye la petición: detrás de nginx o de un
 *   túnel cambia) seguida de los parámetros del formulario ordenados por nombre, cada uno como
 *   `nombre` + `valor` sin separadores.
 * - Formulario `application/x-www-form-urlencoded`, una entrega por petición: un mensaje del
 *   cliente (`MessageSid`, `From=whatsapp:+…`, `To`, `Body`, `NumMedia`…) o un `StatusCallback`
 *   de un mensaje enviado (`MessageSid`, `MessageStatus`, `ErrorCode`…).
 *
 * El formulario es entrada externa: se valida campo por campo y lo que no tiene la forma esperada
 * se descarta. Solo se conserva lo que usa el bot (nunca `ProfileName`).
 */

export const TWILIO_SIGNATURE_HEADER = 'X-Twilio-Signature';
/** Un mensaje de WhatsApp en Twilio tiene hasta 1600 caracteres más sus metadatos. */
export const MAX_TWILIO_WEBHOOK_BYTES = 64 * 1024;
/** Respuesta TwiML vacía: el bot responde con la API, no en la respuesta del webhook. */
export const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

/** HMAC-SHA1 (20 bytes) en Base64. */
const SIGNATURE_PATTERN = /^[A-Za-z0-9+/]{27}=$/;
const MESSAGE_SID_PATTERN = /^(SM|MM)[0-9a-fA-F]{32}$/;
const WHATSAPP_ADDRESS_PATTERN = /^whatsapp:\+(\d{5,20})$/;
const STATUS_PATTERN = /^[a-z_]{1,40}$/;
const ERROR_CODE_PATTERN = /^\d{1,9}$/;
const NUM_MEDIA_PATTERN = /^\d{1,2}$/;
/** Twilio admite hasta 10 adjuntos por mensaje. */
const MAX_MEDIA = 10;

/** Firma esperada de una petición de Twilio. */
export function twilioSignature(url: string, params: URLSearchParams, authToken: string): string {
  const names = [...new Set(params.keys())].sort();
  let data = url;
  for (const name of names) {
    for (const value of params.getAll(name).sort()) data += `${name}${value}`;
  }
  return createHmac('sha1', authToken).update(data, 'utf8').digest('base64');
}

/** Comprueba la firma en tiempo constante. */
export function checkTwilioSignature(url: string, params: URLSearchParams, header: string | undefined, authToken: string): SignatureCheck {
  if (header === undefined || header === '') return 'missing';
  const received = header.trim();
  if (!SIGNATURE_PATTERN.test(received)) return 'malformed';
  const expected = Buffer.from(twilioSignature(url, params, authToken), 'base64');
  const actual = Buffer.from(received, 'base64');
  return actual.length === expected.length && timingSafeEqual(actual, expected) ? 'valid' : 'mismatch';
}

/** Cuerpo crudo -> parámetros del formulario, o null si no es UTF-8 válido. */
export function decodeForm(rawBody: Buffer): URLSearchParams | null {
  try {
    return new URLSearchParams(new TextDecoder('utf-8', { fatal: true }).decode(rawBody));
  } catch {
    return null;
  }
}

export interface TwilioParseOptions {
  /** Account SID del bot. */
  readonly accountSid: string;
  /** Número del bot en dígitos (WHATSAPP_MOLOTES). */
  readonly sender: string;
}

const single = (params: URLSearchParams, name: string): string | undefined => {
  const values = params.getAll(name);
  return values.length === 1 ? values[0] : undefined;
};

function parseStatus(params: URLSearchParams, status: string, sender: string): InboundStatus | null {
  const id = single(params, 'MessageSid');
  if (id === undefined || !MESSAGE_SID_PATTERN.test(id) || !STATUS_PATTERN.test(status)) return null;
  if (single(params, 'From') !== `whatsapp:+${sender}`) return null;
  const errorCode = single(params, 'ErrorCode');
  return errorCode !== undefined && ERROR_CODE_PATTERN.test(errorCode) ? { id, status, errorCode: Number(errorCode) } : { id, status };
}

function parseMessage(params: URLSearchParams, sender: string): InboundMessage | null {
  const id = single(params, 'MessageSid');
  if (id === undefined || !MESSAGE_SID_PATTERN.test(id)) return null;
  if (single(params, 'To') !== `whatsapp:+${sender}`) return null;
  const from = WHATSAPP_ADDRESS_PATTERN.exec(single(params, 'From') ?? '')?.[1];
  if (from === undefined) return null;
  const numMediaRaw = single(params, 'NumMedia') ?? '0';
  if (!NUM_MEDIA_PATTERN.test(numMediaRaw) || Number(numMediaRaw) > MAX_MEDIA) return null;
  const body = single(params, 'Body');
  // D-15 de REQ-F-009: con adjuntos (aunque traigan pie de foto) o sin texto, "no es texto".
  if (Number(numMediaRaw) > 0) return { id, from, type: 'media' };
  if (body === undefined || body === '') return { id, from, type: 'unsupported' };
  return { id, from, type: 'text', text: body.slice(0, MAX_TEXT_LENGTH) };
}

/**
 * Formulario de Twilio -> entrega normalizada (sin `timestamp`: Twilio no lo envía; D-14). Lo que
 * es de otra cuenta, de otro número o no tiene la forma esperada se descarta sin error.
 */
export function parseTwilioDelivery(params: URLSearchParams, { accountSid, sender }: TwilioParseOptions): InboundDelivery {
  const ignored: InboundDelivery = { messages: [], statuses: [], ignored: 1 };
  if (single(params, 'AccountSid') !== accountSid) return ignored;
  // Un StatusCallback trae MessageStatus (queued, sent, delivered, read, failed, undelivered...);
  // un mensaje entrante no lo trae o, si lo trae, vale "received".
  if (params.has('MessageStatus') && single(params, 'MessageStatus') !== 'received') {
    const status = single(params, 'MessageStatus');
    const parsed = status === undefined ? null : parseStatus(params, status, sender);
    return parsed ? { messages: [], statuses: [parsed], ignored: 0 } : ignored;
  }
  const message = parseMessage(params, sender);
  return message ? { messages: [message], statuses: [], ignored: 0 } : ignored;
}
