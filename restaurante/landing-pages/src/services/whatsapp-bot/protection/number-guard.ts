import { createHash } from 'node:crypto';
import { periodsOf, type BotLimits } from '@restaurante/core/bot-control';

import { createExpiringMap, createRateLimiter } from '../store.ts';

/**
 * Controles por número en memoria (REQ-F-025; D-2): se pierden al reiniciar, y eso se acepta.
 *
 * - Ráfaga (RF-1.4) y tope por minuto (RF-1.3), con el limitador de store.ts.
 * - Topes diarios de mensajes procesados (RF-1.2) y de pedidos confirmados (RF-1.1), en el día
 *   del negocio.
 * - Textos idénticos repetidos (RF-7.1): se guarda un hash corto del texto normalizado y sus horas,
 *   nunca el texto. Con `repeatCount` iguales en `repeatWindowMs`, enfriamiento de `cooldownMs`.
 * - Mensajes fijos (D-T3): como mucho uno de cada tipo por número cada 2 h.
 *
 * Igual que el limitador de REQ-F-009 (RN-5), nada guarda el número: las claves son un HMAC con
 * una clave por proceso (`keyOf`). Todo está acotado (`maxTracked`): si se llena, se descarta el
 * número con menos actividad reciente.
 */

export const FIXED_REPLY_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_TEXTS_PER_NUMBER = 20;

interface DayState {
  day: string;
  messages: number;
  orders: number;
  cooldowns: number;
  dailyNotified: boolean;
}

interface RepeatState {
  texts: Map<string, number[]>;
  cooldownUntil: number;
}

export type RateVerdict = 'ok' | { readonly kind: 'burst' | 'minute'; readonly first: boolean };
export type RepeatVerdict = 'ok' | 'cooldown' | 'cooldown_again';

/** Hash corto del texto normalizado (D-T7: los mensajes sin texto comparten una clave fija). */
export const textKeyOf = (normalized: string | null): string =>
  normalized === null ? 'unsupported' : createHash('sha256').update(normalized).digest('base64url').slice(0, 16);

function touch<V>(map: Map<string, V>, key: string, value: V, max: number): void {
  map.delete(key);
  if (map.size >= max) {
    const oldest = map.keys().next();
    if (!oldest.done) map.delete(oldest.value);
  }
  map.set(key, value);
}

export function createNumberGuard({ limits, timeZone, keyOf, maxTracked = 1000 }: { limits: BotLimits; timeZone: string; keyOf: (canonical: string) => string; maxTracked?: number }) {
  const burst = createRateLimiter({ max: limits.burst, windowMs: limits.burstWindowMs, maxTracked, keyOf });
  const minute = createRateLimiter({ max: limits.messagesPerMinute, windowMs: 60_000, maxTracked, keyOf });
  const days = new Map<string, DayState>();
  const repeats = new Map<string, RepeatState>();
  const fixedReplies = createExpiringMap<true>({ ttlMs: FIXED_REPLY_TTL_MS, max: maxTracked });

  function dayOf(key: string, now: number): DayState {
    const day = periodsOf(new Date(now), timeZone).day;
    const current = days.get(key);
    const state = current && current.day === day ? current : { day, messages: 0, orders: 0, cooldowns: 0, dailyNotified: false };
    touch(days, key, state, maxTracked);
    return state;
  }

  return {
    /** RF-7.1: ¿está en enfriamiento? */
    cooling(canonical: string, now: number): boolean {
      const state = repeats.get(keyOf(canonical));
      return state !== undefined && state.cooldownUntil > now;
    },

    /** RF-1.4 y RF-1.3: la ráfaga primero; lo que descarta no cuenta en el tope por minuto. */
    rate(canonical: string, now: number): RateVerdict {
      burst.sweep(now);
      minute.sweep(now);
      const burstHit = burst.hit(canonical, now);
      if (burstHit !== 'ok') return { kind: 'burst', first: burstHit === 'first-limited' };
      const minuteHit = minute.hit(canonical, now);
      if (minuteHit !== 'ok') return { kind: 'minute', first: minuteHit === 'first-limited' };
      return 'ok';
    },

    /** RF-1.2: ¿ya procesó el máximo de mensajes hoy? (no cuenta nada). */
    dailyExceeded(canonical: string, now: number): boolean {
      return dayOf(keyOf(canonical), now).messages >= limits.messagesPerNumberDay;
    },

    /** RF-1.2: el mensaje fijo de "límite de hoy" solo una vez al día; true si toca enviarlo. */
    takeDailyNotice(canonical: string, now: number): boolean {
      const state = dayOf(keyOf(canonical), now);
      if (state.dailyNotified) return false;
      state.dailyNotified = true;
      return true;
    },

    /**
     * Cuenta un mensaje admitido (RF-1.2) y su texto (RF-7.1). `countDaily` es false para el
     * personal (RF-4), que también está exento de los repetidos.
     */
    commit(canonical: string, textKey: string, now: number, { exempt }: { exempt: boolean }): RepeatVerdict {
      const key = keyOf(canonical);
      const state = dayOf(key, now);
      if (exempt) return 'ok';
      state.messages += 1;
      const repeat = repeats.get(key) ?? { texts: new Map<string, number[]>(), cooldownUntil: 0 };
      const since = now - limits.repeatWindowMs;
      const times = [...(repeat.texts.get(textKey) ?? []).filter((time) => time > since), now];
      touch(repeat.texts, textKey, times, MAX_TEXTS_PER_NUMBER);
      touch(repeats, key, repeat, maxTracked);
      if (times.length < limits.repeatCount) return 'ok';
      repeat.texts.delete(textKey);
      repeat.cooldownUntil = now + limits.cooldownMs;
      state.cooldowns += 1;
      return state.cooldowns >= 2 ? 'cooldown_again' : 'cooldown';
    },

    /** RF-1.1: ¿le quedan pedidos hoy? */
    canOrder(canonical: string, now: number): boolean {
      return dayOf(keyOf(canonical), now).orders < limits.ordersPerNumberDay;
    },

    /** RF-1.1: un aviso aceptado por el proveedor cuenta como pedido (uno rechazado, no). */
    recordOrder(canonical: string, now: number): number {
      const state = dayOf(keyOf(canonical), now);
      state.orders += 1;
      return state.orders;
    },

    /** D-T3: true si toca enviar el mensaje fijo `kind` a este número (y lo marca por 2 h). */
    takeFixedReply(canonical: string, kind: string, now: number): boolean {
      const key = `${keyOf(canonical)}:${kind}`;
      if (fixedReplies.get(key, now)) return false;
      fixedReplies.set(key, true, now);
      return true;
    },

    /** Solo lectura (pruebas): números con estado. */
    get trackedCount(): number {
      return days.size;
    },
  };
}

export type NumberGuard = ReturnType<typeof createNumberGuard>;
