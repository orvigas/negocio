import type { Context } from 'koa';

import {
  PAGE_CONFLICT_CODE,
  PAGE_NO_PREVIOUS_CODE,
  pageRestoreRequestSchema,
  pageSaveRequestSchema,
  pageStateResponseSchema,
  pageWriteResponseSchema,
  type AdminPage,
  type Freshness,
} from '@restaurante/contracts';
import {
  PAGE_ACTIONS,
  PageConflictError,
  PageNoPreviousError,
  PageUnavailableError,
  PageValidationError,
  pageFormFields,
  pageFormValues,
  parsePageForm,
  type PageAuthor,
  type PageRepository,
  type PageState,
} from '@restaurante/core/catalog';
import type { BusinessId, Logger } from '@restaurante/core/shared';

import { ApiHttpError, pageUnavailable } from '../errors.ts';
import type { LandingNotifier } from '../notifier.ts';
import type { AdminAccess, AdminAuth } from './access.ts';
import { createResponder, validationFailed } from './responses.ts';

/**
 * Datos de página en `/api/v1/admin/:negocio/pagina` (REQ-F-044, RF-6 a RF-9). Orden: sesión (401) ->
 * negocio (404) -> permiso (403) -> CSRF (403) -> disponibilidad (503) -> cuerpo (422) -> versión
 * (409). `inventory-manager` envía lo escrito como texto: las reglas son las de `/admin` (core). El
 * autor sale siempre de la sesión. `expectedVersion` hace seguro repetir una escritura sin confirmar.
 */

type RouteContext = Context & { params: Record<string, string> };
type Handler = (ctx: RouteContext) => Promise<void>;

export interface PageRoutes {
  get: Handler;
  save: Handler;
  restore: Handler;
}

/** Cuerpo JSON de la página: pocos textos cortos. */
export const PAGE_BODY_LIMIT = 64 * 1024;
const SAVE_FIELDS: readonly string[] = Object.freeze(['expectedVersion', 'overwrite', 'fields']);
const RESTORE_FIELDS: readonly string[] = Object.freeze(['expectedVersion']);
const STRUCTURE_ERROR = 'El formulario no coincide con los campos de la página. Recarga la página.';

const authorOf = ({ user }: AdminAuth): PageAuthor => ({ id: user.id, name: user.displayName });

export function createPageRoutes({ access, pages, notifier, logger }: { access: AdminAccess; pages: PageRepository; notifier: LandingNotifier; logger: Logger }): PageRoutes {
  const { send, closedBody } = createResponder(logger);

  const dto = (business: BusinessId, state: PageState): AdminPage => ({
    version: state.version,
    updatedAt: state.updatedAt,
    updatedBy: state.updatedBy,
    hasPrevious: state.hasPrevious,
    values: pageFormValues(business, state.data),
  });

  /** Confirmada solo si la landing lo confirma; si no, llega como mucho en 60 s (CA-8). */
  const freshness = (business: BusinessId): Promise<Freshness> => notifier.notify(business);

  /** Errores de dominio -> 503, 409 y 422. El resto sigue al manejador central. */
  async function run(ctx: RouteContext, task: () => Promise<void>): Promise<void> {
    try {
      await task();
    } catch (err) {
      if (err instanceof PageUnavailableError) throw pageUnavailable();
      if (err instanceof PageNoPreviousError) throw new ApiHttpError(409, PAGE_NO_PREVIOUS_CODE, 'No hay una versión anterior que restaurar: no se cambió nada.');
      if (err instanceof PageValidationError) return validationFailed(ctx, Object.fromEntries(err.issues.map(({ path, message }) => [path, message])));
      if (err instanceof PageConflictError) {
        logger.info('page_conflict', { business: ctx.params.business });
        ctx.status = 409;
        ctx.body = { error: { code: PAGE_CONFLICT_CODE, message: 'La página cambió mientras la editabas: no se guardó nada.', currentPage: err.current } };
        return;
      }
      throw err;
    }
  }

  return Object.freeze<PageRoutes>({
    async get(ctx) {
      const { businessId } = await access.business(ctx, { write: false });
      await run(ctx, async () => {
        const state = await pages.get(businessId);
        send(ctx, pageStateResponseSchema, { page: dto(businessId, state), fields: pageFormFields(businessId) });
      });
    },

    async save(ctx) {
      const auth = await access.business(ctx, { write: true });
      const { businessId } = auth;
      await run(ctx, async () => {
        const state = await pages.get(businessId);
        const raw = await closedBody(ctx, SAVE_FIELDS, PAGE_BODY_LIMIT);
        if (!raw) return;
        const body = pageSaveRequestSchema.safeParse(raw);
        if (!body.success) return validationFailed(ctx, { '': STRUCTURE_ERROR });
        const form = await parsePageForm(businessId, new Map(Object.entries(body.data.fields)), state.data);
        if (form.structureError) return validationFailed(ctx, { '': STRUCTURE_ERROR });
        if (Object.keys(form.errors).length > 0) return validationFailed(ctx, form.errors);
        const saved = await pages.save(businessId, {
          data: form.data,
          expectedVersion: body.data.expectedVersion,
          author: authorOf(auth),
          action: body.data.overwrite ? PAGE_ACTIONS.OVERWRITE_AFTER_CONFLICT : PAGE_ACTIONS.SAVE,
        });
        return send(ctx, pageWriteResponseSchema, { page: dto(businessId, saved), meta: { freshness: await freshness(businessId) } });
      });
    },

    async restore(ctx) {
      const auth = await access.business(ctx, { write: true });
      const { businessId } = auth;
      await run(ctx, async () => {
        await pages.get(businessId);
        const raw = await closedBody(ctx, RESTORE_FIELDS, PAGE_BODY_LIMIT);
        if (!raw) return;
        const body = pageRestoreRequestSchema.safeParse(raw);
        if (!body.success) return validationFailed(ctx, { expectedVersion: 'Falta la versión.' });
        const restored = await pages.restorePrevious(businessId, { expectedVersion: body.data.expectedVersion, author: authorOf(auth) });
        return send(ctx, pageWriteResponseSchema, { page: dto(businessId, restored), meta: { freshness: await freshness(businessId) } });
      });
    },
  });
}
