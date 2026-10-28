import { z } from 'zod';

import {
  CSRF_HEADER,
  IDEMPOTENCY_HEADER,
  adminPaths,
  loginResponseSchema,
  productFieldsResponseSchema,
  productListResponseSchema,
  productListWriteResponseSchema,
  productResponseSchema,
  productWriteResponseSchema,
  sessionResponseSchema,
  type AdminProduct,
  type Freshness,
  type LoginRequest,
  type LoginResponse,
  type ProductFieldsResponse,
  type SessionResponse,
} from './admin.ts';
import { isJson, isTimeout, readLimited } from './http.ts';
import type { PublicBusinessId } from './products.ts';

/**
 * Cliente HTTP tipado de `/api/v1/admin` (REQ-F-039, D-1 y D-2) para el admin (inventory-manager).
 *
 * - Nunca lanza: devuelve los datos validados con el contrato, el error de la API
 *   (`{ error: { code, message, fields?, current? } }`) o el motivo de un fallo de transporte.
 * - La sesión viaja como `Authorization: Bearer <id>`; las escrituras llevan el token CSRF de la
 *   sesión en `X-CSRF-Token`; el login, la IP del visitante en `X-Forwarded-For` (la escribe el
 *   admin con la que le da su proxy; nunca reenvía la que recibe).
 * - Límite de tiempo por petición, sin redirecciones y cuerpo de 1 MiB como máximo.
 */

export const ADMIN_CLIENT_MAX_BYTES = 1024 * 1024;

const apiErrorBodySchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    fields: z.record(z.string(), z.string()).optional(),
    current: z.object({ id: z.number(), version: z.number(), updatedAt: z.string(), updatedBy: z.string().nullable() }).optional(),
  }),
});
export type AdminApiError = z.infer<typeof apiErrorBodySchema>['error'];

export type AdminApiFailure = 'timeout' | 'network' | 'invalid_response';

export type AdminApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; kind: 'http'; status: number; error: AdminApiError }
  | { ok: false; kind: AdminApiFailure; status?: number };

export type AdminFetch = (input: string, init: RequestInit) => Promise<Response>;

export interface AdminApiClientOptions {
  /** Origen de la API, sin barra final (p. ej. http://api:3001). */
  baseUrl: string;
  timeoutMs: number;
  fetch?: AdminFetch;
}

/** Sesión de la API que reenvía el admin: id opaco y, en escrituras, su token CSRF. */
export interface AdminCredentials {
  sessionId: string;
  csrfToken?: string;
}

export type WriteResult<T> = AdminApiResult<T & { meta: { freshness: Freshness } }>;

export interface AdminApiClient {
  login(body: LoginRequest, clientIp: string): Promise<AdminApiResult<LoginResponse>>;
  session(auth: AdminCredentials): Promise<AdminApiResult<SessionResponse>>;
  logout(auth: AdminCredentials): Promise<AdminApiResult<null>>;
  listProducts(auth: AdminCredentials, business: PublicBusinessId, options?: { deleted?: boolean }): Promise<AdminApiResult<{ products: AdminProduct[] }>>;
  productFields(auth: AdminCredentials, business: PublicBusinessId, kind: { category: string; detailsType: string | null }): Promise<AdminApiResult<ProductFieldsResponse>>;
  getProduct(auth: AdminCredentials, business: PublicBusinessId, id: number): Promise<AdminApiResult<{ product: AdminProduct }>>;
  createProduct(auth: AdminCredentials, business: PublicBusinessId, input: Record<string, unknown>, idempotencyKey?: string): Promise<WriteResult<{ product: AdminProduct }>>;
  updateProduct(auth: AdminCredentials, business: PublicBusinessId, id: number, input: Record<string, unknown>, options?: { overwrite?: boolean }): Promise<WriteResult<{ product: AdminProduct }>>;
  removeProduct(auth: AdminCredentials, business: PublicBusinessId, id: number, version: number): Promise<WriteResult<{ product: AdminProduct }>>;
  restoreProduct(auth: AdminCredentials, business: PublicBusinessId, id: number, version: number): Promise<WriteResult<{ product: AdminProduct }>>;
  moveProduct(auth: AdminCredentials, business: PublicBusinessId, id: number, direction: 'up' | 'down', version: number): Promise<WriteResult<{ products: AdminProduct[] }>>;
}

interface Schema<T> {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
}

