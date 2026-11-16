import type { Context } from 'koa';

import { botBlockResponseSchema, botControlResponseSchema, botStateResponseSchema, type BotState } from '@restaurante/contracts';
import {
  isManualDuration,
  maskedFromLast4,
  parsePhoneInput,
  validateReason,
  type BlockRecord,
  type BotControl,
  type BotControlSnapshot,
  type BotProvider,
  type ControlActor,
  type ControlState,
} from '@restaurante/core/bot-control';
import { toZonedIsoString, type Logger } from '@restaurante/core/shared';

import { ApiHttpError } from '../errors.ts';
import type { AdminAccess, AdminAuth } from './access.ts';
import { createResponder, validationFailed } from './responses.ts';

/**
 * Control del bot en `/api/v1/admin` (REQ-F-043), solo para administradores. Orden: sesión (401) ->
 * rol (403, antes de mirar el cuerpo o el id) -> en escrituras, CSRF (403) -> cuerpo (413, 415, 400,
 * 422) -> dominio.
 *
 * Usa la misma instancia de `BotControl` que el bot: la pausa, las altas y las bajas le llegan sin
 * esperar el refresco, y la lista "alcanzaron un tope hoy" es la de su memoria. La auditoría la escribe
 * el store en la misma transacción que cada acción.
 *
 * El teléfono solo se lee del cuerpo: nunca se registra ni se devuelve. Las respuestas se arman campo
 * a campo, sin el seudónimo ni el id de la clave. Con la base caída, `DatabaseUnavailableError` llega
 * al manejador central (503).
 */

type RouteContext = Context & { params: Record<string, string> };
type Handler = (ctx: RouteContext) => Promise<void>;

export interface BotRoutes {
  state: Handler;
  setPaused: Handler;
  block: Handler;
  unblock: Handler;
  blockReached: Handler;
}

const BODY_LIMIT = 4 * 1024;
const ID_PATTERN = /^[1-9]\d{0,9}$/;
const TOKEN_PATTERN = /^[0-9a-f]{32}$/;
const SWITCH_FIELDS = Object.freeze(['paused', 'reason']);
const BLOCK_FIELDS = Object.freeze(['phone', 'duration', 'reason']);
const REACHED_FIELDS = Object.freeze(['duration', 'reason']);
const NO_FIELDS: readonly string[] = Object.freeze([]);

const FORBIDDEN = 'No tienes permiso para gestionar el bot.';
const MESSAGES = Object.freeze({
  noKey: 'Para bloquear números, el bot debe estar configurado con su clave (WHATSAPP_BOT_BLOCKLIST_KEY). No se guardó nada.',
  alreadyBlocked: 'Ese número ya está en la lista: quítalo antes para cambiar la duración.',
  invalidPhone: 'Escribe un número válido: con código de país (de 8 a 15 dígitos) o 10 dígitos de México.',
  staff: 'Ese número es del personal y no se puede bloquear.',
  duration: 'Elige una duración de la lista.',
  paused: 'Indica si el bot se pausa o se reanuda.',
  blockNotFound: 'Ese bloqueo ya no está en la lista.',
  reachedNotFound: 'Esa entrada ya no está en la lista.',
});

const noKey = () => new ApiHttpError(409, 'BOT_KEY_MISSING', MESSAGES.noKey);
const alreadyBlocked = () => new ApiHttpError(409, 'BOT_NUMBER_ALREADY_BLOCKED', MESSAGES.alreadyBlocked);
const blockNotFound = () => new ApiHttpError(404, 'BOT_BLOCK_NOT_FOUND', MESSAGES.blockNotFound);
const reachedNotFound = () => new ApiHttpError(404, 'BOT_REACHED_NOT_FOUND', MESSAGES.reachedNotFound);

/** Motivo opcional del cuerpo, con la regla de core. */
function reasonOf(raw: unknown): { value: string | null } | { error: string } {
  if (raw !== undefined && typeof raw !== 'string') return { error: 'El motivo debe ser un texto.' };
  return validateReason(raw);
}

