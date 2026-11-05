import { BOT_DEFAULT_DURATION, BOT_MANUAL_DURATIONS, type AdminApiClient, type AdminApiResult, type BotReachedBlockRequest } from '@restaurante/contracts';
import type { Logger, SafeHtml } from '@restaurante/web';

import type { InventoryConfig } from '../config.ts';
import { clearSessionId } from '../session.ts';
import { BOT_PATH, type BotFormValues, type BotPageView } from '../views/bot.ts';
import type { Views } from '../views/index.ts';
import { createControllerKit, type Ctx, type Session } from './common.ts';

/**
 * Control del bot en el admin nuevo (REQ-F-043), solo para administradores. Cada acción la decide la
 * API (`/api/v1/admin/bot*`): aquí no hay reglas de teléfono, motivo ni duración.
 *
 * - GET: sesión (si no vale, 303 al acceso) -> rol administrador (403 sin datos y sin pedir el estado)
 *   -> estado. Si la API falla, 503 con el aviso común.
 * - POST: mismo origen (403) -> lista cerrada de campos (400) -> sesión -> rol -> la API. Después, 303
 *   (PRG) con `ok`, de una lista cerrada, y en altas y bajas solo los 4 últimos dígitos.
 * - Escritura sin confirmar (503, 5xx, `timeout`, `network`, `invalid_response` o un 404 ajeno al bot,
 *   como el de una API anterior; H-10): 503 que no afirma que no se guardó e invita a revisar (RF-12).
 *
 * El teléfono solo se lee del cuerpo para enviarlo a la API: nunca se registra, ni llega a una vista o
 * a una URL (RF-9 y D-4). El motivo se conserva salvo si parece contener un número.
 */

type Handler = (ctx: Ctx) => Promise<void>;

export interface BotController {
  page: Handler;
  toggle: Handler;
  block: Handler;
  unblock: Handler;
  blockReached: Handler;
}

const BODY_LIMIT = 4 * 1024;
const SWITCH_FIELDS = Object.freeze(['_csrf', 'accion', 'motivo']);
const BLOCK_FIELDS = Object.freeze(['_csrf', 'telefono', 'duracion', 'motivo']);
const REACHED_FIELDS = Object.freeze(['_csrf', 'duracion', 'motivo']);
const UNBLOCK_FIELDS = Object.freeze(['_csrf']);

const FORBIDDEN = 'No tienes permiso para gestionar el bot.';
const LAST4_PATTERN = /^\d{4}$/;

/** Mensajes de éxito (`?ok=`, lista cerrada). */
const SUCCESS: Readonly<Record<string, string>> = Object.freeze({
  paused: 'Bot pausado: no se envía ningún mensaje y los mensajes que lleguen se descartan.',
  resumed: 'Bot reanudado: vuelve a atender.',
  blocked: 'Número bloqueado.',
  unblocked: 'Bloqueo quitado: el número vuelve a ser atendido.',
});

const UNCONFIRMED = 'No pudimos confirmar el cambio. Revisa el estado antes de repetirlo.';

const isHttpError = (result: AdminApiResult<unknown>, status: number, code: string): boolean =>
  !result.ok && result.kind === 'http' && result.status === status && result.error.code === code;

const apiMessage = (result: AdminApiResult<unknown>): string => (!result.ok && result.kind === 'http' ? result.error.message : UNCONFIRMED);

/** Lista cerrada: una duración desconocida no se vuelve a pintar. */
const keptDuration = (value: string | undefined): string => (value !== undefined && (BOT_MANUAL_DURATIONS as readonly string[]).includes(value) ? value : BOT_DEFAULT_DURATION);

/** Un motivo con un posible teléfono no se vuelve a pintar, ni con la API caída (RF-9). */
const keptReason = (value: string | undefined): string => (value === undefined || /\d{8,}/.test(value.replace(/[\s().+-]/g, '')) ? '' : value);

const keptValues = (fields: Map<string, string>): BotFormValues => ({ duration: keptDuration(fields.get('duracion')), reason: keptReason(fields.get('motivo')) });

