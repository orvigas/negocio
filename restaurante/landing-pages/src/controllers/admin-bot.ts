import { isAdmin } from '@restaurante/core/identity';
import { DEFAULT_MANUAL_DURATION, isManualDuration, maskedFromLast4, parsePhoneInput, validateReason, type BotControl } from '@restaurante/core/bot-control';

import { renderAdminUnavailable } from '../views/admin/index.ts';
import { BOT_PATH, BOT_SUCCESS_MESSAGES, renderBotPage, type BotFormErrors, type BotPageOptions } from '../views/admin/bot.ts';
import { createAdminAccess, type AdminRouterContext, type Authenticated, type Permission } from './admin-access.ts';
import type { AdminDeps } from './admin.ts';

type Handler = (ctx: AdminRouterContext) => unknown;

export interface AdminBotController {
  page: Handler;
  toggle: Handler;
  block: Handler;
  unblock: Handler;
  blockReached: Handler;
}

/**
 * Página "Bot" de /admin (REQ-F-025, RF-6, RF-3 y RF-9): solo administradores. Un editor recibe
 * 403 sin leer el body (orden de admin-access.ts). Formularios nativos con POST-redirect-GET; cada
 * acción queda en la auditoría (la escribe el store en la misma transacción). Sin la protección
 * del bot (p. ej. pruebas sin ella), responde 503.
 *
 * El teléfono escrito nunca se registra ni se vuelve a pintar (CA-15).
 */

const BODY_LIMIT = 4 * 1024;
const ID_PATTERN = /^[1-9]\d{0,9}$/;
const TOKEN_PATTERN = /^[0-9a-f]{32}$/;
const SWITCH_FIELDS = Object.freeze(['accion', 'motivo']);
const BLOCK_FIELDS = Object.freeze(['telefono', 'duracion', 'motivo']);
const REACHED_FIELDS = Object.freeze(['duracion', 'motivo']);
const NO_FIELDS: readonly string[] = Object.freeze([]);
const LAST4_PATTERN = /^\d{4}$/;

/** Redirección tras un alta o una baja: solo los 4 últimos dígitos viajan en la URL, nunca el número. */
const successPath = (ok: 'blocked' | 'unblocked', number: string | null): string =>
  `${BOT_PATH}?ok=${ok}${number === null ? '' : `&n=${number.slice(-4)}`}`;

const adminOnly: Permission = (user) => (isAdmin(user) ? null : 'No tienes permiso para gestionar el bot.');

const PROBLEMS = Object.freeze({
  noKey: 'Para bloquear números, el bot debe estar configurado con su clave (WHATSAPP_BOT_BLOCKLIST_KEY). No se guardó nada.',
  alreadyBlocked: 'Ese número ya está en la lista: quítalo antes para cambiar la duración. No se guardó nada.',
});

const PHONE_ERRORS = Object.freeze({
  invalid_phone: 'Escribe un número válido: con código de país (de 8 a 15 dígitos) o 10 dígitos de México.',
  staff: 'Ese número es del personal y no se puede bloquear.',
  already_blocked: 'Ese número ya está en la lista: quítalo antes para cambiar la duración.',
});

