import { createHash } from 'node:crypto';

import { businessDate, readOccurredOn } from './business-date.ts';
import { COST_INTEGER_DIGITS, COST_SCALE, parseDecimal } from './decimal.ts';
import {
  AlreadyReversedError,
  DocumentHasReturnsError,
  DocumentNotFoundError,
  DocumentNotReturnableError,
  DocumentReversedError,
  IdempotencyKeyReusedError,
  IdempotencyRaceError,
  InitialBalanceNotAllowedError,
  InventoryValidationError,
  ItemNotFoundError,
  ReversalNotReversibleError,
  type FieldErrors,
} from './errors.ts';
import { normalizeAuthor, type InventoryAuthor } from './inventory-repository.ts';
import { type InventoryStore, type InventoryStoreReader, type InventoryStoreTx } from './inventory-store.ts';
import { isItemType, type InventoryItem, type ItemType } from './item-schema.ts';
import { amountToTotal, lineValue, nextAvgCost, purchaseUnitCost, stockValue } from './kardex-math.ts';
import {
  ADJUSTMENT_REASONS,
  AMOUNT_SCALE,
  DOCUMENT_MAX_LINES,
  DOCUMENT_NOTE_MAX,
  KARDEX_PAGE_SIZE,
  MOVEMENT_TYPES,
  REFERENCE_MAX,
  STOCK_ITEM_TYPES,
  type AdjustmentReason,
  type KardexDocument,
  type KardexMovement,
  type NewKardexMovement,
  type StockRow,
  type T3DocumentType,
} from './kardex-schema.ts';
import type { Supplier } from './supplier-schema.ts';
import { readId, readOptionalText, searchKey } from './text.ts';
import { MAX_QUANTITY, UNIT_CONVERSION_CODES, UnitConversionError, convertToBase } from './units.ts';

/**
 * Casos de uso del Kardex (REQ-F-051, T3): saldo inicial, compra, ajuste, devolución a proveedor y
 * reversión (escrituras), y documentos, existencias valorizadas y Kardex del artículo (lecturas).
 *
 * Cada escritura es un documento de 1 a 50 líneas que se registra todo o nada (RN-T3-2) en una
 * transacción del Kardex:
 *   1. valida la entrada sin tocar la base (errores por campo y línea: `lines.N.campo`, N desde 0);
 *   2. si llega una clave de envío ya registrada, devuelve ese documento (DT-14, CA-12);
 *   3. bloquea el documento de origen (devolución y reversión) y después las existencias, en orden de id;
 *   4. lee los artículos ya bloqueados y aplica RN-T3-1, la conversión de unidades y las reglas del tipo;
 *   5. calcula cada línea en orden con kardex-math (el mismo artículo puede repetirse) e inserta el
 *      documento, los movimientos y las existencias nuevas.
 * Nada edita ni borra documentos o movimientos (RN-T3-9): un error se corrige con una reversión.
 */

export type KardexAuthor = InventoryAuthor;

export interface WriteOptions {
  /** Identificador del envío del formulario (DT-14): el mismo envío repetido crea un solo documento. */
  requestId?: string | null;
}

export interface DocumentResult {
  document: KardexDocument;
  /** true: ya existía con esta clave de envío (no se escribió nada). */
  replayed: boolean;
}

export interface InitialBalanceInput {
  occurredOn?: unknown;
  note?: unknown;
  lines?: unknown;
}

export interface PurchaseInput {
  occurredOn?: unknown;
  supplierId?: unknown;
  reference?: unknown;
  note?: unknown;
  lines?: unknown;
}

export interface AdjustmentInput {
  occurredOn?: unknown;
  reason?: unknown;
  note?: unknown;
  lines?: unknown;
}

export interface SupplierReturnInput {
  occurredOn?: unknown;
  note?: unknown;
  lines?: unknown;
}

export interface ReversalInput {
  reason?: unknown;
}

export const STOCK_STATUSES = Object.freeze(['all', 'negative', 'no_cost'] as const);
export type StockStatus = (typeof STOCK_STATUSES)[number];

export interface StockListFilterInput {
  q?: unknown;
  categoryId?: unknown;
  type?: unknown;
  status?: unknown;
  page?: unknown;
}

export interface StockEntry {
  item: InventoryItem;
  categoryName: string;
  quantity: bigint;
  avgCost: bigint | null;
  lastCost: bigint | null;
  /** existencia × CPP con 2 decimales; null sin costo. */
  value: bigint | null;
  negative: boolean;
  noCost: boolean;
}

export interface StockPage {
  entries: StockEntry[];
  totals: {
    /** Suma de los valores (ya redondeados) de las existencias positivas con costo (DT-T3-8). Escala 2. */
    positiveValue: bigint;
    /** Suma de los valores de las existencias negativas con costo. Escala 2. */
    negativeValue: bigint;
    noCostCount: number;
  };
  page: { number: number; size: number; total: number };
}

export interface ItemKardex {
  item: InventoryItem;
  stock: StockRow | null;
  movements: KardexMovement[];
  /** Fecha del hecho (`AAAA-MM-DD`) de cada documento de la página, por id (RF-8). */
  occurredOn: Map<number, string>;
  page: { number: number; size: number; total: number };
}

export interface DocumentLine extends KardexMovement {
  itemName: string;
  baseUnit: string | null;
  /** Compras no revertidas: lo que todavía se puede devolver de esta línea (escala 3). */
  returnable: bigint | null;
}

export interface DocumentDetail {
  document: KardexDocument;
  lines: DocumentLine[];
  supplier: Supplier | null;
  /** Compras: sus devoluciones (con su reversión, si la tienen). */
  returns: KardexDocument[];
}

