import { createHmac, randomBytes } from 'node:crypto';

import type { BusinessId } from '../../../config/businesses.ts';
import type { Logger } from '../../../utils/logger.ts';
import type { BotControl } from '../../bot-control.ts';
import type { UsageTicket } from '../../bot-usage.ts';
import type { SendFailureKind } from '../chat-bot.ts';
import { canonicalPhone, maskPhone } from '../phone.ts';
import { createExpiringMap } from '../store.ts';
import { normalizeInput } from '../text.ts';
import type { BotLimits } from './limits.ts';
import { createNumberGuard, textKeyOf } from './number-guard.ts';

/**
 * Protección del bot contra el gasto y el abuso (REQ-F-025), compartida por los dos proveedores.
 * El orquestador la consulta en este orden (RF "Orden de aplicación"); un mensaje descartado en un
 * paso no cuenta en los siguientes:
 *
 * 1. Interruptor (RF-9) · 2. Lista negra (RF-3) · 3. Enfriamiento (RF-7) · 4. Ráfaga y tope por
 * minuto (RF-1.4, RF-1.3) · 5. Tope diario de mensajes por número (RF-1.2; solo se consulta) ·
 * 6. Cola global (RF-8) · después se cuentan el mensaje y su texto (RF-1.2, RF-7) ·
 * 7. Procesamiento · 8. Topes globales antes de cada envío (RF-2), y el de pedidos (RF-1.1).
 *
 * Logs sin números completos, sin textos y sin seudónimos; los repetitivos, acotados.
 */

export type Admission = 'process' | 'drop' | 'daily_notice';
export type StartCheck = 'ok' | 'orders' | 'templates' | 'silent';
export type TemplateCheck = 'ok' | 'paused' | 'orders' | 'templates';

const LOG_INTERVAL_MS = 60_000;
const BLOCKED_LOG_TTL_MS = 60 * 60 * 1000;
/** Fallos de envío tras los que el proveedor pudo haber aceptado (y cobrado) el mensaje (D-T2). */
const MAYBE_SENT: ReadonlySet<SendFailureKind> = new Set(['ambiguous', 'timeout']);

export interface BotProtectionOptions {
  control: BotControl;
  limits: BotLimits;
  timeZone: string;
  logger: Logger;
}

