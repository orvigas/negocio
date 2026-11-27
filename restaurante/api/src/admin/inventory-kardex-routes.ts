import {
  INVENTORY_ERROR_CODES,
  INVENTORY_KARDEX_ERROR_CODES as CODES,
  inventoryKardexPaths,
  itemKardexResponseSchema,
  kardexDocumentDetailResponseSchema,
  kardexDocumentListResponseSchema,
  kardexDocumentWriteResponseSchema,
  kardexOptionsResponseSchema,
  kardexReversalPreviewResponseSchema,
  stockResponseSchema,
  type KardexDocument as KardexDocumentDto,
  type KardexMovement as KardexMovementDto,
} from '@restaurante/contracts';
import {
  AMOUNT_SCALE,
  AlreadyReversedError,
  COST_SCALE,
  DocumentHasReturnsError,
  DocumentNotFoundError,
  DocumentNotReturnableError,
  DocumentReversedError,
  IdempotencyKeyReusedError as KardexKeyReusedError,
  InitialBalanceNotAllowedError,
  InventoryBusyError,
  InventoryValidationError,
  ItemNotFoundError,
  ReversalNotReversibleError,
  TOTAL_SCALE,
  formatDecimal,
  movementTypeLabel,
  unitsSnapshot,
  type DocumentResult,
  type InventoryAuthor,
  type InventoryItem,
  type KardexDocument,
  type KardexMovement,
  type KardexRepository,
  type Supplier,
  type WriteOptions,
} from '@restaurante/core/inventory';
import { toZonedIsoString, type Logger } from '@restaurante/core/shared';

import { ApiHttpError } from '../errors.ts';
import type { AdminAccess, AdminAuth } from './access.ts';
import { holdsStock, idempotencyKey, inventoryBusy, routeId, type Handler, type RouteContext } from './inventory-shared.ts';
import { createResponder, isRecord, validationFailed } from './responses.ts';

/**
 * Kardex del inventario en `/api/v1/admin/inventario` (REQ-F-051, RF-2 a RF-9), con las reglas de
 * `core/inventory` (kardex-repository.ts):
 *
 *   GET  /kardex/opciones                       -> { items, suppliers }   (opciones de los formularios)
 *   POST /documentos/saldo-inicial | /compras | /ajustes  (Idempotency-Key) -> 201 { document, replayed: false } | 200 reenvío
 *   POST /documentos/:id/devoluciones           (Idempotency-Key) -> 201 | 200
 *   GET  /documentos/:id/reversion              -> { lines }          (vista previa, RF-4)
 *   POST /documentos/:id/reversion              (Idempotency-Key) -> 201 | 200
 *   GET  /documentos?tipo=&proveedor=&pagina=   -> { documents, page }
 *   GET  /documentos/:id                        -> { document, lines, returns }
 *   GET  /existencias?q=&categoria=&tipo=&estado=&pagina= -> { entries, totals, page }
 *   GET  /articulos/:id/kardex?pagina=          -> { item, stock, movements, page }
 *
 * Ninguna ruta edita ni borra documentos o movimientos (RN-T3-9, CA-15). La clave `Idempotency-Key` de
 * los documentos es persistente (DT-14): sobrevive a un reinicio de la `api`. Orden: sesión (401) ->
 * rol administrador o gerente (403) -> CSRF en escrituras (403) -> id (404) -> cuerpo (413/415/400/422)
 * -> reglas (422, 409, 503). Los logs solo llevan ids, tipos y conteos: nunca costos, cantidades,
 * nombres ni datos del proveedor (CA-27).
 */

export interface InventoryKardexRoutes {
  options: Handler;
  initialBalance: Handler;
  purchase: Handler;
  adjustment: Handler;
  supplierReturn: Handler;
  reversalPreview: Handler;
  reverse: Handler;
  listDocuments: Handler;
  getDocument: Handler;
  stock: Handler;
  itemKardex: Handler;
}