export interface DocumentListFilterInput {
  type?: unknown;
  supplierId?: unknown;
  page?: unknown;
}

export interface DocumentPage {
  documents: (KardexDocument & { supplierName: string | null })[];
  page: { number: number; size: number; total: number };
}

export interface ReversalPreviewLine {
  itemId: number;
  itemName: string;
  /** Cantidad contraria, con signo (escala 3). */
  quantity: bigint;
  unitCost: bigint | null;
  balanceAfter: bigint;
  /** La existencia quedaría negativa (RF-4). */
  negative: boolean;
}

export interface FormOption {
  item: InventoryItem;
  avgCost: bigint | null;
  /** RN-T3-8: el artículo no tiene movimientos vigentes. */
  initialBalanceAllowed: boolean;
}

export interface KardexRepository {
  createInitialBalance(input: InitialBalanceInput, author: KardexAuthor, options?: WriteOptions): Promise<DocumentResult>;
  createPurchase(input: PurchaseInput, author: KardexAuthor, options?: WriteOptions): Promise<DocumentResult>;
  createAdjustment(input: AdjustmentInput, author: KardexAuthor, options?: WriteOptions): Promise<DocumentResult>;
  createSupplierReturn(purchaseId: number, input: SupplierReturnInput, author: KardexAuthor, options?: WriteOptions): Promise<DocumentResult>;
  reverseDocument(id: number, input: ReversalInput, author: KardexAuthor, options?: WriteOptions): Promise<DocumentResult>;
  previewReversal(id: number): Promise<ReversalPreviewLine[]>;
  getDocument(id: number): Promise<DocumentDetail>;
  listDocuments(filter?: DocumentListFilterInput): Promise<DocumentPage>;
  listStock(filter?: StockListFilterInput): Promise<StockPage>;
  itemKardex(itemId: number, page?: unknown): Promise<ItemKardex>;
  formOptions(): Promise<{ items: FormOption[]; suppliers: Supplier[] }>;
}

const QUERY_MAX = 80;
const UNIT_MAX = 30;
const REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;
const COST_LIMIT = { scale: COST_SCALE, integerDigits: COST_INTEGER_DIGITS };
const AMOUNT_LIMIT = { scale: AMOUNT_SCALE, integerDigits: 13 };
const MAX_COST = 10n ** BigInt(COST_INTEGER_DIGITS + COST_SCALE) - 1n;
/** Mayor importe que se guarda (DECIMAL(19,4): 15 enteros y 4 decimales; DEF-001 del QA del PR 1b). */
const MAX_TOTAL = 10n ** 19n - 1n;
const DIRECTIONS = Object.freeze(['entrada', 'salida'] as const);
type Direction = (typeof DIRECTIONS)[number];

const zeroStock = (itemId: number, at: Date): StockRow => ({ itemId, quantity: 0n, avgCost: null, lastCost: null, lastSeq: 0, updatedAt: at });

// --- Validación de la entrada (sin base de datos) -----------------------------------------------

function fail(errors: FieldErrors): void {
  if (Object.keys(errors).length > 0) throw new InventoryValidationError(errors);
}

function readQuantity(raw: unknown, field: string, errors: FieldErrors): bigint {
  const parsed = parseDecimal(raw);
  if (!parsed.ok) errors[field] = parsed.error;
  else if (parsed.value === 0n) errors[field] = 'Escribe una cantidad mayor que 0.';
  else return parsed.value;
  return 0n;
}

function readCost(raw: unknown, field: string, errors: FieldErrors): bigint {
  const parsed = parseDecimal(raw, COST_LIMIT);
  if (!parsed.ok) {
    errors[field] = parsed.error;
    return 0n;
  }
  return parsed.value;
}

const isBlank = (raw: unknown): boolean => raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '');

function readUnit(raw: unknown, field: string, errors: FieldErrors): string {
  if (typeof raw !== 'string' || raw.trim() === '') errors[field] = 'Elige la unidad.';
  else if ([...raw.trim()].length > UNIT_MAX) errors[field] = `Máximo ${UNIT_MAX} caracteres.`;
  else return raw.trim().normalize('NFC');
  return '';
}

function readText(raw: unknown, max: number, field: string, errors: FieldErrors): string | null {
  const parsed = readOptionalText(raw, max);
  if ('error' in parsed) {
    errors[field] = parsed.error;
    return null;
  }
  return parsed.value;
}

/** Lista de líneas: de 1 a 50 objetos. */
function readLines(raw: unknown, errors: FieldErrors): Record<string, unknown>[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    errors.lines = 'Añade al menos una línea.';
    return [];
  }
  if (raw.length > DOCUMENT_MAX_LINES) {
    errors.lines = `Máximo ${DOCUMENT_MAX_LINES} líneas.`;
    return [];
  }
  return raw.map((line: unknown, index) => {
    if (typeof line === 'object' && line !== null && !Array.isArray(line)) return line as Record<string, unknown>;
    errors[`lines.${index}`] = 'Línea no válida.';
    return {};
  });
}

interface ItemLine {
  index: number;
  itemId: number;
  quantity: bigint;
  unit: string;
}

function readItemLine(line: Record<string, unknown>, index: number, errors: FieldErrors): ItemLine {
  const itemId = readId(line.itemId);
  if (itemId === null) errors[`lines.${index}.item`] = 'Elige un artículo.';
  return { index, itemId: itemId ?? 0, quantity: readQuantity(line.quantity, `lines.${index}.quantity`, errors), unit: readUnit(line.unit, `lines.${index}.unit`, errors) };
}

