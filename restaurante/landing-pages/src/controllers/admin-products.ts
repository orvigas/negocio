import { BUSINESS, isBusinessId, type BusinessId } from '@restaurante/core/shared';
import {
  ProductConflictError,
  ProductNotFoundError,
  ProductValidationError,
  isDetailsType,
  isProductCategory,
  isValidKind,
  type ProductKind,
} from '@restaurante/core/catalog';

import type { ProductView } from '../repositories/product-repository.ts';
import {
  emptyProductFormValues,
  formErrors,
  parseProductForm,
  productFormFieldNames,
  productFormValues,
} from '../services/product-form.ts';
import { adminPath, renderAdminBusiness } from '../views/admin/index.ts';
import {
  renderProductDelete,
  renderProductForm,
  renderProductTypeChoice,
  renderProductsDeleted,
} from '../views/admin/products.ts';
import { createAdminAccess, type AdminRouterContext, type Authenticated } from './admin-access.ts';
import { authorOf, businessPermission, createBusinessView } from './admin-business-view.ts';
import type { AdminDeps } from './admin.ts';

/**
 * Administración HTML de productos (REQ-F-008, RF-6, CA-25 a CA-33). Formularios nativos con
 * POST-redirect-GET, sin JavaScript. Orden en un POST: mismo origen -> sesión (303 al acceso) ->
 * permiso del negocio (403, sin leer el body) -> body y CSRF (403) -> producto (404) ->
 * campos del formulario (400 si están manipulados) -> validación (422) -> versión (409).
 */

type Handler = (ctx: AdminRouterContext) => unknown;

export interface AdminProductsController {
  newPage: Handler;
  create: Handler;
  deletedPage: Handler;
  editPage: Handler;
  update: Handler;
  deletePage: Handler;
  remove: Handler;
  restore: Handler;
  moveUp: Handler;
  moveDown: Handler;
}

const ID_PATTERN = /^[1-9]\d{0,9}$/;
const VERSION_PATTERN = /^[1-9]\d{0,9}$/;
const SMALL_BODY = 4 * 1024;

const PROBLEMS = Object.freeze({
  moveConflict: 'El producto cambió mientras ordenabas la lista: no se movió nada. Revisa el orden actual e inténtalo de nuevo.',
  restoreConflict: 'El producto cambió mientras revisabas la lista: no se recuperó. Inténtalo de nuevo.',
});

