import type { Logger } from '@restaurante/core/shared';

import type { SendFailure } from '../../chat-bot.ts';
import { postWithRetry, type FetchLike } from '../http-send.ts';

/**
 * Cliente REST de mensajes de Twilio para WhatsApp (REQ-F-012, RF-4; DT-10), con `fetch` nativo.
 *
 * - `POST https://api.twilio.com/2010-04-01/Accounts/<AccountSid>/Messages.json`, formulario
 *   `application/x-www-form-urlencoded`, `Authorization: Basic base64(AccountSid:AuthToken)`.
 *   La base es fija (el token no puede enviarse a otro host) y el token nunca va en la URL ni
 *   en un log. La URL lleva el Account SID: tampoco se registra.
 * - `From` y `To` con el prefijo `whatsapp:+`, y `StatusCallback` hacia el webhook (D-11).
 * - Nunca lanza: registra `bot_api_error` solo con el estado HTTP, el `code` numérico de Twilio,
 *   el tipo de fallo y si hubo reintento (el `message` de Twilio puede llevar el número).
 * - **Un solo reintento**, solo si es seguro que Twilio no aceptó el mensaje: HTTP 429 o 503, o
 *   un error de conexión antes de enviar. Otro 5xx, un timeout o una conexión cortada a media
 *   respuesta son ambiguos y no se reintentan.
 */

export const TWILIO_API_BASE_URL = 'https://api.twilio.com';

export type TwilioSendResult = { readonly ok: true; readonly messageId: string | undefined } | SendFailure;

/** Contenido del mensaje: texto libre o Content Template con sus variables. */
export type TwilioContent = { readonly body: string } | { readonly contentSid: string; readonly variables: Readonly<Record<string, string>> };

export interface TwilioApiClient {
  send(to: string, content: TwilioContent, messageType: 'text' | 'template'): Promise<TwilioSendResult>;
}

export interface TwilioApiOptions {
  config: { accountId: string; accessToken: string; sender: string; webhookUrl: string };
  fetch: FetchLike;
  logger: Logger;
  timeoutMs?: number;
  retryDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const errorCodeOf = (body: unknown): number | undefined => {
  const code = isObject(body) ? body.code : undefined;
  return typeof code === 'number' && Number.isSafeInteger(code) ? code : undefined;
};

const sidOf = (body: unknown): string | undefined => {
  const sid = isObject(body) ? body.sid : undefined;
  return typeof sid === 'string' ? sid : undefined;
};

export const whatsappAddress = (digits: string): string => `whatsapp:+${digits}`;

export function createTwilioApiClient({ config, fetch, logger, timeoutMs, retryDelayMs, sleep }: TwilioApiOptions): TwilioApiClient {
  const url = `${TWILIO_API_BASE_URL}/2010-04-01/Accounts/${config.accountId}/Messages.json`;
  const authorization = `Basic ${Buffer.from(`${config.accountId}:${config.accessToken}`, 'utf8').toString('base64')}`;

  return Object.freeze({
    async send(to: string, content: TwilioContent, messageType: 'text' | 'template'): Promise<TwilioSendResult> {
      const form = new URLSearchParams({ From: whatsappAddress(config.sender), To: whatsappAddress(to), StatusCallback: config.webhookUrl });
      if ('body' in content) form.set('Body', content.body);
      else {
        form.set('ContentSid', content.contentSid);
        form.set('ContentVariables', JSON.stringify(content.variables));
      }
      const { result, retried } = await postWithRetry({
        fetch,
        url,
        headers: { Authorization: authorization, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
        errorCodeOf,
        isRetryable: (status) => status === 429 || status === 503,
        ...(timeoutMs === undefined ? {} : { timeoutMs }),
        ...(retryDelayMs === undefined ? {} : { retryDelayMs }),
        ...(sleep === undefined ? {} : { sleep }),
      });
      if (result.ok) return { ok: true, messageId: sidOf(result.body) };
      const { kind: failure, status, errorCode } = result;
      logger.error('bot_api_error', { messageType, failure, status, errorCode, retried });
      return result;
    },
  });
}
