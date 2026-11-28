import {
  AlreadyReversedError,
  COST_SCALE,
  IdempotencyRaceError,
  QUANTITY_SCALE,
  TOTAL_SCALE,
  formatDecimal,
  type InventoryStoreReader,
  type InventoryStoreTx,
  type KardexDocument,
  type KardexMovement,
  type StockRow,
} from '@restaurante/core/inventory';

import { isUniqueViolation } from './errors.ts';
import type { Prisma } from './generated/prisma/client.ts';

/**
 * Kardex sobre Prisma/MySQL (REQ-F-051, T3): lecturas y escrituras de documentos, movimientos y
 * existencias que compone `prisma-inventory-store.ts`.
 *
 * - Documentos y movimientos solo se insertan (RN-T3-9, DT-5): aquí no hay ningún update ni delete
 *   sobre ellos (`npm run lint` lo impide en todo el monorepo).
 * - Decimales con signo sin coma flotante: se leen con toFixed(n) y se escriben como texto.
 * - La fecha del hecho (`occurred_on`, DATE) viaja como medianoche UTC del día `AAAA-MM-DD`.
 */

type Tx = Prisma.TransactionClient;

const DOCUMENT_INCLUDE = { reversedBy: { select: { id: true } } } as const satisfies Prisma.InventoryDocumentInclude;
type DocumentRow = Prisma.InventoryDocumentGetPayload<{ include: typeof DOCUMENT_INCLUDE }>;
type MovementRow = Prisma.InventoryMovementGetPayload<object>;
type StockDbRow = Prisma.InventoryStockGetPayload<object>;

/** DECIMAL con signo -> bigint con esa escala, sin pasar por coma flotante. */
function signed(value: Prisma.Decimal, scale: number): bigint {
  const text = value.toFixed(scale);
  if (!/^-?\d+(\.\d+)?$/.test(text)) throw new Error('Decimal inválido en la base de datos');
  const negative = text.startsWith('-');
  const [integer = '0', fraction = ''] = (negative ? text.slice(1) : text).split('.');
  const result = BigInt(integer) * 10n ** BigInt(scale) + BigInt(fraction.padEnd(scale, '0') || '0');
  return negative ? -result : result;
}

const optional = (value: Prisma.Decimal | null, scale: number): bigint | null => (value === null ? null : signed(value, scale));
const text = (value: bigint | null, scale: number): string | null => (value === null ? null : formatDecimal(value, scale));

/** `AAAA-MM-DD` <-> DATE (medianoche UTC). */
export const toDateColumn = (date: string): Date => new Date(`${date}T00:00:00.000Z`);
export const fromDateColumn = (date: Date): string => date.toISOString().slice(0, 10);

const toStock = (row: StockDbRow): StockRow => ({
  itemId: row.itemId,
  quantity: signed(row.quantity, QUANTITY_SCALE),
  avgCost: optional(row.avgCost, COST_SCALE),
  lastCost: optional(row.lastCost, COST_SCALE),
  lastSeq: row.lastSeq,
  updatedAt: row.updatedAt,
});

const toDocument = (row: DocumentRow): KardexDocument => ({
  id: row.id,
  type: row.type,
  occurredOn: fromDateColumn(row.occurredOn),
  recordedAt: row.recordedAt,
  supplierId: row.supplierId,
  reference: row.reference,
  costBasis: row.costBasis,
  reason: row.reason,
  note: row.note,
  totalCost: signed(row.totalCost, TOTAL_SCALE),
  reversesDocumentId: row.reversesDocumentId,
  sourceDocumentId: row.sourceDocumentId,
  idempotencyKey: row.idempotencyKey,
  requestHash: row.requestHash,
  actorId: row.actorId,
  actorName: row.actorName,
  reversedById: row.reversedBy?.id ?? null,
});

