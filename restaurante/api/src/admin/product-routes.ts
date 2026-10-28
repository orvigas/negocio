import type { Context } from 'koa';

import {
  IDEMPOTENCY_HEADER,
  IDEMPOTENCY_KEY_PATTERN,
  adminPaths,
  productFieldsResponseSchema,
  productListResponseSchema,
  productListWriteResponseSchema,
  productResponseSchema,
  productWriteResponseSchema,
  type Freshness,
  type ProductFormField,
} from '@restaurante/contracts';
import {
  PRODUCT_ACTIONS,
  ProductConflictError,
  ProductNotFoundError,
  ProductValidationError,
  isDetailsType,
  isProductCategory,
  isValidKind,
  productFormLeaves,
  toProductDto,
  type FormLeaf,
  type ProductAuthor,
  type ProductRepository,
  type ProductView,
} from '@restaurante/core/catalog';
import { toZonedIsoString, type BusinessId, type Logger } from '@restaurante/core/shared';
import { readJsonBody } from '@restaurante/web';

import { ApiHttpError } from '../errors.ts';
import type { LandingNotifier } from '../notifier.ts';
import type { AdminAccess, AdminAuth } from './access.ts';
import { IdempotencyKeyReusedError, fingerprintOf, type IdempotencyStore } from './idempotency.ts';

/**
 * Productos por negocio en `/api/v1/admin` (REQ-F-039, RF-6 a RF-12), con las reglas actuales del
 * repositorio de core (las mismas de `/admin/api`, REQ-F-008):
 *
 *   GET    /:negocio/productos?eliminados=1&categoria=   -> { products }
 *   GET    /:negocio/productos/campos?categoria=&tipo=   -> descriptor del formulario
 *   POST   /:negocio/productos                           -> 201 { product, meta }  (Idempotency-Key opcional)
 *   PUT    /:negocio/productos/orden                     -> { products, meta }
 *   GET    /:negocio/productos/:id                       -> { product }
 *   PUT    /:negocio/productos/:id[?sobrescribir=1]      -> { product, meta }      (con `version`)
 *   DELETE /:negocio/productos/:id?version=N             -> { product, meta }
 *   POST   /:negocio/productos/:id/recuperar             -> { product, meta }      ({ version })
 *   POST   /:negocio/productos/:id/mover                 -> { products, meta }     ({ direction, version })
 *
 * Orden de las comprobaciones (D-19): sesión (401) -> negocio (404) -> permiso (403) -> CSRF en
 * escrituras (403) -> existencia (404) -> cuerpo (413/415/400) -> validación (422) -> versión (409).
 * `meta.freshness` dice si la landing y el bot ya muestran el cambio (aviso interno, RF-12).
 */

type RouteContext = Context & { params: Record<string, string> };
/** Esquema de respuesta del contrato (solo se usa `safeParse`). */
interface ResponseSchema {
  safeParse(value: unknown): { success: true; data: unknown } | { success: false; error: { issues: readonly unknown[] } };
}
type Handler = (ctx: RouteContext) => Promise<void>;

export interface ProductRoutes {
  list: Handler;
  fields: Handler;
  create: Handler;
  reorder: Handler;
  get: Handler;
  update: Handler;
  remove: Handler;
  restore: Handler;
  move: Handler;
}

const ID_PATTERN = /^[1-9]\d{0,9}$/;
/** Cuerpo JSON de un producto (los formularios más grandes, con 6 filas, ocupan pocos KiB). */
export const PRODUCT_BODY_LIMIT = 64 * 1024;

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Hoja del formulario de core -> descriptor del contrato. */
function toField(leaf: FormLeaf): ProductFormField {
  const { node } = leaf;
  if (node.kind === 'key') throw new TypeError('Un producto no tiene campos de tipo key');
  return {
    name: leaf.name,
    group: leaf.group,
    ...(leaf.slot === undefined ? {} : { slot: leaf.slot }),
    kind: node.kind,
    label: node.label,
    ...('max' in node ? { max: node.max } : {}),
    ...('min' in node ? { min: node.min } : {}),
    ...('optional' in node ? { optional: node.optional } : {}),
    ...('options' in node ? { options: [...node.options] } : {}),
  };
}

