import { BUSINESS_IDS, isBusinessId, type BusinessId, type Logger } from '@restaurante/core/shared';
import type {
  LoginThrottle,
  PasswordHashParams,
  SessionStore,
  UserAuthenticator,
  UserRecord,
  UserRepository,
} from '@restaurante/core/identity';
import {
  PAGE_ACTIONS,
  PageConflictError,
  PageNoPreviousError,
  type ImageExists,
  type PageRepository,
  type PageSaveAction,
  type ProductRepository,
} from '@restaurante/core/catalog';
import { readFormBody, type Renderer } from '@restaurante/web';
import { type BotControl, type BotProvider } from '@restaurante/core/bot-control';

import type { Config } from '../config/env.ts';
import { LOGIN_PATH, SESSION_COOKIE, assertSameOrigin, sessionCookieOptions } from '../middleware/admin-guard.ts';
import { parseAdminForm } from '../services/admin-form.ts';
import type { LandingPage } from '../services/landing-page.ts';
import {
  ACCOUNT_PATH,
  BOT_ADMIN_PATH,
  ADMIN_HOME_PATH,
  SUCCESS_MESSAGES,
  USERS_PATH,
  adminPath,
  renderAdminBusiness,
  renderAdminConfirmRestore,
  renderAdminHome,
  renderAdminLogin,
} from '../views/admin/index.ts';
import type { LandingProducts } from '../services/landing-products.ts';
import { createAdminAccess, type AdminRouterContext } from './admin-access.ts';
import { authorOf, businessPermission, createBusinessView } from './admin-business-view.ts';

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

/** Campos de cada formulario de página (lo demás es una estructura manipulada). */
const RESTORE_FIELDS: readonly string[] = Object.freeze(['expectedVersion']);
const SEED_FIELDS: readonly string[] = Object.freeze([]);

export interface AdminDeps {
  config: Config;
  renderer: Renderer;
  now: () => Date;
  /** Datos de página en MySQL (REQ-F-044): solo lectura con ADMIN_NEW_URL; sin ella, se escriben aquí (D-6). */
  pages: PageRepository;
  /** Caché de la página de las landings (REQ-F-044): se invalida tras cada escritura de /admin. */
  landingPage: Pick<LandingPage, 'invalidate' | 'confirmFresh'>;
  /** Productos (REQ-F-008). */
  products: ProductRepository;
  /** Caché de las landings (REQ-F-038): confirma si la landing ya tiene los datos guardados. */
  landingProducts: Pick<LandingProducts, 'confirmFresh'>;
  sessions: SessionStore;
  throttle: LoginThrottle;
  users: UserRepository;
  authenticator: UserAuthenticator<UserRecord>;
  /** Costo de scrypt para las contraseñas nuevas (las pruebas lo bajan). */
  hashParams: PasswordHashParams;
  imageExists: ImageExists;
  logger: Logger;
  /** Protección del bot (REQ-F-025); sin ella, la página "Bot" responde 503. */
  botControl?: BotControl | undefined;
  /** Proveedor del bot configurado (el bot vive en la api), o undefined si está desactivado. */
  botProvider?: BotProvider | undefined;
}

/**
 * Controlador del acceso, del inicio y de la administración de menús (REQ-F-001, RF-5 a RF-8;
 * REQ-F-007, R-6, R-7 y R-10). Formularios HTML nativos con POST-redirect-GET; sin JavaScript.
 *
 * Cada negocio solo lo ve y edita quien lo tiene permitido (403 si no). El autor de cada cambio
 * es el usuario de la sesión: su nombre visible y su identificador (D-11).
 *
 * Datos de página (REQ-F-044): viven en MySQL (`pages`). En MySQL no hay estado "dañado": "restaurar
 * semilla" responde siempre "no permitido" (D-10) y restaurar exige la versión confirmada. Con
 * ADMIN_NEW_URL (RF-10, CA-13) la página se consulta sin formulario y cada POST pasa sesión, permiso,
 * cuerpo y CSRF y responde 410 sin escribir.
 */

const LOGIN_BODY_LIMIT = 4 * 1024;
const RESTORE_BODY_LIMIT = 4 * 1024;
const SAVE_ACTIONS: readonly (string | undefined)[] = Object.freeze([PAGE_ACTIONS.SAVE, PAGE_ACTIONS.OVERWRITE_AFTER_CONFLICT]);

/** Solo se vuelve a páginas de administración conocidas (sin redirecciones abiertas). */
const ALLOWED_NEXT = new Set([ADMIN_HOME_PATH, USERS_PATH, ACCOUNT_PATH, BOT_ADMIN_PATH, ...BUSINESS_IDS.map(adminPath)]);
const sanitizeNext = (value: unknown): string => (typeof value === 'string' && ALLOWED_NEXT.has(value) ? value : ADMIN_HOME_PATH);

const PROBLEMS = Object.freeze({
  previousUnavailable: 'No hay una versión anterior válida para restaurar. No se cambió nada.',
  seedNotAllowed: 'La semilla original solo se puede restaurar cuando los datos están dañados. No se cambió nada.',
  restoreConflict: 'La página cambió mientras la revisabas: no se restauró nada. Revisa la versión vigente antes de volver a intentarlo.',
  moved: 'No se guardó nada: el hero, el texto destacado y las promociones se editan en el admin nuevo.',
});

