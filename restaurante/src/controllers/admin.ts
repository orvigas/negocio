import type { RouterContext } from '@koa/router';

import { BUSINESS_IDS, isBusinessId, type BusinessId } from '../config/businesses.ts';
import type { Config } from '../config/env.ts';
import {
  LOGIN_PATH,
  SESSION_COOKIE,
  assertCsrfToken,
  assertSameOrigin,
  createSessionGuard,
  sessionCookieOptions,
  type AdminState,
} from '../middleware/admin-guard.ts';
import {
  CHANGE_ACTIONS,
  MenuConflictError,
  MenuDamagedError,
  PreviousUnavailableError,
  SeedRestoreNotAllowedError,
  type MenuRepository,
} from '../repositories/menu-repository.ts';
import type { AdminAuthenticator } from '../services/admin-auth.ts';
import { parseAdminForm, type ImageExists } from '../services/admin-form.ts';
import { getActiveBusinessId } from '../services/business-schedule.ts';
import type { LoginThrottle } from '../services/login-throttle.ts';
import { AUTHOR_MAX_LENGTH, textLength } from '../services/menu-schema.ts';
import type { SessionStore } from '../services/session-store.ts';
import { readFormBody } from '../utils/form-body.ts';
import type { Logger } from '../utils/logger.ts';
import {
  SUCCESS_MESSAGES,
  adminPath,
  renderAdminBusiness,
  renderAdminConfirmRestore,
  renderAdminLogin,
  type AdminBusinessOptions,
} from '../views/admin/index.ts';
import type { Renderer, SafeHtml } from '../views/render.ts';

/** Contexto de las rutas de administración (parámetros del router y sesión en `state`). */
export type AdminRouterContext = RouterContext<AdminState>;
type AdminHandler = (ctx: AdminRouterContext) => unknown;

export interface AdminController {
  loginPage: AdminHandler;
  login: AdminHandler;
  logout: AdminHandler;
  index: AdminHandler;
  businessPage: AdminHandler;
  save: AdminHandler;
  restorePreviousPage: AdminHandler;
  restorePrevious: AdminHandler;
  restoreSeed: AdminHandler;
}

export interface AdminDeps {
  config: Config;
  renderer: Renderer;
  now: () => Date;
  repository: MenuRepository;
  sessions: SessionStore;
  throttle: LoginThrottle;
  authenticator: AdminAuthenticator;
  imageExists: ImageExists;
  logger: Logger;
}

/**
 * Controlador de la administración de menús (REQ-F-001, RF-5 a RF-8).
 * Formularios HTML nativos con POST-redirect-GET; sin JavaScript (P-8).
 */

const LOGIN_BODY_LIMIT = 4 * 1024;
const RESTORE_BODY_LIMIT = 4 * 1024;
const SAVE_ACTIONS: readonly (string | undefined)[] = Object.freeze([CHANGE_ACTIONS.SAVE, CHANGE_ACTIONS.OVERWRITE_AFTER_CONFLICT]);

// BUSINESS_IDS nunca está vacío (se construye a partir de BUSINESS).
const DEFAULT_NEXT = adminPath(BUSINESS_IDS[0] as BusinessId);
const ALLOWED_NEXT = new Set(BUSINESS_IDS.map(adminPath));
/** Solo se vuelve a páginas de administración conocidas (sin redirecciones abiertas). */
const sanitizeNext = (value: unknown): string => (typeof value === 'string' && ALLOWED_NEXT.has(value) ? value : DEFAULT_NEXT);

const PROBLEMS = Object.freeze({
  damagedSave: 'Los datos guardados están dañados: no se guardó nada. Elige una opción de recuperación.',
  previousUnavailable: 'No hay una versión anterior válida para restaurar. No se cambió nada.',
  seedNotAllowed: 'La semilla original solo se puede restaurar cuando los datos están dañados. No se cambió nada.',
});

function validateAuthor(raw: unknown): { value: string; error: string | null } {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (value === '') return { value, error: 'Escribe el nombre de quien hace el cambio.' };
  if (textLength(value) > AUTHOR_MAX_LENGTH) return { value, error: `Máximo ${AUTHOR_MAX_LENGTH} caracteres.` };
  return { value, error: null };
}

function sendHtml(ctx: AdminRouterContext, status: number, html: SafeHtml): void {
  ctx.status = status;
  ctx.type = 'html';
  ctx.body = html.toString();
}

function seeOther(ctx: AdminRouterContext, url: string): void {
  ctx.status = 303;
  ctx.redirect(url);
}

