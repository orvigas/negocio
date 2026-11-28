import { INVENTORY_KARDEX_ERROR_CODES as CODES, supplierDetailResponseSchema, supplierListResponseSchema, supplierResponseSchema, type Supplier as SupplierDto } from '@restaurante/contracts';
import {
  InventoryBusyError,
  InventoryValidationError,
  SupplierConflictError,
  SupplierNameTakenError,
  SupplierNotFoundError,
  type InventoryAuthor,
  type Supplier,
  type SupplierRepository,
} from '@restaurante/core/inventory';
import { toZonedIsoString, type Logger } from '@restaurante/core/shared';

import { ApiHttpError } from '../errors.ts';
import type { AdminAccess, AdminAuth } from './access.ts';
import type { IdempotencyStore } from './idempotency.ts';
import { idempotencyKey, inventoryBusy, routeId, runOnce, type Handler, type RouteContext } from './inventory-shared.ts';
import { createResponder, validationFailed } from './responses.ts';

/**
 * Proveedores del inventario en `/api/v1/admin/inventario` (REQ-F-051, RF-1), con las reglas de
 * `core/inventory` (supplier-repository.ts):
 *
 *   GET  /proveedores?estado=&q=&pagina=   -> { suppliers, page }
 *   GET  /proveedores/:id                  -> { supplier, history }
 *   POST /proveedores  (Idempotency-Key)   -> 201 { supplier }
 *   PUT  /proveedores/:id                  -> { supplier }      (409 SUPPLIER_VERSION_CONFLICT con `current`)
 *   POST /proveedores/:id/desactivar|reactivar -> { supplier }
 *
 * Orden: sesión (401) -> rol administrador o gerente (403) -> CSRF en escrituras (403) -> id (404) ->
 * cuerpo (413/415/400/422) -> reglas (422, 409, 503). Los logs solo llevan ids y acciones: nunca el
 * nombre ni el contacto del proveedor (CA-27).
 */

export interface InventorySupplierRoutes {
  list: Handler;
  get: Handler;
  create: Handler;
  update: Handler;
  deactivate: Handler;
  reactivate: Handler;
}

const BODY_LIMIT = 8 * 1024;
const CREATE_FIELDS: readonly string[] = Object.freeze(['name', 'contact']);
const UPDATE_FIELDS: readonly string[] = Object.freeze(['version', 'overwrite', 'name', 'contact']);
const STATUS_FIELDS: readonly string[] = Object.freeze(['version']);
const FILTER_FIELDS: Readonly<Record<string, string>> = Object.freeze({ status: 'estado', q: 'q', page: 'pagina' });

const authorOf = ({ user }: AdminAuth): InventoryAuthor => ({ id: user.id, name: user.displayName });
const queryValue = (value: string | string[] | undefined): unknown => (value === undefined || value === '' ? undefined : value);
const renameFields = (fields: Record<string, string>, names: Readonly<Record<string, string>>): Record<string, string> =>
  Object.fromEntries(Object.entries(fields).map(([key, message]) => [names[key] ?? key, message]));