export function createAdminProductsController(deps: AdminDeps): AdminProductsController {
  const { config, renderer, now, repository, products, sessions, users, logger } = deps;
  const access = createAdminAccess({ config, sessions, users, renderer, now, logger });
  const businessView = createBusinessView({ config, renderer, repository, products, access });
  const { sendHtml, seeOther } = access;

  function businessFrom(ctx: AdminRouterContext): BusinessId {
    const { business } = ctx.params;
    if (!isBusinessId(business)) ctx.throw(404);
    return business;
  }

  function idFrom(ctx: AdminRouterContext): number {
    const { id } = ctx.params;
    if (typeof id !== 'string' || !ID_PATTERN.test(id)) ctx.throw(404);
    return Number(id);
  }

  const page = (ctx: AdminRouterContext, businessId: BusinessId, handler: (auth: Authenticated) => unknown) =>
    access.page(ctx, { returnTo: adminPath(businessId), permission: businessPermission(businessId) }, handler);

  const post = (ctx: AdminRouterContext, businessId: BusinessId, options: { limit?: number; allowedFields?: readonly string[] } = {}) =>
    access.post(ctx, { returnTo: adminPath(businessId), permission: businessPermission(businessId), ...options });

  /** Producto activo del negocio o 404 (también si es de otro negocio, CA-22). */
  async function activeProduct(ctx: AdminRouterContext, businessId: BusinessId, id: number): Promise<ProductView> {
    let product: ProductView | null = null;
    try {
      product = await products.get(businessId, id);
    } catch (err) {
      if (!(err instanceof ProductNotFoundError)) throw err;
    }
    if (!product || product.deleted) ctx.throw(404);
    return product;
  }

  /** Formulario manipulado: campos que no son del formulario de esta combinación (400). */
  function assertKnownFields(ctx: AdminRouterContext, auth: Authenticated, fields: Map<string, string>, known: readonly string[]): void {
    const allowed = new Set(['_csrf', ...known]);
    if ([...fields.keys()].some((name) => !allowed.has(name))) {
      logger.warn('admin_form_unknown_fields', { path: ctx.path, userId: auth.user.id });
      ctx.throw(400, 'El formulario tiene campos desconocidos.', { code: 'INVALID_FORM' });
    }
  }

  function versionField(fields: Map<string, string>): number | string {
    const raw = fields.get('version') ?? '';
    return VERSION_PATTERN.test(raw) ? Number(raw) : raw;
  }

  async function businessPage(ctx: AdminRouterContext, businessId: BusinessId, auth: Authenticated, status: number, problem: string) {
    sendHtml(ctx, status, renderAdminBusiness(renderer, await businessView(businessId, auth, { problem })));
  }

  async function move(ctx: AdminRouterContext, direction: 'up' | 'down') {
    const businessId = businessFrom(ctx);
    const id = idFrom(ctx);
    const auth = await post(ctx, businessId, { limit: SMALL_BODY, allowedFields: ['version'] });
    if (!auth) return undefined;
    await activeProduct(ctx, businessId, id);
    try {
      await products.move(businessId, id, direction, versionField(auth.fields), authorOf(auth));
    } catch (err) {
      if (err instanceof ProductConflictError || err instanceof ProductValidationError) {
        return businessPage(ctx, businessId, auth, 409, PROBLEMS.moveConflict);
      }
      throw err;
    }
    return seeOther(ctx, `${adminPath(businessId)}?ok=product_moved`);
  }

  return Object.freeze<AdminProductsController>({
    async newPage(ctx: AdminRouterContext) {
      const businessId = businessFrom(ctx);
      return page(ctx, businessId, (auth) => {
        const { categoria, tipo } = ctx.query;
        const category = businessId === BUSINESS.BIRRIA ? (categoria ?? 'platillo') : categoria;
        if (!isProductCategory(category)) ctx.throw(404);
        if (businessId === BUSINESS.BIRRIA && tipo === undefined) {
          return sendHtml(ctx, 200, renderProductTypeChoice(renderer, { ...access.pageContext(auth), businessId }));
        }
        const detailsType = businessId === BUSINESS.BIRRIA ? tipo : null;
        const kind = { business: businessId, category, detailsType };
        if (!isValidKind(kind) || (detailsType !== null && !isDetailsType(detailsType))) ctx.throw(404);
        return sendHtml(
          ctx,
          200,
          renderProductForm(renderer, { ...access.pageContext(auth), businessId, timezone: config.timezone, mode: 'create', kind, values: emptyProductFormValues(kind) }),
        );
      });
    },

    async create(ctx: AdminRouterContext) {
      const businessId = businessFrom(ctx);
      const auth = await post(ctx, businessId);
      if (!auth) return undefined;
      const { fields } = auth;
      const kind = { business: businessId, category: fields.get('category'), detailsType: fields.get('detailsType') ?? null };
      if (!isValidKind(kind)) ctx.throw(400, 'El formulario tiene campos desconocidos.', { code: 'INVALID_FORM' });
      assertKnownFields(ctx, auth, fields, productFormFieldNames(kind, { withAvailable: false }));
      if (fields.get('action') !== 'create') ctx.throw(400, 'Acción desconocida.', { code: 'INVALID_FORM' });

      const parsed = parseProductForm(kind, fields, { withAvailable: false });
      if (parsed.structureError) ctx.throw(400, 'El formulario tiene valores imposibles.', { code: 'INVALID_FORM' });
      try {
        await products.create(businessId, { input: { ...parsed.input, category: kind.category, ...(kind.detailsType ? { detailsType: kind.detailsType } : {}) } }, authorOf(auth));
      } catch (err) {
        if (!(err instanceof ProductValidationError)) throw err;
        return sendHtml(
          ctx,
          422,
          renderProductForm(renderer, {
            ...access.pageContext(auth),
            businessId,
            timezone: config.timezone,
            mode: 'create',
            kind,
            values: parsed.values,
            errors: formErrors(err.fields, parsed.slots),
          }),
        );
      }
      return seeOther(ctx, `${adminPath(businessId)}?ok=product_created`);
    },

    async deletedPage(ctx: AdminRouterContext) {
      const businessId = businessFrom(ctx);
      return page(ctx, businessId, async (auth) => {
        const list = (await products.list(businessId, { includeDeleted: true })).filter((product) => product.deleted);
        sendHtml(ctx, 200, renderProductsDeleted(renderer, { ...access.pageContext(auth), businessId, timezone: config.timezone, products: list }));
      });
    },

    async editPage(ctx: AdminRouterContext) {
      const businessId = businessFrom(ctx);
      const id = idFrom(ctx);
      return page(ctx, businessId, async (auth) => {
        const product = await activeProduct(ctx, businessId, id);
        sendHtml(
          ctx,
          200,
          renderProductForm(renderer, {
            ...access.pageContext(auth),
            businessId,
            timezone: config.timezone,
            mode: 'edit',
            kind: product,
            product,
            values: productFormValues(product, { withAvailable: true }),
          }),
        );
      });
    },

    async update(ctx: AdminRouterContext) {
      const businessId = businessFrom(ctx);
      const id = idFrom(ctx);
      const auth = await post(ctx, businessId);
      if (!auth) return undefined;
      const { fields } = auth;
      const product = await activeProduct(ctx, businessId, id);
      const kind: ProductKind = product;
      assertKnownFields(ctx, auth, fields, productFormFieldNames(kind, { withAvailable: true }));
      const action = fields.get('action');
      if (action !== 'update' && action !== 'overwrite_after_conflict') ctx.throw(400, 'Acción desconocida.', { code: 'INVALID_FORM' });

      const parsed = parseProductForm(kind, fields, { withAvailable: true });
      if (parsed.structureError) ctx.throw(400, 'El formulario tiene valores imposibles.', { code: 'INVALID_FORM' });
      const view = { ...access.pageContext(auth), businessId, timezone: config.timezone, mode: 'edit' as const, kind, product, values: parsed.values };
      try {
        await products.update(businessId, id, { input: parsed.input, expectedVersion: versionField(fields), action }, authorOf(auth));
      } catch (err) {
        if (err instanceof ProductValidationError) {
          return sendHtml(ctx, 422, renderProductForm(renderer, { ...view, errors: formErrors(err.fields, parsed.slots) }));
        }
        if (err instanceof ProductConflictError) {
          logger.info('product_conflict', { business: businessId, productId: id, action });
          return sendHtml(ctx, 409, renderProductForm(renderer, { ...view, conflict: err.current }));
        }
        throw err;
      }
      return seeOther(ctx, `${adminPath(businessId)}?ok=${action === 'update' ? 'product_saved' : 'product_overwritten'}`);
    },

    async deletePage(ctx: AdminRouterContext) {
      const businessId = businessFrom(ctx);
      const id = idFrom(ctx);
      return page(ctx, businessId, async (auth) => {
        const product = await activeProduct(ctx, businessId, id);
        sendHtml(ctx, 200, renderProductDelete(renderer, { ...access.pageContext(auth), businessId, timezone: config.timezone, product }));
      });
    },

    async remove(ctx: AdminRouterContext) {
      const businessId = businessFrom(ctx);
      const id = idFrom(ctx);
      const auth = await post(ctx, businessId, { limit: SMALL_BODY, allowedFields: ['version', 'action'] });
      if (!auth) return undefined;
      const product = await activeProduct(ctx, businessId, id);
      if (auth.fields.get('action') !== 'delete') ctx.throw(400, 'Acción desconocida.', { code: 'INVALID_FORM' });
      try {
        await products.remove(businessId, id, versionField(auth.fields), authorOf(auth));
      } catch (err) {
        if (err instanceof ProductConflictError || err instanceof ProductValidationError) {
          const current = err instanceof ProductConflictError ? err.current : { productId: id, version: product.version, updatedAt: product.updatedAt, updatedBy: product.updatedBy?.actorName ?? null };
          return sendHtml(
            ctx,
            409,
            renderProductDelete(renderer, { ...access.pageContext(auth), businessId, timezone: config.timezone, product: await activeProduct(ctx, businessId, id), conflict: current }),
          );
        }
        throw err;
      }
      return seeOther(ctx, `${adminPath(businessId)}?ok=product_deleted`);
    },

    async restore(ctx: AdminRouterContext) {
      const businessId = businessFrom(ctx);
      const id = idFrom(ctx);
      const auth = await post(ctx, businessId, { limit: SMALL_BODY, allowedFields: ['version'] });
      if (!auth) return undefined;
      try {
        await products.restore(businessId, id, versionField(auth.fields), authorOf(auth));
      } catch (err) {
        if (err instanceof ProductNotFoundError) ctx.throw(404);
        if (err instanceof ProductValidationError || err instanceof ProductConflictError) {
          const problem = err instanceof ProductValidationError ? (Object.values(err.fields)[0] ?? PROBLEMS.restoreConflict) : PROBLEMS.restoreConflict;
          const list = (await products.list(businessId, { includeDeleted: true })).filter((product) => product.deleted);
          return sendHtml(
            ctx,
            err instanceof ProductConflictError ? 409 : 422,
            renderProductsDeleted(renderer, { ...access.pageContext(auth), businessId, timezone: config.timezone, products: list, problem }),
          );
        }
        throw err;
      }
      return seeOther(ctx, `${adminPath(businessId)}?ok=product_restored`);
    },

    moveUp: (ctx) => move(ctx, 'up'),
    moveDown: (ctx) => move(ctx, 'down'),
  });
}