export function createAdminApiClient({ baseUrl, timeoutMs, fetch: fetchFn = (input, init) => fetch(input, init) }: AdminApiClientOptions): AdminApiClient {
  if (typeof baseUrl !== 'string' || baseUrl === '' || baseUrl.endsWith('/')) throw new TypeError('createAdminApiClient requiere baseUrl sin barra final');
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) throw new TypeError('createAdminApiClient requiere timeoutMs positivo');

  async function request<T>(
    method: string,
    path: string,
    { auth, body, headers = {}, schema, expect = 200 }: { auth?: AdminCredentials; body?: unknown; headers?: Record<string, string>; schema: Schema<T> | null; expect?: number },
  ): Promise<AdminApiResult<T>> {
    const all: Record<string, string> = { accept: 'application/json', ...headers };
    if (auth) all.authorization = `Bearer ${auth.sessionId}`;
    if (auth?.csrfToken && method !== 'GET') all[CSRF_HEADER] = auth.csrfToken;
    if (body !== undefined) all['content-type'] = 'application/json';
    const signal = AbortSignal.timeout(timeoutMs);
    try {
      const response = await fetchFn(`${baseUrl}${path}`, {
        method,
        headers: all,
        redirect: 'error',
        signal,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (response.status === expect && schema === null) {
        await response.body?.cancel();
        return { ok: true, status: response.status, data: null as T };
      }
      if (!isJson(response.headers.get('content-type'))) {
        await response.body?.cancel();
        return { ok: false, kind: 'invalid_response', status: response.status };
      }
      const text = await readLimited(response, ADMIN_CLIENT_MAX_BYTES);
      if (text === null) return { ok: false, kind: 'invalid_response', status: response.status };
      let parsedBody: unknown;
      try {
        parsedBody = JSON.parse(text);
      } catch {
        return { ok: false, kind: 'invalid_response', status: response.status };
      }
      if (response.status === expect && schema) {
        const parsed = schema.safeParse(parsedBody);
        return parsed.success ? { ok: true, status: response.status, data: parsed.data } : { ok: false, kind: 'invalid_response', status: response.status };
      }
      const error = apiErrorBodySchema.safeParse(parsedBody);
      return error.success ? { ok: false, kind: 'http', status: response.status, error: error.data.error } : { ok: false, kind: 'invalid_response', status: response.status };
    } catch (err) {
      return { ok: false, kind: isTimeout(err) || signal.aborted ? 'timeout' : 'network' };
    }
  }

  return Object.freeze<AdminApiClient>({
    login: (body, clientIp) => request('POST', adminPaths.session, { body, headers: { 'x-forwarded-for': clientIp }, schema: loginResponseSchema, expect: 201 }),
    session: (auth) => request('GET', adminPaths.session, { auth, schema: sessionResponseSchema }),
    logout: (auth) => request<null>('DELETE', adminPaths.session, { auth, schema: null, expect: 204 }),
    listProducts: (auth, business, { deleted = false } = {}) =>
      request('GET', `${adminPaths.products(business)}${deleted ? '?eliminados=1' : ''}`, { auth, schema: productListResponseSchema }),
    productFields: (auth, business, { category, detailsType }) => {
      const query = new URLSearchParams({ categoria: category, ...(detailsType ? { tipo: detailsType } : {}) });
      return request('GET', `${adminPaths.productFields(business)}?${query.toString()}`, { auth, schema: productFieldsResponseSchema });
    },
    getProduct: (auth, business, id) => request('GET', adminPaths.product(business, id), { auth, schema: productResponseSchema }),
    createProduct: (auth, business, input, idempotencyKey) =>
      request('POST', adminPaths.products(business), {
        auth,
        body: input,
        headers: idempotencyKey ? { [IDEMPOTENCY_HEADER]: idempotencyKey } : {},
        schema: productWriteResponseSchema,
        expect: 201,
      }),
    updateProduct: (auth, business, id, input, { overwrite = false } = {}) =>
      request('PUT', `${adminPaths.product(business, id)}${overwrite ? '?sobrescribir=1' : ''}`, { auth, body: input, schema: productWriteResponseSchema }),
    removeProduct: (auth, business, id, version) => request('DELETE', `${adminPaths.product(business, id)}?version=${version}`, { auth, schema: productWriteResponseSchema }),
    restoreProduct: (auth, business, id, version) => request('POST', adminPaths.productRestore(business, id), { auth, body: { version }, schema: productWriteResponseSchema }),
    moveProduct: (auth, business, id, direction, version) =>
      request('POST', adminPaths.productMove(business, id), { auth, body: { direction, version }, schema: productListWriteResponseSchema }),
  });
}
