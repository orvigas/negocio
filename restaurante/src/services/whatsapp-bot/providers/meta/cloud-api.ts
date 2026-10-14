import type { SendFailure } from '../../chat-bot.ts';
import type { Logger } from '../../../../utils/logger.ts';
import { postWithRetry, type FetchLike } from '../http-send.ts';

/**
 * Cliente de envío de la WhatsApp Cloud API (REQ-F-009, RF-7 y RF-8), con `fetch` nativo. Detalle
 * interno de `WhatsAppBot` (REQ-F-012, DT-3).
 *
 * - `POST https://graph.facebook.com/<versión>/<ID del número>/messages` con el token en la
 *   cabecera `Authorization` (nunca en la URL ni en un log). La base es fija: el token no puede
 *   enviarse a otro host.
 * - Nunca lanza: devuelve `{ ok: false, ... }` y registra `bot_api_error` solo con el estado
 *   HTTP, el código numérico de Meta y el tipo de fallo (el `message` de Meta puede llevar datos).
 * - **Un solo reintento**, y solo si es seguro que Meta no aceptó el mensaje: HTTP 429 o 5xx,
 *   códigos de Graph de servicio temporal o límite de envío, o un error de conexión antes de
 *   enviar (providers/http-send.ts).
 * - Destinatario mexicano: Meta entrega el `wa_id` de un celular de México como `521` + 10
 *   dígitos, pero solo acepta enviarle como `52` + 10 (si no, error 131030). Solo se normaliza
 *   el destino del envío; el identificador del cliente en la conversación no cambia.
 */

export const GRAPH_API_BASE_URL = 'https://graph.facebook.com';

/** Códigos de Graph de error temporal o de límite de envío (el mensaje no se aceptó). */
const RETRYABLE_GRAPH_CODES = new Set([1, 2, 4, 130429]);

export type CloudSendResult = { readonly ok: true; readonly messageId: string | undefined } | SendFailure;

export interface TemplateMessage {
  readonly name: string;
  readonly language: string;
  /** Parámetros con nombre del cuerpo de la plantilla. */
  readonly params: Readonly<Record<string, string>>;
}

export interface CloudApiClient {
  sendText(to: string, body: string): Promise<CloudSendResult>;
  sendTemplate(to: string, template: TemplateMessage): Promise<CloudSendResult>;
}

export interface CloudApiOptions {
  config: { accessToken: string; accountId: string; graphApiVersion: string };
  fetch: FetchLike;
  logger: Logger;
  timeoutMs?: number;
  retryDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const errorCodeOf = (body: unknown): number | undefined => {
  const code = isObject(body) && isObject(body.error) ? body.error.code : undefined;
  return typeof code === 'number' && Number.isSafeInteger(code) ? code : undefined;
};

const messageIdOf = (body: unknown): string | undefined => {
  const [first] = isObject(body) && Array.isArray(body.messages) ? (body.messages as unknown[]) : [];
  const id = isObject(first) ? first.id : undefined;
  return typeof id === 'string' ? id : undefined;
};

const MX_MOBILE_WA_ID = /^521(\d{10})$/;

/** Destino aceptado por la Cloud API: `521` + 10 dígitos -> `52` + 10; cualquier otro, sin cambios. */
export const toCloudApiRecipient = (to: string): string => to.replace(MX_MOBILE_WA_ID, '52$1');

export function createCloudApiClient({ config, fetch, logger, timeoutMs, retryDelayMs, sleep }: CloudApiOptions): CloudApiClient {
  const url = `${GRAPH_API_BASE_URL}/${config.graphApiVersion}/${config.accountId}/messages`;

  async function send(kind: 'text' | 'template', message: Record<string, unknown>): Promise<CloudSendResult> {
    const { result, retried } = await postWithRetry({
      fetch,
      url,
      headers: { Authorization: `Bearer ${config.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', ...message }),
      errorCodeOf,
      isRetryable: (status, errorCode) => status === 429 || status >= 500 || (errorCode !== undefined && RETRYABLE_GRAPH_CODES.has(errorCode)),
      ...(timeoutMs === undefined ? {} : { timeoutMs }),
      ...(retryDelayMs === undefined ? {} : { retryDelayMs }),
      ...(sleep === undefined ? {} : { sleep }),
    });
    if (result.ok) return { ok: true, messageId: messageIdOf(result.body) };
    const { kind: failure, status, errorCode } = result;
    logger.error('bot_api_error', { messageType: kind, failure, status, errorCode, retried });
    return result;
  }

  return Object.freeze({
    sendText(to: string, body: string) {
      return send('text', { to: toCloudApiRecipient(to), type: 'text', text: { preview_url: false, body } });
    },
    sendTemplate(to: string, { name, language, params }: TemplateMessage) {
      const parameters = Object.entries(params).map(([parameterName, text]) => ({ type: 'text', parameter_name: parameterName, text }));
      return send('template', { to: toCloudApiRecipient(to), type: 'template', template: { name, language: { code: language }, components: [{ type: 'body', parameters }] } });
    },
  });
}
