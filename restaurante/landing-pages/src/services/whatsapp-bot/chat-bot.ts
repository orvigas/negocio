/**
 * Contrato entre la conversación compartida y el proveedor de WhatsApp (REQ-F-012, RF-1; DT-1).
 *
 * `ChatBot` es el **transporte**: todo lo que depende del proveedor (verificación del webhook,
 * firma, formato de la entrega, respuesta al proveedor, envío y longitud máxima de un texto). No
 * sabe nada de la conversación, la deduplicación, las colas ni los límites, que viven una sola vez
 * en el orquestador (orchestrator.ts).
 *
 * Implementaciones: `WhatsAppBot` (WhatsApp Cloud API de Meta) y `TwilioBot` (Twilio). Solo
 * providers/select.ts las importa; el resto de la app depende de esta interfaz.
 */

export const BOT_PROVIDERS = Object.freeze(['meta', 'twilio'] as const);
export type BotProvider = (typeof BOT_PROVIDERS)[number];

/** Longitud máxima del texto que procesa el bot (lo demás se recorta; D-12 de REQ-F-009 no pide más de 200). */
export const MAX_TEXT_LENGTH = 1000;

/** Mensaje entrante ya validado. `text` solo existe en los mensajes de texto. */
export interface InboundMessage {
  readonly id: string;
  /** Identificador del cliente en dígitos, tal como lo envió el proveedor (se le responde a ese mismo). */
  readonly from: string;
  /**
   * Segundos desde la época (Unix) según el proveedor. Ausente si el proveedor no lo envía
   * (Twilio): el orquestador usa entonces la hora de recepción (D-14).
   */
  readonly timestamp?: number;
  readonly type: string;
  readonly text?: string;
}

/** Estado de un mensaje que envió el bot (entregado, leído, fallido...). */
export interface InboundStatus {
  readonly id: string;
  readonly status: string;
  /** Código numérico del error, si lo hay (nunca su mensaje). */
  readonly errorCode?: number;
}

export interface InboundDelivery {
  readonly messages: InboundMessage[];
  readonly statuses: InboundStatus[];
  /** Partes descartadas (otra cuenta, otro número o mal formadas). */
  readonly ignored: number;
}

export type SignatureCheck = 'valid' | 'missing' | 'malformed' | 'mismatch';

/** Parámetros de la query del GET del webhook (ya reducidos a texto). */
export type WebhookQuery = Readonly<Record<string, string | undefined>>;

export type VerifyOutcome =
  | { readonly kind: 'challenge'; readonly challenge: string }
  | { readonly kind: 'rejected' }
  /** El proveedor no tiene verificación por GET (Twilio): el webhook responde 405. */
  | { readonly kind: 'unsupported' };

/** Cuerpo de la respuesta 200 al proveedor. */
export interface WebhookResponse {
  readonly type: string;
  readonly body: string;
}

export type DeliveryOutcome =
  | { readonly kind: 'accepted'; readonly delivery: InboundDelivery; readonly response: WebhookResponse }
  | { readonly kind: 'signature_invalid'; readonly reason: Exclude<SignatureCheck, 'valid'> }
  | { readonly kind: 'bad_request'; readonly code: string; readonly message: string };

export type SendFailureKind = 'http' | 'network' | 'timeout' | 'ambiguous' | 'invalid_response';
export interface SendFailure {
  readonly ok: false;
  readonly kind: SendFailureKind;
  readonly status?: number;
  readonly errorCode?: number;
}
export type SendResult = { readonly ok: true; readonly messageIds: readonly string[] } | SendFailure;

/** Aviso de un pedido al personal: el proveedor elige la forma (plantilla o texto libre). */
export interface StaffNotice {
  /** Parámetros con nombre (codigo, negocio, horario, cliente, whatsapp, entrega, lineas, total, notas). */
  readonly params: Readonly<Record<string, string>>;
  /** El mismo contenido como texto libre (REQ-F-009 CA-14). */
  readonly text: string;
}

export interface ChatBot {
  readonly provider: BotProvider;
  /** Longitud máxima de un mensaje de texto saliente (4096 en Meta, 1600 en Twilio). */
  readonly maxTextLength: number;
  /** Tamaño máximo del cuerpo del webhook (413 si lo supera). */
  readonly maxWebhookBytes: number;
  /** GET del webhook. */
  verifySubscription(query: WebhookQuery): VerifyOutcome;
  /** POST del webhook: firma, formato y entrega normalizada. Nunca lanza. */
  handleDelivery(rawBody: Buffer, header: (name: string) => string | undefined): DeliveryOutcome;
  /** Envía un texto de hasta `maxTextLength` caracteres. Nunca lanza. */
  sendText(to: string, body: string): Promise<SendResult>;
  /** Envía el aviso de un pedido al personal, una sola vez (sin reintentar una parte aceptada). Nunca lanza. */
  sendStaffNotice(to: string, notice: StaffNotice): Promise<SendResult>;
}
