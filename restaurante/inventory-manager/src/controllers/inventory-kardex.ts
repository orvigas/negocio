import { IDEMPOTENCY_KEY_PATTERN, type AdminApiClient, type KardexDocumentDetailResponse } from '@restaurante/contracts';
import type { Logger, SafeHtml } from '@restaurante/web';

import type { InventoryConfig } from '../config.ts';
import type { Views } from '../views/index.ts';
import { DOCUMENTS_PATH, NEW_SUPPLIER_PATH, STOCK_PATH, SUPPLIERS_PATH, documentPath, reversalPath, supplierEditPath, type SupplierFormValues } from '../views/inventory-kardex.ts';
import { createControllerKit, type Ctx, type Session } from './common.ts';
import { UNAVAILABLE, createInventoryAccess, httpFailure, newRequestId, queryText } from './inventory-common.ts';

/**
 * Pantallas del Kardex (REQ-F-051, T3; PR 3a), solo para administradores y gerentes: existencias
 * valorizadas (RF-7), proveedores (RF-1), lista y detalle de documentos (RF-9) y la reversión con
 * confirmación (RF-4). Mismo flujo que T1 y T2:
 *
 * - GET: sesión (sin ella, 303 al acceso volviendo a esta misma pantalla, OBS-12 a) -> rol -> datos.
 * - POST: mismo origen -> lista cerrada de campos (400) -> sesión -> rol -> la API (CSRF, 422 por campo,
 *   409 de versión y de reglas). Después, 303 (PRG).
 * - Las escrituras llevan siempre `Idempotency-Key` (OBS-16): un `requestId` del formulario, que se
 *   conserva al repintar, así un reintento tras un 503 no duplica nada.
 * - Con la API caída: 503 con lo escrito conservado.
 *
 * Nunca se registran nombres, contactos, cantidades ni costos: solo la ruta, ids y códigos.
 */

type Handler = (ctx: Ctx) => Promise<void>;

export interface KardexController {
  stock: Handler;
  suppliers: Handler;
  newSupplier: Handler;
  createSupplier: Handler;
  editSupplier: Handler;
  updateSupplier: Handler;
  deactivateSupplier: Handler;
  reactivateSupplier: Handler;
  documents: Handler;
  document: Handler;
  reversalPage: Handler;
  reverse: Handler;
}

const SMALL_LIMIT = 4 * 1024;
const SUPPLIER_CREATE_FIELDS = Object.freeze(['_csrf', 'action', 'requestId', 'name', 'contact']);
const SUPPLIER_UPDATE_FIELDS = Object.freeze(['_csrf', 'action', 'version', 'name', 'contact']);
const SUPPLIER_STATUS_FIELDS = Object.freeze(['_csrf', 'version']);
const REVERSAL_FIELDS = Object.freeze(['_csrf', 'action', 'requestId', 'reason']);

/** Mensajes de éxito (`?ok=`, lista cerrada). */
const SUCCESS: Readonly<Record<string, string>> = Object.freeze({
  supplier_created: 'Proveedor creado.',
  supplier_saved: 'Cambios guardados.',
  supplier_deactivated: 'Proveedor inactivado: ya no se ofrece en compras nuevas.',
  supplier_reactivated: 'Proveedor reactivado.',
  reversed: 'Documento revertido: se registraron los movimientos contrarios.',
  created: 'Documento registrado: sus movimientos ya están en el Kardex.',
});

const requestIdOf = (raw: string | undefined): string => (raw && IDEMPOTENCY_KEY_PATTERN.test(raw) ? raw : newRequestId());

