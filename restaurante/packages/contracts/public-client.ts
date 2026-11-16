import { isJson, isTimeout, readLimited } from './http.ts';
import { pageResponseSchemas, publicPagePath, type PublicPage } from './page.ts';
import { productsResponseSchemas, publicProductsPath, type PublicBusinessId, type PublicProducts } from './products.ts';

/**
 * Cliente HTTP de los endpoints públicos: productos (REQ-F-038, RF-2 y RF-5) y página (REQ-F-044). Nunca lanza: devuelve
 * el resultado o el motivo del fallo, para que quien lo usa decida (las landings sirven su última
 * copia buena). Toda respuesta se valida con el contrato: un cuerpo que no lo cumple es un fallo.
 */

/** Tamaño máximo del cuerpo aceptado. */
export const MAX_RESPONSE_BYTES = 1024 * 1024;

export type PublicApiFailure = 'timeout' | 'network' | 'http_status' | 'invalid_body';

export type PublicApiFetched<T> = { ok: true; data: T } | { ok: false; reason: PublicApiFailure; status?: number };
export type PublicApiResult<Id extends PublicBusinessId> = PublicApiFetched<PublicProducts[Id]>;

export type FetchFn = (input: string, init: RequestInit) => Promise<Response>;

export interface PublicApiClient {
  getProducts<Id extends PublicBusinessId>(business: Id): Promise<PublicApiResult<Id>>;
  /** Datos de página del negocio (REQ-F-044). */
  getPage<Id extends PublicBusinessId>(business: Id): Promise<PublicApiFetched<PublicPage[Id]>>;
}

export interface PublicApiClientOptions {
  /** Origen (y ruta base opcional) de la API, sin barra final: p. ej. http://api:3001. */
  baseUrl: string;
  /** Límite de cada petición, en milisegundos. */
  timeoutMs: number;
  fetch?: FetchFn;
}

export function createPublicApiClient({ baseUrl, timeoutMs, fetch: fetchFn = (input, init) => fetch(input, init) }: PublicApiClientOptions): PublicApiClient {
  if (typeof baseUrl !== 'string' || baseUrl === '' || baseUrl.endsWith('/')) throw new TypeError('createPublicApiClient requiere baseUrl sin barra final');
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) throw new TypeError('createPublicApiClient requiere timeoutMs positivo');

  async function fetchData<T>(path: string, schema: { safeParse(value: unknown): { success: true; data: { data: unknown } } | { success: false } }): Promise<PublicApiFetched<T>> {
    const signal = AbortSignal.timeout(timeoutMs);
    try {
      const response = await fetchFn(`${baseUrl}${path}`, {
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
      const parsed = schema.safeParse(body);
      if (!parsed.success) return { ok: false, reason: 'invalid_body' };
      // Quien llama elige el esquema del recurso y del negocio: su salida tiene la forma de T.
      return { ok: true, data: parsed.data.data as T };
    } catch (err) {
      return { ok: false, reason: isTimeout(err) || signal.aborted ? 'timeout' : 'network' };
    }
  }

  return Object.freeze<PublicApiClient>({
    getProducts: (business) => fetchData(publicProductsPath(business), productsResponseSchemas[business]),
    getPage: (business) => fetchData(publicPagePath(business), pageResponseSchemas[business]),
  });
}
