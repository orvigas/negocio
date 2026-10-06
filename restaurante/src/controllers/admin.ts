import { BUSINESS_IDS, isBusinessId, type BusinessId } from '../config/businesses.ts';
import type { Config } from '../config/env.ts';
import { LOGIN_PATH, SESSION_COOKIE, assertSameOrigin, sessionCookieOptions } from '../middleware/admin-guard.ts';
import {
  CHANGE_ACTIONS,
  MenuConflictError,
  MenuDamagedError,
  PreviousUnavailableError,
  SeedRestoreNotAllowedError,
  type MenuAuthor,
  type MenuRepository,
} from '../repositories/menu-repository.ts';
import type { UserRecord, UserRepository } from '../repositories/user-repository.ts';
import type { PasswordHashParams, UserAuthenticator } from '../services/admin-auth.ts';
import { parseAdminForm, type ImageExists } from '../services/admin-form.ts';
import { canEditBusiness } from '../services/authorization.ts';
import type { LoginThrottle } from '../services/login-throttle.ts';
import type { SessionStore } from '../services/session-store.ts';
import { readFormBody } from '../utils/form-body.ts';
import type { Logger } from '../utils/logger.ts';
import {
  ACCOUNT_PATH,
  ADMIN_HOME_PATH,
  SUCCESS_MESSAGES,
  USERS_PATH,
  adminPath,
  businessName,
  renderAdminBusiness,
  renderAdminConfirmRestore,
  renderAdminHome,
  renderAdminLogin,
  type AdminBusinessOptions,
} from '../views/admin/index.ts';
import type { Renderer } from '../views/render.ts';
import { createAdminAccess, type AdminRouterContext, type Authenticated, type Permission } from './admin-access.ts';

export type { AdminRouterContext } from './admin-access.ts';
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
  users: UserRepository;
  authenticator: UserAuthenticator<UserRecord>;
  /** Costo de scrypt para las contraseñas nuevas (las pruebas lo bajan). */
  hashParams: PasswordHashParams;
  imageExists: ImageExists;
  logger: Logger;
}

/**
 * Controlador del acceso, del inicio y de la administración de menús (REQ-F-001, RF-5 a RF-8;
 * REQ-F-007, R-6, R-7 y R-10). Formularios HTML nativos con POST-redirect-GET; sin JavaScript.
 *
 * Cada negocio solo lo ve y edita quien lo tiene permitido (403 si no). El autor de cada cambio
 * es el usuario de la sesión: su nombre visible y su identificador (D-11).
 */

const LOGIN_BODY_LIMIT = 4 * 1024;
const RESTORE_BODY_LIMIT = 4 * 1024;
const SAVE_ACTIONS: readonly (string | undefined)[] = Object.freeze([CHANGE_ACTIONS.SAVE, CHANGE_ACTIONS.OVERWRITE_AFTER_CONFLICT]);

/** Solo se vuelve a páginas de administración conocidas (sin redirecciones abiertas). */
const ALLOWED_NEXT = new Set([ADMIN_HOME_PATH, USERS_PATH, ACCOUNT_PATH, ...BUSINESS_IDS.map(adminPath)]);
const sanitizeNext = (value: unknown): string => (typeof value === 'string' && ALLOWED_NEXT.has(value) ? value : ADMIN_HOME_PATH);

const PROBLEMS = Object.freeze({
  damagedSave: 'Los datos guardados están dañados: no se guardó nada. Elige una opción de recuperación.',
  previousUnavailable: 'No hay una versión anterior válida para restaurar. No se cambió nada.',
  seedNotAllowed: 'La semilla original solo se puede restaurar cuando los datos están dañados. No se cambió nada.',
});

/** Permiso sobre un negocio (R-7). */
const businessPermission =
  (businessId: BusinessId): Permission =>
  (user) =>
    canEditBusiness(user, businessId) ? null : `No tienes permiso para administrar ${businessName(businessId)}.`;