export function createBotProtection({ control, limits, timeZone, logger }: BotProtectionOptions) {
  // Como el limitador de REQ-F-009 (RN-5): clave aleatoria por proceso, nunca el número en claro.
  const secret = randomBytes(32);
  const keyOf = (canonical: string): string => createHmac('sha256', secret).update(canonical).digest('base64url');
  const guard = createNumberGuard({ limits, timeZone, keyOf });
  const blockedLogged = createExpiringMap<true>({ ttlMs: BLOCKED_LOG_TTL_MS, max: 1000 });
  const throttled = { paused: { last: -Infinity, count: 0 }, queue: { last: -Infinity, count: 0 } };

  /** Un log como mucho por minuto con el número de descartes acumulados (RF-8, CA-11). */
  function countDrop(kind: keyof typeof throttled, msg: string, now: number): void {
    const state = throttled[kind];
    state.count += 1;
    if (now - state.last < LOG_INTERVAL_MS) return;
    logger.warn(msg, { dropped: state.count });
    state.last = now;
    state.count = 0;
  }

  return {
    /** Pasos 1 a 6 y el recuento: qué hacer con un mensaje entrante ya deduplicado. */
    admit(message: { readonly from: string; readonly text?: string | undefined }, now: number, queueSize: number): Admission {
      const canonical = canonicalPhone(message.from);
      // Como el resto de logs del bot: el número tal como lo envió el proveedor, enmascarado.
      const customer = maskPhone(message.from);
      if (control.isPaused()) {
        countDrop('paused', 'bot_paused_dropped', now);
        return 'drop';
      }
      if (control.isBlocked(canonical)) {
        if (!blockedLogged.get(keyOf(canonical), now)) {
          blockedLogged.set(keyOf(canonical), true, now);
          logger.info('bot_blocked_message', { customer });
        }
        return 'drop';
      }
      if (guard.cooling(canonical, now)) return 'drop';
      const rate = guard.rate(canonical, now);
      if (rate !== 'ok') {
        if (rate.first) {
          logger.warn(rate.kind === 'burst' ? 'bot_burst_limited' : 'bot_rate_limited', { customer });
          control.recordReached(canonical, rate.kind);
        }
        return 'drop';
      }
      const exempt = control.isStaff(canonical);
      const exceeded = !exempt && guard.dailyExceeded(canonical, now);
      if (queueSize >= limits.queueMax) {
        countDrop('queue', 'bot_queue_full', now);
        return 'drop';
      }
      if (exceeded) {
        if (!guard.takeDailyNotice(canonical, now)) return 'drop';
        logger.warn('bot_number_cap_reached', { customer, cap: 'messages', limit: limits.messagesPerNumberDay });
        control.recordReached(canonical, 'messages');
        control.autoBlock(canonical, 'tope');
        return 'daily_notice';
      }
      const textKey = textKeyOf(message.text === undefined ? null : normalizeInput(message.text));
      const repeat = guard.commit(canonical, textKey, now, { exempt });
      if (repeat === 'ok') return 'process';
      logger.warn('bot_cooldown_started', { customer, minutes: Math.round(limits.cooldownMs / 60_000) });
      control.recordReached(canonical, 'cooldown');
      if (repeat === 'cooldown_again') control.autoBlock(canonical, 'repeticion');
      return 'drop';
    },

    /**
     * Antes de abrir una conversación nueva (RF-1.1 y RF-2.1): 'orders' o 'templates' piden el
     * mensaje fijo; 'silent', que ya se le envió hace menos de 2 h (D-T3).
     */
    startCheck(from: string, now: Date): StartCheck {
      const canonical = canonicalPhone(from);
      const time = now.getTime();
      let kind: StartCheck = 'ok';
      if (!control.isStaff(canonical) && !guard.canOrder(canonical, time)) kind = 'orders';
      else if (control.usage.blocked('template', now) !== null) kind = 'templates';
      if (kind === 'ok') return 'ok';
      return guard.takeFixedReply(canonical, kind, time) ? kind : 'silent';
    },

    /** Antes del aviso al personal (paso 8 y RF-1.1). */
    templateCheck(from: string, now: Date): TemplateCheck {
      const canonical = canonicalPhone(from);
      if (control.isPaused()) return 'paused';
      if (!control.isStaff(canonical) && !guard.canOrder(canonical, now.getTime())) return 'orders';
      if (control.usage.blocked('template', now) !== null) return 'templates';
      return 'ok';
    },

    /** Reserva una unidad antes de enviar (paso 8); null: no se envía (pausa o tope global). */
    reserve(kind: 'outbound' | 'template', now: Date): UsageTicket | null {
      if (control.isPaused()) return null;
      return control.usage.reserve(kind, now);
    },

    /** Resultado de un envío: un rechazo definitivo libera la unidad (D-T2). */
    settle(ticket: UsageTicket, result: { ok: true } | { ok: false; kind: SendFailureKind }, now: Date): void {
      if (!result.ok && !MAYBE_SENT.has(result.kind)) control.usage.release(ticket, now);
    },

    /** RF-1.1: el aviso aceptado cuenta como pedido del número. */
    orderAccepted(from: string, now: Date, business: BusinessId): void {
      const canonical = canonicalPhone(from);
      if (control.isStaff(canonical)) return;
      const orders = guard.recordOrder(canonical, now.getTime());
      if (orders < limits.ordersPerNumberDay) return;
      logger.warn('bot_number_cap_reached', { customer: maskPhone(from), cap: 'orders', limit: limits.ordersPerNumberDay, business });
      control.recordReached(canonical, 'orders');
    },
  };
}

export type BotProtection = ReturnType<typeof createBotProtection>;
