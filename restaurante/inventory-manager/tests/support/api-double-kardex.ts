import type { Context } from 'koa';

import {
  IDEMPOTENCY_HEADER,
  type AdminUser,
  type InventoryItem,
  type ItemKardexResponse,
  type KardexDocument,
  type KardexDocumentDetailResponse,
  type KardexReversalPreviewResponse,
  type StockResponse,
  type Supplier,
} from '@restaurante/contracts';

/**
 * Doble de las rutas del Kardex de `/api/v1/admin/inventario` (REQ-F-051, T3) para las pruebas de las
 * pantallas: existencias, proveedores, documentos, vista previa y reversión, y el Kardex del artículo.
 * Los datos los ponen las pruebas; las reglas reales (CPP, existencias, idempotencia persistente) están
 * en core y se prueban en api/tests. Reglas mínimas para la interfaz: 422 por campo (filtro desconocido,
 * nombre vacío o repetido, motivo vacío), 409 de versión con `current`, 409 de reversión y alta e
 * idempotencia por `Idempotency-Key` (registra las claves recibidas: OBS-16).
 */

export interface KardexDouble {
  stock: StockResponse;
  suppliers: Supplier[];
  documents: Map<number, KardexDocumentDetailResponse>;
  previews: Map<number, KardexReversalPreviewResponse>;
  kardex: Map<number, ItemKardexResponse>;
  /** Compras con devoluciones vigentes (409 DOCUMENT_HAS_RETURNS al revertir). */
  blockedByReturns: Map<number, number[]>;
  /** `Idempotency-Key` recibidas en las escrituras. */
  keys: string[];
  /** Cambia un proveedor "desde otra sesión" (para el 409). */
  touchSupplier(id: number, by: string): void;
}

const AT = '2026-11-26T10:00:00-06:00';
const PAGE = { number: 1, size: 50, total: 0 };

export function createKardexDouble(): KardexDouble {
  const double: KardexDouble = {
    stock: { entries: [], totals: { positiveValue: '0.00', negativeValue: '0.00', noCostCount: 0 }, page: PAGE },
    suppliers: [],
    documents: new Map(),
    previews: new Map(),
    kardex: new Map(),
    blockedByReturns: new Map(),
    keys: [],
    touchSupplier(id, by) {
      const found = double.suppliers.find((supplier) => supplier.id === id);
      if (found) Object.assign(found, { version: found.version + 1, updatedBy: by });
    },
  };
  return double;
}

let sequence = 9000;
const replays = new Map<string, number>();

function fail(ctx: Context, status: number, code: string, message: string, more: Record<string, unknown> = {}): void {
  ctx.status = status;
  ctx.body = { error: { code, message, ...more } };
}
const invalid = (ctx: Context, fields: Record<string, string>) => fail(ctx, 422, 'VALIDATION_FAILED', 'Los datos no son válidos: no se guardó nada.', { fields });
const pageOf = (query: unknown): number => (typeof query === 'string' && /^[1-9]\d*$/.test(query) ? Number(query) : 1);

/** true si la ruta es del Kardex (la atiende este doble). */
export const isKardexPath = (path: string): boolean => /^\/(existencias|proveedores|documentos|kardex)(\/|$)/.test(path) || /^\/articulos\/\d+\/kardex$/.test(path);

