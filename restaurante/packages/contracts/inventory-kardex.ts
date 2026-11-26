import { z } from 'zod';

import { ADMIN_API_PREFIX } from './admin.ts';
import { INVENTORY_HISTORY_ACTIONS, INVENTORY_ITEM_KINDS, INVENTORY_ITEM_TYPES, INVENTORY_UNITS, costText, itemStockSchema, packagingUnitSchema } from './inventory.ts';

/**
 * Contrato del Kardex y de los proveedores del inventario (REQ-F-051, T3) en `/api/v1/admin/inventario`:
 * proveedores, documentos (saldo inicial, compra, ajuste, devolución a proveedor y reversión), detalle
 * y lista de documentos, existencias valorizadas y Kardex del artículo. Solo administradores y
 * gerentes (403 `FORBIDDEN_ROLE` al resto); las escrituras llevan el token CSRF.
 *
 * - Las reglas viven en core (`packages/core/inventory`). Un 422 `VALIDATION_FAILED` trae `fields` por
 *   campo y línea (`occurredOn`, `supplierId`, `reason`, `note`, `lines`, `lines.N.item`,
 *   `lines.N.quantity`, `lines.N.unit`, `lines.N.amount`, `lines.N.unitCost`, `lines.N.direction`…).
 * - Cantidades con 3 decimales y con signo («-2.000»), costos con 4 («21.3333»), importes con 4
 *   («1000.0000»; la pantalla los redondea a 2) y valores de existencia con 2 («1000.00»). Siempre
 *   texto, nunca `number`. Un costo que falta es `null` («Sin costo»), nunca 0.
 * - Las escrituras de documentos admiten `Idempotency-Key` persistente (DT-14): el mismo envío repetido
 *   devuelve 200 con el documento ya registrado (`replayed: true`); con otros datos, 422.
 */

export const INVENTORY_KARDEX_ERROR_CODES = Object.freeze({
  SUPPLIER_NOT_FOUND: 'SUPPLIER_NOT_FOUND',
  SUPPLIER_VERSION_CONFLICT: 'SUPPLIER_VERSION_CONFLICT',
  DOCUMENT_NOT_FOUND: 'DOCUMENT_NOT_FOUND',
  INITIAL_BALANCE_NOT_ALLOWED: 'INITIAL_BALANCE_NOT_ALLOWED',
  ALREADY_REVERSED: 'ALREADY_REVERSED',
  REVERSAL_NOT_REVERSIBLE: 'REVERSAL_NOT_REVERSIBLE',
  DOCUMENT_HAS_RETURNS: 'DOCUMENT_HAS_RETURNS',
  DOCUMENT_NOT_RETURNABLE: 'DOCUMENT_NOT_RETURNABLE',
  DOCUMENT_REVERSED: 'DOCUMENT_REVERSED',
} as const);

/** Tipos de documento y movimiento (copia de `MOVEMENT_TYPES` de core; una prueba de `api/` lo vigila). */
export const INVENTORY_MOVEMENT_TYPES = Object.freeze([
  'saldo_inicial',
  'compra',
  'devolucion_proveedor',
  'ajuste',
  'reversion',
  'merma',
  'consumo_interno',
  'produccion',
  'conteo',
  'venta',
  'devolucion_venta',
] as const);
export type InventoryMovementType = (typeof INVENTORY_MOVEMENT_TYPES)[number];

/** Filtro `estado` de Existencias (query). */
export const INVENTORY_STOCK_STATUSES = Object.freeze(['todos', 'negativos', 'sin_costo'] as const);
export type InventoryStockStatus = (typeof INVENTORY_STOCK_STATUSES)[number];
/** Tipos que llevan existencias (filtro `tipo` de Existencias; RN-T3-1). */
export const INVENTORY_STOCK_ITEM_TYPES = Object.freeze(['insumo', 'intermedio', 'reventa'] as const);
export const INVENTORY_ADJUSTMENT_REASONS = Object.freeze(['error_captura', 'otro'] as const);
export const INVENTORY_ADJUSTMENT_DIRECTIONS = Object.freeze(['entrada', 'salida'] as const);

const INVENTORY_PREFIX = `${ADMIN_API_PREFIX}/inventario`;

