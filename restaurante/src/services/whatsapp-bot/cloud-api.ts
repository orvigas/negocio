import type { Logger } from '../../utils/logger.ts';

/**
 * Cliente de envío de la WhatsApp Cloud API (REQ-F-009, RF-7 y RF-8), con `fetch` nativo.
 *
 * - `POST https://graph.facebook.com/<versión>/<PHONE_NUMBER_ID>/messages` con el token en la
 *   cabecera `Authorization` (nunca en la URL ni en un log). La base es fija: el token no puede
 *   enviarse a otro host.
 * - Nunca lanza: devuelve `{ ok: false, ... }` y registra `bot_api_error` solo con el estado
 *   HTTP, el código numérico de Meta y el tipo de fallo (el `message` de Meta puede llevar datos).
 * - **Un solo reintento**, y solo si es seguro que Meta no aceptó el mensaje: HTTP 429 o 5xx,
 *   códigos de Graph de servicio temporal o límite de envío, o un error de conexión antes de
 *   enviar. Un timeout o una conexión cortada a media respuesta son ambiguos (el mensaje pudo
 *   llegar): no se reintenta, porque nunca se debe duplicar un envío (RF-7.3).
 */

export const GRAPH_API_BASE_URL = 'https://graph.facebook.com';
export const REQUEST_TIMEOUT_MS = 10_000;
export const RETRY_DELAY_MS = 1000;

/** Errores de conexión que ocurren antes de enviar la petición. */
const PRE_SEND_ERROR_CODES = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT']);
/** Códigos de Graph de error temporal o de límite de envío (el mensaje no se aceptó). */
const RETRYABLE_GRAPH_CODES = new Set([1, 2, 4, 130429]);

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export type SendFailureKind = 'http' | 'network' | 'timeout' | 'ambiguous' | 'invalid_response';
export type SendResult =
  | { readonly ok: true; readonly messageId: string | undefined }
  | { readonly ok: false; readonly kind: SendFailureKind; readonly status?: number; readonly errorCode?: number };

export interface TemplateMessage {
  readonly name: string;
  readonly language: string;
  /** Parámetros con nombre del cuerpo de la plantilla. */
  readonly params: Readonly<Record<string, string>>;
}

export interface CloudApiClient {
  sendText(to: string, body: string): Promise<SendResult>;
  sendTemplate(to: string, template: TemplateMessage): Promise<SendResult>;
}

export interface CloudApiOptions {
  config: { accessToken: string; phoneNumberId: string; graphApiVersion: string };
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

async function readJson(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return undefined;
  }
}

interface Attempt {
  result: SendResult;
  retryable: boolean;
}

function classifyThrown(err: unknown): Attempt {
  if (isObject(err) && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
    return { result: { ok: false, kind: 'timeout' }, retryable: false };
  }
  const cause = isObject(err) ? err.cause : undefined;
  const code = isObject(cause) ? cause.code : undefined;
  if (typeof code === 'string' && PRE_SEND_ERROR_CODES.has(code)) return { result: { ok: false, kind: 'network' }, retryable: true };
  return { result: { ok: false, kind: 'ambiguous' }, retryable: false };
}

export function createCloudApiClient({
  config,
  fetch,
  logger,
  timeoutMs = REQUEST_TIMEOUT_MS,
  retryDelayMs = RETRY_DELAY_MS,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}: CloudApiOptions): CloudApiClient {
  const url = `${GRAPH_API_BASE_URL}/${config.graphApiVersion}/${config.phoneNumberId}/messages`;

  async function attempt(payload: string): Promise<Attempt> {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.accessToken}`, 'Content-Type': 'application/json' },
        body: payload,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      return classifyThrown(err);
    }
    const body = await readJson(response);
    if (response.ok) {
      return { result: { ok: true, messageId: messageIdOf(body) }, retryable: false };
    }
    const errorCode = errorCodeOf(body);
    const retryable = response.status === 429 || response.status >= 500 || (errorCode !== undefined && RETRYABLE_GRAPH_CODES.has(errorCode));
    const result: SendResult =
      errorCode === undefined ? { ok: false, kind: 'http', status: response.status } : { ok: false, kind: 'http', status: response.status, errorCode };
    return { result, retryable };
  }

  async function send(kind: 'text' | 'template', message: Record<string, unknown>): Promise<SendResult> {
    const payload = JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', ...message });
    let current = await attempt(payload);
    let retried = false;
    if (!current.result.ok && current.retryable) {
      await sleep(retryDelayMs);
      current = await attempt(payload);
      retried = true;
    }
    if (!current.result.ok) {
      const { kind: failure, status, errorCode } = current.result;
      logger.error('bot_api_error', { messageType: kind, failure, status, errorCode, retried });
    }
    return current.result;
  }

  return Object.freeze({
    sendText(to: string, body: string) {
      return send('text', { to, type: 'text', text: { preview_url: false, body } });
    },
    sendTemplate(to: string, { name, language, params }: TemplateMessage) {
      const parameters = Object.entries(params).map(([parameterName, text]) => ({ type: 'text', parameter_name: parameterName, text }));
      return send('template', { to, type: 'template', template: { name, language: { code: language }, components: [{ type: 'body', parameters }] } });
    },
  });
}
