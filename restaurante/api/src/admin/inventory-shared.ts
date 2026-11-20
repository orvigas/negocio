import type { Context } from 'koa';

import { IDEMPOTENCY_HEADER, IDEMPOTENCY_KEY_PATTERN, INVENTORY_ERROR_CODES } from '@restaurante/contracts';
import type { Logger } from '@restaurante/core/shared';

import { ApiHttpError } from '../errors.ts';
import type { AdminAuth } from './access.ts';
import { IdempotencyKeyReusedError, fingerprintOf, type IdempotencyStore } from './idempotency.ts';

/**
 * Piezas comunes de las rutas del inventario (REQ-F-049, artículos y categorías; REQ-F-050, recetas):
 * el id de la ruta, la clave de idempotencia de las altas y la respuesta 503 cuando otra escritura
 * retiene el candado del inventario.
 */

export type RouteContext = Context & { params: Record<string, string> };
export type Handler = (ctx: RouteContext) => Promise<void>;

const ID_PATTERN = /^[1-9]\d{0,9}$/;

/** `:id` de la ruta, o el 404 que corresponda si no tiene la forma de un id. */
export function routeId(ctx: RouteContext, notFound: () => ApiHttpError): number {
  const { id } = ctx.params;
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) throw notFound();
  return Number(id);
}

/** Cabecera `Idempotency-Key` ('' si no llega) o 400 si no tiene el formato del contrato. */
export function idempotencyKey(ctx: Context): string {
  const key = ctx.get(IDEMPOTENCY_HEADER);
  if (key !== '' && !IDEMPOTENCY_KEY_PATTERN.test(key)) throw new ApiHttpError(400, 'INVALID_IDEMPOTENCY_KEY', 'La clave de idempotencia no es válida.');
  return key;
}

/**
 * Alta idempotente (caso límite "doble envío"): la misma clave del mismo usuario en el mismo ámbito y
 * con el mismo cuerpo devuelve el primer resultado sin repetir la escritura; con otro cuerpo, 422.
 */
export async function runOnce<T>(
  logger: Logger,
  { store, scope, auth, key, body }: { store: IdempotencyStore<T>; scope: string; auth: AdminAuth; key: string; body: unknown },
  task: () => Promise<T>,
): Promise<{ value: T; replayed: boolean }> {
  if (key === '') return { value: await task(), replayed: false };
  try {
    return await store.run({ userId: auth.user.id, scope, key, fingerprint: fingerprintOf(body) }, task);
  } catch (err) {
    if (!(err instanceof IdempotencyKeyReusedError)) throw err;
    logger.warn('inventory_create_key_reused', { scope });
    throw new ApiHttpError(422, 'IDEMPOTENCY_KEY_REUSED', 'La clave de idempotencia ya se usó con otros datos: no se guardó nada.');
  }
}

/**
 * Espera del candado agotada (InventoryBusyError; MySQL 1205): 503 `INVENTORY_BUSY`, sin reintento
 * (DEF-001 del QA del PR 1 de REQ-F-050: antes acababa en 500). No se escribió nada.
 */
export function inventoryBusy(ctx: Context, logger: Logger): ApiHttpError {
  logger.warn('inventory_busy', { method: ctx.method, path: ctx.path });
  return new ApiHttpError(503, INVENTORY_ERROR_CODES.INVENTORY_BUSY, 'El inventario está ocupado con otra escritura: inténtalo de nuevo en unos segundos. No se guardó nada.');
}
