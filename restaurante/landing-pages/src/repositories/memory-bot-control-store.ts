import { DatabaseUnavailableError } from '../db/errors.ts';
import {
  AUTOMATIC_ORIGINS,
  NOT_PAUSED,
  blockAuditFields,
  isActiveBlock,
  maskedFromLast4,
  type AuditRecord,
  type BlockRecord,
  type BotControlStore,
  type ControlState,
  type UsageCap,
  type UsagePeriodType,
  type UsageRecord,
} from './bot-control-store.ts';

/**
 * Store de la protección del bot en memoria (REQ-F-025): el doble de las pruebas unitarias y el de
 * `npm run bot:chat`. Mismas reglas que el de Prisma. `fail` permite simular una base caída.
 */

interface MutableBlock {
  id: number;
  phoneHash: string;
  keyId: string;
  last4: string;
  origin: BlockRecord['origin'];
  reason: string | null;
  createdAt: Date;
  expiresAt: Date | null;
  createdByName: string | null;
  removedAt: Date | null;
  expiryAuditedAt: Date | null;
}

interface MutableUsage {
  templates: number;
  outbound: number;
  cappedAt: Partial<Record<UsageCap, Date>>;
}

export interface MemoryBotControlStore extends BotControlStore {
  /** Pruebas: con `true`, cada operación falla como una base caída. */
  failing: boolean;
  /** Pruebas: todas las filas (para buscar datos que no deben estar). */
  dump(): { blocks: readonly MutableBlock[]; audit: readonly AuditRecord[]; usage: ReadonlyMap<string, MutableUsage>; control: ControlState };
}


const snapshot = (block: MutableBlock): BlockRecord => ({
  id: block.id,
  phoneHash: block.phoneHash,
  keyId: block.keyId,
  last4: block.last4,
  origin: block.origin,
  reason: block.reason,
  createdAt: block.createdAt,
  expiresAt: block.expiresAt,
  createdByName: block.createdByName,
  removedAt: block.removedAt,
});

const usageKey = (periodType: UsagePeriodType, period: string): string => `${periodType}:${period}`;

