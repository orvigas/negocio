import { createHmac, randomBytes, randomInt } from 'node:crypto';

import type { BusinessId } from '../../config/businesses.ts';
import type { WhatsAppBotConfig } from '../../config/env.ts';
import type { ProductRepository } from '../../repositories/product-repository.ts';
import { errorProp } from '../../utils/errors.ts';
import { silentLogger, type Logger } from '../../utils/logger.ts';
import { buildWhatsAppLink } from '../whatsapp.ts';
import { buildCatalog } from './catalog.ts';
import type { CloudApiClient } from './cloud-api.ts';
import { handleTurn, type Conversation, type TurnContext, type TurnInput } from './conversation.ts';
import { cartTotal, confirmedMessage, staffFailedMessage, staffTemplateParams, type OrderDetails } from './messages.ts';
import { maskPhone } from './phone.ts';
import {
  CONVERSATION_IDLE_MS,
  MAX_SEEN,
  RATE_LIMIT,
  MAX_STAFF_MESSAGES,
  SEEN_TTL_MS,
  STAFF_MESSAGE_TTL_MS,
  createConversationStore,
  createExpiringMap,
  createRateLimiter,
} from './store.ts';
import type { InboundMessage, ParsedDelivery } from './webhook.ts';

/**
 * Orquestador del bot de WhatsApp (REQ-F-009).
 *
 * - `receive` no espera: deduplica por id de mensaje (RF-1.4), descarta los mensajes de hace más
 *   de 2 h (PT-4 A) y los que superan el límite por número (DT-15), y encola el resto en una
 *   cola por cliente (los mensajes de un mismo cliente se procesan uno tras otro, en orden).
 * - Cada mensaje pasa por la máquina de estados (conversation.ts) y sus respuestas se envían con
 *   la Cloud API. Un pedido confirmado se envía al personal **una sola vez** con la plantilla
 *   (DT-6); si falla, el cliente recibe el contacto directo (D-18).
 * - Los estados (`statuses`) no cambian el flujo (RF-1.5); solo se registra el fallo tardío de un
 *   aviso al personal (PT-3 A).
 * - Logs sin datos personales (RF-9): número enmascarado, nunca textos, nombre, dirección, notas,
 *   código de referencia ni tokens.
 */

/** Alfabeto del código de referencia, sin caracteres ambiguos (0/O, 1/I/L). */
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const STALE_MESSAGE_MS = CONVERSATION_IDLE_MS;

export const randomReferenceCode = (prefix: string): string =>
  `${prefix}-${Array.from({ length: 4 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('')}`;

export interface WhatsAppBot {
  receive(delivery: ParsedDelivery): void;
  /** Se cumple cuando no queda ningún mensaje en proceso (pruebas y cierre ordenado). */
  drain(): Promise<void>;
  hasConversation(waId: string): boolean;
  readonly conversationCount: number;
  /** Solo lectura (pruebas): ¿el limitador por número tiene una entrada de este número? */
  isRateTracked(waId: string): boolean;
  readonly rateTrackedCount: number;
}

export interface WhatsAppBotOptions {
  config: NonNullable<WhatsAppBotConfig>;
  timeZone: string;
  products: Pick<ProductRepository, 'getPublished'>;
  client: CloudApiClient;
  logger?: Logger;
  now?: () => Date;
  newCode?: (prefix: string) => string;
  newId?: () => string;
}