/** Duración y motivo tal como se escribieron: la que los valida es la API. */
function reachedInput(fields: Map<string, string>): BotReachedBlockRequest {
  const reason = fields.get('motivo');
  return { duration: fields.get('duracion') ?? '', ...(reason ? { reason } : {}) };
}

/** Solo los 4 últimos dígitos del enmascarado viajan en la URL, nunca el número. */
function okUrl(ok: 'blocked' | 'unblocked', masked: string): string {
  const last4 = masked.slice(-4);
  return `${BOT_PATH}?ok=${ok}${LAST4_PATTERN.test(last4) ? `&n=${last4}` : ''}`;
}

export function createBotController({ config, api, views, logger }: { config: InventoryConfig; api: AdminApiClient; views: Views; logger: Logger }): BotController {
  const kit = createControllerKit({ config, api, views, logger });
  const { send, seeOther, toLogin, unavailable, failureReason, readClosedForm, fieldErrors, notFound, idOf, credentials } = kit;

  const adminSession = (ctx: Ctx, onUnavailable?: () => boolean) => kit.adminSession(ctx, BOT_PATH, FORBIDDEN, onUnavailable);

  const unconfirmedPage = (ctx: Ctx, auth: Session) =>
    send(ctx, 503, views.message({ title: 'Bot', notice: { tone: 'error', title: UNCONFIRMED }, context: auth, section: 'bot', backHref: BOT_PATH, backLabel: 'Revisar el estado del bot' }));

  /**
   * Respuestas de la API que no son de dominio: 401 -> acceso, 403 y el resto -> `onDown`. Sin él, el
   * 503 común. Un 404 llega aquí si su `code` no es del bot: la API anterior no tiene estas rutas (H-10).
   */
  function apiFailure(ctx: Ctx, result: AdminApiResult<unknown>, auth: Session, onDown?: () => void): void {
    if (!result.ok && result.kind === 'http') {
      if (result.status === 401) {
        clearSessionId(ctx, config.isProduction);
        return toLogin(ctx, BOT_PATH);
      }
      if (result.status === 403 && result.error.code === 'FORBIDDEN_ROLE') return kit.forbidden(ctx, auth, FORBIDDEN);
      if (result.status === 403) {
        return send(ctx, 403, views.message({ title: 'Petición no válida', notice: { tone: 'error', title: result.error.message }, context: auth, section: 'bot', backHref: BOT_PATH, backLabel: 'Volver al bot' }));
      }
    }
    if (!onDown) return unavailable(ctx, failureReason(result), auth);
    logger.warn('api_unavailable', { path: ctx.path, reason: failureReason(result) });
    return onDown();
  }

  async function renderPage(ctx: Ctx, auth: Session, status: number, view: BotPageView = {}, onDown?: () => void): Promise<void> {
    const result = await api.getBot(credentials(auth));
    if (result.ok) return send(ctx, status, views.bot(auth, result.data.bot, view));
    return apiFailure(ctx, result, auth, onDown);
  }

  const urgent = (message: string): SafeHtml => views.notice({ tone: 'warning', urgent: true, title: message });

  return Object.freeze<BotController>({
    async page(ctx) {
      const auth = await adminSession(ctx);
      if (!auth) return;
      const { ok, n } = ctx.query;
      const message = typeof ok === 'string' && Object.hasOwn(SUCCESS, ok) ? (SUCCESS[ok] as string) : null;
      const masked = typeof n === 'string' && LAST4_PATTERN.test(n) ? ` (*********${n})` : '';
      await renderPage(ctx, auth, 200, { notices: message ? [views.notice({ tone: 'success', title: `${message}${masked}` })] : [] });
    },

    /** Interruptor de emergencia (RF-3). */
    async toggle(ctx) {
      const fields = await readClosedForm(ctx, SWITCH_FIELDS, BODY_LIMIT);
      const auth = await adminSession(ctx);
      if (!auth) return;
      const action = fields.get('accion');
      if (action !== 'pausar' && action !== 'reanudar') return ctx.throw(400, 'Acción desconocida.', { code: 'INVALID_FORM' });
      const reason = fields.get('motivo');
      const result = await api.setBotPaused(credentials(auth, fields), { paused: action === 'pausar', ...(reason ? { reason } : {}) });
      if (result.ok) return seeOther(ctx, `${BOT_PATH}?ok=${action === 'pausar' ? 'paused' : 'resumed'}`);
      const errors = fieldErrors(result);
      if (errors) return renderPage(ctx, auth, 422, { switchForm: { reason: keptReason(reason), errors } });
      return apiFailure(ctx, result, auth, () => unconfirmedPage(ctx, auth));
    },

    /** Alta manual (RF-7). El teléfono vuelve vacío en cada salida (D-4). */
    async block(ctx) {
      const fields = await readClosedForm(ctx, BLOCK_FIELDS, BODY_LIMIT);
      const values = keptValues(fields);
      const looseForm = (auth: Session | null) =>
        send(ctx, 503, views.botBlockForm({ context: auth, csrfToken: auth?.csrfToken ?? fields.get('_csrf') ?? '', values, notices: [views.notice({ tone: 'error', title: UNCONFIRMED })] }));
      const auth = await adminSession(ctx, () => {
        looseForm(null);
        return true;
      });
      if (!auth) return;
      const onDown = () => looseForm(auth);
      const result = await api.blockNumber(credentials(auth, fields), { phone: fields.get('telefono') ?? '', ...reachedInput(fields) });
      if (result.ok) return seeOther(ctx, okUrl('blocked', result.data.block.masked));
      const errors = fieldErrors(result);
      if (errors) return renderPage(ctx, auth, 422, { form: { ...values, errors } }, onDown);
      if (isHttpError(result, 409, 'BOT_NUMBER_ALREADY_BLOCKED')) return renderPage(ctx, auth, 409, { form: { ...values, errors: { phone: apiMessage(result) } } }, onDown);
      if (isHttpError(result, 409, 'BOT_KEY_MISSING')) return renderPage(ctx, auth, 409, { notices: [urgent(apiMessage(result))] }, onDown);
      return apiFailure(ctx, result, auth, onDown);
    },

    /** Baja (RF-6), también de un bloqueo automático. */
    async unblock(ctx) {
      const fields = await readClosedForm(ctx, UNBLOCK_FIELDS, BODY_LIMIT);
      const auth = await adminSession(ctx);
      if (!auth) return;
      const id = idOf(ctx);
      if (id === null) return notFound(ctx, { context: auth, section: 'bot', backHref: BOT_PATH, backLabel: 'Volver al bot' });
      const result = await api.unblockNumber(credentials(auth, fields), id);
      if (result.ok) return seeOther(ctx, okUrl('unblocked', result.data.block.masked));
      if (isHttpError(result, 404, 'BOT_BLOCK_NOT_FOUND')) return renderPage(ctx, auth, 404, { notices: [urgent(apiMessage(result))] });
      return apiFailure(ctx, result, auth, () => unconfirmedPage(ctx, auth));
    },

    /** Bloqueo desde "alcanzaron un tope hoy" (RF-5). */
    async blockReached(ctx) {
      const fields = await readClosedForm(ctx, REACHED_FIELDS, BODY_LIMIT);
      const auth = await adminSession(ctx);
      if (!auth) return;
      const { token = '' } = ctx.params;
      const result = await api.blockReached(credentials(auth, fields), token, reachedInput(fields));
      if (result.ok) return seeOther(ctx, okUrl('blocked', result.data.block.masked));
      const errors = fieldErrors(result);
      if (errors) return renderPage(ctx, auth, 422, { reachedForm: { ...keptValues(fields), token, errors } });
      if (isHttpError(result, 404, 'BOT_REACHED_NOT_FOUND')) return renderPage(ctx, auth, 404, { notices: [urgent(apiMessage(result))] });
      if (!result.ok && result.kind === 'http' && result.status === 409) return renderPage(ctx, auth, 409, { notices: [urgent(result.error.message)] });
      return apiFailure(ctx, result, auth, () => unconfirmedPage(ctx, auth));
    },
  });
}
