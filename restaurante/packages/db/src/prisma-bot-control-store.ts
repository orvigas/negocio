import {
  AUTOMATIC_ORIGINS,
  NOT_PAUSED,
  blockAuditFields,
  maskedFromLast4,
  type BlockRecord,
  type BotControlStore,
  type ControlState,
  type UsageCap,
  type UsageRecord,
} from '@restaurante/core/bot-control';

import type { Database } from './client.ts';
import { isTransactionConflict, toUnavailable } from './errors.ts';
import type { Prisma } from './generated/prisma/client.ts';

/**
 * Store de la protección del bot sobre Prisma/MySQL (REQ-F-025; REQ-F-014).
 *
 * - Las altas en la lista negra van en una transacción serializable con reintento acotado ante un
 *   interbloqueo (como user-repository.ts): nunca quedan dos bloqueos activos del mismo número.
 * - Los contadores se incrementan con INSERT IGNORE (fila del periodo) y un UPDATE relativo.
 * - Las fechas las pone siempre la app (RF-12 de REQ-F-014).
 * - Los errores inesperados se convierten en DatabaseUnavailableError (nunca el mensaje de Prisma).
 */

type Tx = Prisma.TransactionClient;
type BlockRow = Prisma.BotBlockGetPayload<object>;

const WRITE_TX = Object.freeze({ isolationLevel: 'Serializable', maxWait: 5000, timeout: 10_000 } as const);
const MAX_ATTEMPTS = 3;
const retryDelay = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 20 + Math.floor(Math.random() * 60)));
const CONTROL_ID = 1;

const CAP_COLUMNS = Object.freeze({ templates: 'templatesCappedAt', outbound: 'outboundCappedAt', budget: 'budgetCappedAt' } as const satisfies Record<UsageCap, string>);

const toBlock = (row: BlockRow): BlockRecord => ({
  id: row.id,
  phoneHash: row.phoneHash,
  keyId: row.keyId,
  last4: row.last4,
  origin: row.origin,
  reason: row.reason,
  createdAt: row.createdAt,
  expiresAt: row.expiresAt,
  createdByName: row.createdByName,
  removedAt: row.removedAt,
});

const activeWhere = (now: Date) => ({ removedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] });

