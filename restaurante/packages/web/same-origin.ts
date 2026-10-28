import type { Context } from 'koa';

import type { Logger } from './logger.ts';

/**
 * Primera capa contra CSRF (movida de landing-pages/src/middleware/admin-guard.ts; REQ-F-039, P-1 y
 * D-2): el navegador indica el origen de la petición.
 *
 * - `Sec-Fetch-Site` (cabecera que solo pone el navegador; otro sitio no la puede falsear):
 *   si llega, debe ser `same-origin`.
 * - `Origin`: si llega con un origen concreto, debe ser el de este sitio. `Origin: null` (lo que
 *   manda el navegador con `Referrer-Policy: no-referrer`, o desde contextos opacos) no prueba
 *   nada por sí solo: solo se acepta si el navegador confirma `Sec-Fetch-Site: same-origin`.
 * - Sin ninguna de las dos (clientes que no son navegador) decide el token CSRF.
 *
 * El control principal sigue siendo el token sincronizador y la cookie `SameSite=Strict`.
 * Si falla: 403 `CSRF_INVALID` y el evento `admin_csrf_rejected` en el log (sin datos de la petición).
 */

export const CSRF_REJECTED_MESSAGE = 'La petición no es válida. Recarga la página e inténtalo de nuevo.';

export function rejectCsrf(ctx: Context, logger: Logger, reason: string): never {
  logger.warn('admin_csrf_rejected', { path: ctx.path, reason });
  ctx.throw(403, CSRF_REJECTED_MESSAGE, { code: 'CSRF_INVALID' });
}

export function assertSameOrigin(ctx: Context, logger: Logger): void {
  const origin = ctx.get('Origin');
  const site = ctx.get('Sec-Fetch-Site');
  // Ojo: en Koa 3 `ctx.origin` devuelve la cabecera Origin; el origen propio se calcula aquí
  // (con TRUST_PROXY, protocolo y host salen de X-Forwarded-Proto/Host del proxy).
  const ownOrigin = `${ctx.protocol}://${ctx.host}`;

  if (site && site !== 'same-origin') rejectCsrf(ctx, logger, 'fetch_site');
  if (origin === 'null') {
    if (site !== 'same-origin') rejectCsrf(ctx, logger, 'origin_null');
  } else if (origin && origin !== ownOrigin) {
    rejectCsrf(ctx, logger, 'origin');
  }
}
