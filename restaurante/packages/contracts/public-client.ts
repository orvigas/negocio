import { productsResponseSchemas, publicProductsPath, type PublicBusinessId, type PublicProducts } from './products.ts';

/**
 * Cliente HTTP del endpoint público de productos (REQ-F-038, RF-2 y RF-5). Nunca lanza: devuelve
 * el resultado o el motivo del fallo, para que quien lo usa decida (las landings sirven su última
 * copia buena). Toda respuesta se valida con el contrato: un cuerpo que no lo cumple es un fallo.
 */

/** Tamaño máximo del cuerpo aceptado. */
export const MAX_RESPONSE_BYTES = 1024 * 1024;

export type PublicApiFailure = 'timeout' | 'network' | 'http_status' | 'invalid_body';

export type PublicApiResult<Id extends PublicBusinessId> =
  | { ok: true; data: PublicProducts[Id] }
  | { ok: false; reason: PublicApiFailure; status?: number };

export type FetchFn = (input: string, init: RequestInit) => Promise<Response>;

export interface PublicApiClient {
  getProducts<Id extends PublicBusinessId>(business: Id): Promise<PublicApiResult<Id>>;
}

export interface PublicApiClientOptions {
  /** Origen (y ruta base opcional) de la API, sin barra final: p. ej. http://api:3001. */
  baseUrl: string;
  /** Límite de cada petición, en milisegundos. */
  timeoutMs: number;
  fetch?: FetchFn;
}

const isTimeout = (err: unknown): boolean =>
  err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');

const isJson = (contentType: string | null): boolean => /^application\/json(?:\s*;|$)/i.test(contentType ?? '');

/** Lee el cuerpo como texto sin pasar de `limit` bytes; null si lo supera. */
async function readLimited(response: Response, limit: number): Promise<string | null> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > limit) {
    await response.body?.cancel();
    return null;
  }
  if (!response.body) return '';
  const reader: ReadableStreamDefaultReader<Uint8Array> = response.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

export function createPublicApiClient({ baseUrl, timeoutMs, fetch: fetchFn = (input, init) => fetch(input, init) }: PublicApiClientOptions): PublicApiClient {
  if (typeof baseUrl !== 'string' || baseUrl === '' || baseUrl.endsWith('/')) throw new TypeError('createPublicApiClient requiere baseUrl sin barra final');
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) throw new TypeError('createPublicApiClient requiere timeoutMs positivo');

  return Object.freeze<PublicApiClient>({
    async getProducts(business) {
      const signal = AbortSignal.timeout(timeoutMs);
      try {
        const response = await fetchFn(`${baseUrl}${publicProductsPath(business)}`, {
          method: 'GET',
          headers: { accept: 'application/json' },
          redirect: 'error',
          signal,
        });
        if (response.status !== 200) {
          await response.body?.cancel();
          return { ok: false, reason: 'http_status', status: response.status };
        }
        if (!isJson(response.headers.get('content-type'))) {
          await response.body?.cancel();
          return { ok: false, reason: 'invalid_body' };
        }
        const text = await readLimited(response, MAX_RESPONSE_BYTES);
        if (text === null) return { ok: false, reason: 'invalid_body' };
        let body: unknown;
        try {
          body = JSON.parse(text);
        } catch {
          return { ok: false, reason: 'invalid_body' };
        }
        const parsed = productsResponseSchemas[business].safeParse(body);
        if (!parsed.success) return { ok: false, reason: 'invalid_body' };
        // El esquema elegido es el de `business`: su salida tiene la forma de PublicProducts[Id].
        return { ok: true, data: parsed.data.data as PublicProducts[typeof business] };
      } catch (err) {
        return { ok: false, reason: isTimeout(err) || signal.aborted ? 'timeout' : 'network' };
      }
    },
  });
}