export function createAdminController({
  config,
  renderer,
  now,
  pages,
  landingPage,
  products,
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

  const businessView = createBusinessView({ config, renderer, pages, products, access });

  /** POST sobre un negocio: sesión, permiso del negocio, body y CSRF. */
  const businessPost = (ctx: AdminRouterContext, businessId: BusinessId, limit?: number, allowedFields?: readonly string[]) =>
    access.post(ctx, { returnTo: adminPath(businessId), permission: businessPermission(businessId), ...(limit ? { limit } : {}), ...(allowedFields ? { allowedFields } : {}) });

  /** Tras escribir en MySQL, la landing espera la página nueva; `pending` si la API no la confirma. */
  async function refreshLanding(businessId: BusinessId): Promise<boolean> {
    landingPage.invalidate(businessId);
    return landingPage.confirmFresh(businessId);
  }

  const controller: AdminController = {
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
      const parsed = await parseAdminForm(businessId, fields, view.page, { imageExists });
      if (parsed.structureError) {
        logger.warn('admin_form_structure_rejected', { business: businessId });
        ctx.throw(400, 'La estructura del menú no se puede modificar.', { code: 'STRUCTURE_MODIFIED' });
      }

      const form = { values: parsed.values, errors: parsed.errors };
      if (Object.keys(parsed.errors).length > 0) {
        return sendHtml(ctx, 422, renderAdminBusiness(renderer, { ...view, version: expectedVersion, form }));
      }

      try {
        // SAVE_ACTIONS solo admite las dos acciones de guardado (comprobado arriba).
        await pages.save(businessId, { data: parsed.data, expectedVersion, author: authorOf(auth), action: action as PageSaveAction });
      } catch (err) {
        if (err instanceof PageConflictError) {
          logger.info('menu_conflict', { business: businessId, action });
          return sendHtml(ctx, 409, renderAdminBusiness(renderer, { ...view, form, conflict: err.current }));
        }
        throw err;
      }
      const fresh = await refreshLanding(businessId);
      return seeOther(ctx, `${adminPath(businessId)}?ok=${action === PAGE_ACTIONS.SAVE && !fresh ? 'save_pending' : String(action)}`);
    },

    async restorePreviousPage(ctx) {
      const businessId = businessFrom(ctx);
      return access.page(ctx, { returnTo: adminPath(businessId), permission: businessPermission(businessId) }, async (auth) => {
        const view = await businessView(businessId, auth);
        return sendHtml(ctx, 200, renderAdminConfirmRestore(renderer, view));
      });
    },

    async restorePrevious(ctx) {
      const businessId = businessFrom(ctx);
      const auth = await businessPost(ctx, businessId, RESTORE_BODY_LIMIT, RESTORE_FIELDS);
      if (!auth) return undefined;
      try {
        await pages.restorePrevious(businessId, { expectedVersion: auth.fields.get('expectedVersion') ?? '', author: authorOf(auth) });
      } catch (err) {
        if (err instanceof PageNoPreviousError) {
          const view = await businessView(businessId, auth, { problem: PROBLEMS.previousUnavailable });
          return sendHtml(ctx, 409, renderAdminConfirmRestore(renderer, view));
        }
        if (err instanceof PageConflictError) {
          logger.info('menu_conflict', { business: businessId, action: PAGE_ACTIONS.RESTORE_PREVIOUS });
          const view = await businessView(businessId, auth, { problem: PROBLEMS.restoreConflict });
          return sendHtml(ctx, 409, renderAdminBusiness(renderer, view));
        }
        throw err;
      }
      await refreshLanding(businessId);
      return seeOther(ctx, `${adminPath(businessId)}?ok=${PAGE_ACTIONS.RESTORE_PREVIOUS}`);
    },

    async restoreSeed(ctx) {
      const businessId = businessFrom(ctx);
      const auth = await businessPost(ctx, businessId, RESTORE_BODY_LIMIT, SEED_FIELDS);
      if (!auth) return undefined;
      // En MySQL no existe el estado "dañado" (D-10): restaurar la semilla nunca está permitido.
      const view = await businessView(businessId, auth, { problem: PROBLEMS.seedNotAllowed });
      return sendHtml(ctx, 409, renderAdminBusiness(renderer, view));
    },
  };

  // Solo lectura (REQ-F-044, RF-10 y CA-13): con el admin nuevo activo, la página se edita allí. El GET
  // muestra lo vigente en MySQL sin formulario; cada POST: sesión -> permiso -> cuerpo -> CSRF -> 410
  // con la misma página y el aviso, sin validar ni escribir nada.
  const movedTo = config.adminNewUrl;
  if (movedTo === undefined) return Object.freeze(controller);
  const moved =
    (action: string, allowedFields?: readonly string[]): AdminHandler =>
    async (ctx) => {
      const businessId = businessFrom(ctx);
      const auth = await businessPost(ctx, businessId, allowedFields ? RESTORE_BODY_LIMIT : undefined, allowedFields);
      if (!auth) return undefined;
      logger.info('admin_page_moved', { business: businessId, action, userId: auth.user.id });
      return sendHtml(ctx, 410, renderAdminBusiness(renderer, await businessView(businessId, auth, { problem: PROBLEMS.moved })));
    };
  return Object.freeze<AdminController>({
    ...controller,
    save: moved('save'),
    restorePreviousPage(ctx) {
      const businessId = businessFrom(ctx);
      return access.page(ctx, { returnTo: adminPath(businessId), permission: businessPermission(businessId) }, () => seeOther(ctx, adminPath(businessId)));
    },
    restorePrevious: moved(PAGE_ACTIONS.RESTORE_PREVIOUS, RESTORE_FIELDS),
    restoreSeed: moved(PAGE_ACTIONS.RESTORE_SEED, SEED_FIELDS),
  });
}
