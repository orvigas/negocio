import type { Context } from 'koa';

import { BOT_MANUAL_DURATIONS, type AdminUser, type BotState } from '@restaurante/contracts';

/**
 * Doble de `/api/v1/admin/bot*` (REQ-F-043): mismas formas que el contrato, que el cliente valida con
 * Zod en cada respuesta, y reglas mínimas para las pruebas de pantalla. Las reglas reales están en core
 * y se prueban en `api/tests` y `landing-pages/tests`.
 *
 * `readFailure` y `writeFailure` simulan una API que falla: `legacy` es la `api` anterior, sin estas
 * rutas (404 `NOT_FOUND`, H-10).
 */

export type BotFailure = '503' | '500' | 'network' | 'invalid' | 'slow' | 'legacy' | 'forbidden' | 'expired';

export interface BotDouble {
  state: BotState;
  /** Número completo de cada bloqueo manual, para detectar el repetido. */
  phones: Map<number, string>;
  staff: string[];
  readFailure: BotFailure | null;
  writeFailure: BotFailure | null;
}

/** Más que el `apiTimeoutMs` que usan las pruebas de tiempo agotado. */
const SLOW_MS = 400;
const PHONE_PATTERN = /^\d{8,15}$/;
const TOKEN_PATTERN = /^[0-9a-f]{32}$/;

export const STAFF_PHONE = '5215500000001';
export const reachedToken = (seed: number): string => seed.toString(16).padStart(32, '0');
export const masked = (last4: string): string => `*********${last4}`;

export function createBotDouble(): BotDouble {
  return {
    state: {
      status: { enabled: true, provider: 'meta' },
      control: { paused: false, changedAt: null, changedByName: null, reason: null },
      usage: {
        day: '2026-11-05',
        month: '2026-11',
        timeZone: 'America/Mexico_City',
        counters: [
          { id: 'templates_day', used: 3, limit: 50, reached: false },
          { id: 'templates_month', used: 900, limit: 900, reached: true },
          { id: 'outbound_day', used: 120, limit: 500, reached: false },
          { id: 'outbound_month', used: 4000, limit: 9000, reached: false },
          { id: 'budget', used: 12_500_000, limit: 25_000_000, reached: false },
        ],
      },
      reached: [],
      blocks: [],
      canBlock: true,
      previousKeyBlocks: 0,
      storeHealthy: true,
    },
    phones: new Map(),
    staff: [STAFF_PHONE],
    readFailure: null,
    writeFailure: null,
  };
}

export function blockRow(id: number, last4: string, extra: Partial<BotState['blocks'][number]> = {}): BotState['blocks'][number] {
  return { id, pending: false, masked: masked(last4), origin: 'manual', reason: null, author: 'Ana Admin', since: '2026-11-05T10:00:00-06:00', until: '2026-11-12T10:00:00-06:00', ...extra };
}

const send = (ctx: Context, status: number, body: unknown): void => {
  ctx.status = status;
  ctx.body = body;
};

const fail = (ctx: Context, status: number, code: string, message: string, fields?: Record<string, string>): void =>
  send(ctx, status, { error: { code, message, ...(fields ? { fields } : {}) } });

const invalid = (ctx: Context, fields: Record<string, string>): void => fail(ctx, 422, 'VALIDATION_FAILED', 'Los datos no son válidos: no se guardó nada.', fields);

function reasonError(raw: unknown): string | null {
  if (raw === undefined) return null;
  if (typeof raw !== 'string') return 'El motivo debe ser un texto.';
  if ([...raw].length > 200) return 'El motivo puede tener hasta 200 caracteres.';
  return /\d{8,}/.test(raw.replace(/[\s().+-]/g, '')) ? 'No escribas números de teléfono en el motivo.' : null;
}

async function failWith(ctx: Context, failure: BotFailure): Promise<void> {
  if (failure === 'network') {
    ctx.respond = false;
    ctx.req.socket.destroy();
    return;
  }
  if (failure === 'slow') {
    await new Promise((resolve) => {
      setTimeout(resolve, SLOW_MS);
    });
    return send(ctx, 200, {});
  }
  if (failure === 'invalid') return send(ctx, 200, { nada: true });
  if (failure === 'legacy') return fail(ctx, 404, 'NOT_FOUND', 'Recurso no encontrado.');
  if (failure === 'forbidden') return fail(ctx, 403, 'FORBIDDEN_ROLE', 'No tienes permiso para gestionar el bot.');
  if (failure === 'expired') return fail(ctx, 401, 'UNAUTHENTICATED', 'Inicia sesión para continuar.');
  if (failure === '500') return fail(ctx, 500, 'INTERNAL_ERROR', 'SELECT secreto FROM bot_block');
  return fail(ctx, 503, 'DATABASE_UNAVAILABLE', 'Servicio no disponible temporalmente.');
}

