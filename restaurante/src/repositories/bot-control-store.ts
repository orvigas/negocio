/**
 * Persistencia de la protección del bot (REQ-F-025; D-2): lista negra seudonimizada, auditoría,
 * contadores globales e interruptor. Dos implementaciones con el mismo contrato:
 * prisma-bot-control-store.ts (MySQL) y memory-bot-control-store.ts (pruebas y `bot:chat`).
 *
 * Reglas comunes:
 * - Nunca hay dos bloqueos activos del mismo `phoneHash` (`addBlock` devuelve 'already_blocked').
 * - Cada alta, baja, caducidad y cambio del interruptor deja su entrada en la auditoría en la misma
 *   operación (RF-3.7, RF-9.1), solo con el número enmascarado.
 * - Ningún dato guardado es el número completo (RF-10).
 * - Los errores inesperados de la base se convierten en DatabaseUnavailableError.
 */

export const BLOCK_ORIGINS = Object.freeze(['manual', 'tope', 'repeticion'] as const);
export type BlockOrigin = (typeof BLOCK_ORIGINS)[number];
export const AUTOMATIC_ORIGINS: readonly BlockOrigin[] = Object.freeze(['tope', 'repeticion']);

export type UsagePeriodType = 'day' | 'month';
export type UsageCap = 'templates' | 'outbound' | 'budget';

/** Quién hace una acción: un usuario de /admin o el sistema. */
export type ControlActor = { readonly kind: 'user'; readonly id: number; readonly name: string } | { readonly kind: 'system' };

export interface BlockRecord {
  readonly id: number;
  readonly phoneHash: string;
  readonly keyId: string;
  readonly last4: string;
  readonly origin: BlockOrigin;
  readonly reason: string | null;
  readonly createdAt: Date;
  /** null: permanente. */
  readonly expiresAt: Date | null;
  /** Nombre visible del autor; null: el sistema. */
  readonly createdByName: string | null;
  readonly removedAt: Date | null;
}

export interface NewBlock {
  readonly phoneHash: string;
  readonly keyId: string;
  readonly last4: string;
  readonly origin: BlockOrigin;
  readonly reason: string | null;
  readonly expiresAt: Date | null;
  /** Para la auditoría (maskPhone). */
  readonly masked: string;
  /** Texto de la duración para la auditoría ("7 d", "permanente"). */
  readonly duration: string;
}

export interface ControlState {
  readonly paused: boolean;
  readonly changedAt: Date | null;
  readonly changedByName: string | null;
  readonly reason: string | null;
}

export const NOT_PAUSED: ControlState = Object.freeze({ paused: false, changedAt: null, changedByName: null, reason: null });

export interface UsageRecord {
  readonly periodType: UsagePeriodType;
  readonly period: string;
  readonly templates: number;
  readonly outbound: number;
  readonly cappedAt: Readonly<Partial<Record<UsageCap, Date>>>;
}

export interface UsageDelta {
  readonly templates: number;
  readonly outbound: number;
}

export interface AuditRecord {
  readonly at: Date;
  readonly action: string;
  readonly actorKind: string;
  readonly actorName: string | null;
  readonly masked: string | null;
  readonly origin: string | null;
  readonly reason: string | null;
  readonly details: string | null;
}

export interface PurgeLimits {
  /** Bloqueos vencidos o quitados antes de esta fecha. */
  readonly blocksBefore: Date;
  readonly auditBefore: Date;
  /** Contadores diarios con periodo anterior a esta fecha (AAAA-MM-DD). */
  readonly usageDayBefore: string;
}

export interface BotControlStore {
  /** Bloqueos vigentes (no quitados ni vencidos en `now`). */
  activeBlocks(now: Date): Promise<BlockRecord[]>;
  /** Hashes de los bloqueos automáticos creados desde `since` (escalón de RF-7.2), vigentes o no. */
  automaticBlocksSince(since: Date): Promise<{ phoneHash: string; createdAt: Date }[]>;
  addBlock(block: NewBlock, actor: ControlActor, now: Date): Promise<BlockRecord | 'already_blocked'>;
  /** Baja manual; null si no existe o ya no está vigente. */
  removeBlock(id: number, actor: ControlActor & { kind: 'user' }, now: Date): Promise<BlockRecord | null>;
  /** Re-key perezoso (D-T1): la entrada pasa a la clave actual. */
  rekeyBlocks(fromHash: string, toHash: string, keyId: string): Promise<void>;
  getControl(): Promise<ControlState>;
  setControl(paused: boolean, actor: ControlActor & { kind: 'user' }, reason: string | null, now: Date): Promise<ControlState>;
  readUsage(keys: readonly { periodType: UsagePeriodType; period: string }[]): Promise<UsageRecord[]>;
  addUsage(periodType: UsagePeriodType, period: string, delta: UsageDelta, now: Date): Promise<void>;
  /** Marca un tope como alcanzado; true si es la primera vez en el periodo (RF-2.4). */
  markCapped(periodType: UsagePeriodType, period: string, cap: UsageCap, now: Date): Promise<boolean>;
  /** Audita las caducidades pendientes (RF-3.7); devuelve cuántas. */
  auditExpired(now: Date): Promise<number>;
  /** Retención (RF-10, D-T9). */
  purge(limits: PurgeLimits): Promise<{ blocks: number; audit: number; usage: number }>;
  /** Auditoría más reciente primero (pruebas y diagnóstico). */
  recentAudit(limit: number): Promise<AuditRecord[]>;
}

export const isActiveBlock = (block: Pick<BlockRecord, 'removedAt' | 'expiresAt'>, now: Date): boolean =>
  block.removedAt === null && (block.expiresAt === null || block.expiresAt.getTime() > now.getTime());

/** Fila de auditoría de un cambio en la lista negra. */
export function blockAuditFields(action: 'block_added' | 'block_removed' | 'block_expired', actor: ControlActor, block: { masked: string; origin: BlockOrigin; reason: string | null; details: string | null }) {
  return {
    action,
    actorKind: actor.kind,
    actorId: actor.kind === 'user' ? actor.id : null,
    actorName: actor.kind === 'user' ? actor.name : null,
    masked: block.masked,
    origin: block.origin,
    reason: block.reason,
    details: block.details,
  };
}

/** "*********5678" a partir de los 4 últimos dígitos (las entradas no guardan la longitud). */
export const maskedFromLast4 = (last4: string): string => `*********${last4}`;
