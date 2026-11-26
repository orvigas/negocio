/**
 * Kardex del inventario (REQ-F-051, T3): tipos de documento y de movimiento, listas cerradas y la forma
 * de los datos que guarda el store. Los tipos, el criterio de costo y los motivos se guardan como
 * VARCHAR (DT-T3-1 y DT-15): esta lista es la única fuente, y un valor que no conoce (escrito por una
 * versión posterior) se muestra como «tipo no reconocido» sin romper la lectura.
 */

/** Todos los tipos de movimiento y de documento. Los de T4 y E2 están reservados: nadie los escribe aún. */
export const MOVEMENT_TYPES = Object.freeze([
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
export type MovementType = (typeof MOVEMENT_TYPES)[number];

/** Tipos que se escriben en T3. */
export const T3_DOCUMENT_TYPES = Object.freeze(['saldo_inicial', 'compra', 'devolucion_proveedor', 'ajuste', 'reversion'] as const satisfies readonly MovementType[]);
export type T3DocumentType = (typeof T3_DOCUMENT_TYPES)[number];

export const isMovementType = (value: unknown): value is MovementType => typeof value === 'string' && (MOVEMENT_TYPES as readonly string[]).includes(value);

/** Etiqueta legible de un tipo; uno desconocido no rompe la lectura. */
export const MOVEMENT_TYPE_LABELS: Readonly<Record<MovementType, string>> = Object.freeze({
  saldo_inicial: 'Saldo inicial',
  compra: 'Compra',
  devolucion_proveedor: 'Devolución a proveedor',
  ajuste: 'Ajuste',
  reversion: 'Reversión',
  merma: 'Merma',
  consumo_interno: 'Consumo interno',
  produccion: 'Producción',
  conteo: 'Conteo',
  venta: 'Venta',
  devolucion_venta: 'Devolución de venta',
});
export const movementTypeLabel = (type: string): string => (isMovementType(type) ? MOVEMENT_TYPE_LABELS[type] : 'Movimiento (tipo no reconocido)');

/** Criterio del costo de compra (PV-6). T3 siempre guarda `con_iva` (PV-T3-11). */
export const COST_BASES = Object.freeze(['con_iva', 'sin_iva'] as const);
export type CostBasis = (typeof COST_BASES)[number];

/** Motivos del ajuste (P-5, PV-T3-1). `otro` exige nota. */
export const ADJUSTMENT_REASONS = Object.freeze(['error_captura', 'otro'] as const);
export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number];

/** Tipos de artículo que llevan existencias (RN-T3-1; P-4: también se compran Intermedios). */
export const STOCK_ITEM_TYPES = Object.freeze(['insumo', 'intermedio', 'reventa'] as const);

export const DOCUMENT_MAX_LINES = 50;
export const REFERENCE_MAX = 40;
export const DOCUMENT_NOTE_MAX = 400;
/** Fecha del hecho: hoy o hasta 31 días atrás (RN-T3-3, DT-8). */
export const OCCURRED_ON_WINDOW_DAYS = 31;
/** Escala de los importes capturados (PV-T3-6). */
export const AMOUNT_SCALE = 2;
/** Escala de los importes guardados (DECIMAL(19,4)). */
export const TOTAL_SCALE = 4;
export const KARDEX_PAGE_SIZE = 50;

/** Existencia de un artículo (proyección del Kardex, DT-T3-2). Cantidad con escala 3, costos con escala 4. */
export interface StockRow {
  itemId: number;
  quantity: bigint;
  avgCost: bigint | null;
  lastCost: bigint | null;
  lastSeq: number;
  updatedAt: Date;
}

/** Cabecera de un documento del Kardex, tal como se guarda (inmutable). */
export interface KardexDocument {
  id: number;
  /** Tipo de MOVEMENT_TYPES (texto: puede venir de una versión posterior). */
  type: string;
  /** Fecha del hecho, `AAAA-MM-DD` en BUSINESS_TIMEZONE. */
  occurredOn: string;
  recordedAt: Date;
  supplierId: number | null;
  reference: string | null;
  costBasis: string | null;
  reason: string | null;
  note: string | null;
  /** Escala 4. */
  totalCost: bigint;
  reversesDocumentId: number | null;
  sourceDocumentId: number | null;
  idempotencyKey: string | null;
  requestHash: string | null;
  actorId: number | null;
  actorName: string;
  /** Leído, no guardado: id de la reversión de este documento, o null. */
  reversedById: number | null;
}

export type NewKardexDocument = Omit<KardexDocument, 'id' | 'reversedById'>;

/** Movimiento del Kardex (RN-8, RN-T3-2). */
export interface KardexMovement {
  id: number;
  documentId: number;
  line: number;
  itemId: number;
  seq: number;
  type: string;
  /** Unidad base, con signo (escala 3). */
  quantity: bigint;
  enteredQuantity: bigint;
  enteredUnit: string;
  balanceBefore: bigint;
  balanceAfter: bigint;
  unitCost: bigint | null;
  lineTotal: bigint | null;
  avgCostBefore: bigint | null;
  avgCostAfter: bigint | null;
  sourceMovementId: number | null;
  recordedAt: Date;
  actorId: number | null;
  actorName: string;
}

export type NewKardexMovement = Omit<KardexMovement, 'id' | 'documentId'>;