export function createKardexController({ config, api, views, logger }: { config: InventoryConfig; api: AdminApiClient; views: Views; logger: Logger }): KardexController {
  const kit = createControllerKit({ config, api, views, logger });
  const { send, seeOther, failureReason, isUnavailable, readClosedForm, fieldErrors, idOf, credentials } = kit;
  const { notFound, inventorySession, apiFailure } = createInventoryAccess({ config, kit, views });

  function successNotices(ctx: Ctx): SafeHtml[] {
    const { ok } = ctx.query;
    return typeof ok === 'string' && Object.hasOwn(SUCCESS, ok) ? [views.notice({ tone: 'success', title: SUCCESS[ok] as string })] : [];
  }
  const warning = (title: string, paragraphs: string[] = ['No se guardó nada. Lo que escribiste sigue en el formulario.']) => views.notice({ tone: 'warning', urgent: true, title, paragraphs });

  // --- Proveedores (RF-1) ---------------------------------------------------------------------------

  async function supplierForm(
    ctx: Ctx,
    status: number,
    auth: Session | null,
    csrf: string,
    state: { id: number | null; values: SupplierFormValues; version?: string; requestId?: string; errors?: Record<string, string>; notices?: SafeHtml[]; conflict?: boolean },
  ): Promise<void> {
    let history = undefined;
    if (auth && state.id !== null) {
      const found = await api.getInventorySupplier(credentials(auth), state.id);
      if (found.ok) history = found.data.history;
    }
    send(ctx, status, views.inventorySupplierForm({ context: auth, csrfToken: auth?.csrfToken ?? csrf, ...state, ...(history ? { history } : {}) }));
  }

  async function changeSupplierStatus(ctx: Ctx, active: boolean): Promise<void> {
    const fields = await readClosedForm(ctx, SUPPLIER_STATUS_FIELDS, SMALL_LIMIT);
    const auth = await inventorySession(ctx, SUPPLIERS_PATH);
    if (!auth) return;
    const id = idOf(ctx);
    if (id === null) return notFound(ctx, auth, 'inventory-suppliers');
    const version = Number(fields.get('version'));
    const result = await api.setInventorySupplierActive(credentials(auth, fields), id, active, { version: Number.isSafeInteger(version) ? version : 0 });
    if (result.ok) return seeOther(ctx, `${SUPPLIERS_PATH}?ok=${active ? 'supplier_reactivated' : 'supplier_deactivated'}`);
    if (httpFailure(result, 409) || httpFailure(result, 422)) {
      const title =
        result.error.code === 'SUPPLIER_VERSION_CONFLICT'
          ? 'El proveedor cambió mientras lo revisabas: no se guardó nada. Inténtalo de nuevo.'
          : (Object.values(result.error.fields ?? {})[0] ?? result.error.message);
      return suppliersPage(ctx, auth, result.status, [warning(title, [])]);
    }
    return apiFailure(ctx, result, auth, SUPPLIERS_PATH, 'inventory-suppliers');
  }

  async function suppliersPage(ctx: Ctx, auth: Session, status: number, notices: SafeHtml[]): Promise<void> {
    const filter = { estado: queryText(ctx.query.estado), q: queryText(ctx.query.q) };
    const result = await api.listInventorySuppliers(credentials(auth), { status: filter.estado, q: filter.q, page: queryText(ctx.query.pagina) });
    if (result.ok) return send(ctx, status, views.inventorySuppliers({ context: auth, filter, data: result.data, notices }));
    const errors = fieldErrors(result);
    if (errors) return send(ctx, 422, views.inventorySuppliers({ context: auth, filter, data: null, errors, notices }));
    return apiFailure(ctx, result, auth, SUPPLIERS_PATH, 'inventory-suppliers');
  }

  // --- Documentos y reversión (RF-4, RF-9) ----------------------------------------------------------

  /** Unidad base de cada artículo del documento: las cantidades de la vista previa van con unidad (OBS-26). */
  const unitsOf = (detail: KardexDocumentDetailResponse) => new Map(detail.lines.map((line) => [line.itemId, line.baseUnit]));

  async function reversalForm(
    ctx: Ctx,
    status: number,
    auth: Session,
    detail: KardexDocumentDetailResponse,
    extra: { reason: string; requestId: string; errors?: Record<string, string>; notices?: SafeHtml[] },
  ): Promise<void> {
    const { document } = detail;
    const preview = await api.previewReversal(credentials(auth), document.id);
    const notices = [...(extra.notices ?? [])];
    if (!preview.ok && preview.kind === 'http' && preview.status === 409) notices.push(warning(preview.error.message, []));
    if (!preview.ok && preview.kind === 'http' && preview.status === 422) notices.push(warning(Object.values(preview.error.fields ?? {})[0] ?? preview.error.message, []));
    send(ctx, status, views.inventoryReversal({ context: auth, csrfToken: auth.csrfToken, document, units: unitsOf(detail), preview: preview.ok ? preview.data : null, ...extra, notices }));
  }

  /**
   * DEF-005 (QA del PR 3a): con la API caída, la confirmación se vuelve a pintar con el motivo y el mismo
   * `requestId`, sin leer el documento ni la vista previa (como el alta de proveedor).
   */
  function reversalUnavailable(ctx: Ctx, auth: Session | null, csrf: string, id: number, state: { reason: string; requestId: string }): void {
    send(ctx, 503, views.inventoryReversal({ context: auth, csrfToken: auth?.csrfToken ?? csrf, document: { id, typeLabel: 'Documento' }, preview: null, ...state, notices: [views.notice(UNAVAILABLE)] }));
  }

  return Object.freeze<KardexController>({
    async stock(ctx) {
      const auth = await inventorySession(ctx, STOCK_PATH);
      if (!auth) return;
      const filter = { q: queryText(ctx.query.q), categoria: queryText(ctx.query.categoria), tipo: queryText(ctx.query.tipo), estado: queryText(ctx.query.estado) };
      const [result, categories] = await Promise.all([
        api.listStock(credentials(auth), { q: filter.q, categoryId: filter.categoria, type: filter.tipo, status: filter.estado, page: queryText(ctx.query.pagina) }),
        api.listInventoryCategories(credentials(auth)),
      ]);
      const options = categories.ok ? categories.data.categories.map(({ id, name, active }) => ({ id, name, active })) : [];
      if (result.ok) return send(ctx, 200, views.inventoryStock({ context: auth, filter, categories: options, data: result.data }));
      const errors = fieldErrors(result);
      if (errors) return send(ctx, 422, views.inventoryStock({ context: auth, filter, categories: options, data: null, errors }));
      return apiFailure(ctx, result, auth, STOCK_PATH, 'inventory-stock');
    },

    async suppliers(ctx) {
      const auth = await inventorySession(ctx, SUPPLIERS_PATH);
      if (!auth) return;
      return suppliersPage(ctx, auth, 200, successNotices(ctx));
    },

    async newSupplier(ctx) {
      const auth = await inventorySession(ctx, NEW_SUPPLIER_PATH);
      if (!auth) return;
      return supplierForm(ctx, 200, auth, '', { id: null, values: { name: '', contact: '' }, requestId: newRequestId() });
    },

    async createSupplier(ctx) {
      const fields = await readClosedForm(ctx, SUPPLIER_CREATE_FIELDS, SMALL_LIMIT);
      const values = { name: fields.get('name') ?? '', contact: fields.get('contact') ?? '' };
      const requestId = requestIdOf(fields.get('requestId'));
      const csrf = fields.get('_csrf') ?? '';
      const pending: Promise<void>[] = [];
      const auth = await inventorySession(ctx, NEW_SUPPLIER_PATH, () => {
        pending.push(supplierForm(ctx, 503, null, csrf, { id: null, values, requestId, notices: [views.notice(UNAVAILABLE)] }));
        return true;
      });
      await Promise.all(pending);
      if (!auth) return;
      const result = await api.createInventorySupplier(credentials(auth, fields), { name: values.name, contact: values.contact.trim() === '' ? null : values.contact }, requestId);
      if (result.ok) return seeOther(ctx, `${SUPPLIERS_PATH}?ok=supplier_created`);
      const errors = fieldErrors(result);
      if (errors) return supplierForm(ctx, 422, auth, csrf, { id: null, values, requestId, errors });
      if (isUnavailable(result)) {
        logger.warn('api_unavailable', { path: ctx.path, reason: failureReason(result) });
        return supplierForm(ctx, 503, auth, csrf, { id: null, values, requestId, notices: [views.notice(UNAVAILABLE)] });
      }
      return apiFailure(ctx, result, auth, NEW_SUPPLIER_PATH, 'inventory-suppliers');
    },

    async editSupplier(ctx) {
      const auth = await inventorySession(ctx, SUPPLIERS_PATH);
      if (!auth) return;
      const id = idOf(ctx);
      if (id === null) return notFound(ctx, auth, 'inventory-suppliers');
      const found = await api.getInventorySupplier(credentials(auth), id);
      if (!found.ok) return apiFailure(ctx, found, auth, ctx.path, 'inventory-suppliers');
      const { supplier, history } = found.data;
      send(ctx, 200, views.inventorySupplierForm({ context: auth, csrfToken: auth.csrfToken, id, values: { name: supplier.name, contact: supplier.contact ?? '' }, version: String(supplier.version), history, notices: successNotices(ctx) }));
    },

    async updateSupplier(ctx) {
      const fields = await readClosedForm(ctx, SUPPLIER_UPDATE_FIELDS, SMALL_LIMIT);
      const id = idOf(ctx);
      const action = fields.get('action');
      if (action !== 'update' && action !== 'overwrite') ctx.throw(400, 'El formulario tiene valores imposibles.', { code: 'INVALID_FORM' });
      const values = { name: fields.get('name') ?? '', contact: fields.get('contact') ?? '' };
      const version = fields.get('version') ?? '';
      const csrf = fields.get('_csrf') ?? '';
      const pending: Promise<void>[] = [];
      const auth = await inventorySession(ctx, id === null ? SUPPLIERS_PATH : supplierEditPath(id), () => {
        if (id === null) return false;
        pending.push(supplierForm(ctx, 503, null, csrf, { id, values, version, notices: [views.notice(UNAVAILABLE)] }));
        return true;
      });
      await Promise.all(pending);
      if (!auth) return;
      if (id === null) return notFound(ctx, auth, 'inventory-suppliers');
      const numeric = Number(version);
      const result = await api.updateInventorySupplier(credentials(auth, fields), id, {
        version: Number.isSafeInteger(numeric) ? numeric : 0,
        name: values.name,
        contact: values.contact.trim() === '' ? null : values.contact,
        ...(action === 'overwrite' ? { overwrite: true } : {}),
      });
      if (result.ok) return seeOther(ctx, `${supplierEditPath(id)}?ok=supplier_saved`);
      const errors = fieldErrors(result);
      if (errors) return supplierForm(ctx, 422, auth, csrf, { id, values, version, errors });
      if (httpFailure(result, 409) && result.error.code === 'SUPPLIER_VERSION_CONFLICT') {
        // Mismo patrón que T1: lo escrito se conserva y se puede guardar encima de la versión vigente.
        const current = result.error.current;
        return supplierForm(ctx, 409, auth, csrf, {
          id,
          values,
          version: current ? String(current.version) : version,
          conflict: true,
          notices: [warning(`${current?.updatedBy ?? 'Otra persona'} guardó cambios mientras lo editabas: no se guardó nada.`, ['Revisa el historial. Si quieres conservar lo que escribiste, guárdalo sobre la versión vigente.'])],
        });
      }
      if (isUnavailable(result)) {
        logger.warn('api_unavailable', { path: ctx.path, reason: failureReason(result) });
        return supplierForm(ctx, 503, auth, csrf, { id, values, version, notices: [views.notice(UNAVAILABLE)] });
      }
      return apiFailure(ctx, result, auth, supplierEditPath(id), 'inventory-suppliers');
    },

    deactivateSupplier: (ctx) => changeSupplierStatus(ctx, false),
    reactivateSupplier: (ctx) => changeSupplierStatus(ctx, true),

    async documents(ctx) {
      const auth = await inventorySession(ctx, DOCUMENTS_PATH);
      if (!auth) return;
      const filter = { tipo: queryText(ctx.query.tipo), proveedor: queryText(ctx.query.proveedor) };
      const [result, suppliers] = await Promise.all([
        api.listKardexDocuments(credentials(auth), { type: filter.tipo, supplierId: filter.proveedor, page: queryText(ctx.query.pagina) }),
        api.listInventorySuppliers(credentials(auth), { status: 'all' }),
      ]);
      const options = suppliers.ok ? suppliers.data.suppliers.map(({ id, name }) => ({ id, name })) : [];
      if (result.ok) return send(ctx, 200, views.inventoryDocuments({ context: auth, filter, suppliers: options, data: result.data }));
      const errors = fieldErrors(result);
      if (errors) return send(ctx, 422, views.inventoryDocuments({ context: auth, filter, suppliers: options, data: null, errors }));
      return apiFailure(ctx, result, auth, DOCUMENTS_PATH, 'inventory-documents');
    },

    async document(ctx) {
      const auth = await inventorySession(ctx, DOCUMENTS_PATH);
      if (!auth) return;
      const id = idOf(ctx);
      if (id === null) return notFound(ctx, auth, 'inventory-documents');
      const result = await api.getKardexDocument(credentials(auth), id);
      if (!result.ok) return apiFailure(ctx, result, auth, ctx.path, 'inventory-documents');
      send(ctx, 200, views.inventoryDocument({ context: auth, data: result.data, notices: successNotices(ctx) }));
    },

    async reversalPage(ctx) {
      const auth = await inventorySession(ctx, DOCUMENTS_PATH);
      if (!auth) return;
      const id = idOf(ctx);
      if (id === null) return notFound(ctx, auth, 'inventory-documents');
      const found = await api.getKardexDocument(credentials(auth), id);
      if (!found.ok) return apiFailure(ctx, found, auth, ctx.path, 'inventory-documents');
      const { document } = found.data;
      if (document.type === 'reversion' || document.reversedById !== null) return seeOther(ctx, documentPath(id));
      return reversalForm(ctx, 200, auth, found.data, { reason: '', requestId: newRequestId() });
    },

    async reverse(ctx) {
      const fields = await readClosedForm(ctx, REVERSAL_FIELDS, SMALL_LIMIT);
      const id = idOf(ctx);
      if (fields.get('action') !== 'reverse') ctx.throw(400, 'El formulario tiene valores imposibles.', { code: 'INVALID_FORM' });
      const reason = fields.get('reason') ?? '';
      const requestId = requestIdOf(fields.get('requestId'));
      const csrf = fields.get('_csrf') ?? '';
      const state = { reason, requestId };
      const auth = await inventorySession(ctx, id === null ? DOCUMENTS_PATH : reversalPath(id), () => {
        if (id === null) return false;
        reversalUnavailable(ctx, null, csrf, id, state);
        return true;
      });
      if (!auth) return;
      if (id === null) return notFound(ctx, auth, 'inventory-documents');
      // La escritura va primero: el documento solo se lee para volver a pintar la confirmación.
      const result = await api.reverseDocument(credentials(auth, fields), id, { reason }, requestId);
      if (result.ok) return seeOther(ctx, `${documentPath(result.data.document.id)}?ok=reversed`);
      if (isUnavailable(result)) {
        logger.warn('api_unavailable', { path: ctx.path, reason: failureReason(result) });
        return reversalUnavailable(ctx, auth, csrf, id, state);
      }
      const errors = fieldErrors(result);
      const conflict = httpFailure(result, 409);
      if (!errors && !conflict) return apiFailure(ctx, result, auth, reversalPath(id), 'inventory-documents');
      const found = await api.getKardexDocument(credentials(auth), id);
      if (!found.ok) {
        if (isUnavailable(found)) return reversalUnavailable(ctx, auth, csrf, id, state);
        return apiFailure(ctx, found, auth, reversalPath(id), 'inventory-documents');
      }
      if (errors) return reversalForm(ctx, 422, auth, found.data, { ...state, errors });
      logger.info('inventory_reversal_rejected', { documentId: id, code: result.ok ? '' : result.kind === 'http' ? result.error.code : '' });
      const returns = !result.ok && result.kind === 'http' ? result.error.returnIds?.map((returnId) => `#${returnId}`).join(', ') : undefined;
      const message = !result.ok && result.kind === 'http' ? result.error.message : '';
      return reversalForm(ctx, 409, auth, found.data, { ...state, notices: [warning(message, returns ? [`Devoluciones vigentes: ${returns}.`] : [])] });
    },
  });
}
