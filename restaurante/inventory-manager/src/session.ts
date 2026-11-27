import type { Context } from 'koa';

/**
 * Cookie de sesión del admin nuevo (REQ-F-039, D-1, RF-1, RF-3 y CA-1). La sesión es de la API: aquí
 * solo se guarda su id opaco para reenviarlo como `Authorization: Bearer`.
 *
 * - En producción se llama `__Host-admin_sid`: el navegador exige `Secure`, `Path=/` y que no haya
 *   `Domain` (solo este host). Fuera de producción (HTTP local), `admin_sid`.
 * - `HttpOnly` y `SameSite=Strict`; sin `Max-Age`: la caducidad (2 h sin actividad) la decide la API.
 */

export const SESSION_COOKIE_PRODUCTION = '__Host-admin_sid';
export const SESSION_COOKIE_DEVELOPMENT = 'admin_sid';
const SESSION_ID = /^[A-Za-z0-9_-]{16,128}$/;

export const sessionCookieName = (isProduction: boolean): string => (isProduction ? SESSION_COOKIE_PRODUCTION : SESSION_COOKIE_DEVELOPMENT);

export function sessionCookieOptions(isProduction: boolean) {
  return { httpOnly: true, sameSite: 'strict' as const, path: '/', secure: isProduction, signed: false, overwrite: true };
}

/** Id de sesión de la cookie (formato validado), o null. */
export function readSessionId(ctx: Context, isProduction: boolean): string | null {
  const value = ctx.cookies.get(sessionCookieName(isProduction));
  return typeof value === 'string' && SESSION_ID.test(value) ? value : null;
}

export function writeSessionId(ctx: Context, isProduction: boolean, id: string): void {
  ctx.cookies.set(sessionCookieName(isProduction), id, sessionCookieOptions(isProduction));
}

export function clearSessionId(ctx: Context, isProduction: boolean): void {
  ctx.cookies.set(sessionCookieName(isProduction), null, sessionCookieOptions(isProduction));
}

/**
 * Rutas internas a las que se puede volver tras entrar (RF-3, CA-3): sin redirecciones abiertas.
 * Solo las pantallas GET del admin; cualquier otro valor vuelve al inicio.
 */
const RETURN_PATTERNS: readonly RegExp[] = [
  /^\/$/,
  /^\/(?:molotes|birria)\/productos$/,
  /^\/(?:molotes|birria)\/productos\/(?:nuevo|eliminados)$/,
  /^\/(?:molotes|birria)\/productos\/[1-9]\d{0,9}\/(?:editar|eliminar)$/,
  // Datos de página (REQ-F-044).
  /^\/(?:molotes|birria)\/pagina(?:\/restaurar)?$/,
  // Usuarios y "Mi cuenta" (REQ-F-040, RF-14).
  /^\/usuarios(?:\/nuevo)?$/,
  /^\/usuarios\/[1-9]\d{0,9}\/(?:editar|contrasena)$/,
  /^\/cuenta$/,
  // Control del bot (REQ-F-043).
  /^\/bot$/,
  // Cotizador de taquizas (REQ-F-046): ruta fija con la query de un cálculo (la de URLSearchParams).
  // Solo caracteres de una query codificada: sin redirección abierta.
  /^\/birria\/cotizador(?:\?[A-Za-z0-9._~*%&=+,-]*)?$/,
  // Inventario (REQ-F-051, OBS-12 a de REQ-F-050): cualquier pantalla de /inventario con su query. Solo
  // segmentos de minúsculas, dígitos y guiones (sin «//» ni otro origen) y caracteres de una query
  // codificada: sin redirección abierta.
  /^\/inventario(?:\/[a-z0-9-]+)*(?:\?[A-Za-z0-9._~*%&=+,-]*)?$/,
];

/**
 * Tope de la vuelta ya codificada como campo del formulario de acceso (DEF-004 de REQ-F-046): el
 * cuerpo del acceso está limitado a 4 KiB, y así queda sitio para un usuario y una contraseña de su
 * longitud máxima. Una vuelta más larga se descarta (se vuelve al inicio).
 */
export const NEXT_ENCODED_LIMIT = 3000;

/** Longitud del valor tal como lo codifica el navegador en un formulario (`application/x-www-form-urlencoded`). */
const encodedLength = (value: string): number => new URLSearchParams([['', value]]).toString().length - 1;

export function sanitizeNext(value: unknown): string {
  if (typeof value !== 'string' || value.length > NEXT_ENCODED_LIMIT) return '/';
  return RETURN_PATTERNS.some((pattern) => pattern.test(value)) && encodedLength(value) <= NEXT_ENCODED_LIMIT ? value : '/';
}