export function createProductRoutes({
  access,
  products,
  notifier,
  idempotency,
  timeZone,
  logger,
}: {
  access: AdminAccess;
  products: ProductRepository;
  notifier: LandingNotifier;
  idempotency: IdempotencyStore<{ product: ProductView; freshness: Freshness }>;
  timeZone: string;
  logger: Logger;
}): ProductRoutes {
  const dto = (product: ProductView) => toProductDto(product, timeZone);
  const authorOf = ({ user }: AdminAuth): ProductAuthor => ({ id: user.id, name: user.displayName });

  /** Responde validando con el contrato: una respuesta que no lo cumple es un error interno. */
  function send(ctx: Context, schema: ResponseSchema, body: unknown, status = 200): void {
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      logger.error('admin_response_invalid', { path: ctx.path, issues: parsed.error.issues.length });
      throw new Error('La respuesta no cumple el contrato');
    }
    ctx.status = status;
    ctx.body = parsed.data;
  }

  function productId(ctx: RouteContext): number {
    const { id } = ctx.params;
    if (typeof id !== 'string' || !ID_PATTERN.test(id)) throw new ApiHttpError(404, 'PRODUCT_NOT_FOUND', 'Producto no encontrado.');
    return Number(id);
  }

  function validationFailed(ctx: Context, fields: Record<string, string>, message = 'Los datos no son válidos: no se guardó nada.'): void {
    ctx.status = 422;
    ctx.body = { error: { code: 'VALIDATION_FAILED', message, fields } };
  }

  /** Errores de dominio -> 404, 422 y 409. El resto sigue al manejador central. */
  async function run(ctx: RouteContext, task: () => Promise<void>): Promise<void> {
    try {
      await task();
    } catch (err) {
      if (err instanceof ProductNotFoundError) throw new ApiHttpError(404, 'PRODUCT_NOT_FOUND', 'Producto no encontrado.');
      if (err instanceof ProductValidationError) return validationFailed(ctx, err.fields);
      if (err instanceof ProductConflictError) {
        logger.info('product_conflict', { business: ctx.params.business, productId: err.current.productId });
        ctx.status = 409;
        ctx.body = {
          error: {
            code: 'VERSION_CONFLICT',
            message: 'El producto cambió mientras lo editabas: no se guardó nada.',
            current: {
              id: err.current.productId,
              version: err.current.version,
              updatedAt: toZonedIsoString(err.current.updatedAt, timeZone),
              updatedBy: err.current.updatedBy,
            },
          },
        };
        return;
      }
      throw err;
    }
  }

  const versionFrom = (body: unknown): unknown => (isRecord(body) ? body.version : undefined);
  const freshness = (business: BusinessId): Promise<Freshness> => notifier.notify(business);

  /** Lee un objeto JSON con solo los campos indicados; si no, 422 y null. */
  async function closedBody(ctx: RouteContext, allowed: readonly string[]): Promise<Record<string, unknown> | null> {
    const body = await readJsonBody(ctx, { limit: PRODUCT_BODY_LIMIT });
    if (!isRecord(body)) {
      validationFailed(ctx, { '': 'El cuerpo debe ser un objeto.' });
      return null;
    }
    const unknownKeys = Object.keys(body).filter((key) => !allowed.includes(key));
    if (unknownKeys.length > 0) {
      validationFailed(ctx, Object.fromEntries(unknownKeys.map((key) => [key, 'Campo desconocido.'])));
      return null;
    }
    return body;
  }

  return Object.freeze<ProductRoutes>({
    async list(ctx) {
      const { businessId } = await access.business(ctx, { write: false });
      const { eliminados, categoria } = ctx.query;
      if (categoria !== undefined && !isProductCategory(categoria)) return validationFailed(ctx, { categoria: 'Usa platillo o bebida.' }, 'Categoría desconocida.');
      const list = await products.list(businessId, {
        includeDeleted: eliminados === '1',
        ...(categoria === undefined ? {} : { category: categoria }),
      });
      send(ctx, productListResponseSchema, { products: list.map(dto) });
    },

    async fields(ctx) {
      const { businessId } = await access.business(ctx, { write: false });
      const { categoria, tipo } = ctx.query;
      const detailsType = tipo === undefined || tipo === '' ? null : tipo;
      const kind = { business: businessId, category: categoria, detailsType };
      if (!isProductCategory(categoria) || (detailsType !== null && !isDetailsType(detailsType)) || !isValidKind(kind)) {
        throw new ApiHttpError(400, 'INVALID_KIND', 'Categoría o tipo de detalle no válidos para este negocio.');
      }
      send(ctx, productFieldsResponseSchema, {
        category: kind.category,
        detailsType: kind.detailsType,
        create: productFormLeaves(kind, { withAvailable: false }).map(toField),
        update: productFormLeaves(kind, { withAvailable: true }).map(toField),
      });
    },

    async create(ctx) {
      const auth = await access.business(ctx, { write: true });
      const key = ctx.get(IDEMPOTENCY_HEADER);
      if (key !== '' && !IDEMPOTENCY_KEY_PATTERN.test(key)) throw new ApiHttpError(400, 'INVALID_IDEMPOTENCY_KEY', 'La clave de idempotencia no es válida.');
      const input = await readJsonBody(ctx, { limit: PRODUCT_BODY_LIMIT });
      await run(ctx, async () => {
        const task = async () => {
          const product = await products.create(auth.businessId, { input }, authorOf(auth));
          return { product, freshness: await freshness(auth.businessId) };
        };
        let outcome: { value: Awaited<ReturnType<typeof task>>; replayed: boolean };
        try {
          outcome =
            key === ''
              ? { value: await task(), replayed: false }
              : await idempotency.run({ userId: auth.user.id, scope: auth.businessId, key, fingerprint: fingerprintOf(input) }, task);
        } catch (err) {
          if (!(err instanceof IdempotencyKeyReusedError)) throw err;
          logger.warn('product_create_key_reused', { business: auth.businessId });
          throw new ApiHttpError(422, 'IDEMPOTENCY_KEY_REUSED', 'La clave de idempotencia ya se usó con otros datos: no se guardó nada.');
        }
        const { value, replayed } = outcome;
        if (replayed) logger.info('product_create_replayed', { business: auth.businessId, productId: value.product.id });
        ctx.set('Location', adminPaths.product(auth.businessId, value.product.id));
        send(ctx, productWriteResponseSchema, { product: dto(value.product), meta: { freshness: value.freshness } }, 201);
      });
    },

    async reorder(ctx) {
      const auth = await access.business(ctx, { write: true });
      const body = await closedBody(ctx, ['category', 'items']);
      if (!body) return;
      await run(ctx, async () => {
        const list = await products.reorder(auth.businessId, body.category, body.items, authorOf(auth));
        send(ctx, productListWriteResponseSchema, { products: list.map(dto), meta: { freshness: await freshness(auth.businessId) } });
      });
    },

    async get(ctx) {
      const { businessId } = await access.business(ctx, { write: false });
      const id = productId(ctx);
      await run(ctx, async () => {
        send(ctx, productResponseSchema, { product: dto(await products.get(businessId, id)) });
      });
    },

    async update(ctx) {
      const auth = await access.business(ctx, { write: true });
      const id = productId(ctx);
      const action = ctx.query.sobrescribir === '1' ? PRODUCT_ACTIONS.OVERWRITE_AFTER_CONFLICT : PRODUCT_ACTIONS.UPDATE;
      await run(ctx, async () => {
        // D-19: la existencia (404) se comprueba antes de leer el cuerpo.
        await products.get(auth.businessId, id);
        const input = await readJsonBody(ctx, { limit: PRODUCT_BODY_LIMIT });
        const product = await products.update(auth.businessId, id, { input, expectedVersion: versionFrom(input), action }, authorOf(auth));
        send(ctx, productWriteResponseSchema, { product: dto(product), meta: { freshness: await freshness(auth.businessId) } });
      });
    },

    async remove(ctx) {
      const auth = await access.business(ctx, { write: true });
      const id = productId(ctx);
      const raw = ctx.query.version;
      const version = typeof raw === 'string' && ID_PATTERN.test(raw) ? Number(raw) : raw;
      await run(ctx, async () => {
        const product = await products.remove(auth.businessId, id, version, authorOf(auth));
        send(ctx, productWriteResponseSchema, { product: dto(product), meta: { freshness: await freshness(auth.businessId) } });
      });
    },

    async restore(ctx) {
      const auth = await access.business(ctx, { write: true });
      const id = productId(ctx);
      await run(ctx, async () => {
        await products.get(auth.businessId, id);
        const body = await closedBody(ctx, ['version']);
        if (!body) return;
        const product = await products.restore(auth.businessId, id, versionFrom(body), authorOf(auth));
        send(ctx, productWriteResponseSchema, { product: dto(product), meta: { freshness: await freshness(auth.businessId) } });
      });
    },

    async move(ctx) {
      const auth = await access.business(ctx, { write: true });
      const id = productId(ctx);
      await run(ctx, async () => {
        await products.get(auth.businessId, id);
        const body = await closedBody(ctx, ['direction', 'version']);
        if (!body) return;
        const { direction } = body;
        if (direction !== 'up' && direction !== 'down') return validationFailed(ctx, { direction: 'Usa up o down.' });
        const list = await products.move(auth.businessId, id, direction, versionFrom(body), authorOf(auth));
        send(ctx, productListWriteResponseSchema, { products: list.map(dto), meta: { freshness: await freshness(auth.businessId) } });
      });
    },
  });
}
