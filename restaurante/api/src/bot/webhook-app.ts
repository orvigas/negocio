import Router from '@koa/router';
import Koa from 'koa';

import type { BotControl, BotLimits } from '@restaurante/core/bot-control';
import type { ProductRepository } from '@restaurante/core/catalog';
import { silentLogger, type Logger } from '@restaurante/core/shared';

import { createRequestLogger } from '../app.ts';
import { createErrorHandler } from '../errors.ts';
import type { ChatBotConfig } from './config.ts';
import { createBotOrchestrator, type BotOrchestrator } from './orchestrator.ts';
import { createBotProtection } from './protection/protection.ts';
import type { FetchLike } from './providers/http-send.ts';
import { createChatBot } from './providers/select.ts';
import { WEBHOOK_PATH, createWhatsAppWebhook, type WebhookBot } from './whatsapp-webhook.ts';

/**
 * App del webhook del bot de WhatsApp (REQ-F-042, P-1): se sirve en su propio puerto (WEBHOOK_PORT),
 * que es el único de la api que publica Traefik. Solo tiene una ruta:
 *
 *   GET  /webhooks/whatsapp -> verificación de la suscripción (Meta)
 *   POST /webhooks/whatsapp -> entregas firmadas (firma -> 200 inmediato -> segundo plano)
 *
 * Cualquier otra ruta responde 404 y otro método 405: aunque una regla de Traefik fuera demasiado
 * amplia, /api/v1/admin y /api/v1/public no son alcanzables por este puerto (CA-3). Sin bot
 * configurado, el webhook responde 503 BOT_DISABLED (RF-5).
 */

export interface BotWebhookAppOptions {
  bot: WebhookBot | undefined;
  logger?: Logger;
}

export function createBotWebhookApp({ bot, logger = silentLogger }: BotWebhookAppOptions): Koa {
  const app = new Koa();
  // Los errores se registran en el manejador central, sin el mensaje.
  app.silent = true;
  // Detrás de Traefik: la IP del visitante es el último valor de X-Forwarded-For (RF-3).
  app.proxy = true;
  app.maxIpsCount = 1;

  // D-13 (REQ-F-012): solo el proveedor, ningún otro valor.
  if (bot) logger.info('bot_provider_selected', { provider: bot.chatBot.provider });
  const webhook = createWhatsAppWebhook({ bot, logger });
  const router = new Router();
  router.get(WEBHOOK_PATH, webhook.verify);
  router.post(WEBHOOK_PATH, webhook.receive);

  // El log de peticiones solo lleva la ruta: la query de la verificación trae el token. La IP y el
  // protocolo, como los registraba landing-pages: con proxy, salen de X-Forwarded-For y -Proto (RF-3).
  app.use(createRequestLogger(logger, (ctx) => ({ ip: ctx.ip, protocol: ctx.protocol })));
  app.use(createErrorHandler(logger));
  app.use(async (ctx, next) => {
    ctx.set('Cache-Control', 'no-store');
    ctx.set('X-Content-Type-Options', 'nosniff');
    await next();
  });
  app.use(router.routes());
  app.use(router.allowedMethods());
  return app;
}

export interface CreateBotOptions {
  config: ChatBotConfig;
  limits: BotLimits;
  timeZone: string;
  products: Pick<ProductRepository, 'getPublished'>;
  botControl: BotControl;
  logger?: Logger;
  now?: () => Date;
  fetch?: FetchLike;
}

/**
 * Bot desde la configuración (REQ-F-009; proveedor elegido en providers/select.ts, REQ-F-012):
 * undefined sin configuración. Siempre lleva la protección (REQ-F-025, D-T10).
 */
export function createBotFromConfig({
  config,
  limits,
  timeZone,
  products,
  botControl,
  logger = silentLogger,
  now = () => new Date(),
  fetch: providerFetch = (url, init) => fetch(url, init),
}: CreateBotOptions): BotOrchestrator | undefined {
  if (!config) return undefined;
  return createBotOrchestrator({
    chatBot: createChatBot(config, { fetch: providerFetch, logger }),
    staff: config.staff,
    timeZone,
    products,
    logger,
    now,
    protection: createBotProtection({ control: botControl, limits, timeZone, logger }),
  });
}
