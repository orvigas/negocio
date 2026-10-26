import type { UsageCap, UsageDelta, UsagePeriodType, UsageRecord } from '@restaurante/core/bot-control';
import type { Logger } from '@restaurante/core/shared';

import { toZonedIsoString } from '../utils/datetime.ts';
import type { BotLimits } from './whatsapp-bot/protection/limits.ts';

/**
 * Contadores globales del bot (REQ-F-025, RF-2): plantillas al personal y mensajes salientes, por
 * día y por mes en la zona del negocio, y gasto estimado frente al presupuesto.
 *
 * - La memoria es la fuente de verdad mientras la app corre (una instancia): cada envío **reserva**
 *   su unidad de forma síncrona antes de salir, así dos clientes a la vez no superan un tope.
 * - Cada reserva o liberación se persiste con `persist` (cola de bot-control.ts); al arrancar se
 *   cargan el día y el mes actuales (CA-5: los contadores y el corte sobreviven a un reinicio).
 * - Un envío que el proveedor rechaza de forma definitiva libera su unidad (D-T2).
 * - La primera vez que se alcanza un tope en su periodo se registra un error sin números (RF-2.4)
 *   y se marca en la base, para no repetirlo tras un reinicio.
 * - Al cambiar el día o el mes, el periodo nuevo empieza en 0 de forma perezosa.
 */

export type SendKind = 'outbound' | 'template';
export type UsageBlock = 'templates_day' | 'templates_month' | 'outbound_day' | 'outbound_month' | 'budget';

interface PeriodState {
  period: string;
  templates: number;
  outbound: number;
  capped: Set<UsageCap>;
}

export interface UsageTicket {
  readonly kind: SendKind;
  readonly day: string;
  readonly month: string;
}

export interface UsageStatus {
  readonly id: UsageBlock;
  readonly used: number;
  readonly limit: number;
  readonly reached: boolean;
}

export interface UsageSnapshot {
  readonly day: { readonly period: string; readonly templates: number; readonly outbound: number };
  readonly month: { readonly period: string; readonly templates: number; readonly outbound: number };
  readonly estimatedMicros: number;
  readonly budgetMicros: number;
  readonly statuses: readonly UsageStatus[];
}

export interface UsageMeterOptions {
  limits: BotLimits;
  timeZone: string;
  logger: Logger;
  persist: (periodType: UsagePeriodType, period: string, delta: UsageDelta) => void;
  markCapped: (periodType: UsagePeriodType, period: string, cap: UsageCap) => void;
}

export const periodsOf = (now: Date, timeZone: string): { day: string; month: string } => {
  const iso = toZonedIsoString(now, timeZone);
  return { day: iso.slice(0, 10), month: iso.slice(0, 7) };
};

/** Gasto estimado (RF-2.3) en micro-USD: plantillas × utility + máx(0, salientes − cupo) × servicio. */
export const estimateMicros = (limits: BotLimits, templates: number, outbound: number): number =>
  templates * limits.utilityCostMicros + Math.max(0, outbound - limits.freeServiceMonth) * limits.serviceCostMicros;

const emptyPeriod = (period: string): PeriodState => ({ period, templates: 0, outbound: 0, capped: new Set() });