export function handleKardex(ctx: Context, double: KardexDouble, items: readonly InventoryItem[], user: AdminUser, path: string, record: Record<string, unknown>): void {
  const key = ctx.get(IDEMPOTENCY_HEADER);
  if (ctx.method !== 'GET' && key !== '') double.keys.push(key);

  if (path === '/existencias' && ctx.method === 'GET') {
    const estado = ctx.query.estado;
    if (estado !== undefined && estado !== '' && !['todos', 'negativos', 'sin_costo'].includes(String(estado))) return invalid(ctx, { estado: 'Elige todos, negativos o sin costo.' });
    ctx.body = { ...double.stock, page: { ...double.stock.page, number: pageOf(ctx.query.pagina) } };
    return;
  }

  const kardexMatch = /^\/articulos\/(\d+)\/kardex$/.exec(path);
  if (kardexMatch && ctx.method === 'GET') {
    const id = Number(kardexMatch[1]);
    const item = items.find((entry) => entry.id === id);
    if (!item) return fail(ctx, 404, 'ITEM_NOT_FOUND', 'Artículo no encontrado.');
    ctx.body = double.kardex.get(id) ?? { item: { id, name: item.name, kind: item.kind, type: item.type, baseUnit: item.baseUnit, active: item.active }, stock: null, movements: [], page: PAGE };
    return;
  }

  if (path === '/proveedores') {
    if (ctx.method === 'GET') {
      const estado = typeof ctx.query.estado === 'string' && ctx.query.estado !== '' ? ctx.query.estado : 'active';
      if (!['active', 'inactive', 'all'].includes(estado)) return invalid(ctx, { estado: 'Elige activos, inactivos o todos.' });
      const q = typeof ctx.query.q === 'string' ? ctx.query.q.toLowerCase() : '';
      const list = double.suppliers.filter((supplier) => (estado === 'all' || supplier.active === (estado === 'active')) && supplier.name.toLowerCase().includes(q));
      ctx.body = { suppliers: list, page: { number: pageOf(ctx.query.pagina), size: 50, total: list.length } };
      return;
    }
    if (ctx.method === 'POST') {
      const replayed = key !== '' ? replays.get(`proveedor:${key}`) : undefined;
      const existing = double.suppliers.find((supplier) => supplier.id === replayed);
      if (existing) {
        ctx.status = 201;
        ctx.body = { supplier: existing };
        return;
      }
      const name = typeof record.name === 'string' ? record.name.trim() : '';
      if (name === '') return invalid(ctx, { name: 'Escribe el nombre.' });
      if (double.suppliers.some((supplier) => supplier.active && supplier.name.toLowerCase() === name.toLowerCase())) return invalid(ctx, { name: 'Ya hay un proveedor activo con ese nombre.' });
      const supplier: Supplier = { id: ++sequence, name, contact: typeof record.contact === 'string' ? record.contact : null, active: true, version: 1, updatedAt: AT, updatedBy: user.name };
      double.suppliers.push(supplier);
      if (key !== '') replays.set(`proveedor:${key}`, supplier.id);
      ctx.status = 201;
      ctx.body = { supplier };
      return;
    }
  }

  const supplierMatch = /^\/proveedores\/(\d+)(?:\/(desactivar|reactivar))?$/.exec(path);
  if (supplierMatch) {
    const supplier = double.suppliers.find((entry) => entry.id === Number(supplierMatch[1]));
    if (!supplier) return fail(ctx, 404, 'SUPPLIER_NOT_FOUND', 'Proveedor no encontrado.');
    const action = supplierMatch[2];
    if (ctx.method === 'GET' && !action) {
      ctx.body = { supplier, history: [{ id: 1, at: AT, action: 'create', author: 'Semilla', changes: [{ field: 'name', before: null, after: supplier.name }] }] };
      return;
    }
    if (record.version !== supplier.version) {
      return fail(ctx, 409, 'SUPPLIER_VERSION_CONFLICT', 'El proveedor cambió mientras lo editabas: no se guardó nada.', { current: { id: supplier.id, version: supplier.version, updatedAt: supplier.updatedAt, updatedBy: supplier.updatedBy } });
    }
    if (ctx.method === 'PUT') {
      const name = typeof record.name === 'string' ? record.name.trim() : '';
      if (name === '') return invalid(ctx, { name: 'Escribe el nombre.' });
      Object.assign(supplier, { name, contact: typeof record.contact === 'string' ? record.contact : null, version: supplier.version + 1, updatedBy: user.name });
    } else if (action) {
      Object.assign(supplier, { active: action === 'reactivar', version: supplier.version + 1, updatedBy: user.name });
    }
    ctx.body = { supplier };
    return;
  }

  if (path === '/documentos' && ctx.method === 'GET') {
    const tipo = ctx.query.tipo;
    if (typeof tipo === 'string' && tipo !== '' && !['saldo_inicial', 'compra', 'devolucion_proveedor', 'ajuste', 'reversion'].includes(tipo)) return invalid(ctx, { tipo: 'Elige un tipo de la lista.' });
    const documents = [...double.documents.values()].map((detail) => detail.document).filter((document) => !tipo || document.type === tipo).sort((a, b) => b.id - a.id);
    ctx.body = { documents, page: { number: pageOf(ctx.query.pagina), size: 50, total: documents.length } };
    return;
  }

  const documentMatch = /^\/documentos\/(\d+)(?:\/(reversion))?$/.exec(path);
  if (documentMatch) {
    const id = Number(documentMatch[1]);
    const detail = double.documents.get(id);
    if (!detail) return fail(ctx, 404, 'DOCUMENT_NOT_FOUND', 'Documento no encontrado.');
    if (!documentMatch[2] && ctx.method === 'GET') {
      ctx.body = detail;
      return;
    }
    const { document } = detail;
    if (document.type === 'reversion') return fail(ctx, 409, 'REVERSAL_NOT_REVERSIBLE', 'Una reversión no se puede revertir.');
    if (document.reversedById !== null) return fail(ctx, 409, 'ALREADY_REVERSED', 'El documento ya se revirtió.');
    if (ctx.method === 'GET') {
      ctx.body = double.previews.get(id) ?? { lines: [] };
      return;
    }
    const replayed = key !== '' ? replays.get(`reversion:${key}`) : undefined;
    if (replayed !== undefined) {
      ctx.status = 200;
      ctx.body = { document: double.documents.get(replayed)?.document, replayed: true };
      return;
    }
    const reason = typeof record.reason === 'string' ? record.reason.trim() : '';
    if (reason === '') return invalid(ctx, { reason: 'Escribe el motivo de la reversión.' });
    const returns = double.blockedByReturns.get(id);
    if (returns) return fail(ctx, 409, 'DOCUMENT_HAS_RETURNS', `Revierte primero las devoluciones ${returns.map((returnId) => `#${returnId}`).join(', ')}.`, { returnIds: returns });
    const reversal: KardexDocument = { ...document, id: ++sequence, type: 'reversion', typeLabel: 'Reversión', note: reason, reversesDocumentId: id, reversedById: null, sourceDocumentId: null, author: user.name };
    double.documents.set(reversal.id, { document: reversal, lines: [], returns: [] });
    detail.document = { ...document, reversedById: reversal.id };
    if (key !== '') replays.set(`reversion:${key}`, reversal.id);
    ctx.status = 201;
    ctx.body = { document: reversal, replayed: false };
    return;
  }

  fail(ctx, 404, 'NOT_FOUND', 'Ruta no encontrada.');
}