export function createPrismaBotControlStore({ prisma }: { prisma: Database }): BotControlStore {
  if (!prisma) throw new TypeError('createPrismaBotControlStore requiere el cliente de la base de datos');

  async function run<T>(operation: () => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await operation();
      } catch (err) {
        if (isTransactionConflict(err) && attempt < MAX_ATTEMPTS) {
          await retryDelay();
          continue;
        }
        throw toUnavailable(err);
      }
    }
  }

  const write = <T>(task: (tx: Tx) => Promise<T>): Promise<T> => run(() => prisma.$transaction(task, WRITE_TX));

  /** Fila del periodo en 0 si aún no existe (INSERT IGNORE). */
  const ensureUsageRow = (periodType: string, period: string, now: Date) =>
    prisma.botUsage.createMany({ data: [{ periodType, period, updatedAt: now }], skipDuplicates: true });

  return Object.freeze<BotControlStore>({
    activeBlocks: (now) => run(async () => (await prisma.botBlock.findMany({ where: activeWhere(now), orderBy: { createdAt: 'desc' } })).map(toBlock)),

    automaticBlocksSince: (since) =>
      run(() =>
        prisma.botBlock.findMany({
          where: { origin: { in: [...AUTOMATIC_ORIGINS] }, createdAt: { gte: since } },
          select: { phoneHash: true, createdAt: true },
        }),
      ),

    addBlock: (block, actor, now) =>
      write(async (tx) => {
        const existing = await tx.botBlock.findFirst({ where: { phoneHash: block.phoneHash, ...activeWhere(now) }, select: { id: true } });
        if (existing) return 'already_blocked' as const;
        const row = await tx.botBlock.create({
          data: {
            phoneHash: block.phoneHash,
            keyId: block.keyId,
            last4: block.last4,
            origin: block.origin,
            reason: block.reason,
            createdAt: now,
            expiresAt: block.expiresAt,
            createdById: actor.kind === 'user' ? actor.id : null,
            createdByName: actor.kind === 'user' ? actor.name : null,
          },
        });
        await tx.botAudit.create({ data: { at: now, ...blockAuditFields('block_added', actor, { ...block, details: block.duration }) } });
        return toBlock(row);
      }),

    removeBlock: (id, actor, now) =>
      write(async (tx) => {
        const row = await tx.botBlock.findFirst({ where: { id, ...activeWhere(now) } });
        if (!row) return null;
        const updated = await tx.botBlock.update({ where: { id }, data: { removedAt: now, removedById: actor.id, removedByName: actor.name } });
        await tx.botAudit.create({
          data: { at: now, ...blockAuditFields('block_removed', actor, { masked: maskedFromLast4(row.last4), origin: row.origin, reason: null, details: null }) },
        });
        return toBlock(updated);
      }),

    rekeyBlocks: (fromHash, toHash, keyId) =>
      run(async () => {
        await prisma.botBlock.updateMany({ where: { phoneHash: fromHash }, data: { phoneHash: toHash, keyId } });
      }),

    getControl: () =>
      run(async () => {
        const row = await prisma.botControl.findUnique({ where: { id: CONTROL_ID } });
        return row ? { paused: row.paused, changedAt: row.changedAt, changedByName: row.changedByName, reason: row.reason } : NOT_PAUSED;
      }),

    setControl: (paused, actor, reason, now) =>
      write(async (tx): Promise<ControlState> => {
        const data = { paused, changedAt: now, changedById: actor.id, changedByName: actor.name, reason };
        await tx.botControl.upsert({ where: { id: CONTROL_ID }, create: { id: CONTROL_ID, ...data }, update: data });
        await tx.botAudit.create({
          data: { at: now, action: paused ? 'bot_paused' : 'bot_resumed', actorKind: 'user', actorId: actor.id, actorName: actor.name, reason },
        });
        return { paused, changedAt: now, changedByName: actor.name, reason };
      }),

    readUsage: (keys) =>
      run(async () => {
        if (keys.length === 0) return [];
        const rows = await prisma.botUsage.findMany({ where: { OR: keys.map(({ periodType, period }) => ({ periodType, period })) } });
        return rows.map(
          (row): UsageRecord => ({
            periodType: row.periodType === 'month' ? 'month' : 'day',
            period: row.period,
            templates: row.templates,
            outbound: row.outbound,
            cappedAt: {
              ...(row.templatesCappedAt ? { templates: row.templatesCappedAt } : {}),
              ...(row.outboundCappedAt ? { outbound: row.outboundCappedAt } : {}),
              ...(row.budgetCappedAt ? { budget: row.budgetCappedAt } : {}),
            },
          }),
        );
      }),

    addUsage: (periodType, period, delta, now) =>
      run(async () => {
        // INSERT IGNORE + UPDATE relativo: sin carreras entre dos escrituras del mismo periodo.
        await ensureUsageRow(periodType, period, now);
        await prisma.botUsage.updateMany({
          where: { periodType, period },
          data: { templates: { increment: delta.templates }, outbound: { increment: delta.outbound }, updatedAt: now },
        });
      }),

    markCapped: (periodType, period, cap, now) =>
      run(async () => {
        const column = CAP_COLUMNS[cap];
        await ensureUsageRow(periodType, period, now);
        const { count } = await prisma.botUsage.updateMany({ where: { periodType, period, [column]: null }, data: { [column]: now } });
        return count > 0;
      }),

    auditExpired: (now) =>
      write(async (tx) => {
        const rows = await tx.botBlock.findMany({ where: { removedAt: null, expiryAuditedAt: null, expiresAt: { lte: now } } });
        for (const row of rows) {
          await tx.botAudit.create({
            data: {
              at: now,
              ...blockAuditFields('block_expired', { kind: 'system' }, { masked: maskedFromLast4(row.last4), origin: row.origin, reason: null, details: row.expiresAt?.toISOString() ?? null }),
            },
          });
        }
        if (rows.length > 0) await tx.botBlock.updateMany({ where: { id: { in: rows.map((row) => row.id) } }, data: { expiryAuditedAt: now } });
        return rows.length;
      }),

    purge: ({ blocksBefore, auditBefore, usageDayBefore }) =>
      run(async () => {
        const blocks = await prisma.botBlock.deleteMany({
          where: { OR: [{ removedAt: { lt: blocksBefore } }, { removedAt: null, expiresAt: { lt: blocksBefore } }] },
        });
        const audit = await prisma.botAudit.deleteMany({ where: { at: { lt: auditBefore } } });
        const usage = await prisma.botUsage.deleteMany({ where: { periodType: 'day', period: { lt: usageDayBefore } } });
        return { blocks: blocks.count, audit: audit.count, usage: usage.count };
      }),

    recentAudit: (limit) =>
      run(async () =>
        (await prisma.botAudit.findMany({ orderBy: [{ at: 'desc' }, { id: 'desc' }], take: limit })).map((row) => ({
          at: row.at,
          action: row.action,
          actorKind: row.actorKind,
          actorName: row.actorName,
          masked: row.masked,
          origin: row.origin,
          reason: row.reason,
          details: row.details,
        })),
      ),
  });
}