/** 50 líneas con sus textos caben de sobra. */
export const KARDEX_BODY_LIMIT = 64 * 1024;
const BODIES = Object.freeze({
  initialBalance: { fields: ['occurredOn', 'note', 'lines'], line: ['itemId', 'quantity', 'unit', 'unitCost'] },
  purchase: { fields: ['occurredOn', 'supplierId', 'reference', 'note', 'lines'], line: ['itemId', 'quantity', 'unit', 'amount'] },
  adjustment: { fields: ['occurredOn', 'reason', 'note', 'lines'], line: ['itemId', 'direction', 'quantity', 'unit', 'unitCost'] },
  supplierReturn: { fields: ['occurredOn', 'note', 'lines'], line: ['sourceMovementId', 'quantity'] },
  reversal: { fields: ['reason'], line: [] },
} as const);
/** Claves de core -> parámetros de la query (los `fields` de un 422 usan los nombres de la query). */
const DOCUMENT_FILTER_FIELDS: Readonly<Record<string, string>> = Object.freeze({ type: 'tipo', supplierId: 'proveedor', page: 'pagina' });
const STOCK_FILTER_FIELDS: Readonly<Record<string, string>> = Object.freeze({ q: 'q', categoryId: 'categoria', type: 'tipo', status: 'estado', page: 'pagina' });
const KARDEX_FILTER_FIELDS: Readonly<Record<string, string>> = Object.freeze({ page: 'pagina' });
/** Estado de Existencias: valores de la query -> core. */
const STOCK_STATUS: Readonly<Record<string, string>> = Object.freeze({ todos: 'all', negativos: 'negative', sin_costo: 'no_cost' });

const authorOf = ({ user }: AdminAuth): InventoryAuthor => ({ id: user.id, name: user.displayName });
const queryValue = (value: string | string[] | undefined): unknown => (value === undefined || value === '' ? undefined : value);
const renameFields = (fields: Record<string, string>, names: Readonly<Record<string, string>>): Record<string, string> =>
  Object.fromEntries(Object.entries(fields).map(([key, message]) => [names[key] ?? key, message]));
const quantity = (value: bigint): string => formatDecimal(value);
const cost = (value: bigint | null): string | null => (value === null ? null : formatDecimal(value, COST_SCALE));
const total = (value: bigint | null): string | null => (value === null ? null : formatDecimal(value, TOTAL_SCALE));

/** Campos desconocidos dentro de `lines`: 422 por línea (también la línea es un objeto cerrado). */
function unknownLineFields(lines: unknown, allowed: readonly string[]): Record<string, string> {
  if (!Array.isArray(lines)) return {};
  const fields: Record<string, string> = {};
  // Array.isArray lo tipa como any[]: sus elementos aún no están validados.
  for (const [index, line] of (lines as unknown[]).entries()) {
    if (!isRecord(line)) continue;
    for (const key of Object.keys(line)) if (!allowed.includes(key)) fields[`lines.${index}.${key}`] = 'Campo desconocido.';
  }
  return fields;
}

const stockItem = (item: InventoryItem) => ({ id: item.id, name: item.name, kind: item.kind, type: item.type, baseUnit: item.baseUnit, active: item.active });

