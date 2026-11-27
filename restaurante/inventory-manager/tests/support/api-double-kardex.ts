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
  /** Cuerpos de los documentos registrados (REQ-F-051, PR 3b), en orden. */
  writes: { path: string; body: Record<string, unknown> }[];
  /** Artículos que ya tienen movimientos: no se ofrecen para el saldo inicial y su saldo responde 409. */
  takenItems: Set<number>;
  /** Artículos con movimientos que las opciones todavía no reflejan (carrera): solo el saldo responde 409. */
  conflictItems: Set<number>;
  /** La próxima escritura de un documento responde 503 `INVENTORY_BUSY`. */
  busyNext: boolean;
  /** «Hoy» de las opciones de los formularios. */
  today: string;
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
    writes: [],
    takenItems: new Set(),
    conflictItems: new Set(),
    busyNext: false,
    today: '2026-11-26',
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

  if (path === '/kardex/opciones' && ctx.method === 'GET') {
    const stockTypes = ['insumo', 'intermedio', 'reventa'];
    ctx.body = {
      items: items
        .filter((item) => item.active && item.kind !== 'parent' && item.inventoriable && stockTypes.includes(item.type))
        .map((item) => ({ id: item.id, name: item.name, kind: item.kind, type: item.type, baseUnit: item.baseUnit, active: item.active, units: item.units, referenceCost: item.referenceCost, avgCost: null, initialBalanceAllowed: !double.takenItems.has(item.id) })),
      suppliers: double.suppliers.filter((supplier) => supplier.active).map(({ id, name }) => ({ id, name })),
      today: double.today,
    };
    return;
  }

  const writeMatch = /^\/documentos\/(saldo-inicial|compras|ajustes)$/.exec(path) ?? /^\/documentos\/(\d+)\/devoluciones$/.exec(path);
  if (writeMatch && ctx.method === 'POST') {
    const replayed = key !== '' ? replays.get(`documento:${key}`) : undefined;
    const previous = replayed === undefined ? undefined : double.documents.get(replayed);
    if (previous) {
      ctx.status = 200;
      ctx.body = { document: previous.document, replayed: true };
      return;
    }
    if (double.busyNext) {
      double.busyNext = false;
      return fail(ctx, 503, 'INVENTORY_BUSY', 'El inventario está ocupado con otra escritura: inténtalo de nuevo en unos segundos. No se guardó nada.');
    }
    const fields: Record<string, string> = {};
    if (typeof record.occurredOn !== 'string' || record.occurredOn === '' || record.occurredOn > double.today) fields.occurredOn = 'La fecha no puede ser futura.';
    const lines = Array.isArray(record.lines) ? (record.lines as Record<string, unknown>[]) : [];
    if (lines.length === 0) fields.lines = 'Añade al menos una línea.';
    const purchase = /^\d+$/.test(writeMatch[1] ?? '') ? double.documents.get(Number(writeMatch[1])) : undefined;
    lines.forEach((line, index) => {
      if (purchase) {
        const source = purchase.lines.find((entry) => entry.id === line.sourceMovementId);
        if (!source) fields[`lines.${index}.item`] = 'La línea no pertenece a esta compra.';
        else if (Number(line.quantity) > Number(source.returnable ?? '0')) fields[`lines.${index}.quantity`] = 'Es más de lo que queda por devolver de esta línea.';
        return;
      }
      if (line.itemId === 0) fields[`lines.${index}.item`] = 'Elige un artículo.';
      if (typeof line.quantity !== 'string' || !/^\d+(\.\d{1,3})?$/.test(line.quantity)) fields[`lines.${index}.quantity`] = 'Escribe un número sin signo, con punto decimal (p. ej. 24 o 0.355).';
      if (typeof line.amount === 'string' && !/^\d+(\.\d{1,2})?$/.test(line.amount)) fields[`lines.${index}.amount`] = 'Máximo 2 decimales.';
    });
    if (Object.keys(fields).length > 0) return invalid(ctx, fields);
    const taken = writeMatch[1] === 'saldo-inicial' ? lines.filter((line) => double.takenItems.has(Number(line.itemId)) || double.conflictItems.has(Number(line.itemId))) : [];
    if (taken.length > 0) {
      return fail(ctx, 409, 'INITIAL_BALANCE_NOT_ALLOWED', 'El artículo ya tiene movimientos: corrige su existencia con un ajuste.', {
        items: taken.map((line) => ({ itemId: Number(line.itemId), name: items.find((item) => item.id === Number(line.itemId))?.name ?? '' })),
      });
    }
    const type = purchase ? 'devolucion_proveedor' : writeMatch[1] === 'compras' ? 'compra' : writeMatch[1] === 'ajustes' ? 'ajuste' : 'saldo_inicial';
    const labels: Record<string, string> = { compra: 'Compra', ajuste: 'Ajuste', saldo_inicial: 'Saldo inicial', devolucion_proveedor: 'Devolución a proveedor' };
    const document: KardexDocument = {
      id: ++sequence,
      type,
      typeLabel: labels[type] ?? type,
      occurredOn: String(record.occurredOn),
      recordedAt: AT,
      supplier: null,
      reference: null,
      costBasis: type === 'compra' ? 'con_iva' : null,
      reason: typeof record.reason === 'string' ? record.reason : null,
      note: typeof record.note === 'string' ? record.note : null,
      totalCost: '0.0000',
      reversesDocumentId: null,
      reversedById: null,
      sourceDocumentId: purchase ? purchase.document.id : null,
      author: user.name,
    };
    double.documents.set(document.id, { document, lines: [], returns: [] });
    double.writes.push({ path, body: record });
    if (key !== '') replays.set(`documento:${key}`, document.id);
    ctx.status = 201;
    ctx.body = { document, replayed: false };
    return;
  }

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