export function createWhatsAppBot({
  config,
  timeZone,
  products,
  client,
  logger = silentLogger,
  now = () => new Date(),
  newCode = randomReferenceCode,
  newId = () => randomBytes(4).toString('hex'),
}: WhatsAppBotOptions): WhatsAppBot {
  const conversations = createConversationStore();
  const seen = createExpiringMap<true>({ ttlMs: SEEN_TTL_MS, max: MAX_SEEN });
  const staffMessages = createExpiringMap<BusinessId>({ ttlMs: STAFF_MESSAGE_TTL_MS, max: MAX_STAFF_MESSAGES });
  // RN-5 (DEF-001): el limitador guarda un HMAC del número con una clave aleatoria por proceso,
  // que nunca se registra ni se expone; nunca el número en claro.
  const rateKeySecret = randomBytes(32);
  const rateLimiter = createRateLimiter({ ...RATE_LIMIT, keyOf: (waId) => createHmac('sha256', rateKeySecret).update(waId).digest('base64url') });
  const queues = new Map<string, Promise<void>>();
  const pending = new Set<Promise<void>>();

  const staffContact = (business: BusinessId): string => buildWhatsAppLink({ phone: config.staff[business] });

  async function reply(to: string, messages: readonly string[]): Promise<void> {
    // En orden: el cliente debe leerlos en la secuencia en que se escribieron.
    for (const body of messages) {
      const result = await client.sendText(to, body);
      if (!result.ok) return;
    }
  }

  /** Aviso al personal (RF-7): una sola vez; con un fallo, D-18. La conversación se cierra. */
  async function notifyStaff(waId: string, conversation: Conversation, order: OrderDetails): Promise<void> {
    const fields = { conversationId: conversation.id, business: order.business, customer: maskPhone(waId) };
    const result = await client.sendTemplate(config.staff[order.business], {
      name: config.staffTemplate.name,
      language: config.staffTemplate.language,
      params: staffTemplateParams(order, waId),
    });
    conversations.delete(waId);
    if (result.ok) {
      if (result.messageId) staffMessages.set(result.messageId, order.business, now().getTime());
      logger.info('bot_order_confirmed', { ...fields, lines: order.lines.length, totalCents: cartTotal(order.lines), offHours: order.offHoursOpening !== null });
      await reply(waId, [confirmedMessage(order)]);
    } else {
      logger.error('bot_staff_send_failed', { ...fields, failure: result.kind, status: result.status, errorCode: result.errorCode });
      await reply(waId, [staffFailedMessage(order, staffContact(order.business))]);
    }
  }

  async function processMessage(message: InboundMessage): Promise<void> {
    const time = now();
    const stored = conversations.get(message.from, time.getTime());
    if (stored && message.timestamp < stored.lastTimestamp) {
      logger.info('bot_message_out_of_order', { conversationId: stored.conversation.id, customer: maskPhone(message.from) });
      return;
    }
    const input: TurnInput = message.text === undefined ? { kind: 'unsupported' } : { kind: 'text', text: message.text };
    const ctx: TurnContext = {
      now: time,
      timeZone,
      catalog: (business) => buildCatalog(business, products.getPublished(business)),
      staffContact,
      newCode,
      newId,
    };
    const result = handleTurn(stored?.conversation ?? null, input, ctx);
    const conversation = result.conversation;
    const id = conversation?.id ?? stored?.conversation.id;
    const fields = { conversationId: id, customer: maskPhone(message.from) };

    if (result.started && conversation) logger.info('bot_conversation_started', { ...fields, business: conversation.business });
    if (conversation) {
      const lastTimestamp = Math.max(message.timestamp, stored?.lastTimestamp ?? 0);
      if (conversations.set(message.from, { conversation, lastSeen: time.getTime(), lastTimestamp })) {
        logger.warn('bot_conversation_evicted', {});
      }
    } else {
      // Cerrada: sus datos se borran de memoria (RF-9.3).
      conversations.delete(message.from);
      if (result.cancelled) logger.info('bot_order_cancelled', { ...fields, business: stored?.conversation.business });
    }

    await reply(message.from, result.replies);
    if (result.order && conversation) await notifyStaff(message.from, conversation, result.order);
  }

  function enqueue(message: InboundMessage): void {
    const previous = queues.get(message.from) ?? Promise.resolve();
    const run = previous
      .then(() => processMessage(message))
      .catch((err: unknown) => {
        // Sin el mensaje del error: podría llevar datos de la conversación.
        logger.error('bot_processing_failed', { name: errorProp(err, 'name') });
      });
    queues.set(message.from, run);
    pending.add(run);
    void run.finally(() => {
      pending.delete(run);
      if (queues.get(message.from) === run) queues.delete(message.from);
    });
  }

  function handleStatuses(delivery: ParsedDelivery, time: number): void {
    for (const status of delivery.statuses) {
      if (status.status !== 'failed') continue;
      const business = staffMessages.get(status.id, time);
      if (business !== undefined) logger.error('bot_staff_delivery_failed', { business, errorCode: status.errorCode });
    }
  }

  return {
    receive(delivery) {
      const time = now().getTime();
      conversations.sweep(time);
      rateLimiter.sweep(time);
      handleStatuses(delivery, time);
      const messages = [...delivery.messages].sort((a, b) => a.timestamp - b.timestamp);
      for (const message of messages) {
        if (seen.get(message.id, time)) continue;
        seen.set(message.id, true, time);
        if (time - message.timestamp * 1000 > STALE_MESSAGE_MS) {
          logger.info('bot_message_stale', { customer: maskPhone(message.from), ageSeconds: Math.round(time / 1000 - message.timestamp) });
          continue;
        }
        const limit = rateLimiter.hit(message.from, time);
        if (limit !== 'ok') {
          if (limit === 'first-limited') logger.warn('bot_rate_limited', { customer: maskPhone(message.from) });
          continue;
        }
        enqueue(message);
      }
    },

    async drain() {
      while (pending.size > 0) await Promise.allSettled([...pending]);
    },

    hasConversation(waId) {
      conversations.sweep(now().getTime());
      return conversations.has(waId);
    },

    get conversationCount() {
      conversations.sweep(now().getTime());
      return conversations.size;
    },

    isRateTracked(waId) {
      return rateLimiter.has(waId);
    },

    get rateTrackedCount() {
      return rateLimiter.size;
    },
  };
}
