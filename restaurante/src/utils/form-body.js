/**
 * Lectura del body de formularios HTML nativos (application/x-www-form-urlencoded) sin
 * dependencias (DT-1). Límite de bytes y de campos; un campo repetido es un error.
 */

export const MAX_FORM_BYTES = 128 * 1024;
export const MAX_FORM_FIELDS = 600;

const decoder = () => new TextDecoder('utf-8', { fatal: true });

async function readRawBody(ctx, limit) {
  const declared = Number(ctx.get('Content-Length'));
  if (Number.isFinite(declared) && declared > limit) {
    ctx.throw(413, 'El formulario es demasiado grande.', { code: 'PAYLOAD_TOO_LARGE' });
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of ctx.req) {
    size += chunk.length;
    if (size > limit) ctx.throw(413, 'El formulario es demasiado grande.', { code: 'PAYLOAD_TOO_LARGE' });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * @param {import('koa').Context} ctx
 * @param {{ limit?: number, maxFields?: number }} [options]
 * @returns {Promise<Map<string, string>>}
 */
export async function readFormBody(ctx, { limit = MAX_FORM_BYTES, maxFields = MAX_FORM_FIELDS } = {}) {
  if (!ctx.is('application/x-www-form-urlencoded')) {
    ctx.throw(415, 'El formulario debe enviarse como application/x-www-form-urlencoded.', { code: 'UNSUPPORTED_MEDIA_TYPE' });
  }

  let text;
  try {
    text = decoder().decode(await readRawBody(ctx, limit));
  } catch (err) {
    if (err?.status) throw err;
    ctx.throw(400, 'El formulario no es UTF-8 válido.', { code: 'INVALID_FORM' });
  }

  const fields = new Map();
  for (const [name, value] of new URLSearchParams(text)) {
    if (fields.has(name)) ctx.throw(400, 'El formulario tiene campos repetidos.', { code: 'INVALID_FORM' });
    fields.set(name, value);
    if (fields.size > maxFields) ctx.throw(413, 'El formulario tiene demasiados campos.', { code: 'PAYLOAD_TOO_LARGE' });
  }
  return fields;
}