const toMovement = (row: MovementRow): KardexMovement => ({
  id: row.id,
  documentId: row.documentId,
  line: row.line,
  itemId: row.itemId,
  seq: row.seq,
  type: row.type,
  quantity: signed(row.quantity, QUANTITY_SCALE),
  enteredQuantity: signed(row.enteredQuantity, QUANTITY_SCALE),
  enteredUnit: row.enteredUnit,
  balanceBefore: signed(row.balanceBefore, QUANTITY_SCALE),
  balanceAfter: signed(row.balanceAfter, QUANTITY_SCALE),
  unitCost: optional(row.unitCost, COST_SCALE),
  lineTotal: optional(row.lineTotal, TOTAL_SCALE),
  avgCostBefore: optional(row.avgCostBefore, COST_SCALE),
  avgCostAfter: optional(row.avgCostAfter, COST_SCALE),
  sourceMovementId: row.sourceMovementId,
  recordedAt: row.recordedAt,
  actorId: row.actorId,
  actorName: row.actorName,
});

/** Documento vigente: no es una reversión y nadie lo revirtió (RN-T3-8, DT-T3-4). */
const ACTIVE_DOCUMENT = { type: { not: 'reversion' }, reversedBy: { is: null } } as const satisfies Prisma.InventoryDocumentWhereInput;

type KardexReader = Pick<
  InventoryStoreReader,
  | 'stockRows'
  | 'allStock'
  | 'documentById'
  | 'documentByIdempotencyKey'
  | 'documentsByIds'
  | 'documentMovements'
  | 'returnsOf'
  | 'listDocuments'
  | 'itemMovements'
  | 'itemsWithActiveMovements'
  | 'lastPurchaseCost'
  | 'movementsAfter'
  | 'countDocuments'
>;