/** Rutas del Kardex y de los proveedores (relativas al origen de la API). */
export const inventoryKardexPaths = Object.freeze({
  suppliers: `${INVENTORY_PREFIX}/proveedores`,
  supplier: (id: number) => `${INVENTORY_PREFIX}/proveedores/${id}`,
  supplierStatus: (id: number, action: 'desactivar' | 'reactivar') => `${INVENTORY_PREFIX}/proveedores/${id}/${action}`,
  options: `${INVENTORY_PREFIX}/kardex/opciones`,
  documents: `${INVENTORY_PREFIX}/documentos`,
  document: (id: number) => `${INVENTORY_PREFIX}/documentos/${id}`,
  initialBalances: `${INVENTORY_PREFIX}/documentos/saldo-inicial`,
  purchases: `${INVENTORY_PREFIX}/documentos/compras`,
  adjustments: `${INVENTORY_PREFIX}/documentos/ajustes`,
  returns: (purchaseId: number) => `${INVENTORY_PREFIX}/documentos/${purchaseId}/devoluciones`,
  reversal: (id: number) => `${INVENTORY_PREFIX}/documentos/${id}/reversion`,
  stock: `${INVENTORY_PREFIX}/existencias`,
  itemKardex: (itemId: number) => `${INVENTORY_PREFIX}/articulos/${itemId}/kardex`,
});

const id = z.number().int().positive();
const isoDate = z.string().min(1);
const businessDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const quantityText = z.string().regex(/^-?\d+\.\d{3}$/);
const totalText = z.string().regex(/^\d+\.\d{4}$/);
const valueText = z.string().regex(/^-?\d+\.\d{2}$/);
const page = z.object({ number: id, size: id, total: z.number().int().nonnegative() });

// --- Proveedores (RF-1) ------------------------------------------------------------------------------

export const supplierSchema = z.object({
  id,
  name: z.string(),
  contact: z.string().nullable(),
  active: z.boolean(),
  version: id,
  updatedAt: isoDate,
  updatedBy: z.string().nullable(),
});
export type Supplier = z.infer<typeof supplierSchema>;

export const supplierListResponseSchema = z.object({ suppliers: z.array(supplierSchema), page });
export type SupplierListResponse = z.infer<typeof supplierListResponseSchema>;

export const supplierDetailResponseSchema = z.object({
  supplier: supplierSchema,
  history: z.array(z.object({ id, at: isoDate, action: z.enum(INVENTORY_HISTORY_ACTIONS), author: z.string(), changes: z.array(z.object({ field: z.string(), before: z.unknown(), after: z.unknown() })) })),
});
export type SupplierDetailResponse = z.infer<typeof supplierDetailResponseSchema>;

export const supplierResponseSchema = z.object({ supplier: supplierSchema });
export type SupplierResponse = z.infer<typeof supplierResponseSchema>;

export interface SupplierCreateRequest {
  name: string;
  contact?: string | null;
}
export interface SupplierUpdateRequest extends SupplierCreateRequest {
  version: number;
  overwrite?: boolean;
}
export interface SupplierStatusRequest {
  version: number;
}
/** Query de la lista de proveedores (`estado`: active | inactive | all, `q`, `pagina`). */
export interface SupplierListFilter {
  status?: string;
  q?: string;
  page?: string;
}

// --- Documentos y movimientos (RF-2 a RF-6, RF-8, RF-9) ----------------------------------------------

const authorSchema = z.string();

export const kardexDocumentSchema = z.object({
  id,
  /** Texto: un tipo de una versión posterior se muestra como «tipo no reconocido». */
  type: z.string(),
  typeLabel: z.string(),
  occurredOn: businessDay,
  recordedAt: isoDate,
  supplier: z.object({ id, name: z.string() }).nullable(),
  reference: z.string().nullable(),
  costBasis: z.string().nullable(),
  reason: z.string().nullable(),
  note: z.string().nullable(),
  totalCost: totalText,
  reversesDocumentId: id.nullable(),
  reversedById: id.nullable(),
  sourceDocumentId: id.nullable(),
  author: authorSchema,
});
export type KardexDocument = z.infer<typeof kardexDocumentSchema>;

export const kardexMovementSchema = z.object({
  id,
  documentId: id,
  line: id,
  itemId: id,
  seq: id,
  type: z.string(),
  typeLabel: z.string(),
  quantity: quantityText,
  enteredQuantity: quantityText,
  enteredUnit: z.string(),
  balanceBefore: quantityText,
  balanceAfter: quantityText,
  unitCost: costText.nullable(),
  lineTotal: totalText.nullable(),
  avgCostBefore: costText.nullable(),
  avgCostAfter: costText.nullable(),
  sourceMovementId: id.nullable(),
  recordedAt: isoDate,
  author: authorSchema,
});
export type KardexMovement = z.infer<typeof kardexMovementSchema>;

