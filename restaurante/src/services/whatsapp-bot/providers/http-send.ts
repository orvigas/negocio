import type { SendFailure } from '../chat-bot.ts';

/**
 * Envío HTTP de los proveedores del bot (REQ-F-009 RF-7.3 y RF-8; REQ-F-012 RF-4.1), con `fetch`
 * nativo: timeout por petición y **un solo reintento**, solo cuando es seguro que el proveedor no
 * aceptó el mensaje (lo decide `isRetryable` con el estado HTTP y el código del proveedor) o ante
 * un error de conexión antes de enviar. Un timeout o una conexión cortada a media respuesta son
 * ambiguos (el mensaje pudo llegar): no se reintenta, porque nunca se debe duplicar un envío.
 *
 * Nunca lanza. No registra nada: cada proveedor registra el fallo sin datos (estado, código, tipo).
 */

export const REQUEST_TIMEOUT_MS = 10_000;
export const RETRY_DELAY_MS = 1000;

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/** Errores de conexión que ocurren antes de enviar la petición. */
const PRE_SEND_ERROR_CODES = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT']);

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

export type HttpSendResult = { readonly ok: true; readonly body: unknown } | SendFailure;

export interface HttpSendOptions {
  fetch: FetchLike;
  url: string;
  headers: Readonly<Record<string, string>>;
  body: string;
  /** Código numérico de error del proveedor en el cuerpo de una respuesta fallida. */
  errorCodeOf: (body: unknown) => number | undefined;
  /** ¿Es seguro que el proveedor no aceptó el mensaje? */
  isRetryable: (status: number, errorCode: number | undefined) => boolean;
  timeoutMs?: number;
  retryDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return undefined;
  }
}

interface Attempt {
  result: HttpSendResult;
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

/** POST con un reintento como máximo. `retried` indica si hubo segundo intento. */
export async function postWithRetry({
  fetch,
  url,
  headers,
  body,
  errorCodeOf,
  isRetryable,
  timeoutMs = REQUEST_TIMEOUT_MS,
  retryDelayMs = RETRY_DELAY_MS,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}: HttpSendOptions): Promise<{ result: HttpSendResult; retried: boolean }> {
  async function attempt(): Promise<Attempt> {
    let response: Response;
    try {
      response = await fetch(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(timeoutMs) });
    } catch (err) {
      return classifyThrown(err);
    }
    const json = await readJson(response);
    if (response.ok) return { result: { ok: true, body: json }, retryable: false };
    const errorCode = errorCodeOf(json);
    const result: SendFailure =
      errorCode === undefined ? { ok: false, kind: 'http', status: response.status } : { ok: false, kind: 'http', status: response.status, errorCode };
    return { result, retryable: isRetryable(response.status, errorCode) };
  }

  let current = await attempt();
  if (current.result.ok || !current.retryable) return { result: current.result, retried: false };
  await sleep(retryDelayMs);
  current = await attempt();
  return { result: current.result, retried: true };
}
