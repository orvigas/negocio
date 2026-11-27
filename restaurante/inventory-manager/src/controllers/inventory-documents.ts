import {
  IDEMPOTENCY_KEY_PATTERN,
  type AdjustmentRequest,
  type AdminApiClient,
  type AdminApiResult,
  type InitialBalanceRequest,
  type KardexDocumentWriteResponse,
  type KardexOptionsResponse,
  type PurchaseRequest,
} from '@restaurante/contracts';
import type { Logger, SafeHtml } from '@restaurante/web';

import type { InventoryConfig } from '../config.ts';
import type { Views } from '../views/index.ts';
import {
  DOCUMENT_MAX_ROWS,
  DOCUMENT_ROWS_STEP,
  LINE_PARTS,
  emptyDocumentForm,
  isDocumentKind,
  isEmptyLine,
  lineField,
  newDocumentPath,
  readDocumentForm,
  returnPath,
  visibleRows,
  type DocumentFormValues,
  type DocumentKind,
} from '../views/inventory-documents.ts';
import { DOCUMENTS_PATH, documentPath } from '../views/inventory-kardex.ts';
import { trimDecimal } from '../views/inventory.ts';
import { createControllerKit, type Ctx, type Session } from './common.ts';
import { UNAVAILABLE, createInventoryAccess, httpFailure, newRequestId } from './inventory-common.ts';

/**
 * Formularios del Kardex con líneas en el admin (REQ-F-051, T3; PR 3b): saldo inicial, compra, ajuste y
 * devolución a proveedor. La API decide cada regla (core); aquí se lee el formulario, se resuelve el nombre
 * del artículo con las opciones de la API y se vuelve a pintar lo escrito ante cualquier error:
 *
 * - «Añadir 10 filas» (`action=rows`) vuelve a pintar con 10 filas más, sin registrar nada (PV-T3-4).
 * - Cada envío lleva `Idempotency-Key` (OBS-16): el `requestId` del formulario, que se conserva al repintar,
 *   así un reintento tras un 503 nunca duplica el documento (DT-14).
 * - 422 por línea y campo, con las filas del formulario (las vacías no se envían); el artículo de una línea
 *   va en `lines.N.item` (OBS-15). 409 con su aviso; 503 (API caída u ocupada) con lo escrito (DEF-005).
 *
 * Nunca se registran nombres, cantidades, costos ni tokens: solo la ruta, ids, tipos y códigos.
 */

type Handler = (ctx: Ctx) => Promise<void>;

export interface DocumentController {
  newDocument: Handler;
  createDocument: Handler;
  returnPage: Handler;
  createReturn: Handler;
}

const BODY_LIMIT = 128 * 1024;
const LINE_FIELDS = Array.from({ length: DOCUMENT_MAX_ROWS }, (_, slot) => LINE_PARTS.map((part) => lineField(slot, part))).flat();
const DOCUMENT_FIELDS = Object.freeze(['_csrf', 'action', 'requestId', 'rows', 'today', 'occurredOn', 'note', 'supplierId', 'reference', 'reason', ...LINE_FIELDS]);
const RETURN_LINE_FIELDS = Array.from({ length: DOCUMENT_MAX_ROWS }, (_, slot) => [lineField(slot, 'source'), lineField(slot, 'label'), lineField(slot, 'quantity')]).flat();
const RETURN_FIELDS = Object.freeze(['_csrf', 'action', 'requestId', 'today', 'occurredOn', 'note', ...RETURN_LINE_FIELDS]);
const UNKNOWN_ITEM = 'No hay un artículo que admita este documento con ese nombre: elige uno de la lista.';
/** DEF-007: el mismo texto que el 409 `INITIAL_BALANCE_NOT_ALLOWED` de la API (RN-T3-8, CA-5). */
const HAS_MOVEMENTS = 'El artículo ya tiene movimientos: corrige su existencia con un ajuste.';
const ID_PATTERN = /^[1-9]\d{0,9}$/;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
/** «Hoy» que el formulario devuelve oculto (solo para `min` y `max` de la fecha si la API no responde). */
const todayOf = (raw: string | undefined): string => (raw && DAY_PATTERN.test(raw) ? raw : '');