export const kardexDocumentLineSchema = kardexMovementSchema.extend({
  itemName: z.string(),
  baseUnit: z.enum(INVENTORY_UNITS).nullable(),
  /** Compras no revertidas: lo que queda por devolver de la línea; null en el resto. */
  returnable: quantityText.nullable(),
});
export type KardexDocumentLine = z.infer<typeof kardexDocumentLineSchema>;

export const kardexDocumentDetailResponseSchema = z.object({
  document: kardexDocumentSchema,
  lines: z.array(kardexDocumentLineSchema),
  returns: z.array(kardexDocumentSchema),
});
export type KardexDocumentDetailResponse = z.infer<typeof kardexDocumentDetailResponseSchema>;

export const kardexDocumentListResponseSchema = z.object({ documents: z.array(kardexDocumentSchema), page });
export type KardexDocumentListResponse = z.infer<typeof kardexDocumentListResponseSchema>;

export const kardexDocumentWriteResponseSchema = z.object({ document: kardexDocumentSchema, replayed: z.boolean() });
export type KardexDocumentWriteResponse = z.infer<typeof kardexDocumentWriteResponseSchema>;

export const kardexReversalPreviewResponseSchema = z.object({
  lines: z.array(z.object({ itemId: id, itemName: z.string(), quantity: quantityText, unitCost: costText.nullable(), balanceAfter: quantityText, negative: z.boolean() })),
});
export type KardexReversalPreviewResponse = z.infer<typeof kardexReversalPreviewResponseSchema>;

export interface InitialBalanceRequest {
  occurredOn: string;
  note?: string | null;
  lines: { itemId: number; quantity: string; unit: string; unitCost: string }[];
}
export interface PurchaseRequest {
  occurredOn: string;
  supplierId?: number | null;
  reference?: string | null;
  note?: string | null;
  lines: { itemId: number; quantity: string; unit: string; amount: string }[];
}
export interface AdjustmentRequest {
  occurredOn: string;
  reason: string;
  note?: string | null;
  lines: { itemId: number; direction: string; quantity: string; unit: string; unitCost?: string | null }[];
}
export interface SupplierReturnRequest {
  occurredOn: string;
  note?: string | null;
  lines: { sourceMovementId: number; quantity: string }[];
}
export interface ReversalRequest {
  reason: string;
}
/** Query de la lista de documentos (`tipo`, `proveedor`, `pagina`). */
export interface KardexDocumentFilter {
  type?: string;
  supplierId?: string;
  page?: string;
}

// --- Existencias, Kardex del artículo y opciones (RF-7, RF-8) ----------------------------------------

const stockItemSchema = z.object({ id, name: z.string(), kind: z.enum(INVENTORY_ITEM_KINDS), type: z.enum(INVENTORY_ITEM_TYPES), baseUnit: z.enum(INVENTORY_UNITS).nullable(), active: z.boolean() });

export const stockResponseSchema = z.object({
  entries: z.array(
    z.object({
      item: stockItemSchema,
      categoryName: z.string(),
      quantity: quantityText,
      avgCost: costText.nullable(),
      lastCost: costText.nullable(),
      /** existencia × CPP con 2 decimales; null sin costo. */
      value: valueText.nullable(),
      negative: z.boolean(),
      noCost: z.boolean(),
    }),
  ),
  totals: z.object({ positiveValue: valueText, negativeValue: valueText, noCostCount: z.number().int().nonnegative() }),
  page,
});
export type StockResponse = z.infer<typeof stockResponseSchema>;

/** Query de Existencias (`q`, `categoria`, `tipo`, `estado`, `pagina`). */
export interface StockFilter {
  q?: string;
  categoryId?: string;
  type?: string;
  status?: string;
  page?: string;
}

export const itemKardexResponseSchema = z.object({ item: stockItemSchema, stock: itemStockSchema.nullable(), movements: z.array(kardexMovementSchema), page });
export type ItemKardexResponse = z.infer<typeof itemKardexResponseSchema>;

export const kardexOptionsResponseSchema = z.object({
  items: z.array(stockItemSchema.extend({ units: z.array(packagingUnitSchema), referenceCost: costText.nullable(), avgCost: costText.nullable(), initialBalanceAllowed: z.boolean() })),
  suppliers: z.array(z.object({ id, name: z.string() })),
});
export type KardexOptionsResponse = z.infer<typeof kardexOptionsResponseSchema>;
