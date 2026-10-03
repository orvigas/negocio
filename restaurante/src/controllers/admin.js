import { BUSINESS_IDS } from '../config/businesses.js';
import {
  LOGIN_PATH,
  SESSION_COOKIE,
  assertCsrfToken,
  assertSameOrigin,
  createSessionGuard,
  sessionCookieOptions,
} from '../middleware/admin-guard.js';
import {
  CHANGE_ACTIONS,
  MenuConflictError,
  MenuDamagedError,
  PreviousUnavailableError,
  SeedRestoreNotAllowedError,
} from '../repositories/menu-repository.js';
import { parseAdminForm } from '../services/admin-form.js';
import { getActiveBusinessId } from '../services/business-schedule.js';
import { AUTHOR_MAX_LENGTH, textLength } from '../services/menu-schema.js';
import { readFormBody } from '../utils/form-body.js';
import {
  SUCCESS_MESSAGES,
  adminPath,
  renderAdminBusiness,
  renderAdminConfirmRestore,
  renderAdminLogin,
} from '../views/admin/index.js';

/**
 * Controlador de la administración de menús (REQ-F-001, RF-5 a RF-8).
 * Formularios HTML nativos con POST-redirect-GET; sin JavaScript (P-8).
 */

const LOGIN_BODY_LIMIT = 4 * 1024;
const RESTORE_BODY_LIMIT = 4 * 1024;
const SAVE_ACTIONS = Object.freeze([CHANGE_ACTIONS.SAVE, CHANGE_ACTIONS.OVERWRITE_AFTER_CONFLICT]);

const DEFAULT_NEXT = adminPath(BUSINESS_IDS[0]);
const ALLOWED_NEXT = new Set(BUSINESS_IDS.map(adminPath));
/** Solo se vuelve a páginas de administración conocidas (sin redirecciones abiertas). */
const sanitizeNext = (value) => (typeof value === 'string' && ALLOWED_NEXT.has(value) ? value : DEFAULT_NEXT);

const PROBLEMS = Object.freeze({
  damagedSave: 'Los datos guardados están dañados: no se guardó nada. Elige una opción de recuperación.',
  previousUnavailable: 'No hay una versión anterior válida para restaurar. No se cambió nada.',
  seedNotAllowed: 'La semilla original solo se puede restaurar cuando los datos están dañados. No se cambió nada.',
});

function validateAuthor(raw) {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (value === '') return { value, error: 'Escribe el nombre de quien hace el cambio.' };
  if (textLength(value) > AUTHOR_MAX_LENGTH) return { value, error: `Máximo ${AUTHOR_MAX_LENGTH} caracteres.` };
  return { value, error: null };
}

function sendHtml(ctx, status, html) {
  ctx.status = status;
  ctx.type = 'html';
  ctx.body = html.toString();
}

function seeOther(ctx, url) {
  ctx.status = 303;
  ctx.redirect(url);
}

/**
 * @param {{
 *   config: object,
 *   renderer: object,
 *   now: () => Date,
 *   repository: object,
 *   sessions: object,
 *   throttle: object,
 *   authenticator: { verify: (user: string, password: string) => Promise<boolean> },
 *   imageExists: (src: string) => Promise<boolean>,
 *   logger: object,
 * }} deps
 */
export function createAdminController({ config, renderer, now, repository, sessions, throttle, authenticator, imageExists, logger }) {
  if (typeof now !== 'function') throw new TypeError('createAdminController requiere el reloj (now)');
  const requireSession = createSessionGuard({ sessions, config });
  const timezone = config.timezone;
  /** Negocio activo del día: su favicon se muestra en todas las páginas de admin (REQ-F-002, RF-7). */
  const faviconBusinessId = () => getActiveBusinessId({ now: now(), timeZone: timezone });

  /** Resuelve :business o responde 404. */
  function businessFrom(ctx) {
    const { business } = ctx.params;
    if (!BUSINESS_IDS.includes(business)) ctx.throw(404);
    return business;
  }

  /** Sesión + body + CSRF para una acción POST. Devuelve los campos o null si redirigió. */
  async function authorizePost(ctx, { returnTo, limit } = {}) {
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

  async function businessView(businessId, ctx, extra = {}) {
    const edit = await repository.getForEdit(businessId);
    return {
      businessId,
      timezone,
      csrfToken: ctx.state.adminSession.csrfToken,
      document: edit.document,
      version: edit.version,
      damaged: edit.damaged,
      lastChange: await repository.getLastChange(businessId),
      faviconBusinessId: faviconBusinessId(),
      ...extra,
    };
  }

  return Object.freeze({
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
      sessions.destroy(ctx.cookies.get(SESSION_COOKIE));
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
          const success = Object.hasOwn(SUCCESS_MESSAGES, ctx.query.ok) ? SUCCESS_MESSAGES[ctx.query.ok] : undefined;
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

      const respond = async (status, extra) => {
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
