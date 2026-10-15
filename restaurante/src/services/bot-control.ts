import { createHmac, randomBytes } from 'node:crypto';

import type { BotKeys } from '../config/env.ts';
import {
  isActiveBlock,
  maskedFromLast4,
  type BlockOrigin,
  type BlockRecord,
  type BotControlStore,
  type ControlActor,
  type ControlState,
  type NewBlock,
  type UsageDelta,
  type UsagePeriodType,
  NOT_PAUSED,
} from '../repositories/bot-control-store.ts';
import { errorProp } from '../utils/errors.ts';
import type { Logger } from '../utils/logger.ts';
import { createUsageMeter, periodsOf, type UsageMeter, type UsageSnapshot } from './bot-usage.ts';
import { MS, USAGE_DAY_RETENTION_MONTHS, type BotLimits } from './whatsapp-bot/protection/limits.ts';
import { canonicalPhone, maskPhone, parsePhoneInput } from './whatsapp-bot/phone.ts';

/**
 * Estado compartido de la protección del bot (REQ-F-025) entre el bot y la página "Bot" de /admin:
 * lista negra seudonimizada, interruptor, contadores globales y "alcanzaron un tope hoy".
 *
 * - **Seudónimo (D-T1, RF-3.6):** HMAC-SHA256 del número canónico (CA-9) con una clave que no está
 *   en la base. Con una clave anterior (rotación), se busca también con ella y la entrada se vuelve
 *   a calcular con la actual cuando el número escribe (re-key perezoso).
 * - **Copia en memoria (D-T5, RF-3.8):** el bot consulta la lista y el interruptor sin ir a la base.
 *   Un cambio desde el panel actualiza la copia al confirmarse; los hechos fuera del proceso llegan
 *   con un refresco perezoso (como mucho cada `refreshMs`). Si la base falla, se conserva la última
 *   copia conocida y se registra un error por caída (`bot_control_store_failed`).
 * - **Altas automáticas:** surten efecto al instante en memoria; si su escritura falla, se
 *   reintentan en el siguiente refresco (como mucho `MAX_PENDING_BLOCKS`).
 * - **Contadores:** bot-usage.ts; sus deltas se persisten en una cola serie que acumula lo pendiente
 *   si la base falla y lo reintenta con la siguiente escritura, el mantenimiento o el apagado.
 * - Nunca registra el número completo, el seudónimo ni las claves.
 */

export const MANUAL_DURATIONS = Object.freeze({
  '24h': { label: '24 horas', ms: 24 * MS.hour },
  '7d': { label: '7 días', ms: 7 * MS.day },
  '30d': { label: '30 días', ms: 30 * MS.day },
  permanente: { label: 'Permanente', ms: null },
} as const);
export type ManualDuration = keyof typeof MANUAL_DURATIONS;
export const DEFAULT_MANUAL_DURATION: ManualDuration = '7d';
export const isManualDuration = (value: unknown): value is ManualDuration => typeof value === 'string' && Object.hasOwn(MANUAL_DURATIONS, value);

export const REASON_MAX_LENGTH = 200;
const REACHED_MAX = 200;
const MAX_PENDING_BLOCKS = 100;
const HASH_DOMAIN = 'bot-block:v1:';

export type ReachedCap = 'orders' | 'messages' | 'cooldown' | 'burst' | 'minute';

export interface ReachedEntry {
  readonly token: string;
  readonly masked: string;
  readonly cap: ReachedCap;
  readonly at: Date;
}

export interface BotControlSnapshot {
  readonly control: ControlState;
  readonly blocks: readonly BlockRecord[];
  readonly reached: readonly ReachedEntry[];
  readonly usage: UsageSnapshot;
  readonly canBlock: boolean;
  /** Entradas vigentes calculadas con la clave anterior (D-T1). */
  readonly previousKeyBlocks: number;
  readonly storeHealthy: boolean;
}

export type BlockOutcome = 'blocked' | 'already_blocked' | 'staff' | 'invalid_phone' | 'no_key' | 'not_found';

