/**
 * Lectura del body de formularios HTML nativos (application/x-www-form-urlencoded) sin
 * dependencias (DT-1). Límite de bytes y de campos; un campo repetido es un error.
 */

export const MAX_FORM_BYTES = 128 * 1024;
export const MAX_FORM_FIELDS = 600;

import type { Context } from 'koa';

const decoder = () => new TextDecoder('utf-8', { fatal: true });

async function readRawBody(ctx: Context, limit: number): Promise<Buffer> {
  const declared = Number(ctx.get('Content-Length'));
  if (Number.isFinite(declared) && declared > limit) {
    ctx.throw(413, 'El formulario es demasiado grande.', { code: 'PAYLOAD_TOO_LARGE' });
  }

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of ctx.req) {
    size += chunk.length;
    if (size > limit) ctx.throw(413, 'El formulario es demasiado grande.', { code: 'PAYLOAD_TOO_LARGE' });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function readFormBody(
  ctx: Context,
  { limit = MAX_FORM_BYTES, maxFields = MAX_FORM_FIELDS }: { limit?: number; maxFields?: number } = {},
): Promise<Map<string, string>> {
  if (!ctx.is('application/x-www-form-urlencoded')) {
    ctx.throw(415, 'El formulario debe enviarse como application/x-www-form-urlencoded.', { code: 'UNSUPPORTED_MEDIA_TYPE' });
  }

  let text: string;
  try {
    text = decoder().decode(await readRawBody(ctx, limit));
  } catch (err) {
    if ((err as { status?: unknown } | null)?.status) throw err;
    ctx.throw(400, 'El formulario no es UTF-8 válido.', { code: 'INVALID_FORM' });
  }

  const fields = new Map<string, string>();
  for (const [name, value] of new URLSearchParams(text)) {
    if (fields.has(name)) ctx.throw(400, 'El formulario tiene campos repetidos.', { code: 'INVALID_FORM' });
    fields.set(name, value);
    if (fields.size > maxFields) ctx.throw(413, 'El formulario tiene demasiados campos.', { code: 'PAYLOAD_TOO_LARGE' });
  }
  return fields;
}
