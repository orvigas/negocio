import type { Context, Middleware } from 'koa';

import type { WhatsAppBotConfig } from '../config/env.ts';
import { safeEqualStrings } from '../services/admin-auth.ts';
import { MAX_WEBHOOK_BYTES, SIGNATURE_HEADER, checkSignature, parseDelivery, type ParsedDelivery } from '../services/whatsapp-bot/webhook.ts';
import { readRawBody } from '../utils/form-body.ts';
import type { Logger } from '../utils/logger.ts';

/**
 * Webhook del bot de WhatsApp (REQ-F-009, RF-1): GET y POST /webhooks/whatsapp.
 *
 * Es el único endpoint público sin sesión: la autenticidad la da la firma. Orden en el POST:
 * bot deshabilitado (503) -> cuerpo crudo con límite (413) -> firma (401 sin firma o mal formada,
 * 403 si no coincide) -> JSON (400) -> 200 inmediato. El procesamiento sigue en segundo plano
 * (`receive` no espera): un fallo del bot o de Meta nunca cambia la respuesta (RF-8).
 */

export const WEBHOOK_PATH = '/webhooks/whatsapp';

/** Lo que el webhook necesita del bot. */
export interface WebhookReceiver {
  receive(delivery: ParsedDelivery): void;
}

const CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

const queryString = (ctx: Context, name: string): string | undefined => {
  const value = ctx.query[name];
  return typeof value === 'string' ? value : undefined;
};

function respondDisabled(ctx: Context): void {
  ctx.status = 503;
  ctx.type = 'json';
  ctx.body = { error: { code: 'BOT_DISABLED', message: 'El bot de WhatsApp no está configurado.' } };
}

export function createWhatsAppWebhook({
  botConfig,
  bot,
  logger,
}: {
  botConfig: WhatsAppBotConfig;
  bot: WebhookReceiver | undefined;
  logger: Logger;
}): { verify: Middleware; receive: Middleware } {
  /** Verificación de la suscripción (RF-1.1, CA-1). */
  const verify: Middleware = async (ctx) => {
    if (botConfig === null || bot === undefined) return respondDisabled(ctx);
    const challenge = queryString(ctx, 'hub.challenge');
    const tokenMatches = safeEqualStrings(queryString(ctx, 'hub.verify_token') ?? '', botConfig.verifyToken);
    if (queryString(ctx, 'hub.mode') !== 'subscribe' || !tokenMatches || challenge === undefined || !CHALLENGE_PATTERN.test(challenge)) {
      logger.warn('bot_webhook_verify_failed', {});
      ctx.throw(403, 'Verificación rechazada.', { code: 'FORBIDDEN' });
    }
    ctx.type = 'text/plain';
    ctx.body = challenge;
    return undefined;
  };

  /** Recepción de mensajes y estados (RF-1.2 a RF-1.5, CA-2, CA-3). */
  const receive: Middleware = async (ctx) => {
    if (botConfig === null || bot === undefined) return respondDisabled(ctx);
    const raw = await readRawBody(ctx, MAX_WEBHOOK_BYTES, 'El cuerpo es demasiado grande.');
    const signature = checkSignature(raw, ctx.get(SIGNATURE_HEADER) || undefined, botConfig.appSecret);
    if (signature !== 'valid') {
      logger.warn('bot_webhook_signature_invalid', { reason: signature });
      if (signature === 'mismatch') ctx.throw(403, 'Firma inválida.', { code: 'INVALID_SIGNATURE' });
      ctx.throw(401, 'Falta la firma o no tiene el formato esperado.', { code: 'INVALID_SIGNATURE' });
    }

    let payload: unknown;
    try {
      payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw)) as unknown;
    } catch {
      ctx.throw(400, 'El cuerpo no es JSON válido.', { code: 'INVALID_JSON' });
    }
    const delivery = parseDelivery(payload, botConfig.phoneNumberId);
    if (delivery.ignored > 0) logger.info('bot_webhook_ignored', { count: delivery.ignored });
    bot.receive(delivery);

    ctx.status = 200;
    ctx.type = 'text/plain';
    ctx.body = 'OK';
    return undefined;
  };

  return { verify, receive };
}
