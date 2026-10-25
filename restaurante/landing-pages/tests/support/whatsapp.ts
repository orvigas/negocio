import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { MetaBotConfig } from '../../src/config/env.ts';
import { createMemoryBotControlStore, type MemoryBotControlStore } from '../../src/repositories/memory-bot-control-store.ts';
import type { ProductRepository } from '../../src/repositories/product-repository.ts';
import { createBotControl, type BotControl } from '../../src/services/bot-control.ts';
import { DEFAULT_BOT_LIMITS, type BotLimits } from '../../src/services/whatsapp-bot/protection/limits.ts';
import { createBotProtection } from '../../src/services/whatsapp-bot/protection/protection.ts';
import { createBotOrchestrator } from '../../src/services/whatsapp-bot/orchestrator.ts';
import { parseDelivery } from '../../src/services/whatsapp-bot/providers/meta/webhook.ts';
import { createChatBot } from '../../src/services/whatsapp-bot/providers/select.ts';
import { BOT_ENV, makeConfig, makeRecordingLogger } from '../helpers.ts';
import { createCloudApiDouble } from './cloud-api-double.ts';
import { makeProductRepository } from './products.ts';

/**
 * Apoyo para las pruebas del bot de WhatsApp (REQ-F-009, RF-11): entregas del webhook construidas
 * a partir de las fixtures (forma de los ejemplos oficiales), firma y un "arnés" con el bot real,
 * el doble de la Cloud API, el reloj controlado y un logger que registra.
 */

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'whatsapp');

export type FixtureName = 'text' | 'image' | 'audio' | 'sticker' | 'location' | 'contacts' | 'status-delivered' | 'status-failed';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any justificado: las pruebas modifican el JSON de las fixtures a voluntad.
export const loadFixture = (name: FixtureName): any => JSON.parse(readFileSync(join(FIXTURES_DIR, `${name}.json`), 'utf8'));

export const CUSTOMER = '5215500001234';
export const PHONE_NUMBER_ID = BOT_ENV.WHATSAPP_BOT_ACCOUNT_ID;
export const STAFF = Object.freeze({ molotes: BOT_ENV.WHATSAPP_BOT_STAFF_MOLOTES, birria: BOT_ENV.WHATSAPP_BOT_STAFF_BIRRIA });

/** Fecha y hora en Ciudad de México (UTC-6, sin horario de verano): mx('2026-10-06T10:00'). */
export const mx = (local: string): Date => new Date(`${local}:00-06:00`);
/** Semana de referencia: lunes 5 a domingo 11 de octubre de 2026. */
export const WEEK = Object.freeze({
  mon: '2026-10-05',
  tue: '2026-10-06',
  wed: '2026-10-07',
  thu: '2026-10-08',
  fri: '2026-10-09',
  sat: '2026-10-10',
  sun: '2026-10-11',
  nextMon: '2026-10-12',
});

let nextId = 0;
export const newMessageId = (): string => `wamid.PRUEBA${(nextId += 1)}`;

/** Entrega con un mensaje del tipo de la fixture (texto, imagen...). */
export function inboundPayload(
  kind: Exclude<FixtureName, 'status-delivered' | 'status-failed'>,
  { from = CUSTOMER, id = newMessageId(), text, at }: { from?: string; id?: string; text?: string; at: Date },
) {
  const payload = loadFixture(kind);
  const message = payload.entry[0].changes[0].value.messages[0];
  Object.assign(message, { from, id, timestamp: String(Math.floor(at.getTime() / 1000)) });
  payload.entry[0].changes[0].value.contacts[0].wa_id = from;
  if (kind === 'text') message.text.body = text ?? 'Hola';
  return payload;
}

export const sign = (body: string, secret: string = BOT_ENV.WHATSAPP_BOT_APP_SECRET): string =>
  `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

export const botConfig = (): MetaBotConfig => {
  const { whatsappBot } = makeConfig(BOT_ENV);
  if (whatsappBot?.provider !== 'meta') throw new Error('BOT_ENV debe habilitar el bot con Meta');
  return whatsappBot;
};

export interface HarnessProtection {
  /** Umbrales distintos de los de por defecto (REQ-F-025). */
  limits?: Partial<BotLimits>;
  /** Store compartido (p. ej. para simular un reinicio o una base caída). */
  store?: MemoryBotControlStore;
}

/**
 * Bot real con Meta (WhatsAppBot), el doble de la Cloud API, reloj controlado y productos en memoria
 * (semillas). Con `protection`, además la protección de REQ-F-025 con un store en memoria.
 */
export async function makeBotHarness({
  at = mx(`${WEEK.tue}T10:00`),
  products,
  protection,
}: { at?: Date; products?: Pick<ProductRepository, 'getPublished'>; protection?: HarnessProtection } = {}) {
  const clock = { now: at };
  const double = createCloudApiDouble();
  const logger = makeRecordingLogger();
  const config = botConfig();
  const fullConfig = makeConfig(BOT_ENV);
  const productRepository = products ?? (await makeProductRepository()).repository;
  let codes = 0;
  const limits: BotLimits = { ...DEFAULT_BOT_LIMITS, ...protection?.limits };
  const store = protection?.store ?? createMemoryBotControlStore();
  let control: BotControl | undefined;
  if (protection) {
    control = createBotControl({ store, keys: fullConfig.botKeys, limits, timeZone: 'America/Mexico_City', staff: Object.values(config.staff), logger, now: () => clock.now });
    await control.init();
  }
  const bot = createBotOrchestrator({
    chatBot: createChatBot(config, { fetch: double.fetch, logger, retryDelayMs: 0 }),
    staff: config.staff,
    timeZone: 'America/Mexico_City',
    products: productRepository,
    logger,
    now: () => clock.now,
    newCode: (prefix) => `${prefix}-T${String((codes += 1)).padStart(3, '0')}`,
    protection: control ? createBotProtection({ control, limits, timeZone: 'America/Mexico_City', logger }) : undefined,
  });

  /** Entrega cruda (ya parseada) y espera a que el bot termine. */
  async function deliver(payload: unknown): Promise<void> {
    bot.receive(parseDelivery(payload, PHONE_NUMBER_ID));
    await bot.drain();
  }

  /**
   * El cliente escribe; devuelve los textos que recibió por este mensaje. Cada mensaje avanza el
   * reloj 3 s (un ritmo humano, dentro del límite de 20 mensajes por minuto).
   */
  async function say(text: string, { from = CUSTOMER }: { from?: string } = {}): Promise<string[]> {
    clock.now = new Date(clock.now.getTime() + 3000);
    const before = double.textsTo(from).length;
    await deliver(inboundPayload('text', { from, text, at: clock.now }));
    return double.textsTo(from).slice(before);
  }

  /** Igual que `say`, con todo el texto recibido unido (para buscar frases). */
  const ask = async (text: string, options?: { from?: string }): Promise<string> => (await say(text, options)).join('\n---\n');

  return { bot, double, logger, clock, config, products: productRepository, deliver, say, ask, control, store, limits };
}

export type BotHarness = Awaited<ReturnType<typeof makeBotHarness>>;