export function kardexReaderOn(client: Tx): KardexReader {
  return {
    async stockRows(itemIds) {
      if (itemIds.length === 0) return new Map();
      const rows = await client.inventoryStock.findMany({ where: { itemId: { in: [...itemIds] } } });
      return new Map(rows.map((row) => [row.itemId, toStock(row)]));
    },

    async allStock() {
      return (await client.inventoryStock.findMany({ orderBy: { itemId: 'asc' } })).map(toStock);
    },

    async documentById(id) {
      const row = await client.inventoryDocument.findUnique({ where: { id }, include: DOCUMENT_INCLUDE });
      return row ? toDocument(row) : null;
    },

    async documentByIdempotencyKey(key) {
      const row = await client.inventoryDocument.findUnique({ where: { idempotencyKey: key }, include: DOCUMENT_INCLUDE });
      return row ? toDocument(row) : null;
    },

    async documentsByIds(ids) {
      if (ids.length === 0) return [];
      return (await client.inventoryDocument.findMany({ where: { id: { in: [...ids] } }, include: DOCUMENT_INCLUDE })).map(toDocument);
    },

    async documentMovements(documentId) {
      return (await client.inventoryMovement.findMany({ where: { documentId }, orderBy: { line: 'asc' } })).map(toMovement);
    },

    async returnsOf(purchaseId) {
      return (await client.inventoryDocument.findMany({ where: { sourceDocumentId: purchaseId }, include: DOCUMENT_INCLUDE, orderBy: { id: 'asc' } })).map(toDocument);
    },

    async listDocuments(query) {
      const where: Prisma.InventoryDocumentWhereInput = {};
      if (query.type !== null) where.type = query.type;
      if (query.supplierId !== null) where.supplierId = query.supplierId;
      const [total, rows] = await Promise.all([
        client.inventoryDocument.count({ where }),
        client.inventoryDocument.findMany({ where, include: DOCUMENT_INCLUDE, orderBy: { id: 'desc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      ]);
      return { documents: rows.map(toDocument), total };
    },

    async itemMovements(itemId, page, pageSize) {
      const [total, rows] = await Promise.all([
        client.inventoryMovement.count({ where: { itemId } }),
        client.inventoryMovement.findMany({ where: { itemId }, orderBy: { seq: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      ]);
      return { movements: rows.map(toMovement), total };
    },

    async itemsWithActiveMovements(itemIds) {
      const where: Prisma.InventoryMovementWhereInput = { document: ACTIVE_DOCUMENT };
      if (itemIds !== null) {
        if (itemIds.length === 0) return new Set();
        where.itemId = { in: [...itemIds] };
      }
      const rows = await client.inventoryMovement.findMany({ where, distinct: ['itemId'], select: { itemId: true } });
      return new Set(rows.map((row) => row.itemId));
    },

    async lastPurchaseCost(itemId, excludeDocumentId) {
      const row = await client.inventoryMovement.findFirst({
        where: { itemId, type: 'compra', document: { ...ACTIVE_DOCUMENT, ...(excludeDocumentId === null ? {} : { id: { not: excludeDocumentId } }) } },
        orderBy: { seq: 'desc' },
        select: { unitCost: true },
      });
      return row ? optional(row.unitCost, COST_SCALE) : null;
    },

    async movementsAfter(itemId, seq, limit) {
      const rows = await client.inventoryMovement.findMany({
        where: { OR: [{ itemId: { gt: itemId } }, { itemId, seq: { gt: seq } }] },
        orderBy: [{ itemId: 'asc' }, { seq: 'asc' }],
        take: limit,
      });
      return rows.map(toMovement);
    },

    countDocuments: () => client.inventoryDocument.count(),
  };
}

type KardexTx = Pick<InventoryStoreTx, 'lockDocument' | 'insertDocument' | 'saveStock'>;

export function kardexTxOn(tx: Tx): KardexTx {
  return {
    async lockDocument(id) {
      const rows = await tx.$queryRaw<{ id: number }[]>`SELECT id FROM inventory_document WHERE id = ${id} FOR UPDATE`;
      return rows.length > 0;
    },

    async insertDocument(document, movements) {
      let row: DocumentRow;
      try {
        row = await tx.inventoryDocument.create({
          data: {
            type: document.type,
            occurredOn: toDateColumn(document.occurredOn),
            recordedAt: document.recordedAt,
            supplierId: document.supplierId,
            reference: document.reference,
            costBasis: document.costBasis,
            reason: document.reason,
            note: document.note,
            totalCost: formatDecimal(document.totalCost, TOTAL_SCALE),
            reversesDocumentId: document.reversesDocumentId,
            sourceDocumentId: document.sourceDocumentId,
            idempotencyKey: document.idempotencyKey,
            requestHash: document.requestHash,
            actorId: document.actorId,
            actorName: document.actorName,
          },
          include: DOCUMENT_INCLUDE,
        });
      } catch (err) {
        // Las únicas claves únicas del documento: la de envío (DT-14) y la de reversión (RN-T3-6).
        if (isUniqueViolation(err)) throw document.idempotencyKey !== null ? new IdempotencyRaceError() : new AlreadyReversedError(null);
        throw err;
      }
      await tx.inventoryMovement.createMany({
        data: movements.map((movement) => ({
          documentId: row.id,
          line: movement.line,
          itemId: movement.itemId,
          seq: movement.seq,
          type: movement.type,
          quantity: formatDecimal(movement.quantity, QUANTITY_SCALE),
          enteredQuantity: formatDecimal(movement.enteredQuantity, QUANTITY_SCALE),
          enteredUnit: movement.enteredUnit,
          balanceBefore: formatDecimal(movement.balanceBefore, QUANTITY_SCALE),
          balanceAfter: formatDecimal(movement.balanceAfter, QUANTITY_SCALE),
          unitCost: text(movement.unitCost, COST_SCALE),
          lineTotal: text(movement.lineTotal, TOTAL_SCALE),
          avgCostBefore: text(movement.avgCostBefore, COST_SCALE),
          avgCostAfter: text(movement.avgCostAfter, COST_SCALE),
          sourceMovementId: movement.sourceMovementId,
          recordedAt: movement.recordedAt,
          actorId: movement.actorId,
          actorName: movement.actorName,
        })),
      });
      return toDocument(row);
    },

    async saveStock(rows) {
      for (const row of rows) {
        await tx.inventoryStock.update({
          where: { itemId: row.itemId },
          data: { quantity: formatDecimal(row.quantity, QUANTITY_SCALE), avgCost: text(row.avgCost, COST_SCALE), lastCost: text(row.lastCost, COST_SCALE), lastSeq: row.lastSeq, updatedAt: row.updatedAt },
        });
      }
    },
  };
}