function readRequestId(options: WriteOptions | undefined): string | null {
  const raw = options?.requestId;
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string' || !REQUEST_ID.test(raw)) throw new InventoryValidationError({ requestId: 'Identificador de envío no válido.' });
  return raw;
}

const canonical = (value: unknown): string => JSON.stringify(value, (_key, entry: unknown) => (typeof entry === 'bigint' ? entry.toString() : entry));
const hashOf = (type: string, input: unknown): string => createHash('sha256').update(canonical({ type, input })).digest('hex');

/** RN-T3-1: motivo por el que el artículo no admite movimientos, o null. */
function stockItemProblem(item: InventoryItem | undefined, allowInactive: boolean): string | null {
  if (!item) return 'El artículo no existe.';
  if (item.kind === 'parent') return 'Un artículo padre no lleva existencias: elige una de sus variantes.';
  if (!(STOCK_ITEM_TYPES as readonly string[]).includes(item.type)) return 'Un Compuesto no lleva existencias: solo tiene receta y costo.';
  if (!item.inventoriable) return 'El artículo no es inventariable: no lleva existencias.';
  if (!item.active && !allowInactive) return 'El artículo está inactivo.';
  return null;
}

const holdsStock = (item: InventoryItem): boolean => stockItemProblem(item, true) === null;

/** Cantidad capturada en la unidad base del artículo, o el error en su campo. */
function toBase(line: ItemLine, item: InventoryItem, errors: FieldErrors): bigint | null {
  try {
    return convertToBase(line.quantity, line.unit, item);
  } catch (err) {
    if (!(err instanceof UnitConversionError)) throw err;
    const field = err.code === UNIT_CONVERSION_CODES.TOO_SMALL || err.code === UNIT_CONVERSION_CODES.TOO_LARGE ? 'quantity' : 'unit';
    errors[`lines.${line.index}.${field}`] = err.message;
    return null;
  }
}

// --- Cálculo de las líneas -----------------------------------------------------------------------

/** Línea lista para calcular: el costo se resuelve con la existencia vigente en ese punto del documento. */
interface PlannedLine {
  index: number;
  itemId: number;
  enteredQuantity: bigint;
  enteredUnit: string;
  /** En la unidad base, con signo. */
  quantity: bigint;
  sourceMovementId: number | null;
  /** Costo unitario y total de la línea según la existencia previa; un texto es el error de la línea. */
  cost(row: StockRow): { unitCost: bigint | null; lineTotal: bigint | null } | { error: string; field: string };
}

interface Computed {
  movements: NewKardexMovement[];
  stocks: Map<number, StockRow>;
  total: bigint;
}

/** Aplica las líneas en orden sobre las existencias (RN-T3-3, RN-T3-5): movimientos y existencias nuevas. */
function compute(type: string, lines: readonly PlannedLine[], stocks: ReadonlyMap<number, StockRow>, author: KardexAuthor, at: Date): Computed {
  const errors: FieldErrors = {};
  const running = new Map(stocks);
  const movements: NewKardexMovement[] = [];
  let total = 0n;
  for (const line of lines) {
    const row = running.get(line.itemId) ?? zeroStock(line.itemId, at);
    const cost = line.cost(row);
    if ('error' in cost) {
      errors[`lines.${line.index}.${cost.field}`] = cost.error;
      continue;
    }
    const balanceAfter = row.quantity + line.quantity;
    if (balanceAfter > MAX_QUANTITY || -balanceAfter > MAX_QUANTITY) {
      errors[`lines.${line.index}.quantity`] = 'La existencia del artículo superaría el máximo que se puede guardar.';
      continue;
    }
    // DEF-001 (QA del PR 1b): lo que no cabe en sus columnas se rechaza en el campo, nunca llega a la base.
    if (cost.lineTotal !== null && cost.lineTotal > MAX_TOTAL) {
      errors[`lines.${line.index}.quantity`] = 'El valor de la línea supera el máximo que se puede guardar: revisa la cantidad y el costo.';
      continue;
    }
    const avgCostAfter = nextAvgCost(type, row.quantity, row.avgCost, line.quantity, cost.unitCost);
    if ((cost.unitCost !== null && cost.unitCost > MAX_COST) || (avgCostAfter !== null && avgCostAfter > MAX_COST)) {
      errors[`lines.${line.index}.quantity`] = 'El costo por unidad resultante supera el máximo que se puede guardar: revisa la cantidad y el costo.';
      continue;
    }
    const seq = row.lastSeq + 1;
    movements.push({
      line: movements.length + 1,
      itemId: line.itemId,
      seq,
      type,
      quantity: line.quantity,
      enteredQuantity: line.enteredQuantity,
      enteredUnit: line.enteredUnit,
      balanceBefore: row.quantity,
      balanceAfter,
      unitCost: cost.unitCost,
      lineTotal: cost.lineTotal,
      avgCostBefore: row.avgCost,
      avgCostAfter,
      sourceMovementId: line.sourceMovementId,
      recordedAt: at,
      actorId: author.id,
      actorName: author.name,
    });
    if (cost.lineTotal !== null) total += cost.lineTotal;
    if (total > MAX_TOTAL && !errors.lines) errors.lines = 'El total del documento supera el máximo que se puede guardar: divídelo en varios documentos.';
    // RN-T3-5: el último costo es el de la última compra.
    const lastCost = type === 'compra' ? cost.unitCost : row.lastCost;
    running.set(line.itemId, { itemId: line.itemId, quantity: balanceAfter, avgCost: avgCostAfter, lastCost, lastSeq: seq, updatedAt: at });
  }
  fail(errors);
  return { movements, stocks: running, total };
}

