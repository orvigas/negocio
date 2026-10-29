/**
 * Utilidades de los clientes HTTP de contracts (REQ-F-038; compartidas con el cliente del admin desde
 * REQ-F-039): límite de tiempo, tipo JSON y cuerpo con tamaño máximo.
 */

export const isTimeout = (err: unknown): boolean =>
  err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');

export const isJson = (contentType: string | null): boolean => /^application\/json(?:\s*;|$)/i.test(contentType ?? '');

/** Lee el cuerpo como texto sin pasar de `limit` bytes; null si lo supera. */
export async function readLimited(response: Response, limit: number): Promise<string | null> {
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