export function createUsageMeter({ limits, timeZone, logger, persist, markCapped }: UsageMeterOptions) {
  let day = emptyPeriod('');
  let month = emptyPeriod('');

  function roll(now: Date): void {
    const periods = periodsOf(now, timeZone);
    if (day.period !== periods.day) day = emptyPeriod(periods.day);
    if (month.period !== periods.month) month = emptyPeriod(periods.month);
  }

  /** RF-2.4: una sola vez por tope y periodo (también tras un reinicio: `capped` se carga). */
  function noteCap(periodType: UsagePeriodType, cap: UsageCap, limit: number): void {
    const state = periodType === 'day' ? day : month;
    if (state.capped.has(cap)) return;
    state.capped.add(cap);
    logger.error(periodType === 'day' ? 'bot_daily_cap_reached' : 'bot_monthly_cap_reached', {
      cap,
      limit: cap === 'budget' ? limit / 1_000_000 : limit,
      period: state.period,
    });
    markCapped(periodType, state.period, cap);
  }

  /** Motivo por el que una unidad más superaría un tope, o null. */
  function blockOf(kind: SendKind): UsageBlock | null {
    if (kind === 'template') {
      if (day.templates >= limits.templatesDay) return 'templates_day';
      if (month.templates >= limits.templatesMonth) return 'templates_month';
      if (estimateMicros(limits, month.templates + 1, month.outbound) > limits.budgetMonthMicros) return 'budget';
      return null;
    }
    if (day.outbound >= limits.outboundDay) return 'outbound_day';
    if (month.outbound >= limits.outboundMonth) return 'outbound_month';
    if (estimateMicros(limits, month.templates, month.outbound + 1) > limits.budgetMonthMicros) return 'budget';
    return null;
  }

  function noteBlock(block: UsageBlock): void {
    if (block === 'templates_day') noteCap('day', 'templates', limits.templatesDay);
    else if (block === 'templates_month') noteCap('month', 'templates', limits.templatesMonth);
    else if (block === 'outbound_day') noteCap('day', 'outbound', limits.outboundDay);
    else if (block === 'outbound_month') noteCap('month', 'outbound', limits.outboundMonth);
    else noteCap('month', 'budget', limits.budgetMonthMicros);
  }

  /** Tras sumar: si el contador llegó a su tope (o el gasto al presupuesto), es la "primera vez". */
  function noteReached(kind: SendKind): void {
    if (kind === 'template') {
      if (day.templates >= limits.templatesDay) noteCap('day', 'templates', limits.templatesDay);
      if (month.templates >= limits.templatesMonth) noteCap('month', 'templates', limits.templatesMonth);
    } else {
      if (day.outbound >= limits.outboundDay) noteCap('day', 'outbound', limits.outboundDay);
      if (month.outbound >= limits.outboundMonth) noteCap('month', 'outbound', limits.outboundMonth);
    }
    if (estimateMicros(limits, month.templates, month.outbound) >= limits.budgetMonthMicros) noteCap('month', 'budget', limits.budgetMonthMicros);
  }

  function add(kind: SendKind, amount: number): void {
    const field = kind === 'template' ? 'templates' : 'outbound';
    day[field] += amount;
    month[field] += amount;
    const delta = { templates: kind === 'template' ? amount : 0, outbound: kind === 'outbound' ? amount : 0 };
    persist('day', day.period, delta);
    persist('month', month.period, delta);
  }

  return {
    /** Carga los contadores del día y del mes actuales (al arrancar). */
    load(records: readonly UsageRecord[], now: Date): void {
      roll(now);
      for (const record of records) {
        const state = record.periodType === 'day' ? day : month;
        if (record.period !== state.period) continue;
        state.templates = record.templates;
        state.outbound = record.outbound;
        state.capped = new Set(Object.keys(record.cappedAt) as UsageCap[]);
      }
    },

    /** Periodos vigentes (para cargar sus filas). */
    periods: (now: Date) => periodsOf(now, timeZone),

    /** ¿Una unidad más de `kind` superaría algún tope? (sin reservar). */
    blocked(kind: SendKind, now: Date): UsageBlock | null {
      roll(now);
      const block = blockOf(kind);
      if (block) noteBlock(block);
      return block;
    },

    /** Reserva una unidad antes del envío; null si superaría un tope (no se envía). */
    reserve(kind: SendKind, now: Date): UsageTicket | null {
      roll(now);
      const block = blockOf(kind);
      if (block) {
        noteBlock(block);
        return null;
      }
      add(kind, 1);
      noteReached(kind);
      return { kind, day: day.period, month: month.period };
    },

    /** Libera una reserva de un envío rechazado (D-T2); solo si su periodo sigue vigente. */
    release(ticket: UsageTicket, now: Date): void {
      roll(now);
      if (ticket.day !== day.period || ticket.month !== month.period) return;
      add(ticket.kind, -1);
    },

    snapshot(now: Date): UsageSnapshot {
      roll(now);
      const estimatedMicros = estimateMicros(limits, month.templates, month.outbound);
      const status = (id: UsageBlock, used: number, limit: number): UsageStatus => ({ id, used, limit, reached: used >= limit });
      return {
        day: { period: day.period, templates: day.templates, outbound: day.outbound },
        month: { period: month.period, templates: month.templates, outbound: month.outbound },
        estimatedMicros,
        budgetMicros: limits.budgetMonthMicros,
        statuses: [
          status('templates_day', day.templates, limits.templatesDay),
          status('templates_month', month.templates, limits.templatesMonth),
          status('outbound_day', day.outbound, limits.outboundDay),
          status('outbound_month', month.outbound, limits.outboundMonth),
          { ...status('budget', estimatedMicros, limits.budgetMonthMicros), reached: estimatedMicros >= limits.budgetMonthMicros || month.capped.has('budget') },
        ],
      };
    },
  };
}

export type UsageMeter = ReturnType<typeof createUsageMeter>;