/** Líneas contrarias de una reversión (RN-T3-6): cada movimiento al costo con que entró o salió. */
function reversalLines(movements: readonly KardexMovement[]): PlannedLine[] {
  return movements.map((movement, index) => ({
    index,
    itemId: movement.itemId,
    enteredQuantity: movement.enteredQuantity,
    enteredUnit: movement.enteredUnit,
    quantity: -movement.quantity,
    sourceMovementId: movement.id,
    cost: () => ({ unitCost: movement.unitCost, lineTotal: movement.lineTotal }),
  }));
}

/** Lo que queda por devolver de cada línea de una compra: comprado − devuelto en devoluciones no revertidas. */
async function returnableOf(reader: InventoryStoreReader, purchase: KardexMovement[], purchaseId: number): Promise<{ remaining: Map<number, bigint>; activeReturns: number[] }> {
  const remaining = new Map(purchase.map((movement) => [movement.id, movement.quantity]));
  const activeReturns: number[] = [];
  for (const document of await reader.returnsOf(purchaseId)) {
    if (document.reversedById !== null) continue;
    activeReturns.push(document.id);
    for (const movement of await reader.documentMovements(document.id)) {
      if (movement.sourceMovementId === null) continue;
      remaining.set(movement.sourceMovementId, (remaining.get(movement.sourceMovementId) ?? 0n) + movement.quantity);
    }
  }
  return { remaining, activeReturns };
}

function readPage(raw: unknown): number {
  if (raw === undefined || raw === null) return 1;
  const page = readId(raw);
  if (page === null) throw new InventoryValidationError({ page: 'La página debe ser un entero positivo.' });
  return page;
}

