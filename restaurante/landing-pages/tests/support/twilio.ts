import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ProductRepository } from '@restaurante/core/catalog';

import type { Env, TwilioBotConfig } from '../../src/config/env.ts';
import { createBotOrchestrator } from '../../src/services/whatsapp-bot/orchestrator.ts';
import { createChatBot } from '../../src/services/whatsapp-bot/providers/select.ts';
import { parseTwilioDelivery } from '../../src/services/whatsapp-bot/providers/twilio/webhook.ts';
import { TWILIO_BOT_ENV, makeConfig, makeRecordingLogger } from '../helpers.ts';
import { makeProductRepository } from './products.ts';
import { createTwilioApiDouble } from './twilio-api-double.ts';
import { CUSTOMER, WEEK, mx } from './whatsapp.ts';

/**
 * Apoyo para las pruebas del bot con Twilio (REQ-F-012, RF-8): entregas del webhook (formulario)
 * construidas a partir de las fixtures y firmadas como Twilio (`X-Twilio-Signature`).
 */

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'twilio');

export type TwilioFixtureName = 'text' | 'image' | 'location' | 'status-delivered' | 'status-failed' | 'status-undelivered';

export const loadTwilioFixture = (name: TwilioFixtureName): Record<string, string> =>
  JSON.parse(readFileSync(join(FIXTURES_DIR, `${name}.json`), 'utf8')) as Record<string, string>;

export const TWILIO_WEBHOOK_URL = TWILIO_BOT_ENV.WHATSAPP_BOT_WEBHOOK_URL;
export const TWILIO_AUTH_TOKEN = TWILIO_BOT_ENV.WHATSAPP_BOT_ACCESS_TOKEN;
export const TWILIO_SENDER = TWILIO_BOT_ENV.WHATSAPP_MOLOTES;

let nextSid = 0;
export const newMessageSid = (): string => `SM${(nextSid += 1).toString(16).padStart(32, 'a')}`;

/**
 * Firma de referencia, escrita aparte de la implementación con el algoritmo documentado por
 * Twilio: URL + parámetros ordenados por nombre (`nombre` + `valor`), HMAC-SHA1 en Base64.
 */
export function signTwilio(params: Readonly<Record<string, string>>, { url = TWILIO_WEBHOOK_URL, token = TWILIO_AUTH_TOKEN }: { url?: string; token?: string } = {}): string {
  const data = Object.keys(params)
    .sort()
    .reduce((acc, name) => `${acc}${name}${params[name]}`, url);
  return createHmac('sha1', token).update(data, 'utf8').digest('base64');
}

/** Formulario de un mensaje del cliente con la forma de la fixture. */
export function twilioInbound(
  kind: 'text' | 'image' | 'location',
  { from = CUSTOMER, sid = newMessageSid(), text }: { from?: string; sid?: string; text?: string } = {},
): Record<string, string> {
  const params = loadTwilioFixture(kind);
  Object.assign(params, { MessageSid: sid, SmsMessageSid: sid, SmsSid: sid, From: `whatsapp:+${from}`, WaId: from });
  if (kind === 'text') params.Body = text ?? 'Hola';
  return params;
}

/** StatusCallback de un mensaje enviado. */
export function twilioStatus(kind: 'status-delivered' | 'status-failed' | 'status-undelivered', sid: string): Record<string, string> {
  return { ...loadTwilioFixture(kind), MessageSid: sid, SmsSid: sid };
}

export const formBody = (params: Readonly<Record<string, string>>): string => new URLSearchParams(params).toString();

export const twilioConfig = (env: Env = {}): TwilioBotConfig => {
  const { whatsappBot } = makeConfig({ ...TWILIO_BOT_ENV, ...env });
  if (whatsappBot?.provider !== 'twilio') throw new Error('TWILIO_BOT_ENV debe habilitar el bot con Twilio');
  return whatsappBot;
};

/**
 * Bot real con Twilio (TwilioBot), el doble de la API de Twilio, reloj controlado y productos en
 * memoria. Las entregas se pasan ya leídas por el parser de Twilio (sin HTTP).
 */
export async function makeTwilioBotHarness({ at = mx(`${WEEK.tue}T10:00`), products, env = {} }: { at?: Date; products?: Pick<ProductRepository, 'getPublished'>; env?: Env } = {}) {
  const clock = { now: at };
  const double = createTwilioApiDouble();
  const logger = makeRecordingLogger();
  const config = twilioConfig(env);
  const productRepository = products ?? (await makeProductRepository()).repository;
  let codes = 0;
  const bot = createBotOrchestrator({
    chatBot: createChatBot(config, { fetch: double.fetch, logger, retryDelayMs: 0 }),
    staff: config.staff,
    timeZone: 'America/Mexico_City',
    products: productRepository,
    logger,
    now: () => clock.now,
    newCode: (prefix) => `${prefix}-T${String((codes += 1)).padStart(3, '0')}`,
  });

  async function deliver(params: Readonly<Record<string, string>>): Promise<void> {
    bot.receive(parseTwilioDelivery(new URLSearchParams(params), { accountSid: config.accountId, sender: config.sender }));
    await bot.drain();
  }

  async function say(text: string, { from = CUSTOMER }: { from?: string } = {}): Promise<string[]> {
    clock.now = new Date(clock.now.getTime() + 3000);
    const before = double.textsTo(from).length;
    await deliver(twilioInbound('text', { from, text }));
    return double.textsTo(from).slice(before);
  }

  return { bot, double, logger, clock, config, deliver, say };
}