export function createBotRoutes({
  access,
  botControl,
  botProvider,
  timeZone,
  logger,
}: {
  access: AdminAccess;
  botControl: BotControl;
  botProvider: BotProvider | null;
  timeZone: string;
  logger: Logger;
}): BotRoutes {
  const { send, closedBody } = createResponder(logger);
  const iso = (date: Date) => toZonedIsoString(date, timeZone);
  const adminOnly = (ctx: RouteContext, write: boolean) => access.adminOnly(ctx, { write, forbiddenMessage: FORBIDDEN });
  const actorOf = ({ user }: AdminAuth): ControlActor & { kind: 'user' } => ({ kind: 'user', id: user.id, name: user.displayName });

  const controlDto = (control: ControlState): BotState['control'] => ({
    paused: control.paused,
    changedAt: control.changedAt ? iso(control.changedAt) : null,
    changedByName: control.changedByName,
    reason: control.reason,
  });

  const blockDto = (block: BlockRecord): BotState['blocks'][number] => ({
    id: block.id > 0 ? block.id : null,
    pending: block.id <= 0,
    masked: maskedFromLast4(block.last4),
    origin: block.origin,
    reason: block.reason,
    author: block.createdByName,
    since: iso(block.createdAt),
    until: block.expiresAt ? iso(block.expiresAt) : null,
  });

  const stateDto = (snapshot: BotControlSnapshot): BotState => ({
    status: { enabled: botProvider !== null, provider: botProvider },
    control: controlDto(snapshot.control),
    usage: { day: snapshot.usage.day.period, month: snapshot.usage.month.period, timeZone, counters: snapshot.usage.statuses.map(({ id, used, limit, reached }) => ({ id, used, limit, reached })) },
    reached: snapshot.reached.map(({ token, masked, cap, at }) => ({ token, masked, cap, at: iso(at) })),
    blocks: snapshot.blocks.map(blockDto),
    canBlock: snapshot.canBlock,
    previousKeyBlocks: snapshot.previousKeyBlocks,
    storeHealthy: snapshot.storeHealthy,
  });

  return Object.freeze<BotRoutes>({
    async state(ctx) {
      await adminOnly(ctx, false);
      send(ctx, botStateResponseSchema, { bot: stateDto(await botControl.snapshot()) });
    },

    /** Interruptor de emergencia (RF-3): con varios administradores, gana el último y ambos se auditan. */
    async setPaused(ctx) {
      const auth = await adminOnly(ctx, true);
      const body = await closedBody(ctx, SWITCH_FIELDS, BODY_LIMIT);
      if (!body) return;
      const reason = reasonOf(body.reason);
      const fields: Record<string, string> = {};
      if (typeof body.paused !== 'boolean') fields.paused = MESSAGES.paused;
      if ('error' in reason) fields.reason = reason.error;
      if (typeof body.paused !== 'boolean' || 'error' in reason) return validationFailed(ctx, fields);
      const control = await botControl.setPaused(body.paused, actorOf(auth), reason.value);
      send(ctx, botControlResponseSchema, { control: controlDto(control) });
    },

    /** Alta manual (RF-7). Sin clave, 409 antes de validar el resto, como en el `/admin` actual. */
    async block(ctx) {
      const auth = await adminOnly(ctx, true);
      const body = await closedBody(ctx, BLOCK_FIELDS, BODY_LIMIT);
      if (!body) return;
      if (!botControl.canBlock) throw noKey();
      const phone = typeof body.phone === 'string' ? body.phone : '';
      const canonical = parsePhoneInput(phone);
      const { duration } = body;
      const reason = reasonOf(body.reason);
      const fields: Record<string, string> = {};
      if (canonical === null) fields.phone = MESSAGES.invalidPhone;
      if (!isManualDuration(duration)) fields.duration = MESSAGES.duration;
      if ('error' in reason) fields.reason = reason.error;
      if (canonical === null || !isManualDuration(duration) || 'error' in reason) return validationFailed(ctx, fields);
      const outcome = await botControl.blockManual(phone, duration, reason.value, actorOf(auth));
      if (outcome === 'blocked') return send(ctx, botBlockResponseSchema, { block: { masked: maskedFromLast4(canonical.slice(-4)) } }, 201);
      if (outcome === 'already_blocked') throw alreadyBlocked();
      if (outcome === 'staff') return validationFailed(ctx, { phone: MESSAGES.staff });
      if (outcome === 'invalid_phone') return validationFailed(ctx, { phone: MESSAGES.invalidPhone });
      throw noKey();
    },

    /** Baja (RF-6), también de un bloqueo automático. */
    async unblock(ctx) {
      const auth = await adminOnly(ctx, true);
      if (!(await closedBody(ctx, NO_FIELDS, BODY_LIMIT))) return;
      const { id } = ctx.params;
      if (typeof id !== 'string' || !ID_PATTERN.test(id)) throw blockNotFound();
      const last4 = await botControl.unblock(Number(id), actorOf(auth));
      if (last4 === null) throw blockNotFound();
      send(ctx, botBlockResponseSchema, { block: { masked: maskedFromLast4(last4) } });
    },

    /** Bloqueo desde "alcanzaron un tope hoy" (RF-5): token de un solo uso del día del negocio. */
    async blockReached(ctx) {
      const auth = await adminOnly(ctx, true);
      const body = await closedBody(ctx, REACHED_FIELDS, BODY_LIMIT);
      if (!body) return;
      const { token } = ctx.params;
      if (typeof token !== 'string' || !TOKEN_PATTERN.test(token)) throw reachedNotFound();
      const { duration } = body;
      const reason = reasonOf(body.reason);
      const fields: Record<string, string> = {};
      if (!isManualDuration(duration)) fields.duration = MESSAGES.duration;
      if ('error' in reason) fields.reason = reason.error;
      if (!isManualDuration(duration) || 'error' in reason) return validationFailed(ctx, fields);
      const last4 = botControl.reachedLast4(token);
      if (last4 === null) throw reachedNotFound();
      const outcome = await botControl.blockReached(token, duration, reason.value, actorOf(auth));
      if (outcome === 'blocked') return send(ctx, botBlockResponseSchema, { block: { masked: maskedFromLast4(last4) } }, 201);
      if (outcome === 'already_blocked') throw alreadyBlocked();
      throw reachedNotFound();
    },
  });
}