export function createKardexRepository({ store, timeZone, now = () => new Date() }: { store: InventoryStore; timeZone: string; now?: () => Date }): KardexRepository {
  if (!store) throw new TypeError('createKardexRepository requiere un store');
  if (typeof timeZone !== 'string' || timeZone === '') throw new TypeError('createKardexRepository requiere la zona horaria del negocio');

  const today = (): string => businessDate(now(), timeZone);

  interface Spec {
    type: T3DocumentType;
    author: KardexAuthor;
    requestId: string | null;
    /** Entrada validada (para la huella de idempotencia). */
    input: unknown;
    /** Documento de origen que se bloquea primero (devolución y reversión). */
    lockDocumentId: number | null;
    /**
     * Artículos cuyas existencias se bloquean antes de leer nada que pueda cambiar (RN-T3-11): los de la
     * entrada o los del documento de origen (inmutable, ya bloqueado).
     */
    lockItemIds(tx: InventoryStoreTx): Promise<number[]> | number[];
    /** Construye el documento dentro de la transacción, con las existencias ya bloqueadas. */
    build(tx: InventoryStoreTx, at: Date): Promise<{ header: Omit<KardexDocument, 'id' | 'reversedById' | 'type' | 'recordedAt' | 'totalCost' | 'idempotencyKey' | 'requestHash' | 'actorId' | 'actorName'>; lines: (stocks: Map<number, StockRow>) => Promise<PlannedLine[]> | PlannedLine[]; after?: (tx: InventoryStoreTx, stocks: Map<number, StockRow>) => Promise<void> }>;
  }

  async function write(spec: Spec): Promise<DocumentResult> {
    const key = spec.requestId === null ? null : `${spec.author.id ?? 'sistema'}:${spec.type}:${spec.requestId}`;
    const hash = hashOf(spec.type, spec.input);
    const replay = (existing: KardexDocument): DocumentResult => {
      if (existing.requestHash !== hash) throw new IdempotencyKeyReusedError();
      return { document: existing, replayed: true };
    };
    try {
      return await store.kardexTransaction(async (tx) => {
        if (key !== null) {
          const existing = await tx.documentByIdempotencyKey(key);
          if (existing) return replay(existing);
        }
        if (spec.lockDocumentId !== null && !(await tx.lockDocument(spec.lockDocumentId))) throw new DocumentNotFoundError();
        const itemIds = [...new Set(await spec.lockItemIds(tx))].filter((itemId) => itemId > 0);
        await tx.lockStock(itemIds);
        const at = now();
        const built = await spec.build(tx, at);
        const stocks = await tx.stockRows(itemIds);
        const lines = await built.lines(stocks);
        const result = compute(spec.type, lines, stocks, spec.author, at);
        if (built.after) await built.after(tx, result.stocks);
        const document = await tx.insertDocument(
          { ...built.header, type: spec.type, recordedAt: at, totalCost: result.total, idempotencyKey: key, requestHash: key === null ? null : hash, actorId: spec.author.id, actorName: spec.author.name },
          result.movements,
        );
        const changed = new Set(result.movements.map((movement) => movement.itemId));
        await tx.saveStock([...result.stocks.values()].filter((row) => changed.has(row.itemId)));
        return { document, replayed: false };
      });
    } catch (err) {
      if (err instanceof IdempotencyRaceError && key !== null) {
        const existing = await store.read((reader) => reader.documentByIdempotencyKey(key));
        if (existing) return replay(existing);
      }
      throw err;
    }
  }

  /** Artículos de las líneas, con los errores de RN-T3-1 marcados en cada una. */
  async function loadItems(tx: InventoryStoreReader, lines: readonly ItemLine[], allowInactive: boolean, errors: FieldErrors): Promise<Map<number, InventoryItem>> {
    const items = new Map((await tx.itemsByIds([...new Set(lines.map((line) => line.itemId))])).map((item) => [item.id, item]));
    for (const line of lines) {
      const problem = stockItemProblem(items.get(line.itemId), allowInactive);
      if (problem) errors[`lines.${line.index}.item`] = problem;
    }
    return items;
  }

  return Object.freeze<KardexRepository>({
    async createInitialBalance(input, rawAuthor, options) {
      const author = normalizeAuthor(rawAuthor);
      const requestId = readRequestId(options);
      const errors: FieldErrors = {};
      const occurredOn = readOccurredOn(input.occurredOn, today());
      if ('error' in occurredOn) errors.occurredOn = occurredOn.error;
      const note = readText(input.note, DOCUMENT_NOTE_MAX, 'note', errors);
      const lines = readLines(input.lines, errors).map((line, index) => ({ ...readItemLine(line, index, errors), unitCost: readCost(line.unitCost, `lines.${index}.unitCost`, errors) }));
      const seen = new Map<number, number>();
      for (const line of lines) {
        if (line.itemId === 0) continue;
        if (seen.has(line.itemId)) errors[`lines.${line.index}.item`] = `El artículo ya está en la línea ${(seen.get(line.itemId) ?? 0) + 1}.`;
        else seen.set(line.itemId, line.index);
      }
      fail(errors);
      return write({
        type: 'saldo_inicial',
        author,
        requestId,
        input: { occurredOn, note, lines },
        lockDocumentId: null,
        lockItemIds: () => lines.map((line) => line.itemId),
        async build(tx) {
          const lineErrors: FieldErrors = {};
          const items = await loadItems(tx, lines, false, lineErrors);
          const planned = lines.map((line): PlannedLine | null => {
            const item = items.get(line.itemId);
            const base = item && !lineErrors[`lines.${line.index}.item`] ? toBase(line, item, lineErrors) : null;
            if (base === null) return null;
            const value = lineValue(base, line.unitCost);
            return { index: line.index, itemId: line.itemId, enteredQuantity: line.quantity, enteredUnit: line.unit, quantity: base, sourceMovementId: null, cost: () => ({ unitCost: line.unitCost, lineTotal: value }) };
          });
          fail(lineErrors);
          return {
            header: { occurredOn: (occurredOn as { value: string }).value, supplierId: null, reference: null, costBasis: null, reason: null, note, reversesDocumentId: null, sourceDocumentId: null },
            async lines() {
              // RN-T3-8 (CA-5): solo artículos sin movimientos vigentes, comprobado bajo el bloqueo de sus
              // existencias. Un saldo inicial revertido no cuenta (CA-8).
              const active = await tx.itemsWithActiveMovements([...items.keys()]);
              const taken = [...items.values()].filter((item) => active.has(item.id));
              if (taken.length > 0) throw new InitialBalanceNotAllowedError(taken.map((item) => ({ itemId: item.id, name: item.name })));
              return planned.filter((line): line is PlannedLine => line !== null);
            },
          };
        },
      });
    },

    async createPurchase(input, rawAuthor, options) {
      const author = normalizeAuthor(rawAuthor);
      const requestId = readRequestId(options);
      const errors: FieldErrors = {};
      const occurredOn = readOccurredOn(input.occurredOn, today());
      if ('error' in occurredOn) errors.occurredOn = occurredOn.error;
      const supplierId = isBlank(input.supplierId) ? null : readId(input.supplierId);
      if (!isBlank(input.supplierId) && supplierId === null) errors.supplierId = 'Elige un proveedor de la lista.';
      const reference = readText(input.reference, REFERENCE_MAX, 'reference', errors);
      const note = readText(input.note, DOCUMENT_NOTE_MAX, 'note', errors);
      const lines = readLines(input.lines, errors).map((line, index) => {
        const amount = parseDecimal(line.amount, AMOUNT_LIMIT);
        if (!amount.ok) errors[`lines.${index}.amount`] = amount.error;
        return { ...readItemLine(line, index, errors), amount: amount.ok ? amount.value : 0n };
      });
      fail(errors);
      return write({
        type: 'compra',
        author,
        requestId,
        input: { occurredOn, supplierId, reference, note, lines },
        lockDocumentId: null,
        lockItemIds: () => lines.map((line) => line.itemId),
        async build(tx) {
          const lineErrors: FieldErrors = {};
          if (supplierId !== null) {
            const supplier = await tx.getSupplier(supplierId);
            if (!supplier) lineErrors.supplierId = 'El proveedor no existe.';
            else if (!supplier.active) lineErrors.supplierId = 'El proveedor está inactivo: elige otro o «Sin proveedor».';
          }
          const items = await loadItems(tx, lines, false, lineErrors);
          const planned = lines.map((line): PlannedLine | null => {
            const item = items.get(line.itemId);
            const base = item && !lineErrors[`lines.${line.index}.item`] ? toBase(line, item, lineErrors) : null;
            if (base === null) return null;
            const unitCost = purchaseUnitCost(line.amount, base);
            if (unitCost > MAX_COST) {
              lineErrors[`lines.${line.index}.amount`] = 'El costo por unidad resultante es demasiado grande: revisa la cantidad y el importe.';
              return null;
            }
            const total = amountToTotal(line.amount);
            return { index: line.index, itemId: line.itemId, enteredQuantity: line.quantity, enteredUnit: line.unit, quantity: base, sourceMovementId: null, cost: () => ({ unitCost, lineTotal: total }) };
          });
          fail(lineErrors);
          return {
            header: { occurredOn: (occurredOn as { value: string }).value, supplierId, reference, costBasis: 'con_iva', reason: null, note, reversesDocumentId: null, sourceDocumentId: null },
            lines: () => planned.filter((line): line is PlannedLine => line !== null),
          };
        },
      });
    },

    async createAdjustment(input, rawAuthor, options) {
      const author = normalizeAuthor(rawAuthor);
      const requestId = readRequestId(options);
      const errors: FieldErrors = {};
      const occurredOn = readOccurredOn(input.occurredOn, today());
      if ('error' in occurredOn) errors.occurredOn = occurredOn.error;
      const reason = input.reason;
      if (!(ADJUSTMENT_REASONS as readonly unknown[]).includes(reason)) errors.reason = 'Elige el motivo del ajuste.';
      const note = readText(input.note, DOCUMENT_NOTE_MAX, 'note', errors);
      if (reason === 'otro' && note === null && !errors.note) errors.note = 'Con el motivo «otro», explica el ajuste en la nota.';
      const lines = readLines(input.lines, errors).map((line, index) => {
        const direction = line.direction;
        if (!(DIRECTIONS as readonly unknown[]).includes(direction)) errors[`lines.${index}.direction`] = 'Elige entrada o salida.';
        const unitCost = isBlank(line.unitCost) ? null : readCost(line.unitCost, `lines.${index}.unitCost`, errors);
        return { ...readItemLine(line, index, errors), direction: direction as Direction, unitCost };
      });
      for (const line of lines) {
        if (line.direction === 'salida' && line.unitCost !== null) errors[`lines.${line.index}.unitCost`] = 'Una salida sale al CPP: deja el costo vacío.';
      }
      fail(errors);
      return write({
        type: 'ajuste',
        author,
        requestId,
        input: { occurredOn, reason, note, lines },
        lockDocumentId: null,
        lockItemIds: () => lines.map((line) => line.itemId),
        async build(tx) {
          const lineErrors: FieldErrors = {};
          const items = await loadItems(tx, lines, false, lineErrors);
          const planned = lines.map((line): PlannedLine | null => {
            const item = items.get(line.itemId);
            const base = item && !lineErrors[`lines.${line.index}.item`] ? toBase(line, item, lineErrors) : null;
            if (base === null) return null;
            const quantity = line.direction === 'salida' ? -base : base;
            return {
              index: line.index,
              itemId: line.itemId,
              enteredQuantity: line.quantity,
              enteredUnit: line.unit,
              quantity,
              sourceMovementId: null,
              cost(row) {
                // RF-5: la salida sale al CPP (sin CPP, «sin costo»); la entrada entra al CPP vigente.
                if (line.direction === 'salida') return { unitCost: row.avgCost, lineTotal: row.avgCost === null ? null : lineValue(base, row.avgCost) };
                if (row.avgCost !== null) {
                  // DT-T3-7: con CPP, un costo escrito se rechaza en lugar de ignorarse.
                  if (line.unitCost !== null) return { field: 'unitCost', error: 'El artículo ya tiene CPP: deja el costo vacío; entra a su CPP.' };
                  return { unitCost: row.avgCost, lineTotal: lineValue(base, row.avgCost) };
                }
                if (line.unitCost === null) return { field: 'unitCost', error: 'El artículo no tiene CPP: escribe el costo unitario de la entrada.' };
                return { unitCost: line.unitCost, lineTotal: lineValue(base, line.unitCost) };
              },
            };
          });
          fail(lineErrors);
          return {
            header: { occurredOn: (occurredOn as { value: string }).value, supplierId: null, reference: null, costBasis: null, reason: reason as AdjustmentReason, note, reversesDocumentId: null, sourceDocumentId: null },
            lines: () => planned.filter((line): line is PlannedLine => line !== null),
          };
        },
      });
    },

    async createSupplierReturn(purchaseId, input, rawAuthor, options) {
      const author = normalizeAuthor(rawAuthor);
      const requestId = readRequestId(options);
      const errors: FieldErrors = {};
      const occurredOn = readOccurredOn(input.occurredOn, today());
      if ('error' in occurredOn) errors.occurredOn = occurredOn.error;
      const note = readText(input.note, DOCUMENT_NOTE_MAX, 'note', errors);
      const lines = readLines(input.lines, errors).map((line, index) => {
        const sourceMovementId = readId(line.sourceMovementId);
        if (sourceMovementId === null) errors[`lines.${index}.item`] = 'Elige una línea de la compra.';
        return { index, sourceMovementId: sourceMovementId ?? 0, quantity: readQuantity(line.quantity, `lines.${index}.quantity`, errors) };
      });
      fail(errors);
      return write({
        type: 'devolucion_proveedor',
        author,
        requestId,
        input: { purchaseId, occurredOn, note, lines },
        lockDocumentId: purchaseId,
        lockItemIds: async (tx) => (await tx.documentMovements(purchaseId)).map((movement) => movement.itemId),
        async build(tx) {
          const purchase = await tx.documentById(purchaseId);
          if (!purchase) throw new DocumentNotFoundError();
          if (purchase.type !== 'compra') throw new DocumentNotReturnableError();
          if (purchase.reversedById !== null) throw new DocumentReversedError();
          const purchaseLines = await tx.documentMovements(purchaseId);
          const byId = new Map(purchaseLines.map((movement) => [movement.id, movement]));
          const { remaining } = await returnableOf(tx, purchaseLines, purchaseId);
          const lineErrors: FieldErrors = {};
          const planned: PlannedLine[] = [];
          for (const line of lines) {
            const source = byId.get(line.sourceMovementId);
            if (!source) {
              lineErrors[`lines.${line.index}.item`] = 'La línea no pertenece a esta compra.';
              continue;
            }
            const left = remaining.get(source.id) ?? 0n;
            // CA-30: como máximo, lo comprado menos lo ya devuelto (también en este documento).
            if (line.quantity > left) {
              lineErrors[`lines.${line.index}.quantity`] = left > 0n ? 'Es más de lo que queda por devolver de esta línea.' : 'De esta línea ya no queda nada por devolver.';
              continue;
            }
            remaining.set(source.id, left - line.quantity);
            // RF-6: sale al costo de esa compra; el CPP se recalcula como en RN-T3-6.
            const value = source.unitCost === null ? null : lineValue(line.quantity, source.unitCost);
            planned.push({ index: line.index, itemId: source.itemId, enteredQuantity: line.quantity, enteredUnit: '', quantity: -line.quantity, sourceMovementId: source.id, cost: () => ({ unitCost: source.unitCost, lineTotal: value }) });
          }
          fail(lineErrors);
          // La devolución se permite aunque el artículo o el proveedor estén inactivos (DT-T3-3).
          const items = new Map((await tx.itemsByIds(planned.map((line) => line.itemId))).map((item) => [item.id, item]));
          for (const line of planned) line.enteredUnit = items.get(line.itemId)?.baseUnit ?? '';
          return {
            header: { occurredOn: (occurredOn as { value: string }).value, supplierId: purchase.supplierId, reference: null, costBasis: null, reason: null, note, reversesDocumentId: null, sourceDocumentId: purchaseId },
            lines: () => planned,
          };
        },
      });
    },

    async reverseDocument(id, input, rawAuthor, options) {
      const author = normalizeAuthor(rawAuthor);
      const requestId = readRequestId(options);
      const errors: FieldErrors = {};
      const reason = readText(input.reason, DOCUMENT_NOTE_MAX, 'reason', errors);
      if (reason === null && !errors.reason) errors.reason = 'Escribe el motivo de la reversión.';
      fail(errors);
      return write({
        type: 'reversion',
        author,
        requestId,
        input: { id, reason },
        lockDocumentId: id,
        lockItemIds: async (tx) => (await tx.documentMovements(id)).map((movement) => movement.itemId),
        async build(tx) {
          const original = await tx.documentById(id);
          if (!original) throw new DocumentNotFoundError();
          if (original.type === 'reversion') throw new ReversalNotReversibleError();
          if (original.reversedById !== null) throw new AlreadyReversedError(original.reversedById);
          const movements = await tx.documentMovements(id);
          if (original.type === 'compra') {
            // DT-T3-3: una compra con devoluciones vigentes no se revierte.
            const { activeReturns } = await returnableOf(tx, movements, id);
            if (activeReturns.length > 0) throw new DocumentHasReturnsError(activeReturns);
          }
          const itemIds = [...new Set(movements.map((movement) => movement.itemId))];
          return {
            header: { occurredOn: today(), supplierId: original.supplierId, reference: null, costBasis: null, reason: null, note: reason, reversesDocumentId: id, sourceDocumentId: null },
            lines: () => reversalLines(movements),
            async after(locked, stocks) {
              // DT-T3-4: al revertir una compra, el último costo es el de la última compra no revertida.
              if (original.type !== 'compra') return;
              for (const itemId of itemIds) {
                const row = stocks.get(itemId);
                if (row) stocks.set(itemId, { ...row, lastCost: await locked.lastPurchaseCost(itemId, id) });
              }
            },
          };
        },
      });
    },

    async previewReversal(id) {
      return store.read(async (reader) => {
        const original = await reader.documentById(id);
        if (!original) throw new DocumentNotFoundError();
        if (original.type === 'reversion') throw new ReversalNotReversibleError();
        if (original.reversedById !== null) throw new AlreadyReversedError(original.reversedById);
        const movements = await reader.documentMovements(id);
        if (original.type === 'compra') {
          const { activeReturns } = await returnableOf(reader, movements, id);
          if (activeReturns.length > 0) throw new DocumentHasReturnsError(activeReturns);
        }
        const itemIds = [...new Set(movements.map((movement) => movement.itemId))];
        const [stocks, items] = await Promise.all([reader.stockRows(itemIds), reader.itemsByIds(itemIds)]);
        const names = new Map(items.map((item) => [item.id, item.name]));
        const { movements: contrary } = compute('reversion', reversalLines(movements), stocks, { id: null, name: 'vista previa' }, now());
        return contrary.map((movement) => ({
          itemId: movement.itemId,
          itemName: names.get(movement.itemId) ?? '',
          quantity: movement.quantity,
          unitCost: movement.unitCost,
          balanceAfter: movement.balanceAfter,
          negative: movement.balanceAfter < 0n,
        }));
      });
    },

    getDocument(id) {
      return store.read(async (reader) => {
        const document = await reader.documentById(id);
        if (!document) throw new DocumentNotFoundError();
        const movements = await reader.documentMovements(id);
        const [items, supplier, returns] = await Promise.all([
          reader.itemsByIds([...new Set(movements.map((movement) => movement.itemId))]),
          document.supplierId === null ? Promise.resolve(null) : reader.getSupplier(document.supplierId),
          document.type === 'compra' ? reader.returnsOf(id) : Promise.resolve([]),
        ]);
        const byId = new Map(items.map((item) => [item.id, item]));
        const returnable = document.type === 'compra' && document.reversedById === null ? (await returnableOf(reader, movements, id)).remaining : null;
        const lines = movements.map((movement) => ({
          ...movement,
          itemName: byId.get(movement.itemId)?.name ?? '',
          baseUnit: byId.get(movement.itemId)?.baseUnit ?? null,
          returnable: returnable?.get(movement.id) ?? null,
        }));
        return { document, lines, supplier, returns };
      });
    },

    async listDocuments(filter = {}) {
      const errors: FieldErrors = {};
      const type = filter.type ?? null;
      if (type !== null && !(MOVEMENT_TYPES as readonly unknown[]).includes(type)) errors.type = 'Elige un tipo de la lista.';
      const supplierId = isBlank(filter.supplierId) ? null : readId(filter.supplierId);
      if (!isBlank(filter.supplierId) && supplierId === null) errors.supplierId = 'Elige un proveedor de la lista.';
      fail(errors);
      const page = readPage(filter.page);
      return store.read(async (reader) => {
        const result = await reader.listDocuments({ type: type as string | null, supplierId, page, pageSize: KARDEX_PAGE_SIZE });
        const names = new Map((await reader.listSuppliers('all')).map((supplier) => [supplier.id, supplier.name]));
        return {
          documents: result.documents.map((document) => ({ ...document, supplierName: document.supplierId === null ? null : (names.get(document.supplierId) ?? null) })),
          page: { number: page, size: KARDEX_PAGE_SIZE, total: result.total },
        };
      });
    },

    async listStock(filter = {}) {
      const errors: FieldErrors = {};
      let q: string | null = null;
      if (filter.q !== undefined && filter.q !== null) {
        if (typeof filter.q !== 'string') errors.q = 'Debe ser texto.';
        else {
          q = searchKey(filter.q) || null;
          if (q !== null && [...q].length > QUERY_MAX) errors.q = `Máximo ${QUERY_MAX} caracteres.`;
        }
      }
      const categoryId = isBlank(filter.categoryId) ? null : readId(filter.categoryId);
      if (!isBlank(filter.categoryId) && categoryId === null) errors.categoryId = 'Elige una categoría de la lista.';
      const type = filter.type ?? null;
      if (type !== null && !(isItemType(type) && (STOCK_ITEM_TYPES as readonly string[]).includes(type))) errors.type = 'Elige Insumo, Intermedio o Reventa.';
      const status = filter.status ?? 'all';
      if (!(STOCK_STATUSES as readonly unknown[]).includes(status)) errors.status = 'Elige todos, negativos o sin costo.';
      fail(errors);
      const page = readPage(filter.page);
      return store.read(async (reader) => {
        const [stock, categories] = await Promise.all([reader.allStock(), reader.listCategories()]);
        const items = new Map((await reader.itemsByIds(stock.map((row) => row.itemId))).map((item) => [item.id, item]));
        const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
        const entries: StockEntry[] = [];
        for (const row of stock) {
          const item = items.get(row.itemId);
          // RN-T3-1; DT-T3-5: un inactivo solo aparece si su existencia no es 0.
          if (!item || !holdsStock(item) || (!item.active && row.quantity === 0n)) continue;
          if (q !== null && !searchKey(item.name).includes(q)) continue;
          if (categoryId !== null && item.categoryId !== categoryId) continue;
          if (type !== null && item.type !== (type as ItemType)) continue;
          const negative = row.quantity < 0n;
          const noCost = row.avgCost === null;
          if (status === 'negative' && !negative) continue;
          if (status === 'no_cost' && !noCost) continue;
          entries.push({ item, categoryName: categoryNames.get(item.categoryId) ?? '', quantity: row.quantity, avgCost: row.avgCost, lastCost: row.lastCost, value: row.avgCost === null ? null : stockValue(row.quantity, row.avgCost), negative, noCost });
        }
        entries.sort((a, b) => a.item.name.localeCompare(b.item.name, 'es') || a.item.id - b.item.id);
        const totals = { positiveValue: 0n, negativeValue: 0n, noCostCount: 0 };
        for (const entry of entries) {
          if (entry.value === null) totals.noCostCount += 1;
          else if (entry.quantity > 0n) totals.positiveValue += entry.value;
          else if (entry.quantity < 0n) totals.negativeValue += entry.value;
        }
        const start = (page - 1) * KARDEX_PAGE_SIZE;
        return { entries: entries.slice(start, start + KARDEX_PAGE_SIZE), totals, page: { number: page, size: KARDEX_PAGE_SIZE, total: entries.length } };
      });
    },

    async itemKardex(itemId, rawPage) {
      const page = readPage(rawPage);
      return store.read(async (reader) => {
        const item = await reader.getItem(itemId);
        if (!item) throw new ItemNotFoundError();
        const [stocks, result] = await Promise.all([reader.stockRows([itemId]), reader.itemMovements(itemId, page, KARDEX_PAGE_SIZE)]);
        const documents = await reader.documentsByIds([...new Set(result.movements.map((movement) => movement.documentId))]);
        return {
          item,
          stock: stocks.get(itemId) ?? null,
          movements: result.movements,
          occurredOn: new Map(documents.map((document) => [document.id, document.occurredOn])),
          page: { number: page, size: KARDEX_PAGE_SIZE, total: result.total },
        };
      });
    },

    formOptions() {
      return store.read(async (reader) => {
        const [stock, suppliers, active] = await Promise.all([reader.allStock(), reader.listSuppliers('active'), reader.itemsWithActiveMovements(null)]);
        const costs = new Map(stock.map((row) => [row.itemId, row.avgCost]));
        const items = (await reader.itemsByIds(stock.map((row) => row.itemId)))
          .filter((item) => stockItemProblem(item, false) === null)
          .sort((a, b) => a.name.localeCompare(b.name, 'es') || a.id - b.id);
        return { items: items.map((item) => ({ item, avgCost: costs.get(item.id) ?? null, initialBalanceAllowed: !active.has(item.id) })), suppliers };
      });
    },
  });
}