export function createMemoryBotControlStore(): MemoryBotControlStore {
  const blocks: MutableBlock[] = [];
  const audit: AuditRecord[] = [];
  const usage = new Map<string, MutableUsage>();
  let control: ControlState = NOT_PAUSED;
  let nextId = 1;

  const store: MemoryBotControlStore = {
    failing: false,

    async activeBlocks(now) {
      check();
      return blocks.filter((block) => isActiveBlock(block, now)).map(snapshot);
    },

    async automaticBlocksSince(since) {
      check();
      return blocks
        .filter((block) => AUTOMATIC_ORIGINS.includes(block.origin) && block.createdAt.getTime() >= since.getTime())
        .map(({ phoneHash, createdAt }) => ({ phoneHash, createdAt }));
    },

    async addBlock(block, actor, now) {
      check();
      if (blocks.some((other) => other.phoneHash === block.phoneHash && isActiveBlock(other, now))) return 'already_blocked';
      const row: MutableBlock = {
        id: nextId++,
        phoneHash: block.phoneHash,
        keyId: block.keyId,
        last4: block.last4,
        origin: block.origin,
        reason: block.reason,
        createdAt: now,
        expiresAt: block.expiresAt,
        createdByName: actor.kind === 'user' ? actor.name : null,
        removedAt: null,
        expiryAuditedAt: null,
      };
      blocks.push(row);
      pushAudit(now, blockAuditFields('block_added', actor, { ...block, details: block.duration }));
      return snapshot(row);
    },

    async removeBlock(id, actor, now) {
      check();
      const row = blocks.find((block) => block.id === id && isActiveBlock(block, now));
      if (!row) return null;
      row.removedAt = now;
      pushAudit(now, blockAuditFields('block_removed', actor, { masked: maskedFromLast4(row.last4), origin: row.origin, reason: null, details: null }));
      return snapshot(row);
    },

    async rekeyBlocks(fromHash, toHash, keyId) {
      check();
      for (const block of blocks) {
        if (block.phoneHash !== fromHash) continue;
        block.phoneHash = toHash;
        block.keyId = keyId;
      }
    },

    async getControl() {
      check();
      return control;
    },

    async setControl(paused, actor, reason, now) {
      check();
      control = { paused, changedAt: now, changedByName: actor.name, reason };
      pushAudit(now, { action: paused ? 'bot_paused' : 'bot_resumed', actorKind: 'user', actorName: actor.name, masked: null, origin: null, reason, details: null });
      return control;
    },

    async readUsage(keys) {
      check();
      return keys.flatMap(({ periodType, period }): UsageRecord[] => {
        const row = usage.get(usageKey(periodType, period));
        return row ? [{ periodType, period, templates: row.templates, outbound: row.outbound, cappedAt: { ...row.cappedAt } }] : [];
      });
    },

    async addUsage(periodType, period, delta) {
      check();
      const row = rowOf(periodType, period);
      row.templates += delta.templates;
      row.outbound += delta.outbound;
    },

    async markCapped(periodType, period, cap, now) {
      check();
      const row = rowOf(periodType, period);
      if (row.cappedAt[cap]) return false;
      row.cappedAt[cap] = now;
      return true;
    },

    async auditExpired(now) {
      check();
      const expired = blocks.filter((block) => block.removedAt === null && block.expiryAuditedAt === null && block.expiresAt !== null && block.expiresAt.getTime() <= now.getTime());
      for (const block of expired) {
        block.expiryAuditedAt = now;
        pushAudit(now, blockAuditFields('block_expired', { kind: 'system' }, { masked: maskedFromLast4(block.last4), origin: block.origin, reason: null, details: block.expiresAt?.toISOString() ?? null }));
      }
      return expired.length;
    },

    async purge({ blocksBefore, auditBefore, usageDayBefore }) {
      check();
      const limit = blocksBefore.getTime();
      const keep = blocks.filter((block) => {
        const end = block.removedAt ?? block.expiresAt;
        return end === null || end.getTime() >= limit;
      });
      const removedBlocks = blocks.length - keep.length;
      blocks.splice(0, blocks.length, ...keep);
      const keptAudit = audit.filter((entry) => entry.at.getTime() >= auditBefore.getTime());
      const removedAudit = audit.length - keptAudit.length;
      audit.splice(0, audit.length, ...keptAudit);
      let removedUsage = 0;
      for (const key of [...usage.keys()]) {
        const [type, period = ''] = key.split(':');
        if (type === 'day' && period < usageDayBefore) {
          usage.delete(key);
          removedUsage += 1;
        }
      }
      return { blocks: removedBlocks, audit: removedAudit, usage: removedUsage };
    },

    async recentAudit(limit) {
      check();
      return [...audit].reverse().slice(0, limit);
    },

    dump: () => ({ blocks, audit, usage, control }),
  };

  function check(): void {
    if (store.failing) throw new DatabaseUnavailableError({ name: 'MemoryStoreFailure', code: undefined, originalCode: undefined });
  }

  function rowOf(periodType: UsagePeriodType, period: string): MutableUsage {
    const key = usageKey(periodType, period);
    let row = usage.get(key);
    if (!row) {
      row = { templates: 0, outbound: 0, cappedAt: {} };
      usage.set(key, row);
    }
    return row;
  }

  function pushAudit(at: Date, fields: Omit<AuditRecord, 'at'> & Record<string, unknown>): void {
    audit.push({
      at,
      action: fields.action,
      actorKind: fields.actorKind,
      actorName: fields.actorName,
      masked: fields.masked,
      origin: fields.origin,
      reason: fields.reason,
      details: fields.details,
    });
  }

  return store;
}
