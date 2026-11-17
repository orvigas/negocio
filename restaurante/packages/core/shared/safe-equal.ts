import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Compara dos textos en tiempo constante (sobre sus resúmenes, que tienen la misma longitud). En shared
 * desde REQ-F-045 (antes en identity/admin-auth.ts): la usan el token CSRF de la API, la verificación
 * del webhook del bot y la credencial del aviso interno de las landings, que no usan la identidad.
 */
export function safeEqualStrings(a: unknown, b: unknown): boolean {
  const digest = (value: unknown) => createHash('sha256').update(String(value), 'utf8').digest();
  return timingSafeEqual(digest(a), digest(b));
}