export function createInventorySupplierRoutes({
  access,
  suppliers,
  idempotency,
  timeZone,
  logger,
}: {
  access: AdminAccess;
  suppliers: SupplierRepository;
  idempotency: IdempotencyStore<Supplier>;
  timeZone: string;
  logger: Logger;
}): InventorySupplierRoutes {
  const { send, closedBody } = createResponder(logger);
  const iso = (date: Date) => toZonedIsoString(date, timeZone);
  const notFound = () => new ApiHttpError(404, CODES.SUPPLIER_NOT_FOUND, 'Proveedor no encontrado.');

  const dto = (supplier: Supplier): SupplierDto => ({
    id: supplier.id,
    name: supplier.name,
    contact: supplier.contact,
    active: supplier.active,
    version: supplier.version,
    updatedAt: iso(supplier.updatedAt),
    updatedBy: supplier.updatedByName,
  });

  async function run(ctx: RouteContext, task: () => Promise<void>, fieldNames?: Readonly<Record<string, string>>): Promise<void> {
    try {
      await task();
    } catch (err) {
      if (err instanceof InventoryValidationError) return validationFailed(ctx, fieldNames ? renameFields(err.fields, fieldNames) : err.fields);
      if (err instanceof SupplierNameTakenError) return validationFailed(ctx, { name: err.message });
      if (err instanceof SupplierNotFoundError) throw notFound();
      if (err instanceof SupplierConflictError) {
        logger.info('inventory_supplier_conflict', { supplierId: err.current.id });
        ctx.status = 409;
        ctx.body = {
          error: {
            code: CODES.SUPPLIER_VERSION_CONFLICT,
            message: 'El proveedor cambió mientras lo editabas: no se guardó nada.',
            current: { id: err.current.id, version: err.current.version, updatedAt: iso(err.current.updatedAt), updatedBy: err.current.updatedBy },
          },
        };
        return;
      }
      if (err instanceof InventoryBusyError) throw inventoryBusy(ctx, logger);
      throw err;
    }
  }

  async function setActive(ctx: RouteContext, active: boolean): Promise<void> {
    const auth = await access.inventory(ctx, { write: true });
    const id = routeId(ctx, notFound);
    const body = await closedBody(ctx, STATUS_FIELDS, BODY_LIMIT);
    if (!body) return;
    await run(ctx, async () => {
      const input = { version: body.version };
      const supplier = active ? await suppliers.reactivateSupplier(id, input, authorOf(auth)) : await suppliers.deactivateSupplier(id, input, authorOf(auth));
      logger.info('inventory_supplier_saved', { supplierId: id, action: active ? 'reactivate' : 'deactivate' });
      send(ctx, supplierResponseSchema, { supplier: dto(supplier) });
    });
  }

  return Object.freeze<InventorySupplierRoutes>({
    async list(ctx) {
      await access.inventory(ctx, { write: false });
      const { estado, q, pagina } = ctx.query;
      await run(
        ctx,
        async () => {
          const result = await suppliers.listSuppliers({ status: queryValue(estado), q: queryValue(q), page: queryValue(pagina) });
          send(ctx, supplierListResponseSchema, { suppliers: result.suppliers.map(dto), page: result.page });
        },
        FILTER_FIELDS,
      );
    },

    async get(ctx) {
      await access.inventory(ctx, { write: false });
      const id = routeId(ctx, notFound);
      await run(ctx, async () => {
        const { supplier, history } = await suppliers.getSupplier(id);
        send(ctx, supplierDetailResponseSchema, {
          supplier: dto(supplier),
          history: history.map((entry) => ({ id: entry.id, at: iso(entry.at), action: entry.action, author: entry.actorName, changes: entry.changes.map(({ field, before, after }) => ({ field, before, after })) })),
        });
      });
    },

    async create(ctx) {
      const auth = await access.inventory(ctx, { write: true });
      const key = idempotencyKey(ctx);
      const body = await closedBody(ctx, CREATE_FIELDS, BODY_LIMIT);
      if (!body) return;
      await run(ctx, async () => {
        const { value, replayed } = await runOnce(logger, { store: idempotency, scope: 'inventario-proveedores', auth, key, body }, () =>
          suppliers.createSupplier({ name: body.name, contact: body.contact }, authorOf(auth)),
        );
        logger.info('inventory_supplier_saved', { supplierId: value.id, action: replayed ? 'replayed' : 'create' });
        send(ctx, supplierResponseSchema, { supplier: dto(value) }, 201);
      });
    },

    async update(ctx) {
      const auth = await access.inventory(ctx, { write: true });
      const id = routeId(ctx, notFound);
      const body = await closedBody(ctx, UPDATE_FIELDS, BODY_LIMIT);
      if (!body) return;
      if (body.overwrite !== undefined && typeof body.overwrite !== 'boolean') return validationFailed(ctx, { overwrite: 'Debe ser verdadero o falso.' });
      await run(ctx, async () => {
        const supplier = await suppliers.updateSupplier(id, { version: body.version, name: body.name, contact: body.contact, overwrite: body.overwrite === true }, authorOf(auth));
        logger.info('inventory_supplier_saved', { supplierId: id, action: body.overwrite === true ? 'overwrite_after_conflict' : 'update' });
        send(ctx, supplierResponseSchema, { supplier: dto(supplier) });
      });
    },

    deactivate: (ctx) => setActive(ctx, false),
    reactivate: (ctx) => setActive(ctx, true),
  });
}
