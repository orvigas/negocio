import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Webhook de la WhatsApp Cloud API (REQ-F-009, RF-1).
 *
 * - Firma: `X-Hub-Signature-256: sha256=<hex>`, HMAC-SHA256 del cuerpo **crudo** con el App Secret.
 * - Payload: `object: "whatsapp_business_account"` -> `entry[].changes[]` con `field: "messages"`;
 *   `value.messages[]` (mensajes del cliente) y `value.statuses[]` (estados de lo que enviamos).
 *
 * El payload es entrada externa: se valida campo por campo desde `unknown` y lo que no tiene la
 * forma esperada se descarta. Solo se conserva lo que usa el bot (nunca el nombre del perfil).
 */

export const SIGNATURE_HEADER = 'X-Hub-Signature-256';
/** Meta envía payloads de hasta 3 MB. */
export const MAX_WEBHOOK_BYTES = 3 * 1024 * 1024;
/** Longitud máxima del texto que procesa el bot (lo demás se recorta; D-12 no pide más de 200). */
export const MAX_TEXT_LENGTH = 1000;

const SIGNATURE_PATTERN = /^sha256=([0-9a-f]{64})$/i;
const WA_ID_PATTERN = /^\d{5,20}$/;
const MESSAGE_ID_PATTERN = /^[\x21-\x7e]{1,256}$/;
const TIMESTAMP_PATTERN = /^\d{1,12}$/;

export type SignatureCheck = 'valid' | 'missing' | 'malformed' | 'mismatch';

/** Comprueba la firma en tiempo constante. */
export function checkSignature(rawBody: Buffer, header: string | undefined, appSecret: string): SignatureCheck {
  if (header === undefined || header === '') return 'missing';
  const match = SIGNATURE_PATTERN.exec(header.trim());
  if (!match?.[1]) return 'malformed';
  const expected = createHmac('sha256', appSecret).update(rawBody).digest();
  const received = Buffer.from(match[1], 'hex');
  return received.length === expected.length && timingSafeEqual(received, expected) ? 'valid' : 'mismatch';
}

/** Mensaje entrante ya validado. `text` solo existe en los mensajes de texto. */
export interface InboundMessage {
  readonly id: string;
  /** `wa_id` del cliente (dígitos). */
  readonly from: string;
  /** Segundos desde la época (Unix). */
  readonly timestamp: number;
  readonly type: string;
  readonly text?: string;
}

/** Estado de un mensaje que envió el bot (entregado, leído, fallido...). */
export interface InboundStatus {
  readonly id: string;
  readonly status: string;
  /** Código numérico del primer error, si lo hay (nunca su mensaje). */
  readonly errorCode?: number;
}

export interface ParsedDelivery {
  readonly messages: InboundMessage[];
  readonly statuses: InboundStatus[];
  /** Cambios descartados (otro objeto, campo o número). */
  readonly ignored: number;
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

function parseMessage(raw: unknown): InboundMessage | null {
  if (!isObject(raw)) return null;
  const { id, from, timestamp, type } = raw;
  if (typeof id !== 'string' || !MESSAGE_ID_PATTERN.test(id)) return null;
  if (typeof from !== 'string' || !WA_ID_PATTERN.test(from)) return null;
  if (typeof timestamp !== 'string' || !TIMESTAMP_PATTERN.test(timestamp)) return null;
  if (typeof type !== 'string' || type === '' || type.length > 40) return null;
  const message = { id, from, timestamp: Number(timestamp), type };
  if (type !== 'text') return message;
  const body = isObject(raw.text) ? raw.text.body : undefined;
  if (typeof body !== 'string') return { ...message, type: 'unsupported' };
  return { ...message, text: body.slice(0, MAX_TEXT_LENGTH) };
}

function parseStatus(raw: unknown): InboundStatus | null {
  if (!isObject(raw)) return null;
  const { id, status } = raw;
  if (typeof id !== 'string' || !MESSAGE_ID_PATTERN.test(id) || typeof status !== 'string' || status.length > 40) return null;
  const [firstError] = asArray(raw.errors);
  const code = isObject(firstError) ? firstError.code : undefined;
  return typeof code === 'number' && Number.isSafeInteger(code) ? { id, status, errorCode: code } : { id, status };
}

/**
 * Extrae los mensajes y estados dirigidos al número del bot (`phoneNumberId`). Lo que no tiene la
 * forma esperada se descarta sin error: Meta reintentaría durante días una entrega rechazada.
 */
export function parseDelivery(payload: unknown, phoneNumberId: string): ParsedDelivery {
  const messages: InboundMessage[] = [];
  const statuses: InboundStatus[] = [];
  let ignored = 0;
  if (!isObject(payload) || payload.object !== 'whatsapp_business_account') return { messages, statuses, ignored: 1 };

  for (const entry of asArray(payload.entry)) {
    for (const change of asArray(isObject(entry) ? entry.changes : undefined)) {
      const value = isObject(change) && change.field === 'messages' ? change.value : undefined;
      const metadata = isObject(value) ? value.metadata : undefined;
      if (!isObject(value) || !isObject(metadata) || metadata.phone_number_id !== phoneNumberId) {
        ignored += 1;
        continue;
      }
      for (const raw of asArray(value.messages)) {
        const message = parseMessage(raw);
        if (message) messages.push(message);
        else ignored += 1;
      }
      for (const raw of asArray(value.statuses)) {
        const status = parseStatus(raw);
        if (status) statuses.push(status);
        else ignored += 1;
      }
    }
  }
  return { messages, statuses, ignored };
}