export function createInventoryKardexRoutes({ access, kardex, timeZone, logger }: { access: AdminAccess; kardex: KardexRepository; timeZone: string; logger: Logger }): InventoryKardexRoutes {
  const { send, closedBody } = createResponder(logger);
  const iso = (date: Date) => toZonedIsoString(date, timeZone);
  const documentNotFound = () => new ApiHttpError(404, CODES.DOCUMENT_NOT_FOUND, 'Documento no encontrado.');
  const itemNotFound = () => new ApiHttpError(404, INVENTORY_ERROR_CODES.ITEM_NOT_FOUND, 'Artículo no encontrado.');

  const documentDto = (document: KardexDocument, supplier: { id: number; name: string } | null): KardexDocumentDto => ({
    id: document.id,
    type: document.type,
    typeLabel: movementTypeLabel(document.type),
    occurredOn: document.occurredOn,
    recordedAt: iso(document.recordedAt),
    supplier,
    reference: document.reference,
    costBasis: document.costBasis,
    reason: document.reason,
    note: document.note,
    totalCost: formatDecimal(document.totalCost, TOTAL_SCALE),
    reversesDocumentId: document.reversesDocumentId,
    reversedById: document.reversedById,
    sourceDocumentId: document.sourceDocumentId,
    author: document.actorName,
  });

  const movementDto = (movement: KardexMovement): KardexMovementDto => ({
    id: movement.id,
    documentId: movement.documentId,
    line: movement.line,
    itemId: movement.itemId,
    seq: movement.seq,
    type: movement.type,
    typeLabel: movementTypeLabel(movement.type),
    quantity: quantity(movement.quantity),
    enteredQuantity: quantity(movement.enteredQuantity),
    enteredUnit: movement.enteredUnit,
    balanceBefore: quantity(movement.balanceBefore),
    balanceAfter: quantity(movement.balanceAfter),
    unitCost: cost(movement.unitCost),
    lineTotal: total(movement.lineTotal),
    avgCostBefore: cost(movement.avgCostBefore),
    avgCostAfter: cost(movement.avgCostAfter),
    sourceMovementId: movement.sourceMovementId,
    recordedAt: iso(movement.recordedAt),
    author: movement.actorName,
  });

  const supplierRef = (supplier: Supplier | null) => (supplier ? { id: supplier.id, name: supplier.name } : null);

  /** Errores de dominio -> 404, 409, 422 y 503. El resto (DatabaseUnavailableError: 503) sigue al manejador central. */
  async function run(ctx: RouteContext, task: () => Promise<void>, fieldNames?: Readonly<Record<string, string>>): Promise<void> {
    try {
      await task();
    } catch (err) {
      if (err instanceof InventoryValidationError) return validationFailed(ctx, fieldNames ? renameFields(err.fields, fieldNames) : err.fields);
      if (err instanceof DocumentNotFoundError) throw documentNotFound();
      if (err instanceof ItemNotFoundError) throw itemNotFound();
      if (err instanceof InitialBalanceNotAllowedError) {
        ctx.status = 409;
        ctx.body = { error: { code: CODES.INITIAL_BALANCE_NOT_ALLOWED, message: err.message, items: err.items } };
        return;
      }
      if (err instanceof DocumentHasReturnsError) {
        ctx.status = 409;
        ctx.body = { error: { code: CODES.DOCUMENT_HAS_RETURNS, message: err.message, returnIds: err.returnIds } };
        return;
      }
      if (err instanceof AlreadyReversedError) throw new ApiHttpError(409, CODES.ALREADY_REVERSED, err.message);
      if (err instanceof ReversalNotReversibleError) throw new ApiHttpError(409, CODES.REVERSAL_NOT_REVERSIBLE, err.message);
      if (err instanceof DocumentNotReturnableError) throw new ApiHttpError(409, CODES.DOCUMENT_NOT_RETURNABLE, err.message);
      if (err instanceof DocumentReversedError) throw new ApiHttpError(409, CODES.DOCUMENT_REVERSED, err.message);
      if (err instanceof KardexKeyReusedError) {
        logger.warn('inventory_document_key_reused', { path: ctx.path });
        throw new ApiHttpError(422, 'IDEMPOTENCY_KEY_REUSED', 'La clave de idempotencia ya se usó con otros datos: no se guardó nada.');
      }
      if (err instanceof InventoryBusyError) throw inventoryBusy(ctx, logger);
      throw err;
    }
  }

  /**
   * Escritura de un documento: cuerpo cerrado (también por línea), clave persistente y respuesta 201 o 200.
   * Con `withId`, el `:id` de la ruta se lee después del acceso (DEF-003: 401 y 403 antes que 404).
   */
  async function writeDocument(
    ctx: RouteContext,
    body: { fields: readonly string[]; line: readonly string[] },
    write: (input: Record<string, unknown>, author: InventoryAuthor, options: WriteOptions, id: number) => Promise<DocumentResult>,
    withId = false,
  ): Promise<void> {
    const auth = await access.inventory(ctx, { write: true });
    const id = withId ? routeId(ctx, documentNotFound) : 0;
    const key = idempotencyKey(ctx);
    const input = await closedBody(ctx, body.fields, KARDEX_BODY_LIMIT);
    if (!input) return;
    const unknownFields = unknownLineFields(input.lines, body.line);
    if (Object.keys(unknownFields).length > 0) return validationFailed(ctx, unknownFields);
    await run(ctx, async () => {
      const { document, replayed } = await write(input, authorOf(auth), { requestId: key === '' ? null : key }, id);
      const detail = await kardex.getDocument(document.id);
      logger.info(replayed ? 'inventory_document_replayed' : 'inventory_document_created', {
        documentId: document.id,
        type: document.type,
        lines: detail.lines.length,
        ...(document.reversesDocumentId === null ? {} : { reversesDocumentId: document.reversesDocumentId }),
      });
      if (!replayed) ctx.set('Location', inventoryKardexPaths.document(document.id));
      send(ctx, kardexDocumentWriteResponseSchema, { document: documentDto(detail.document, supplierRef(detail.supplier)), replayed }, replayed ? 200 : 201);
    });
  }

  return Object.freeze<InventoryKardexRoutes>({
    async options(ctx) {
      await access.inventory(ctx, { write: false });
      await run(ctx, async () => {
        const { items, suppliers, today } = await kardex.formOptions();
        send(ctx, kardexOptionsResponseSchema, {
          items: items.map(({ item, avgCost, initialBalanceAllowed }) => ({
            ...stockItem(item),
            units: unitsSnapshot(item.units),
            referenceCost: cost(item.referenceCost),
            avgCost: cost(avgCost),
            initialBalanceAllowed,
          })),
          suppliers: suppliers.map((supplier) => ({ id: supplier.id, name: supplier.name })),
          today,
        });
      });
    },

    initialBalance: (ctx) => writeDocument(ctx, BODIES.initialBalance, (input, author, options) => kardex.createInitialBalance(input, author, options)),
    purchase: (ctx) => writeDocument(ctx, BODIES.purchase, (input, author, options) => kardex.createPurchase(input, author, options)),
    adjustment: (ctx) => writeDocument(ctx, BODIES.adjustment, (input, author, options) => kardex.createAdjustment(input, author, options)),

    supplierReturn: (ctx) => writeDocument(ctx, BODIES.supplierReturn, (input, author, options, id) => kardex.createSupplierReturn(id, input, author, options), true),
    reverse: (ctx) => writeDocument(ctx, BODIES.reversal, (input, author, options, id) => kardex.reverseDocument(id, input, author, options), true),

    async reversalPreview(ctx) {
      await access.inventory(ctx, { write: false });
      const id = routeId(ctx, documentNotFound);
      await run(ctx, async () => {
        const lines = await kardex.previewReversal(id);
        send(ctx, kardexReversalPreviewResponseSchema, {
          lines: lines.map((line) => ({ itemId: line.itemId, itemName: line.itemName, quantity: quantity(line.quantity), unitCost: cost(line.unitCost), balanceAfter: quantity(line.balanceAfter), negative: line.negative })),
        });
      });
    },

    async listDocuments(ctx) {
      await access.inventory(ctx, { write: false });
      const { tipo, proveedor, pagina } = ctx.query;
      await run(
        ctx,
        async () => {
          const result = await kardex.listDocuments({ type: queryValue(tipo), supplierId: queryValue(proveedor), page: queryValue(pagina) });
          send(ctx, kardexDocumentListResponseSchema, {
            documents: result.documents.map((document) =>
              documentDto(document, document.supplierId === null ? null : { id: document.supplierId, name: document.supplierName ?? '' }),
            ),
            page: result.page,
          });
        },
        DOCUMENT_FILTER_FIELDS,
      );
    },

    async getDocument(ctx) {
      await access.inventory(ctx, { write: false });
      const id = routeId(ctx, documentNotFound);
      await run(ctx, async () => {
        const detail = await kardex.getDocument(id);
        send(ctx, kardexDocumentDetailResponseSchema, {
          document: documentDto(detail.document, supplierRef(detail.supplier)),
          lines: detail.lines.map((line) => ({ ...movementDto(line), itemName: line.itemName, baseUnit: line.baseUnit as InventoryItem['baseUnit'], returnable: line.returnable === null ? null : quantity(line.returnable) })),
          returns: detail.returns.map((document) => documentDto(document, supplierRef(detail.supplier))),
        });
      });
    },

    async stock(ctx) {
      await access.inventory(ctx, { write: false });
      const { q, categoria, tipo, estado, pagina } = ctx.query;
      const status = queryValue(estado);
      await run(
        ctx,
        async () => {
          const result = await kardex.listStock({
            q: queryValue(q),
            categoryId: queryValue(categoria),
            type: queryValue(tipo),
            status: typeof status === 'string' ? (STOCK_STATUS[status] ?? `?${status}`) : status,
            page: queryValue(pagina),
          });
          send(ctx, stockResponseSchema, {
            entries: result.entries.map((entry) => ({
              item: stockItem(entry.item),
              categoryName: entry.categoryName,
              quantity: quantity(entry.quantity),
              avgCost: cost(entry.avgCost),
              lastCost: cost(entry.lastCost),
              value: entry.value === null ? null : formatDecimal(entry.value, AMOUNT_SCALE),
              negative: entry.negative,
              noCost: entry.noCost,
            })),
            totals: { positiveValue: formatDecimal(result.totals.positiveValue, AMOUNT_SCALE), negativeValue: formatDecimal(result.totals.negativeValue, AMOUNT_SCALE), noCostCount: result.totals.noCostCount },
            page: result.page,
          });
        },
        STOCK_FILTER_FIELDS,
      );
    },

    async itemKardex(ctx) {
      await access.inventory(ctx, { write: false });
      const id = routeId(ctx, itemNotFound);
      await run(
        ctx,
        async () => {
          const view = await kardex.itemKardex(id, queryValue(ctx.query.pagina));
          send(ctx, itemKardexResponseSchema, {
            item: stockItem(view.item),
            stock: view.stock && holdsStock(view.item) ? { quantity: quantity(view.stock.quantity), avgCost: cost(view.stock.avgCost), lastCost: cost(view.stock.lastCost) } : null,
            movements: view.movements.map((movement) => ({ ...movementDto(movement), occurredOn: view.occurredOn.get(movement.documentId) ?? movement.recordedAt.toISOString().slice(0, 10) })),
            page: view.page,
          });
        },
        KARDEX_FILTER_FIELDS,
      );
    },
  });
}