export function createAdminController({
  config,
  renderer,
  now,
  repository,
  sessions,
  throttle,
  authenticator,
  imageExists,
  logger,
}: AdminDeps): AdminController {
  if (typeof now !== 'function') throw new TypeError('createAdminController requiere el reloj (now)');
  const requireSession = createSessionGuard({ sessions, config });
  const timezone = config.timezone;
  /** Negocio activo del día: su favicon se muestra en todas las páginas de admin (REQ-F-002, RF-7). */
  const faviconBusinessId = () => getActiveBusinessId({ now: now(), timeZone: timezone });

  /** Resuelve :business o responde 404. */
  function businessFrom(ctx: AdminRouterContext): BusinessId {
    const { business } = ctx.params;
    if (!isBusinessId(business)) ctx.throw(404);
    return business;
  }

  /** Sesión + body + CSRF para una acción POST. Devuelve los campos o null si redirigió. */
  async function authorizePost(
    ctx: AdminRouterContext,
    { returnTo, limit }: { returnTo?: string; limit?: number } = {},
  ): Promise<Map<string, string> | null> {
    assertSameOrigin(ctx, logger);
    let authorized = false;
    await requireSession(
      ctx,
      async () => {
        authorized = true;
      },
      { returnTo },
    );
    if (!authorized) return null;
    const fields = await readFormBody(ctx, limit ? { limit } : undefined);
    assertCsrfToken(ctx, logger, fields);
    return fields;
  }

  async function businessView(
    businessId: BusinessId,
    ctx: AdminRouterContext,
    extra: Partial<AdminBusinessOptions> = {},
  ): Promise<AdminBusinessOptions> {
    const edit = await repository.getForEdit(businessId);
    // Solo se llama dentro de requireSession/authorizePost, que dejan la sesión en `state`.
    const session = ctx.state.adminSession as NonNullable<AdminState['adminSession']>;
    return {
      businessId,
      timezone,
      csrfToken: session.csrfToken,
      document: edit.document,
      version: edit.version,
      damaged: edit.damaged,
      lastChange: await repository.getLastChange(businessId),
      faviconBusinessId: faviconBusinessId(),
      ...extra,
    };
  }

  return Object.freeze<AdminController>({
    async loginPage(ctx) {
      const next = sanitizeNext(ctx.query.next);
      if (sessions.touch(ctx.cookies.get(SESSION_COOKIE))) return seeOther(ctx, next);
      const expired = ctx.query.expirada === '1';
      return sendHtml(ctx, 200, renderAdminLogin(renderer, { next, expired, faviconBusinessId: faviconBusinessId() }));
    },

    async login(ctx) {
      assertSameOrigin(ctx, logger);
      const fields = await readFormBody(ctx, { limit: LOGIN_BODY_LIMIT });
      const next = sanitizeNext(fields.get('next'));
      const origin = ctx.ip;

      if (throttle.status(origin).locked) {
        logger.warn('admin_login_locked', { ip: origin });
        return sendHtml(ctx, 429, renderAdminLogin(renderer, { next, error: 'locked', faviconBusinessId: faviconBusinessId() }));
      }

      const ok = await authenticator.verify(fields.get('username') ?? '', fields.get('password') ?? '');
      if (!ok) {
        const locked = throttle.recordFailure(origin);
        logger.warn('admin_login_failed', { ip: origin, locked });
        const error = locked ? 'locked' : 'invalid';
        return sendHtml(ctx, locked ? 429 : 401, renderAdminLogin(renderer, { next, error, faviconBusinessId: faviconBusinessId() }));
      }

      throttle.recordSuccess(origin);
      const previous = ctx.cookies.get(SESSION_COOKIE);
      if (previous) sessions.destroy(previous);
      const session = sessions.create();
      ctx.cookies.set(SESSION_COOKIE, session.id, sessionCookieOptions(config));
      logger.info('admin_login_succeeded', { ip: origin });
      return seeOther(ctx, next);
    },

    async logout(ctx) {
      const fields = await authorizePost(ctx, { limit: LOGIN_BODY_LIMIT });
      if (!fields) return undefined;
      // authorizePost ya validó la sesión de esta cookie.
      sessions.destroy(ctx.cookies.get(SESSION_COOKIE) as string);
      ctx.cookies.set(SESSION_COOKIE, null, sessionCookieOptions(config));
      logger.info('admin_logout', { ip: ctx.ip });
      return seeOther(ctx, LOGIN_PATH);
    },

    index(ctx) {
      return seeOther(ctx, DEFAULT_NEXT);
    },

    async businessPage(ctx) {
      const businessId = businessFrom(ctx);
      return requireSession(
        ctx,
        async () => {
          const { ok } = ctx.query;
          // `ok` es una clave propia de SUCCESS_MESSAGES: comprobado con Object.hasOwn.
          const success =
            typeof ok === 'string' && Object.hasOwn(SUCCESS_MESSAGES, ok) ? SUCCESS_MESSAGES[ok as keyof typeof SUCCESS_MESSAGES] : undefined;
          sendHtml(ctx, 200, renderAdminBusiness(renderer, await businessView(businessId, ctx, { success })));
        },
        { returnTo: adminPath(businessId) },
      );
    },

    async save(ctx) {
      const businessId = businessFrom(ctx);
      const fields = await authorizePost(ctx, { returnTo: adminPath(businessId) });
      if (!fields) return undefined;

      const action = fields.get('action');
      if (!SAVE_ACTIONS.includes(action)) ctx.throw(400, 'Acción desconocida.', { code: 'INVALID_FORM' });
      const expectedVersion = fields.get('expectedVersion') ?? '';

      const view = await businessView(businessId, ctx);
      if (view.damaged) {
        return sendHtml(ctx, 409, renderAdminBusiness(renderer, { ...view, problem: PROBLEMS.damagedSave }));
      }

      const parsed = await parseAdminForm(businessId, fields, view.document.data, { imageExists });
      if (parsed.structureError) {
        logger.warn('admin_form_structure_rejected', { business: businessId });
        ctx.throw(400, 'La estructura del menú no se puede modificar.', { code: 'STRUCTURE_MODIFIED' });
      }

      const author = validateAuthor(fields.get('author'));
      const form = { values: parsed.values, errors: parsed.errors, author: fields.get('author') ?? '', authorError: author.error };
      if (Object.keys(parsed.errors).length > 0 || author.error) {
        return sendHtml(ctx, 422, renderAdminBusiness(renderer, { ...view, version: expectedVersion, form }));
      }

      try {
        await repository.save(businessId, { data: parsed.data, expectedVersion, author: author.value, action });
      } catch (err) {
        if (err instanceof MenuConflictError) {
          logger.info('menu_conflict', { business: businessId, action });
          return sendHtml(ctx, 409, renderAdminBusiness(renderer, { ...view, form, conflict: err.current }));
        }
        if (err instanceof MenuDamagedError) {
          const damagedView = await businessView(businessId, ctx, { problem: PROBLEMS.damagedSave });
          return sendHtml(ctx, 409, renderAdminBusiness(renderer, damagedView));
        }
        throw err;
      }
      return seeOther(ctx, `${adminPath(businessId)}?ok=${action}`);
    },

    async restorePreviousPage(ctx) {
      const businessId = businessFrom(ctx);
      return requireSession(
        ctx,
        async () => {
          const view = await businessView(businessId, ctx);
          // Con datos dañados, las opciones de recuperación están en la página del negocio.
          if (view.damaged) return seeOther(ctx, adminPath(businessId));
          return sendHtml(ctx, 200, renderAdminConfirmRestore(renderer, view));
        },
        { returnTo: adminPath(businessId) },
      );
    },

    async restorePrevious(ctx) {
      const businessId = businessFrom(ctx);
      const fields = await authorizePost(ctx, { returnTo: adminPath(businessId), limit: RESTORE_BODY_LIMIT });
      if (!fields) return undefined;
      const author = validateAuthor(fields.get('author'));
      const raw = fields.get('author') ?? '';

      const respond = async (status: number, extra: { authorError?: string | null; problem?: string }) => {
        const view = await businessView(businessId, ctx);
        if (view.damaged) {
          const restoreAuthor = { value: raw, error: extra.authorError };
          return sendHtml(ctx, status, renderAdminBusiness(renderer, { ...view, restoreAuthor, problem: extra.problem }));
        }
        return sendHtml(ctx, status, renderAdminConfirmRestore(renderer, { ...view, author: raw, ...extra }));
      };

      if (author.error) return respond(422, { authorError: author.error });
      try {
        await repository.restorePrevious(businessId, { author: author.value });
      } catch (err) {
        if (err instanceof PreviousUnavailableError) return respond(409, { problem: PROBLEMS.previousUnavailable });
        throw err;
      }
      return seeOther(ctx, `${adminPath(businessId)}?ok=${CHANGE_ACTIONS.RESTORE_PREVIOUS}`);
    },

    async restoreSeed(ctx) {
      const businessId = businessFrom(ctx);
      const fields = await authorizePost(ctx, { returnTo: adminPath(businessId), limit: RESTORE_BODY_LIMIT });
      if (!fields) return undefined;
      const author = validateAuthor(fields.get('author'));
      const raw = fields.get('author') ?? '';

      if (author.error) {
        const view = await businessView(businessId, ctx, { restoreAuthor: { value: raw, error: author.error } });
        return sendHtml(ctx, 422, renderAdminBusiness(renderer, view));
      }
      try {
        await repository.restoreSeed(businessId, { author: author.value });
      } catch (err) {
        if (err instanceof SeedRestoreNotAllowedError) {
          const view = await businessView(businessId, ctx, { problem: PROBLEMS.seedNotAllowed });
          return sendHtml(ctx, 409, renderAdminBusiness(renderer, view));
        }
        throw err;
      }
      return seeOther(ctx, `${adminPath(businessId)}?ok=${CHANGE_ACTIONS.RESTORE_SEED}`);
    },
  });
}