export async function handleBot(ctx: Context, bot: BotDouble, actor: AdminUser, path: string, record: Record<string, unknown>): Promise<void> {
  const { state } = bot;
  const read = ctx.method === 'GET';
  const failure = read ? bot.readFailure : bot.writeFailure;
  if (failure) return failWith(ctx, failure);
  if (read && path === '') return send(ctx, 200, { bot: state });

  if (ctx.method === 'PUT' && path === '/interruptor') {
    const reason = reasonError(record.reason);
    if (reason) return invalid(ctx, { reason });
    state.control = { paused: record.paused === true, changedAt: '2026-11-05T12:00:00-06:00', changedByName: actor.name, reason: typeof record.reason === 'string' ? record.reason : null };
    return send(ctx, 200, { control: state.control });
  }

  if (ctx.method === 'POST' && path === '/bloqueos') {
    if (!state.canBlock) return fail(ctx, 409, 'BOT_KEY_MISSING', 'Para bloquear números, el bot debe estar configurado con su clave. No se guardó nada.');
    const phone = typeof record.phone === 'string' ? record.phone.replace(/\D/g, '') : '';
    const reason = reasonError(record.reason);
    const fields: Record<string, string> = {};
    if (!PHONE_PATTERN.test(phone)) fields.phone = 'Escribe un número válido.';
    else if (bot.staff.includes(phone)) fields.phone = 'Ese número es del personal y no se puede bloquear.';
    if (!(BOT_MANUAL_DURATIONS as readonly unknown[]).includes(record.duration)) fields.duration = 'Elige una duración de la lista.';
    if (reason) fields.reason = reason;
    if (Object.keys(fields).length > 0) return invalid(ctx, fields);
    if ([...bot.phones.values()].includes(phone)) return fail(ctx, 409, 'BOT_NUMBER_ALREADY_BLOCKED', 'Ese número ya está en la lista: quítalo antes para cambiar la duración.');
    const id = Math.max(100, ...state.blocks.map((block) => block.id ?? 0)) + 1;
    bot.phones.set(id, phone);
    state.blocks.push(blockRow(id, phone.slice(-4), { reason: typeof record.reason === 'string' ? record.reason : null, author: actor.name }));
    return send(ctx, 201, { block: { masked: masked(phone.slice(-4)) } });
  }

  const unblock = /^\/bloqueos\/(\d+)\/quitar$/.exec(path);
  if (ctx.method === 'POST' && unblock) {
    const target = state.blocks.find((block) => block.id === Number(unblock[1]));
    if (!target) return fail(ctx, 404, 'BOT_BLOCK_NOT_FOUND', 'Ese bloqueo ya no está en la lista.');
    state.blocks = state.blocks.filter((block) => block !== target);
    bot.phones.delete(Number(unblock[1]));
    return send(ctx, 200, { block: { masked: target.masked } });
  }

  const reached = /^\/topes\/([^/]+)\/bloquear$/.exec(path);
  if (ctx.method === 'POST' && reached) {
    const token = reached[1] as string;
    if (!TOKEN_PATTERN.test(token)) return fail(ctx, 404, 'BOT_REACHED_NOT_FOUND', 'Esa entrada ya no está en la lista.');
    const reason = reasonError(record.reason);
    const fields: Record<string, string> = {};
    if (!(BOT_MANUAL_DURATIONS as readonly unknown[]).includes(record.duration)) fields.duration = 'Elige una duración de la lista.';
    if (reason) fields.reason = reason;
    if (Object.keys(fields).length > 0) return invalid(ctx, fields);
    const entry = state.reached.find((candidate) => candidate.token === token);
    if (!entry) return fail(ctx, 404, 'BOT_REACHED_NOT_FOUND', 'Esa entrada ya no está en la lista.');
    state.reached = state.reached.filter((candidate) => candidate.masked !== entry.masked);
    if (state.blocks.some((block) => block.masked === entry.masked)) return fail(ctx, 409, 'BOT_NUMBER_ALREADY_BLOCKED', 'Ese número ya está en la lista: quítalo antes para cambiar la duración.');
    state.blocks.push(blockRow(Math.max(100, ...state.blocks.map((block) => block.id ?? 0)) + 1, entry.masked.slice(-4), { origin: 'manual', author: actor.name }));
    return send(ctx, 201, { block: { masked: entry.masked } });
  }

  return fail(ctx, 404, 'NOT_FOUND', 'Recurso no encontrado.');
}
