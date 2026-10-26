import { allowedBusinesses } from '../services/authorization.ts';
import { isProductCategory, pesos, toInput } from '../services/product-schema.ts';
import {
  ProductConflictError,
  ProductNotFoundError,
  ProductValidationError,
  type ProductAuthor,
  type ProductRepository,
  type ProductView,
} from '../repositories/product-repository.ts';
import type { UserRepository } from '../repositories/user-repository.ts';
import type { SessionStore } from '../services/session-store.ts';
import type { Config } from '../config/env.ts';
import { toZonedIsoString } from '../utils/datetime.ts';
import { readJsonBody } from '../utils/json-body.ts';
import type { Logger } from '../utils/logger.ts';
import { createAdminApiAccess, type ApiAuth, type ApiContext } from './admin-api-access.ts';

/**
 * API JSON de productos bajo /admin/api (REQ-F-008, RF-5 y DT-10). Sin lectura pública: todas las
 * rutas exigen sesión (D-11′). El autor es siempre el usuario de la sesión (D-18).
 *
 * Respuestas de error con el formato centralizado { error: { code, message } } y, según el caso,
 * `fields` (422, errores por campo) o `current` (409, versión vigente, quién y cuándo).
 */

type Handler = (ctx: ApiContext) => Promise<void>;

export interface AdminProductsApi {
  session: Handler;
  list: Handler;
  get: Handler;
  create: Handler;
  update: Handler;
  remove: Handler;
  restore: Handler;
  reorder: Handler;
}

const ID_PATTERN = /^[1-9]\d{0,9}$/;