export function createAdminBotController(deps: AdminDeps): AdminBotController {
  const { config, renderer, now, sessions, users, logger, botControl, botProvider } = deps;
  const access = createAdminAccess({ config, sessions, users, renderer, now, logger });
  const { sendHtml, seeOther } = access;
  const actorOf = ({ user }: Authenticated) => ({ kind: 'user' as const, id: user.id, name: user.displayName });

  function unavailable(ctx: AdminRouterContext): void {
    sendHtml(ctx, 503, renderAdminUnavailable(renderer, { faviconBusinessId: access.faviconBusinessId() }));
  }

  async function renderPage(
    ctx: AdminRouterContext,
    control: BotControl,
    auth: Authenticated,
    status: number,
    extra: Partial<Pick<BotPageOptions, 'success' | 'problem' | 'form' | 'switchError'>> = {},
  ): Promise<void> {
    const snapshot = await control.snapshot();
    sendHtml(ctx, status, renderBotPage(renderer, { ...access.pageContext(auth), snapshot, timezone: config.timezone, provider: botProvider, ...extra }));
  }

  return Object.freeze<AdminBotController>({
    page(ctx) {
      return access.page(ctx, { returnTo: BOT_PATH, permission: adminOnly }, async (auth) => {
        if (!botControl) return unavailable(ctx);
        const { ok } = ctx.query;
        const { n } = ctx.query;
        const message = typeof ok === 'string' && Object.hasOwn(BOT_SUCCESS_MESSAGES, ok) ? BOT_SUCCESS_MESSAGES[ok as keyof typeof BOT_SUCCESS_MESSAGES] : undefined;
        // DEF-001 (QA): el aviso de alta o baja lleva el número enmascarado (solo los 4 últimos dígitos).
        const success = message && typeof n === 'string' && LAST4_PATTERN.test(n) ? `${message} (${maskedFromLast4(n)})` : message;
        return renderPage(ctx, botControl, auth, 200, success ? { success } : {});
      });
    },

    /** Interruptor de emergencia (RF-9.1). */
    async toggle(ctx) {
      const auth = await access.post(ctx, { returnTo: BOT_PATH, limit: BODY_LIMIT, permission: adminOnly, allowedFields: SWITCH_FIELDS });
      if (!auth) return undefined;
      if (!botControl) return unavailable(ctx);
      const action = auth.fields.get('accion');
      if (action !== 'pausar' && action !== 'reanudar') return ctx.throw(400, 'Acción desconocida.', { code: 'INVALID_FORM' });
      const reason = validateReason(auth.fields.get('motivo'));
      if ('error' in reason) return renderPage(ctx, botControl, auth, 422, { switchError: reason.error });
      await botControl.setPaused(action === 'pausar', actorOf(auth), reason.value);
      return seeOther(ctx, `${BOT_PATH}?ok=${action === 'pausar' ? 'paused' : 'resumed'}`);
    },

    /** Alta manual (RF-3.2, RF-3.3, RF-4; D-T4). */
    async block(ctx) {
      const auth = await access.post(ctx, { returnTo: BOT_PATH, limit: BODY_LIMIT, permission: adminOnly, allowedFields: BLOCK_FIELDS });
      if (!auth) return undefined;
      if (!botControl) return unavailable(ctx);
      const duration = auth.fields.get('duracion') ?? DEFAULT_MANUAL_DURATION;
      const rawReason = auth.fields.get('motivo') ?? '';
      const reason = validateReason(rawReason);
      const phone = auth.fields.get('telefono') ?? '';
      const errors: { telefono?: string; duracion?: string; motivo?: string } = {};
      if (parsePhoneInput(phone) === null) errors.telefono = PHONE_ERRORS.invalid_phone;
      if (!isManualDuration(duration)) errors.duracion = 'Elige una duración de la lista.';
      if ('error' in reason) errors.motivo = reason.error;
      const form = (fieldErrors: BotFormErrors) => ({ duration, reason: 'error' in reason ? '' : rawReason, errors: fieldErrors });
      if (!botControl.canBlock) return renderPage(ctx, botControl, auth, 409, { problem: PROBLEMS.noKey });
      if (Object.keys(errors).length > 0 || !isManualDuration(duration) || 'error' in reason) return renderPage(ctx, botControl, auth, 422, { form: form(errors) });
      const outcome = await botControl.blockManual(phone, duration, reason.value, actorOf(auth));
      if (outcome === 'blocked') return seeOther(ctx, successPath('blocked', parsePhoneInput(phone)));
      if (outcome === 'no_key') return renderPage(ctx, botControl, auth, 409, { problem: PROBLEMS.noKey });
      if (outcome === 'not_found') return ctx.throw(404);
      return renderPage(ctx, botControl, auth, outcome === 'already_blocked' ? 409 : 422, { form: form({ telefono: PHONE_ERRORS[outcome] }) });
    },

    /** Baja manual (RF-3.4), también de un bloqueo automático. */
    async unblock(ctx) {
      const auth = await access.post(ctx, { returnTo: BOT_PATH, limit: BODY_LIMIT, permission: adminOnly, allowedFields: NO_FIELDS });
      if (!auth) return undefined;
      if (!botControl) return unavailable(ctx);
      const raw = ctx.params.id;
      if (typeof raw !== 'string' || !ID_PATTERN.test(raw)) return ctx.throw(404);
      const last4 = await botControl.unblock(Number(raw), actorOf(auth));
      if (last4 === null) return ctx.throw(404);
      return seeOther(ctx, successPath('unblocked', last4));
    },

    /** Bloqueo desde "alcanzaron un tope hoy" (RF-6; D-T11). */
    async blockReached(ctx) {
      const auth = await access.post(ctx, { returnTo: BOT_PATH, limit: BODY_LIMIT, permission: adminOnly, allowedFields: REACHED_FIELDS });
      if (!auth) return undefined;
      if (!botControl) return unavailable(ctx);
      const token = ctx.params.token;
      if (typeof token !== 'string' || !TOKEN_PATTERN.test(token)) return ctx.throw(404);
      const duration = auth.fields.get('duracion') ?? DEFAULT_MANUAL_DURATION;
      if (!isManualDuration(duration)) return ctx.throw(400, 'Duración desconocida.', { code: 'INVALID_FORM' });
      const reason = validateReason(auth.fields.get('motivo'));
      if ('error' in reason) return renderPage(ctx, botControl, auth, 422, { problem: reason.error });
      const last4 = botControl.reachedLast4(token);
      const outcome = await botControl.blockReached(token, duration, reason.value, actorOf(auth));
      if (outcome === 'blocked') return seeOther(ctx, successPath('blocked', last4));
      if (outcome === 'already_blocked') return renderPage(ctx, botControl, auth, 409, { problem: PROBLEMS.alreadyBlocked });
      return ctx.throw(404);
    },
  });
}