/** Motivo opcional del panel (D-T4): hasta 200 caracteres, sin control y sin números completos. */
export function validateReason(raw: string | undefined): { value: string | null } | { error: string } {
  const value = (raw ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
  if (value === '') return { value: null };
  if (/\p{Cc}/u.test(value)) return { error: 'El motivo tiene caracteres no permitidos.' };
  if ([...value].length > REASON_MAX_LENGTH) return { error: `El motivo puede tener hasta ${REASON_MAX_LENGTH} caracteres.` };
  if (/\d{8,}/.test(value.replace(/[\s().+-]/g, ''))) return { error: 'No escribas números de teléfono en el motivo.' };
  return { value };
}

export interface BotControlOptions {
  store: BotControlStore;
  keys: BotKeys | null;
  limits: BotLimits;
  timeZone: string;
  /** Números del personal (lista blanca, RF-4). */
  staff: readonly string[];
  logger: Logger;
  now?: () => Date;
}

const hmacHex = (key: Buffer, value: string): string => createHmac('sha256', key).update(value).digest('hex');
const keyIdOf = (key: Buffer): string => hmacHex(key, 'key-id').slice(0, 8);

const durationText = (ms: number | null): string => {
  if (ms === null) return 'permanente';
  if (ms % MS.day === 0) return `${ms / MS.day} d`;
  return `${Math.round(ms / MS.hour)} h`;
};

const monthsBefore = (date: Date, months: number): Date => {
  const result = new Date(date.getTime());
  result.setUTCMonth(result.getUTCMonth() - months);
  return result;
};

export function createBotControl({ store, keys, limits, timeZone, staff, logger, now = () => new Date() }: BotControlOptions) {
  const staffNumbers = new Set(staff.map(canonicalPhone));
  const currentKey = keys ? { key: keys.current, id: keyIdOf(keys.current) } : null;
  const previousKey = keys?.previous ? { key: keys.previous, id: keyIdOf(keys.previous) } : null;

  let control: ControlState = NOT_PAUSED;
  let blocks: BlockRecord[] = [];
  /** Bloqueos automáticos del historial (RF-7.2): hash -> fechas de alta. */
  let automaticHistory = new Map<string, number[]>();
  const pendingBlocks: { block: NewBlock; createdAt: Date }[] = [];
  const reached = new Map<string, ReachedEntry & { hash: string; last4: string; day: string }>();
  let reachedDay = '';

  let storeHealthy = true;
  let lastRefresh = 0;
  let refreshing: Promise<void> | null = null;
  /** Cambia con cada escritura local: un refresco que empezó antes no pisa la copia. */
  let localVersion = 0;
  let provisionalId = 0;

  // Cola de deltas de los contadores (clave periodType:period).
  const pendingUsage = new Map<string, { periodType: UsagePeriodType; period: string } & { templates: number; outbound: number }>();
  let flushing: Promise<void> | null = null;

  function storeFailed(operation: string, err: unknown): void {
    if (!storeHealthy) return;
    storeHealthy = false;
    const details = errorProp(err, 'details');
    logger.error('bot_control_store_failed', { operation, name: errorProp(err, 'name'), code: errorProp(details, 'code') ?? errorProp(err, 'code') });
  }

  function storeOk(): void {
    if (storeHealthy) return;
    storeHealthy = true;
    logger.info('bot_control_store_recovered', {});
  }

  const usage: UsageMeter = createUsageMeter({
    limits,
    timeZone,
    logger,
    persist: (periodType, period, delta) => queueUsage(periodType, period, delta),
    markCapped: (periodType, period, cap) => {
      store.markCapped(periodType, period, cap, now()).then(storeOk, (err: unknown) => storeFailed('mark_capped', err));
    },
  });

  function queueUsage(periodType: UsagePeriodType, period: string, delta: UsageDelta): void {
    const key = `${periodType}:${period}`;
    const entry = pendingUsage.get(key) ?? { periodType, period, templates: 0, outbound: 0 };
    entry.templates += delta.templates;
    entry.outbound += delta.outbound;
    pendingUsage.set(key, entry);
    void flushUsage();
  }

  function flushUsage(): Promise<void> {
    if (flushing) return flushing;
    flushing = (async () => {
      while (pendingUsage.size > 0) {
        const [key, entry] = pendingUsage.entries().next().value as [string, { periodType: UsagePeriodType; period: string; templates: number; outbound: number }];
        pendingUsage.delete(key);
        if (entry.templates === 0 && entry.outbound === 0) continue;
        try {
          await store.addUsage(entry.periodType, entry.period, entry, now());
          storeOk();
        } catch (err) {
          // Se devuelve a la cola sumado a lo que llegó mientras tanto; se reintenta más tarde.
          const later = pendingUsage.get(key);
          pendingUsage.set(key, { ...entry, templates: entry.templates + (later?.templates ?? 0), outbound: entry.outbound + (later?.outbound ?? 0) });
          storeFailed('add_usage', err);
          return;
        }
      }
    })().finally(() => {
      flushing = null;
    });
    return flushing;
  }

  /** Hashes de un número: con la clave actual y, en rotación, con la anterior. */
  function hashesOf(canonical: string): { current: string; previous: string | null } | null {
    if (!currentKey) return null;
    return {
      current: hmacHex(currentKey.key, HASH_DOMAIN + canonical),
      previous: previousKey ? hmacHex(previousKey.key, HASH_DOMAIN + canonical) : null,
    };
  }

  function activeBlockOf(hashes: { current: string; previous: string | null }, at: Date): BlockRecord | undefined {
    return blocks.find((block) => (block.phoneHash === hashes.current || block.phoneHash === hashes.previous) && isActiveBlock(block, at));
  }

  function setBlocks(next: BlockRecord[]): void {
    blocks = next;
  }

  async function load(): Promise<void> {
    const at = now();
    const version = localVersion;
    const [active, history, state] = await Promise.all([
      store.activeBlocks(at),
      store.automaticBlocksSince(new Date(at.getTime() - limits.blockHistoryMs)),
      store.getControl(),
    ]);
    if (version !== localVersion) return;
    const nextHistory = new Map<string, number[]>();
    for (const entry of history) nextHistory.set(entry.phoneHash, [...(nextHistory.get(entry.phoneHash) ?? []), entry.createdAt.getTime()]);
    // Las altas automáticas aún sin guardar siguen vigentes en memoria.
    const provisional = blocks.filter((block) => block.id < 0);
    setBlocks([...active, ...provisional.filter((block) => !active.some((other) => other.phoneHash === block.phoneHash))]);
    for (const block of provisional) nextHistory.set(block.phoneHash, [...(nextHistory.get(block.phoneHash) ?? []), block.createdAt.getTime()]);
    automaticHistory = nextHistory;
    control = state;
    lastRefresh = at.getTime();
  }

  async function retryPendingBlocks(): Promise<void> {
    while (pendingBlocks.length > 0) {
      const [first] = pendingBlocks;
      if (!first) return;
      const saved = await store.addBlock(first.block, { kind: 'system' }, first.createdAt);
      pendingBlocks.shift();
      localVersion += 1;
      if (saved !== 'already_blocked') setBlocks([saved, ...blocks.filter((block) => !(block.id < 0 && block.phoneHash === saved.phoneHash))]);
    }
  }

  async function refresh(): Promise<void> {
    try {
      await retryPendingBlocks();
      await load();
      await flushUsage();
      storeOk();
    } catch (err) {
      storeFailed('refresh', err);
      // Se reintenta en el siguiente intervalo, no en cada mensaje.
      lastRefresh = now().getTime();
    }
  }

  /** Refresco perezoso (D-T5): no espera; el bot sigue con la copia actual. */
  function maybeRefresh(): void {
    if (refreshing || now().getTime() - lastRefresh < limits.refreshMs) return;
    refreshing = refresh().finally(() => {
      refreshing = null;
    });
  }

  function rekey(block: BlockRecord, hashes: { current: string; previous: string | null }): void {
    if (!currentKey || block.phoneHash === hashes.current || block.id < 0) return;
    localVersion += 1;
    setBlocks(blocks.map((other) => (other.phoneHash === block.phoneHash ? { ...other, phoneHash: hashes.current, keyId: currentKey.id } : other)));
    const from = block.phoneHash;
    store.rekeyBlocks(from, hashes.current, currentKey.id).then(storeOk, (err: unknown) => storeFailed('rekey', err));
    const history = automaticHistory.get(from);
    if (history) {
      automaticHistory.delete(from);
      automaticHistory.set(hashes.current, history);
    }
  }

  function resetReachedIfNewDay(at: Date): void {
    const day = periodsOf(at, timeZone).day;
    if (day === reachedDay) return;
    reachedDay = day;
    reached.clear();
  }

  function newBlockFor(canonical: string, origin: BlockOrigin, reason: string | null, ms: number | null, at: Date): NewBlock | null {
    const hashes = hashesOf(canonical);
    if (!hashes || !currentKey) return null;
    return {
      phoneHash: hashes.current,
      keyId: currentKey.id,
      last4: canonical.slice(-4),
      origin,
      reason,
      expiresAt: ms === null ? null : new Date(at.getTime() + ms),
      masked: maskedFromLast4(canonical.slice(-4)),
      duration: durationText(ms),
    };
  }

  /** Escalón del bloqueo por repeticiones (RF-7.2): según los automáticos de los últimos 30 días. */
  function repeatBlockMs(hashes: { current: string; previous: string | null }, at: Date): number {
    const since = at.getTime() - limits.blockHistoryMs;
    const count = [hashes.current, hashes.previous]
      .filter((hash): hash is string => hash !== null)
      .flatMap((hash) => automaticHistory.get(hash) ?? [])
      .filter((time) => time >= since).length;
    const steps = limits.repeatBlockStepsMs;
    return steps[Math.min(count, steps.length - 1)] ?? steps[steps.length - 1] ?? MS.day;
  }

  async function addManual(block: NewBlock, actor: ControlActor & { kind: 'user' }): Promise<BlockOutcome> {
    const at = now();
    const saved = await store.addBlock(block, actor, at);
    if (saved === 'already_blocked') return 'already_blocked';
    localVersion += 1;
    setBlocks([saved, ...blocks.filter((other) => other.phoneHash !== saved.phoneHash)]);
    logger.info('bot_block_added', { customer: block.masked, origin: 'manual', duration: block.duration, actorId: actor.id });
    return 'blocked';
  }

  return {
    limits,
    usage,

    /** Carga inicial (al arrancar): si la base falla aquí, el servidor no arranca. */
    async init(): Promise<void> {
      const at = now();
      await load();
      const periods = usage.periods(at);
      usage.load(
        await store.readUsage([
          { periodType: 'day', period: periods.day },
          { periodType: 'month', period: periods.month },
        ]),
        at,
      );
    },

    /** ¿Hay clave para seudonimizar? (sin bot no la hay: no se puede dar de alta). */
    get canBlock(): boolean {
      return currentKey !== null;
    },

    isStaff: (canonical: string): boolean => staffNumbers.has(canonical),

    /** Interruptor (RF-9), desde la copia en memoria. */
    isPaused(): boolean {
      maybeRefresh();
      return control.paused;
    },

    /** Lista negra (RF-3.1), desde la copia en memoria. */
    isBlocked(canonical: string): boolean {
      maybeRefresh();
      const hashes = hashesOf(canonical);
      if (!hashes) return false;
      const block = activeBlockOf(hashes, now());
      if (!block) return false;
      if (block.phoneHash !== hashes.current) rekey(block, hashes);
      return true;
    },

    /**
     * Alta automática (RF-1.2 y RF-7.2): efecto inmediato en memoria y escritura en segundo plano.
     * El personal nunca se bloquea (RF-4).
     */
    autoBlock(canonical: string, origin: 'tope' | 'repeticion'): void {
      if (staffNumbers.has(canonical)) return;
      const at = now();
      const hashes = hashesOf(canonical);
      if (!hashes || activeBlockOf(hashes, at)) return;
      const ms = origin === 'tope' ? limits.capBlockMs : repeatBlockMs(hashes, at);
      const block = newBlockFor(canonical, origin, null, ms, at);
      if (!block) return;
      localVersion += 1;
      provisionalId -= 1;
      const provisional: BlockRecord = { id: provisionalId, phoneHash: block.phoneHash, keyId: block.keyId, last4: block.last4, origin, reason: null, createdAt: at, expiresAt: block.expiresAt, createdByName: null, removedAt: null };
      setBlocks([provisional, ...blocks]);
      automaticHistory.set(block.phoneHash, [...(automaticHistory.get(block.phoneHash) ?? []), at.getTime()]);
      logger.warn('bot_auto_blocked', { customer: maskPhone(canonical), origin, hours: Math.round(ms / MS.hour) });
      store.addBlock(block, { kind: 'system' }, at).then(
        (saved) => {
          storeOk();
          if (saved === 'already_blocked') return;
          localVersion += 1;
          setBlocks([saved, ...blocks.filter((other) => other !== provisional)]);
        },
        (err: unknown) => {
          storeFailed('auto_block', err);
          if (pendingBlocks.length < MAX_PENDING_BLOCKS) pendingBlocks.push({ block, createdAt: at });
        },
      );
    },

    /** "Alcanzaron un tope hoy" (RF-6; D-T11): en memoria, sin el número ni el seudónimo en el HTML. */
    recordReached(canonical: string, cap: ReachedCap): void {
      if (!currentKey) return;
      const at = now();
      resetReachedIfNewDay(at);
      const hash = hashesOf(canonical)?.current;
      if (!hash || [...reached.values()].some((entry) => entry.hash === hash && entry.cap === cap)) return;
      if (reached.size >= REACHED_MAX) {
        const oldest = reached.keys().next();
        if (!oldest.done) reached.delete(oldest.value);
      }
      const token = randomBytes(16).toString('hex');
      reached.set(token, { token, masked: maskedFromLast4(canonical.slice(-4)), cap, at, hash, last4: canonical.slice(-4), day: reachedDay });
    },

    /** Estado para el panel. Refresca antes la copia si está vieja (sin esperar si la base falla). */
    async snapshot(): Promise<BotControlSnapshot> {
      if (now().getTime() - lastRefresh >= limits.refreshMs) await (refreshing ?? refresh());
      const at = now();
      resetReachedIfNewDay(at);
      const active = blocks.filter((block) => isActiveBlock(block, at));
      return {
        control,
        blocks: active,
        reached: [...reached.values()].map(({ token, masked, cap, at: when }) => ({ token, masked, cap, at: when })).reverse(),
        usage: usage.snapshot(at),
        canBlock: currentKey !== null,
        previousKeyBlocks: previousKey ? active.filter((block) => block.keyId === previousKey.id).length : 0,
        storeHealthy,
      };
    },

    /** Alta manual desde el panel (RF-3.2, RF-3.3; D-T4). */
    async blockManual(input: string, duration: ManualDuration, reason: string | null, actor: ControlActor & { kind: 'user' }): Promise<BlockOutcome> {
      if (!currentKey) return 'no_key';
      const canonical = parsePhoneInput(input);
      if (canonical === null) return 'invalid_phone';
      if (staffNumbers.has(canonical)) return 'staff';
      const block = newBlockFor(canonical, 'manual', reason, MANUAL_DURATIONS[duration].ms, now());
      if (!block) return 'no_key';
      const hashes = hashesOf(canonical);
      if (hashes && activeBlockOf(hashes, now())) return 'already_blocked';
      return addManual(block, actor);
    },

    /** 4 últimos dígitos de una entrada de "alcanzaron un tope hoy" (para el aviso de éxito), o null. */
    reachedLast4: (token: string): string | null => reached.get(token)?.last4 ?? null,

    /** Bloqueo desde "alcanzaron un tope hoy" (token de un solo uso). */
    async blockReached(token: string, duration: ManualDuration, reason: string | null, actor: ControlActor & { kind: 'user' }): Promise<BlockOutcome> {
      const entry = reached.get(token);
      if (!entry || !currentKey) return 'not_found';
      const at = now();
      const ms = MANUAL_DURATIONS[duration].ms;
      const outcome = await addManual(
        {
          phoneHash: entry.hash,
          keyId: currentKey.id,
          last4: entry.last4,
          origin: 'manual',
          reason,
          expiresAt: ms === null ? null : new Date(at.getTime() + ms),
          masked: entry.masked,
          duration: durationText(ms),
        },
        actor,
      );
      reached.delete(token);
      return outcome;
    },

    /** Baja manual (RF-3.4): también de un bloqueo automático. Devuelve los 4 últimos dígitos, o null. */
    async unblock(id: number, actor: ControlActor & { kind: 'user' }): Promise<string | null> {
      const removed = await store.removeBlock(id, actor, now());
      if (!removed) return null;
      localVersion += 1;
      setBlocks(blocks.filter((block) => block.phoneHash !== removed.phoneHash));
      logger.info('bot_block_removed', { customer: maskedFromLast4(removed.last4), origin: removed.origin, actorId: actor.id });
      return removed.last4;
    },

    /** Interruptor (RF-9.1): efecto inmediato al confirmarse. */
    async setPaused(paused: boolean, actor: ControlActor & { kind: 'user' }, reason: string | null): Promise<void> {
      const state = await store.setControl(paused, actor, reason, now());
      localVersion += 1;
      control = state;
      logger.info(paused ? 'bot_control_paused' : 'bot_control_resumed', { actorId: actor.id });
    },

    /** Mantenimiento (D-T5): caducidades, retención (RF-10, D-T9) y reintentos. Nunca lanza. */
    async maintenance(): Promise<void> {
      const at = now();
      try {
        const expired = await store.auditExpired(at);
        const purged = await store.purge({
          blocksBefore: new Date(at.getTime() - limits.blockHistoryMs),
          auditBefore: monthsBefore(at, limits.auditRetentionMonths),
          usageDayBefore: periodsOf(monthsBefore(at, USAGE_DAY_RETENTION_MONTHS), timeZone).day,
        });
        if (expired > 0 || purged.blocks > 0 || purged.audit > 0 || purged.usage > 0) {
          logger.info('bot_control_maintenance', { expired, purgedBlocks: purged.blocks, purgedAudit: purged.audit, purgedUsage: purged.usage });
        }
        storeOk();
      } catch (err) {
        storeFailed('maintenance', err);
      }
      await refresh();
    },

    /** Apagado ordenado: guarda los contadores pendientes. */
    async flush(): Promise<void> {
      await flushUsage();
      if (pendingUsage.size > 0) await flushUsage();
    },

    /** Pruebas: refresco forzado. */
    refresh,
  };
}

export type BotControl = ReturnType<typeof createBotControl>;
