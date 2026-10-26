import type { Context } from 'koa';

import { readRawBody } from './form-body.ts';

/**
 * Lectura del cuerpo JSON de la API de productos (REQ-F-008, DT-11), sin dependencias:
 * solo `application/json` (415), como máximo `limit` bytes (413), UTF-8 y JSON válido (400).
 * Devuelve `unknown`: quien lo usa lo valida con una lista cerrada de campos.
 */

export const MAX_JSON_BYTES = 32 * 1024;

export async function readJsonBody(ctx: Context, { limit = MAX_JSON_BYTES }: { limit?: number } = {}): Promise<unknown> {
  if (!ctx.is('application/json')) {
    ctx.throw(415, 'El cuerpo debe enviarse como application/json.', { code: 'UNSUPPORTED_MEDIA_TYPE' });
  }
  const raw = await readRawBody(ctx, limit, 'El cuerpo es demasiado grande.');
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(raw);
  } catch {
    ctx.throw(400, 'El cuerpo no es UTF-8 válido.', { code: 'INVALID_JSON' });
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    ctx.throw(400, 'El cuerpo no es JSON válido.', { code: 'INVALID_JSON' });
  }
}
