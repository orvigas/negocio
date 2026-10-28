import type { Context, Middleware } from 'koa';

import type { Logger } from '@restaurante/core/shared';
import { readRawBody } from '@restaurante/web';

import { BOT_WEBHOOK_PATH } from '../config/env.ts';
import type { ChatBot, InboundDelivery, WebhookQuery } from '../services/whatsapp-bot/chat-bot.ts';

/**
 * Webhook del bot de WhatsApp (REQ-F-009 RF-1; REQ-F-012 RF-3): GET y POST /webhooks/whatsapp,
 * la misma ruta con cualquier proveedor (D-10).
 *
 * Es el único endpoint público sin sesión: la autenticidad la da la firma, que comprueba el
 * `ChatBot` del proveedor activo (este controlador no conoce ninguna implementación concreta).
 * Orden en el POST: bot deshabilitado (503) -> cuerpo crudo con límite (413) -> firma (401 sin
 * firma o mal formada, 403 si no coincide) -> formato (400) -> 200 inmediato. El procesamiento
 * sigue en segundo plano (`receive` no espera): un fallo del bot o del proveedor nunca cambia la
 * respuesta (RF-8). En el GET, un proveedor sin verificación (Twilio) responde 405 (DT-5).
 */

export const WEBHOOK_PATH = BOT_WEBHOOK_PATH;

/** Lo que el webhook necesita del bot: su proveedor y la recepción de entregas. */
export interface WebhookBot {
  readonly chatBot: ChatBot;
  receive(delivery: InboundDelivery): void;
}

function respondDisabled(ctx: Context): void {
  ctx.status = 503;
  ctx.type = 'json';
  ctx.body = { error: { code: 'BOT_DISABLED', message: 'El bot de WhatsApp no está configurado.' } };
}

function queryOf(ctx: Context): WebhookQuery {
  return Object.fromEntries(Object.entries(ctx.query).map(([name, value]) => [name, typeof value === 'string' ? value : undefined]));
}

export function createWhatsAppWebhook({ bot, logger }: { bot: WebhookBot | undefined; logger: Logger }): { verify: Middleware; receive: Middleware } {
  /** Verificación de la suscripción (Meta: RF-1.1, CA-1). */
  const verify: Middleware = async (ctx) => {
    if (bot === undefined) return respondDisabled(ctx);
    const outcome = bot.chatBot.verifySubscription(queryOf(ctx));
    if (outcome.kind === 'unsupported') {
      ctx.status = 405;
      ctx.set('Allow', 'POST');
      ctx.type = 'json';
      ctx.body = { error: { code: 'METHOD_NOT_ALLOWED', message: 'Método no permitido.' } };
      return undefined;
    }
    if (outcome.kind === 'rejected') {
      logger.warn('bot_webhook_verify_failed', {});
      return ctx.throw(403, 'Verificación rechazada.', { code: 'FORBIDDEN' });
    }
    ctx.type = 'text/plain';
    ctx.body = outcome.challenge;
    return undefined;
  };

  /** Recepción de mensajes y estados (RF-1.2 a RF-1.5, CA-2, CA-3; REQ-F-012 RF-3). */
  const receive: Middleware = async (ctx) => {
    if (bot === undefined) return respondDisabled(ctx);
    const raw = await readRawBody(ctx, bot.chatBot.maxWebhookBytes, 'El cuerpo es demasiado grande.');
    const outcome = bot.chatBot.handleDelivery(raw, (name) => ctx.get(name) || undefined);
    if (outcome.kind === 'signature_invalid') {
      logger.warn('bot_webhook_signature_invalid', { reason: outcome.reason });
      if (outcome.reason === 'mismatch') return ctx.throw(403, 'Firma inválida.', { code: 'INVALID_SIGNATURE' });
      return ctx.throw(401, 'Falta la firma o no tiene el formato esperado.', { code: 'INVALID_SIGNATURE' });
    }
    if (outcome.kind === 'bad_request') return ctx.throw(400, outcome.message, { code: outcome.code });

    const { delivery, response } = outcome;
    if (delivery.ignored > 0) logger.info('bot_webhook_ignored', { count: delivery.ignored });
    bot.receive(delivery);

    ctx.status = 200;
    ctx.type = response.type;
    ctx.body = response.body;
    return undefined;
  };

  return { verify, receive };
}