export function createAdminProductsApi({
  config,
  sessions,
  users,
  products,
  logger,
}: {
  config: Config;
  sessions: SessionStore;
  users: UserRepository;
  products: ProductRepository;
  logger: Logger;
}): AdminProductsApi {
  const access = createAdminApiAccess({ config, sessions, users, logger });
  const zoned = (date: Date): string => toZonedIsoString(date, config.timezone);

  /** Producto -> JSON: campos de su combinación, precios en pesos y en centavos (RF-5.3). */
  function serialize(product: ProductView): Record<string, unknown> {
    const input = toInput(product);
    const prices: Record<string, unknown> = {};
    if ('price' in input) prices.priceCents = product.priceCents;
    if ('orderPrice' in input) prices.orderPriceCents = product.orderPriceCents;
    if ('variants' in input) {
      input.variants = product.variants.map((variant) => ({ ...variant, price: pesos(variant.priceCents) }));
    }
    return {
      id: product.id,
      business: product.business,
      category: product.category,
      detailsType: product.detailsType,
      slug: product.slug,
      ...input,
      ...prices,
      available: product.available,
      position: product.position,
      version: product.version,
      deleted: product.deleted,
      deletedAt: product.deletedAt ? zoned(product.deletedAt) : null,
      createdAt: zoned(product.createdAt),
      updatedAt: zoned(product.updatedAt),
      updatedBy: product.updatedBy ? { id: product.updatedBy.actorId, name: product.updatedBy.actorName } : null,
    };
  }

  const authorOf = ({ user }: ApiAuth): ProductAuthor => ({ id: user.id, name: user.displayName });

  function productId(ctx: ApiContext): number {
    const { id } = ctx.params;
    if (typeof id !== 'string' || !ID_PATTERN.test(id)) ctx.throw(404, 'Producto no encontrado.', { code: 'PRODUCT_NOT_FOUND' });
    return Number(id);
  }

  /** Errores de dominio -> respuesta JSON (404, 422, 409). El resto sigue al manejador central. */
  async function run(ctx: ApiContext, task: () => Promise<void>): Promise<void> {
    try {
      await task();
    } catch (err) {
      if (err instanceof ProductNotFoundError) ctx.throw(404, 'Producto no encontrado.', { code: 'PRODUCT_NOT_FOUND' });
      if (err instanceof ProductValidationError) {
        ctx.status = 422;
        ctx.body = { error: { code: 'VALIDATION_FAILED', message: 'Los datos no son válidos: no se guardó nada.', fields: err.fields } };
        return;
      }
      if (err instanceof ProductConflictError) {
        logger.info('product_conflict', { business: ctx.params.business, productId: err.current.productId });
        ctx.status = 409;
        ctx.body = {
          error: {
            code: 'VERSION_CONFLICT',
            message: 'El producto cambió mientras lo editabas: no se guardó nada.',
            current: { id: err.current.productId, version: err.current.version, updatedAt: zoned(err.current.updatedAt), updatedBy: err.current.updatedBy },
          },
        };
        return;
      }
      throw err;
    }
  }

  const versionFrom = (body: unknown): unknown => (body !== null && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>).version : undefined);

  return Object.freeze<AdminProductsApi>({
    async session(ctx) {
      const { user, session } = await access.authenticate(ctx);
      ctx.body = {
        user: { id: user.id, name: user.displayName, role: user.role, businesses: allowedBusinesses(user) },
        csrfToken: session.csrfToken,
      };
    },

    async list(ctx) {
      const { businessId } = await access.business(ctx, { write: false });
      const { eliminados, categoria } = ctx.query;
      if (categoria !== undefined && !isProductCategory(categoria)) {
        ctx.status = 422;
        ctx.body = { error: { code: 'VALIDATION_FAILED', message: 'Categoría desconocida.', fields: { categoria: 'Usa platillo o bebida.' } } };
        return;
      }
      const list = await products.list(businessId, {
        includeDeleted: eliminados === '1',
        ...(categoria === undefined ? {} : { category: categoria }),
      });
      ctx.body = { products: list.map(serialize) };
    },

    async get(ctx) {
      const { businessId } = await access.business(ctx, { write: false });
      const id = productId(ctx);
      await run(ctx, async () => {
        ctx.body = { product: serialize(await products.get(businessId, id)) };
      });
    },

    async create(ctx) {
      const auth = await access.business(ctx, { write: true });
      const input = await readJsonBody(ctx);
      await run(ctx, async () => {
        const product = await products.create(auth.businessId, { input }, authorOf(auth));
        ctx.status = 201;
        ctx.set('Location', `/admin/api/${auth.businessId}/productos/${product.id}`);
        ctx.body = { product: serialize(product) };
      });
    },

    async update(ctx) {
      const auth = await access.business(ctx, { write: true });
      const id = productId(ctx);
      await run(ctx, async () => {
        // D-19: la existencia (404) se comprueba antes de leer el cuerpo.
        await products.get(auth.businessId, id);
        const input = await readJsonBody(ctx);
        const product = await products.update(auth.businessId, id, { input, expectedVersion: versionFrom(input) }, authorOf(auth));
        ctx.body = { product: serialize(product) };
      });
    },

    async remove(ctx) {
      const auth = await access.business(ctx, { write: true });
      const id = productId(ctx);
      const raw = ctx.query.version;
      const version = typeof raw === 'string' && ID_PATTERN.test(raw) ? Number(raw) : raw;
      await run(ctx, async () => {
        ctx.body = { product: serialize(await products.remove(auth.businessId, id, version, authorOf(auth))) };
      });
    },

    async restore(ctx) {
      const auth = await access.business(ctx, { write: true });
      const id = productId(ctx);
      await run(ctx, async () => {
        await products.get(auth.businessId, id);
        const body = await readJsonBody(ctx);
        ctx.body = { product: serialize(await products.restore(auth.businessId, id, versionFrom(body), authorOf(auth))) };
      });
    },

    async reorder(ctx) {
      const auth = await access.business(ctx, { write: true });
      const body = await readJsonBody(ctx);
      const isObject = body !== null && typeof body === 'object' && !Array.isArray(body);
      // Objeto JSON comprobado justo arriba.
      const fields = isObject ? (body as Record<string, unknown>) : {};
      const unknown = Object.keys(fields).filter((key) => key !== 'category' && key !== 'items');
      if (!isObject || unknown.length > 0) {
        ctx.status = 422;
        ctx.body = {
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Los datos no son válidos: no se guardó nada.',
            fields: isObject ? Object.fromEntries(unknown.map((key) => [key, 'Campo desconocido.'])) : { '': 'El cuerpo debe ser un objeto.' },
          },
        };
        return;
      }
      await run(ctx, async () => {
        const list = await products.reorder(auth.businessId, fields.category, fields.items, authorOf(auth));
        ctx.body = { products: list.map(serialize) };
      });
    },
  });
}
