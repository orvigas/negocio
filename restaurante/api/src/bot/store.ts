import type { Conversation } from './conversation.ts';

/**
 * Estado en memoria del bot (REQ-F-009, D-11: una sola instancia, como las sesiones de /admin).
 * Todo está acotado (tope de entradas) y caduca de forma perezosa, sin temporizadores.
 */

/** D-4: una conversación sin actividad durante 2 h caduca. */
export const CONVERSATION_IDLE_MS = 2 * 60 * 60 * 1000;
export const MAX_CONVERSATIONS = 1000;
/** Ids de mensaje ya vistos: más que el corte de los mensajes viejos (2 h, PT-4 A). */
export const SEEN_TTL_MS = 3 * 60 * 60 * 1000;
export const MAX_SEEN = 10_000;
/** Límite por número (DT-15): 20 mensajes por minuto. */
export const RATE_LIMIT = Object.freeze({ max: 20, windowMs: 60 * 1000, maxTracked: 1000 });
/** Avisos al personal cuyo estado se vigila (PT-3 A): 24 h, sin datos personales. */
export const STAFF_MESSAGE_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_STAFF_MESSAGES = 1000;

/** Descarta la entrada más antigua (la primera clave de un Map, que conserva el orden de inserción). */
function dropOldest<K, V>(map: Map<K, V>): void {
  const oldest = map.keys().next();
  if (!oldest.done) map.delete(oldest.value);
}

export interface StoredConversation {
  conversation: Conversation;
  lastSeen: number;
  /** `timestamp` (segundos) del último mensaje procesado, para descartar los que llegan desordenados. */
  lastTimestamp: number;
}

export function createConversationStore({ idleMs = CONVERSATION_IDLE_MS, max = MAX_CONVERSATIONS } = {}) {
  const entries = new Map<string, StoredConversation>();
  return {
    /** Conversación vigente del cliente, o null (si caducó, se borra: RF-9.3). */
    get(waId: string, now: number): StoredConversation | null {
      const entry = entries.get(waId);
      if (!entry) return null;
      if (now - entry.lastSeen >= idleMs) {
        entries.delete(waId);
        return null;
      }
      return entry;
    },
    /** Guarda la conversación; devuelve true si hubo que descartar la menos reciente por el tope. */
    set(waId: string, entry: StoredConversation): boolean {
      entries.delete(waId);
      let evicted = false;
      if (entries.size >= max) {
        dropOldest(entries);
        evicted = true;
      }
      entries.set(waId, entry);
      return evicted;
    },
    delete(waId: string): void {
      entries.delete(waId);
    },
    /** Borra las conversaciones caducadas (RF-9.3). `set` reinserta: el orden es por actividad. */
    sweep(now: number): void {
      for (const [waId, entry] of entries) {
        if (now - entry.lastSeen < idleMs) break;
        entries.delete(waId);
      }
    },
    has(waId: string): boolean {
      return entries.has(waId);
    },
    get size(): number {
      return entries.size;
    },
  };
}

/** Conjunto acotado con caducidad (ids de mensaje vistos; avisos al personal). */
export function createExpiringMap<V>({ ttlMs, max }: { ttlMs: number; max: number }) {
  const entries = new Map<string, { value: V; expiresAt: number }>();
  const sweep = (now: number): void => {
    // Insertadas en orden de llegada: las primeras son las que caducan antes.
    for (const [key, entry] of entries) {
      if (entry.expiresAt > now) break;
      entries.delete(key);
    }
  };
  return {
    get(key: string, now: number): V | undefined {
      sweep(now);
      return entries.get(key)?.value;
    },
    set(key: string, value: V, now: number): void {
      sweep(now);
      entries.delete(key);
      if (entries.size >= max) dropOldest(entries);
      entries.set(key, { value, expiresAt: now + ttlMs });
    },
    get size(): number {
      return entries.size;
    },
  };
}

/**
 * Límite de mensajes por número en una ventana fija (DT-15).
 *
 * RN-5 (DEF-001 de QA): el limitador no guarda el número del cliente. `keyOf` lo convierte en
 * una clave seudónima (en el bot, un HMAC-SHA256 con una clave aleatoria por proceso) y las
 * ventanas vencidas se borran de forma perezosa en cada `hit` y en cada `sweep`, sin
 * temporizadores: una entrada no dura más de `windowMs` después de su último mensaje, siempre
 * que llegue cualquier entrega.
 */
export function createRateLimiter({
  max,
  windowMs,
  maxTracked,
  keyOf,
}: { max: number; windowMs: number; maxTracked: number; keyOf: (id: string) => string }) {
  const windows = new Map<string, { start: number; count: number; warned: boolean }>();

  /** Borra las ventanas vencidas. Una ventana nueva se reinserta al final: el orden es por inicio. */
  const sweep = (now: number): void => {
    for (const [key, entry] of windows) {
      if (now - entry.start < windowMs) break;
      windows.delete(key);
    }
  };

  return {
    /** 'ok', 'limited' (se ignora) o 'first-limited' (el primero que se ignora en la ventana). */
    hit(id: string, now: number): 'ok' | 'limited' | 'first-limited' {
      sweep(now);
      const key = keyOf(id);
      let entry = windows.get(key);
      if (!entry) {
        if (windows.size >= maxTracked) dropOldest(windows);
        entry = { start: now, count: 0, warned: false };
        windows.set(key, entry);
      }
      entry.count += 1;
      if (entry.count <= max) return 'ok';
      if (entry.warned) return 'limited';
      entry.warned = true;
      return 'first-limited';
    },
    sweep,
    /** Solo lectura: ¿hay una ventana vigente o pendiente de limpiar para este número? */
    has(id: string): boolean {
      return windows.has(keyOf(id));
    },
    get size(): number {
      return windows.size;
    },
  };
}
