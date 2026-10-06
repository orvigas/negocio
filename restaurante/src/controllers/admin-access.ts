import type { RouterContext } from '@koa/router';

import type { BusinessId } from '../config/businesses.ts';
import type { Config } from '../config/env.ts';
import {
  assertCsrfToken,
  assertSameOrigin,
  createSessionGuard,
  type AdminState,
} from '../middleware/admin-guard.ts';
import type { UserRecord, UserRepository } from '../repositories/user-repository.ts';
import { getActiveBusinessId } from '../services/business-schedule.ts';
import type { SessionInfo, SessionStore } from '../services/session-store.ts';
import { readFormBody } from '../utils/form-body.ts';
import type { Logger } from '../utils/logger.ts';
import { renderAdminForbidden, type AdminPageContext } from '../views/admin/index.ts';
import type { Renderer, SafeHtml } from '../views/render.ts';

/**
 * Acceso a las páginas con sesión de /admin (REQ-F-001 y REQ-F-007), compartido por los
 * controladores de menús, usuarios y cuenta.
 *
 * Orden en un POST (DT-12): mismo origen -> sesión (303 al acceso) -> permiso (403 HTML, sin leer
 * el body) -> body y token CSRF (403) -> la acción. Así un usuario sin permiso nunca llega a
 * escribir nada.
 */

export type AdminRouterContext = RouterContext<AdminState>;

/** Usuario y sesión de una petición autenticada. */
export interface Authenticated {
  user: UserRecord;
  session: SessionInfo;
}

/** Permiso requerido: devuelve el mensaje del 403 si no se cumple, o null si se permite. */
export type Permission = (user: UserRecord) => string | null;

export interface AdminAccess {
  /** GET con sesión (y permiso, si se indica). */
  page(ctx: AdminRouterContext, options: { returnTo?: string; permission?: Permission }, handler: (auth: Authenticated) => unknown): Promise<unknown>;
  /** POST con sesión, permiso, body y CSRF. Devuelve los campos o null si ya respondió. */
  post(
    ctx: AdminRouterContext,
    options: { returnTo?: string; limit?: number; permission?: Permission; allowedFields?: readonly string[] },
  ): Promise<(Authenticated & { fields: Map<string, string> }) | null>;
  /** Datos comunes de las vistas (cabecera, CSRF y favicon). */
  pageContext: (auth: Authenticated) => AdminPageContext;
  sendHtml: (ctx: AdminRouterContext, status: number, html: SafeHtml) => void;
  seeOther: (ctx: AdminRouterContext, url: string) => void;
  faviconBusinessId: () => BusinessId;
}

export function createAdminAccess({
  config,
  sessions,
  users,
  renderer,
  now,
  logger,
}: {
  config: Config;
  sessions: SessionStore;
  users: UserRepository;
  renderer: Renderer;
  now: () => Date;
  logger: Logger;
}): AdminAccess {
  const requireSession = createSessionGuard({ sessions, config, users });
  /** Negocio activo del día: su favicon se muestra en todas las páginas de admin (REQ-F-002, RF-7). */
  const faviconBusinessId = () => getActiveBusinessId({ now: now(), timeZone: config.timezone });

  function sendHtml(ctx: AdminRouterContext, status: number, html: SafeHtml): void {
    ctx.status = status;
    ctx.type = 'html';
    ctx.body = html.toString();
  }

  function seeOther(ctx: AdminRouterContext, url: string): void {
    ctx.status = 303;
    ctx.redirect(url);
  }

  const pageContext = ({ user, session }: Authenticated): AdminPageContext => ({
    viewer: user,
    csrfToken: session.csrfToken,
    faviconBusinessId: faviconBusinessId(),
  });

  /** Sesión válida; deja usuario y sesión, o null si ya redirigió al acceso. */
  async function authenticate(ctx: AdminRouterContext, returnTo: string | undefined): Promise<Authenticated | null> {
    let auth: Authenticated | null = null;
    await requireSession(
      ctx,
      async () => {
        // requireSession deja ambos en `state` antes de llamar aquí.
        auth = { user: ctx.state.adminUser as UserRecord, session: ctx.state.adminSession as SessionInfo };
      },
      { returnTo },
    );
    return auth;
  }

  /** Comprueba el permiso; si falta, responde 403 con la página de aviso. */
  function allowed(ctx: AdminRouterContext, auth: Authenticated, permission: Permission | undefined): boolean {
    const denied = permission?.(auth.user) ?? null;
    if (denied === null) return true;
    logger.warn('admin_forbidden', { path: ctx.path, method: ctx.method, userId: auth.user.id });
    sendHtml(ctx, 403, renderAdminForbidden(renderer, { ...pageContext(auth), message: denied }));
    return false;
  }

  return Object.freeze<AdminAccess>({
    async page(ctx, { returnTo, permission }, handler) {
      const auth = await authenticate(ctx, returnTo);
      if (!auth || !allowed(ctx, auth, permission)) return undefined;
      return handler(auth);
    },

    async post(ctx, { returnTo, limit, permission, allowedFields }) {
      assertSameOrigin(ctx, logger);
      const auth = await authenticate(ctx, returnTo);
      if (!auth || !allowed(ctx, auth, permission)) return null;
      const fields = await readFormBody(ctx, limit ? { limit } : undefined);
      assertCsrfToken(ctx, logger, fields);
      if (allowedFields) {
        // Lista cerrada de campos (además de _csrf): un campo desconocido es un error (400).
        const known = new Set(['_csrf', ...allowedFields]);
        if ([...fields.keys()].some((name) => !known.has(name))) {
          logger.warn('admin_form_unknown_fields', { path: ctx.path, userId: auth.user.id });
          ctx.throw(400, 'El formulario tiene campos desconocidos.', { code: 'INVALID_FORM' });
        }
      }
      return { ...auth, fields };
    },

    pageContext,
    sendHtml,
    seeOther,
    faviconBusinessId,
  });
}