const invalidForm = (ctx: Ctx): never => ctx.throw(400, 'El formulario tiene valores imposibles.', { code: 'INVALID_FORM' });
const nameKey = (name: string): string => name.trim().normalize('NFC').toLocaleLowerCase('es');
const requestIdOf = (raw: string | undefined): string => (raw && IDEMPOTENCY_KEY_PATTERN.test(raw) ? raw : newRequestId());

/** Filas pedidas (campo oculto `rows`): múltiplo de 10 entre 10 y 50; otro valor, 10. */
function rowsOf(raw: string | undefined): number {
  const value = Number(raw);
  return Number.isInteger(value) && value >= DOCUMENT_ROWS_STEP && value <= DOCUMENT_MAX_ROWS && value % DOCUMENT_ROWS_STEP === 0 ? value : DOCUMENT_ROWS_STEP;
}

/** `lines.<i>…` de la API (lista compacta) -> `lines.<fila>…` del formulario. */
function lineErrorsToSlots(errors: Record<string, string>, slots: readonly number[]): Record<string, string> {
  return Object.fromEntries(
    Object.entries(errors).map(([key, message]) => {
      const match = /^lines\.(\d+)(\..+)?$/.exec(key);
      const slot = match ? slots[Number(match[1])] : undefined;
      return [slot === undefined || !match ? key : `lines.${slot}${match[2] ?? ''}`, message];
    }),
  );
}

type Item = KardexOptionsResponse['items'][number];