/** Autor verificado de un cambio (D-11). */
const authorOf = ({ user }: Authenticated): MenuAuthor => ({ id: user.id, name: user.displayName });

export function createAdminController({
  config,
  renderer,
  now,
  repository,
  sessions,
  throttle,
  users,
  authenticator,
  imageExists,
  logger,
}: AdminDeps): AdminController {
  if (typeof now !== 'function') throw new TypeError('createAdminController requiere el reloj (now)');
  const access = createAdminAccess({ config, sessions, users, renderer, now, logger });
  const { sendHtml, seeOther, faviconBusinessId } = access;

  /** Resuelve :business o responde 404. */
  function businessFrom(ctx: AdminRouterContext): BusinessId {
    const { business } = ctx.params;
    if (!isBusinessId(business)) ctx.throw(404);
    return business;
  }

  async function businessView(
    businessId: BusinessId,
    auth: Authenticated,
    extra: Partial<AdminBusinessOptions> = {},
  ): Promise<AdminBusinessOptions> {
    const edit = await repository.getForEdit(businessId);
    return {
      ...access.pageContext(auth),
      businessId,
      timezone: config.timezone,
      document: edit.document,
      version: edit.version,
      damaged: edit.damaged,
      lastChange: await repository.getLastChange(businessId),
      ...extra,
    };
  }

  /** POST sobre un negocio: sesión, permiso del negocio, body y CSRF. */
  const businessPost = (ctx: AdminRouterContext, businessId: BusinessId, limit?: number) =>
    access.post(ctx, { returnTo: adminPath(businessId), permission: businessPermission(businessId), ...(limit ? { limit } : {}) });

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

      // Cuenta inexistente, contraseña incorrecta o cuenta desactivada: misma respuesta (R-6).
      const user = await authenticator.authenticate(fields.get('username') ?? '', fields.get('password') ?? '');
      if (!user) {
        const locked = throttle.recordFailure(origin);
        logger.warn('admin_login_failed', { ip: origin, locked });
        const error = locked ? 'locked' : 'invalid';
        return sendHtml(ctx, locked ? 429 : 401, renderAdminLogin(renderer, { next, error, faviconBusinessId: faviconBusinessId() }));
      }

      throttle.recordSuccess(origin);
      const previous = ctx.cookies.get(SESSION_COOKIE);
      if (previous) sessions.destroy(previous);
      const session = sessions.create({ userId: user.id, sessionVersion: user.sessionVersion });
      ctx.cookies.set(SESSION_COOKIE, session.id, sessionCookieOptions(config));
      await users.recordLogin(user.id, now());
      logger.info('admin_login_succeeded', { ip: origin, userId: user.id });
      return seeOther(ctx, next);
    },

    async logout(ctx) {
      const auth = await access.post(ctx, { limit: LOGIN_BODY_LIMIT });
      if (!auth) return undefined;
      sessions.destroy(auth.session.id);
      ctx.cookies.set(SESSION_COOKIE, null, sessionCookieOptions(config));
      logger.info('admin_logout', { ip: ctx.ip, userId: auth.user.id });
      return seeOther(ctx, LOGIN_PATH);
    },

    index(ctx) {
      return access.page(ctx, { returnTo: ADMIN_HOME_PATH }, (auth) => sendHtml(ctx, 200, renderAdminHome(renderer, access.pageContext(auth))));
    },

    async businessPage(ctx) {
      const businessId = businessFrom(ctx);
      return access.page(ctx, { returnTo: adminPath(businessId), permission: businessPermission(businessId) }, async (auth) => {
        const { ok } = ctx.query;
        // `ok` es una clave propia de SUCCESS_MESSAGES: comprobado con Object.hasOwn.
        const success =
          typeof ok === 'string' && Object.hasOwn(SUCCESS_MESSAGES, ok) ? SUCCESS_MESSAGES[ok as keyof typeof SUCCESS_MESSAGES] : undefined;
        sendHtml(ctx, 200, renderAdminBusiness(renderer, await businessView(businessId, auth, { success })));
      });
    },

    async save(ctx) {
      const businessId = businessFrom(ctx);
      const auth = await businessPost(ctx, businessId);
      if (!auth) return undefined;
      const { fields } = auth;

      const action = fields.get('action');
      if (!SAVE_ACTIONS.includes(action)) ctx.throw(400, 'Acción desconocida.', { code: 'INVALID_FORM' });
      const expectedVersion = fields.get('expectedVersion') ?? '';

      const view = await businessView(businessId, auth);
      if (view.damaged) {
        return sendHtml(ctx, 409, renderAdminBusiness(renderer, { ...view, problem: PROBLEMS.damagedSave }));
      }

      const parsed = await parseAdminForm(businessId, fields, view.document.data, { imageExists });
      if (parsed.structureError) {
        logger.warn('admin_form_structure_rejected', { business: businessId });
        ctx.throw(400, 'La estructura del menú no se puede modificar.', { code: 'STRUCTURE_MODIFIED' });
      }

      const form = { values: parsed.values, errors: parsed.errors };
      if (Object.keys(parsed.errors).length > 0) {
        return sendHtml(ctx, 422, renderAdminBusiness(renderer, { ...view, version: expectedVersion, form }));
      }

      try {
        await repository.save(businessId, { data: parsed.data, expectedVersion, author: authorOf(auth), action });
      } catch (err) {
        if (err instanceof MenuConflictError) {
          logger.info('menu_conflict', { business: businessId, action });
          return sendHtml(ctx, 409, renderAdminBusiness(renderer, { ...view, form, conflict: err.current }));
        }
        if (err instanceof MenuDamagedError) {
          const damagedView = await businessView(businessId, auth, { problem: PROBLEMS.damagedSave });
          return sendHtml(ctx, 409, renderAdminBusiness(renderer, damagedView));
        }
        throw err;
      }
      return seeOther(ctx, `${adminPath(businessId)}?ok=${action}`);
    },

    async restorePreviousPage(ctx) {
      const businessId = businessFrom(ctx);
      return access.page(ctx, { returnTo: adminPath(businessId), permission: businessPermission(businessId) }, async (auth) => {
        const view = await businessView(businessId, auth);
        // Con datos dañados, las opciones de recuperación están en la página del negocio.
        if (view.damaged) return seeOther(ctx, adminPath(businessId));
        return sendHtml(ctx, 200, renderAdminConfirmRestore(renderer, view));
      });
    },

    async restorePrevious(ctx) {
      const businessId = businessFrom(ctx);
      const auth = await businessPost(ctx, businessId, RESTORE_BODY_LIMIT);
      if (!auth) return undefined;
      try {
        await repository.restorePrevious(businessId, { author: authorOf(auth) });
      } catch (err) {
        if (err instanceof PreviousUnavailableError) {
          const view = await businessView(businessId, auth, { problem: PROBLEMS.previousUnavailable });
          if (view.damaged) return sendHtml(ctx, 409, renderAdminBusiness(renderer, view));
          return sendHtml(ctx, 409, renderAdminConfirmRestore(renderer, view));
        }
        throw err;
      }
      return seeOther(ctx, `${adminPath(businessId)}?ok=${CHANGE_ACTIONS.RESTORE_PREVIOUS}`);
    },

    async restoreSeed(ctx) {
      const businessId = businessFrom(ctx);
      const auth = await businessPost(ctx, businessId, RESTORE_BODY_LIMIT);
      if (!auth) return undefined;
      try {
        await repository.restoreSeed(businessId, { author: authorOf(auth) });
      } catch (err) {
        if (err instanceof SeedRestoreNotAllowedError) {
          const view = await businessView(businessId, auth, { problem: PROBLEMS.seedNotAllowed });
          return sendHtml(ctx, 409, renderAdminBusiness(renderer, view));
        }
        throw err;
      }
      return seeOther(ctx, `${adminPath(businessId)}?ok=${CHANGE_ACTIONS.RESTORE_SEED}`);
    },
  });
}