export function createDocumentController({ config, api, views, logger }: { config: InventoryConfig; api: AdminApiClient; views: Views; logger: Logger }): DocumentController {
  const kit = createControllerKit({ config, api, views, logger });
  const { send, seeOther, failureReason, isUnavailable, readClosedForm, fieldErrors, idOf, credentials } = kit;
  const { notFound, inventorySession, apiFailure } = createInventoryAccess({ config, kit, views });
  const warning = (title: string, paragraphs: string[] = ['No se guardó nada. Lo que escribiste sigue en el formulario.']) => views.notice({ tone: 'warning', urgent: true, title, paragraphs });

  async function options(auth: Session): Promise<KardexOptionsResponse | null> {
    const result = await api.kardexOptions(credentials(auth));
    return result.ok ? result.data : null;
  }

  /**
   * Artículos por nombre. Todos los que admiten movimientos: en el saldo inicial, uno con movimientos se
   * resuelve igual para explicar en su fila por qué no se admite (DEF-007), aunque el datalist no lo ofrezca.
   */
  const itemsByName = (data: KardexOptionsResponse) => new Map(data.items.map((item) => [nameKey(item.name), item]));

  /** PV-T3-7: el costo del saldo inicial se precarga con el costo de referencia en las filas con artículo y sin costo. */
  function prefill(kind: DocumentKind, values: DocumentFormValues, data: KardexOptionsResponse | null): DocumentFormValues {
    if (kind !== 'saldo-inicial' || !data) return values;
    const byName = itemsByName(data);
    return {
      ...values,
      lines: values.lines.map((line) => {
        const item = byName.get(nameKey(line.item));
        return item && item.referenceCost && line.unitCost.trim() === '' ? { ...line, unitCost: trimDecimal(item.referenceCost) } : line;
      }),
    };
  }

  /** 503 con lo escrito: API caída (`UNAVAILABLE`) u ocupada (503 `INVENTORY_BUSY`, con su mensaje). */
  function outageNotice(result: AdminApiResult<unknown>): SafeHtml {
    if (!result.ok && result.kind === 'http' && result.error.code === 'INVENTORY_BUSY') return warning(result.error.message, ['Lo que escribiste sigue en el formulario; vuelve a enviarlo.']);
    return views.notice(UNAVAILABLE);
  }

  type DocumentRequest = { kind: 'saldo-inicial'; body: InitialBalanceRequest } | { kind: 'compra'; body: PurchaseRequest } | { kind: 'ajuste'; body: AdjustmentRequest };

  /** Cuerpo para la API con las filas escritas (sin las vacías) y la fila del formulario de cada línea. */
  function body(kind: DocumentKind, values: DocumentFormValues, byName: ReadonlyMap<string, Item>): { request: DocumentRequest; slots: number[]; unknown: Set<number> } {
    const slots: number[] = [];
    const unknown = new Set<number>();
    const written = values.lines.flatMap((line, slot) => {
      if (isEmptyLine(line)) return [];
      const item = byName.get(nameKey(line.item));
      if (!item && line.item.trim() !== '') unknown.add(slot);
      slots.push(slot);
      // 0: sin artículo resuelto; la API lo rechaza en su línea y aquí se explica el motivo.
      return [{ line, common: { itemId: item?.id ?? 0, quantity: line.quantity.trim(), unit: line.unit.trim() } }];
    });
    const occurredOn = values.occurredOn.trim();
    const note = values.note.trim() === '' ? null : values.note;
    if (kind === 'saldo-inicial') return { slots, unknown, request: { kind, body: { occurredOn, note, lines: written.map(({ line, common }) => ({ ...common, unitCost: line.unitCost.trim() })) } } };
    if (kind === 'compra') {
      return {
        slots,
        unknown,
        request: {
          kind,
          body: {
            occurredOn,
            note,
            supplierId: ID_PATTERN.test(values.supplierId) ? Number(values.supplierId) : null,
            reference: values.reference.trim() === '' ? null : values.reference,
            lines: written.map(({ line, common }) => ({ ...common, amount: line.amount.trim() })),
          },
        },
      };
    }
    return {
      slots,
      unknown,
      request: { kind, body: { occurredOn, note, reason: values.reason, lines: written.map(({ line, common }) => ({ ...common, direction: line.direction || 'salida', unitCost: line.unitCost.trim() === '' ? null : line.unitCost.trim() })) } },
    };
  }

  function write(auth: Session, fields: Map<string, string>, request: DocumentRequest, requestId: string): Promise<AdminApiResult<KardexDocumentWriteResponse>> {
    const credential = credentials(auth, fields);
    if (request.kind === 'saldo-inicial') return api.createInitialBalance(credential, request.body, requestId);
    if (request.kind === 'compra') return api.createPurchase(credential, request.body, requestId);
    return api.createAdjustment(credential, request.body, requestId);
  }

  return Object.freeze<DocumentController>({
    async newDocument(ctx) {
      const auth = await inventorySession(ctx, DOCUMENTS_PATH);
      if (!auth) return;
      const kind = ctx.params.tipo;
      if (!isDocumentKind(kind)) return notFound(ctx, auth, 'inventory-documents');
      const data = await options(auth);
      if (!data) return send(ctx, 503, views.message({ title: 'Servicio no disponible', notice: UNAVAILABLE, context: auth, section: 'inventory-documents', backHref: DOCUMENTS_PATH, backLabel: 'Volver a documentos' }));
      send(ctx, 200, views.inventoryDocumentForm({ context: auth, csrfToken: auth.csrfToken, kind, values: emptyDocumentForm(data.today), rows: DOCUMENT_ROWS_STEP, requestId: newRequestId(), options: data }));
    },

    async createDocument(ctx) {
      const fields = await readClosedForm(ctx, DOCUMENT_FIELDS, BODY_LIMIT);
      const kind = ctx.params.tipo;
      const action = fields.get('action') ?? 'save';
      if (action !== 'save' && action !== 'rows') invalidForm(ctx);
      const values = readDocumentForm(fields);
      const requestId = requestIdOf(fields.get('requestId'));
      const rows = rowsOf(fields.get('rows'));
      const csrf = fields.get('_csrf') ?? '';
      const auth = await inventorySession(ctx, isDocumentKind(kind) ? newDocumentPath(kind) : DOCUMENTS_PATH, () => {
        if (!isDocumentKind(kind)) return false;
        send(ctx, 503, views.inventoryDocumentForm({ context: null, csrfToken: csrf, kind, values, rows, requestId, options: null, today: todayOf(fields.get('today')), notices: [views.notice(UNAVAILABLE)] }));
        return true;
      });
      if (!auth) return;
      if (!isDocumentKind(kind)) return notFound(ctx, auth, 'inventory-documents');
      const data = await options(auth);
      const repaint = (status: number, extra: { errors?: Record<string, string>; notices?: SafeHtml[]; focusSlot?: number; rows?: number }) =>
        send(ctx, status, views.inventoryDocumentForm({ context: auth, csrfToken: auth.csrfToken, kind, values: prefill(kind, values, data), rows, requestId, options: data, today: todayOf(fields.get('today')), ...extra }));

      // PV-T3-4: 10 filas más con lo escrito y el foco en el artículo de la primera fila nueva.
      if (action === 'rows') return repaint(200, { rows: Math.min(DOCUMENT_MAX_ROWS, rows + DOCUMENT_ROWS_STEP), focusSlot: visibleRows(values, rows) });
      if (!data) {
        logger.warn('api_unavailable', { path: ctx.path, reason: 'kardex_options' });
        return repaint(503, { notices: [views.notice(UNAVAILABLE)] });
      }

      const byName = itemsByName(data);
      if (kind === 'saldo-inicial') {
        // DEF-007 (RN-T3-8, CA-5): un artículo que ya tiene movimientos se explica en su fila, como el 409 de la API.
        const taken = Object.fromEntries(
          values.lines.flatMap((line, slot) => (!isEmptyLine(line) && byName.get(nameKey(line.item))?.initialBalanceAllowed === false ? [[lineField(slot, 'item'), HAS_MOVEMENTS]] : [])),
        );
        if (Object.keys(taken).length > 0) return repaint(409, { errors: taken, notices: [warning(HAS_MOVEMENTS)] });
      }
      const { request, slots, unknown } = body(kind, values, byName);
      const result = await write(auth, fields, request, requestId);
      if (result.ok) {
        logger.info('inventory_document_form_saved', { documentId: result.data.document.id, type: result.data.document.type, replayed: result.data.replayed });
        return seeOther(ctx, `${documentPath(result.data.document.id)}?ok=created`);
      }
      const errors = fieldErrors(result);
      if (errors) {
        const mapped = lineErrorsToSlots(errors, slots);
        for (const slot of unknown) mapped[lineField(slot, 'item')] = UNKNOWN_ITEM;
        return repaint(422, { errors: mapped });
      }
      if (httpFailure(result, 409)) {
        logger.info('inventory_document_form_rejected', { type: kind, code: result.error.code });
        // RN-T3-8: el saldo inicial marca en su línea cada artículo que ya tiene movimientos.
        const taken = new Set((result.error.items ?? []).map((item) => nameKey(item.name)));
        const lineErrors = Object.fromEntries(values.lines.flatMap((line, slot) => (!isEmptyLine(line) && taken.has(nameKey(line.item)) ? [[lineField(slot, 'item'), result.error.message]] : [])));
        return repaint(409, { errors: lineErrors, notices: [warning(result.error.message)] });
      }
      if (isUnavailable(result)) {
        logger.warn('api_unavailable', { path: ctx.path, reason: failureReason(result) });
        return repaint(503, { notices: [outageNotice(result)] });
      }
      return apiFailure(ctx, result, auth, newDocumentPath(kind), 'inventory-documents');
    },

    async returnPage(ctx) {
      const auth = await inventorySession(ctx, DOCUMENTS_PATH);
      if (!auth) return;
      const id = idOf(ctx);
      if (id === null) return notFound(ctx, auth, 'inventory-documents');
      const [found, data] = await Promise.all([api.getKardexDocument(credentials(auth), id), options(auth)]);
      if (!found.ok) return apiFailure(ctx, found, auth, ctx.path, 'inventory-documents');
      const { document } = found.data;
      if (document.type !== 'compra' || document.reversedById !== null) return seeOther(ctx, documentPath(id));
      const today = data?.today ?? '';
      send(ctx, 200, views.inventoryReturnForm({ context: auth, csrfToken: auth.csrfToken, purchase: found.data, purchaseId: id, occurredOn: today, note: '', quantities: new Map(), today, requestId: newRequestId() }));
    },

    async createReturn(ctx) {
      const fields = await readClosedForm(ctx, RETURN_FIELDS, BODY_LIMIT);
      const id = idOf(ctx);
      if ((fields.get('action') ?? 'save') !== 'save') invalidForm(ctx);
      const requestId = requestIdOf(fields.get('requestId'));
      const occurredOn = fields.get('occurredOn') ?? '';
      const note = fields.get('note') ?? '';
      const csrf = fields.get('_csrf') ?? '';
      // Cantidad escrita por línea de compra (el id va oculto en cada fila).
      const entered: { slot: number; source: number; label: string; quantity: string }[] = [];
      for (let slot = 0; slot < DOCUMENT_MAX_ROWS; slot += 1) {
        const source = fields.get(lineField(slot, 'source'));
        if (source === undefined) continue;
        if (!ID_PATTERN.test(source)) invalidForm(ctx);
        entered.push({ slot, source: Number(source), label: fields.get(lineField(slot, 'label')) ?? '', quantity: fields.get(lineField(slot, 'quantity')) ?? '' });
      }
      const quantities = new Map(entered.map((line) => [line.source, line.quantity]));
      const sentToday = todayOf(fields.get('today'));
      // DEF-009: sin la compra (API caída), las filas enviadas se vuelven a pintar con su etiqueta y su cantidad.
      const fallbackRows = entered.map(({ slot, source, label }) => ({ slot, source, label: label.trim() === '' ? `línea de compra ${source}` : label }));
      const state = { purchaseId: id ?? 0, occurredOn, note, quantities, requestId, fallbackRows };
      const auth = await inventorySession(ctx, id === null ? DOCUMENTS_PATH : returnPath(id), () => {
        if (id === null) return false;
        send(ctx, 503, views.inventoryReturnForm({ context: null, csrfToken: csrf, purchase: null, today: sentToday, ...state, notices: [views.notice(UNAVAILABLE)] }));
        return true;
      });
      if (!auth) return;
      if (id === null) return notFound(ctx, auth, 'inventory-documents');
      const lines = entered.filter((line) => line.quantity.trim() !== '');
      const result = await api.createSupplierReturn(credentials(auth, fields), id, { occurredOn: occurredOn.trim(), note: note.trim() === '' ? null : note, lines: lines.map((line) => ({ sourceMovementId: line.source, quantity: line.quantity.trim() })) }, requestId);
      if (result.ok) {
        logger.info('inventory_document_form_saved', { documentId: result.data.document.id, type: 'devolucion_proveedor', replayed: result.data.replayed });
        return seeOther(ctx, `${documentPath(result.data.document.id)}?ok=created`);
      }
      // Para volver a pintar hacen falta las líneas de la compra; si la API no las da, el formulario va sin ellas.
      const [found, data] = await Promise.all([api.getKardexDocument(credentials(auth), id), options(auth)]);
      const repaint = (status: number, extra: { errors?: Record<string, string>; notices?: SafeHtml[] }) =>
        send(ctx, status, views.inventoryReturnForm({ context: auth, csrfToken: auth.csrfToken, purchase: found.ok ? found.data : null, today: data?.today ?? sentToday, ...state, ...extra }));
      const errors = fieldErrors(result);
      if (errors) return repaint(422, { errors: lineErrorsToSlots(errors, lines.map((line) => line.slot)) });
      if (httpFailure(result, 409)) {
        logger.info('inventory_document_form_rejected', { type: 'devolucion_proveedor', code: result.error.code });
        return repaint(409, { notices: [warning(result.error.message)] });
      }
      if (isUnavailable(result)) {
        logger.warn('api_unavailable', { path: ctx.path, reason: failureReason(result) });
        return repaint(503, { notices: [outageNotice(result)] });
      }
      return apiFailure(ctx, result, auth, returnPath(id), 'inventory-documents');
    },
  });
}

