import { createHmac, randomBytes, randomInt } from 'node:crypto';

import type { BusinessId } from '../../config/businesses.ts';
import type { ProductRepository } from '../../repositories/product-repository.ts';
import { errorProp } from '../../utils/errors.ts';
import { silentLogger, type Logger } from '../../utils/logger.ts';
import { buildWhatsAppLink } from '../whatsapp.ts';
import { buildCatalog } from './catalog.ts';
import type { ChatBot, InboundDelivery, InboundMessage } from './chat-bot.ts';
import { handleTurn, type Conversation, type TurnContext, type TurnInput } from './conversation.ts';
import { cartTotal, confirmedMessage, staffFailedMessage, staffNoticeText, staffTemplateParams, type OrderDetails } from './messages.ts';
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
import { chunkText } from './text.ts';

/**
 * Orquestador del bot de WhatsApp (REQ-F-009): la conversación compartida, independiente del
 * proveedor (REQ-F-012, RF-1.5; DT-2). Recibe un `ChatBot` (Meta o Twilio) y nunca importa código
 * de un proveedor concreto.
 *
 * - `receive` no espera: deduplica por id de mensaje (RF-1.4), descarta los mensajes de hace más
 *   de 2 h (PT-4 A) y los que superan el límite por número (DT-15), y encola el resto en una
 *   cola por cliente (los mensajes de un mismo cliente se procesan uno tras otro, en orden).
 * - Cada mensaje pasa por la máquina de estados (conversation.ts) y sus respuestas se envían con
 *   el `ChatBot`, partidas según su límite de longitud (DT-7). Un pedido confirmado se envía al
 *   personal **una sola vez** (DT-6; D-6 de REQ-F-012); si falla, el cliente recibe el contacto
 *   directo (D-18).
 * - Si el proveedor no envía la hora del mensaje (Twilio), la antigüedad y el orden se calculan
 *   con la hora de recepción (D-14 de REQ-F-012).
 * - Los estados (`statuses`) no cambian el flujo (RF-1.5); solo se registra el fallo tardío de un
 *   aviso al personal (PT-3 A; `failed` o `undelivered`).
 * - Logs sin datos personales (RF-9): número enmascarado, nunca textos, nombre, dirección, notas,
 *   código de referencia ni tokens.
 */

/** Alfabeto del código de referencia, sin caracteres ambiguos (0/O, 1/I/L). */
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const STALE_MESSAGE_MS = CONVERSATION_IDLE_MS;
/** Estados que indican que un mensaje enviado no llegó (Meta: failed; Twilio: failed o undelivered). */
const FAILED_STATUSES = new Set(['failed', 'undelivered']);

/** Mensaje en cola, ya con su hora (la del proveedor o la de recepción). */
type QueuedMessage = InboundMessage & { readonly timestamp: number };

export const randomReferenceCode = (prefix: string): string =>
  `${prefix}-${Array.from({ length: 4 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('')}`;

export interface BotOrchestrator {
  /** Proveedor con el que conversa (el webhook lo usa para la firma y el formato). */
  readonly chatBot: ChatBot;
  receive(delivery: InboundDelivery): void;
  /** Se cumple cuando no queda ningún mensaje en proceso (pruebas y cierre ordenado). */
  drain(): Promise<void>;
  hasConversation(waId: string): boolean;
  readonly conversationCount: number;
  /** Solo lectura (pruebas): ¿el limitador por número tiene una entrada de este número? */
  isRateTracked(waId: string): boolean;
  readonly rateTrackedCount: number;
}

export interface BotOrchestratorOptions {
  chatBot: ChatBot;
  /** Número de WhatsApp del personal de cada negocio. */
  staff: Readonly<Record<BusinessId, string>>;
  timeZone: string;
  products: Pick<ProductRepository, 'getPublished'>;
  logger?: Logger;
  now?: () => Date;
  newCode?: (prefix: string) => string;
  newId?: () => string;
}

export function createBotOrchestrator({
  chatBot,
  staff,
  timeZone,
  products,
  logger = silentLogger,
  now = () => new Date(),
  newCode = randomReferenceCode,
  newId = () => randomBytes(4).toString('hex'),
}: BotOrchestratorOptions): BotOrchestrator {
  const conversations = createConversationStore();
  const seen = createExpiringMap<true>({ ttlMs: SEEN_TTL_MS, max: MAX_SEEN });
  const staffMessages = createExpiringMap<BusinessId>({ ttlMs: STAFF_MESSAGE_TTL_MS, max: MAX_STAFF_MESSAGES });
  // RN-5 (DEF-001): el limitador guarda un HMAC del número con una clave aleatoria por proceso,
  // que nunca se registra ni se expone; nunca el número en claro.
  const rateKeySecret = randomBytes(32);
  const rateLimiter = createRateLimiter({ ...RATE_LIMIT, keyOf: (waId) => createHmac('sha256', rateKeySecret).update(waId).digest('base64url') });
  const queues = new Map<string, Promise<void>>();
  const pending = new Set<Promise<void>>();

  const staffContact = (business: BusinessId): string => buildWhatsAppLink({ phone: staff[business] });

  async function reply(to: string, messages: readonly string[]): Promise<void> {
    // En orden: el cliente debe leerlos en la secuencia en que se escribieron. Cada texto se
    // parte por líneas según el límite del proveedor (nunca corta un producto; DT-7).
    for (const body of messages) {
      for (const part of chunkText(body, chatBot.maxTextLength)) {
        const result = await chatBot.sendText(to, part);
        if (!result.ok) return;
      }
    }
  }

  /** Aviso al personal (RF-7): una sola vez; con un fallo, D-18. La conversación se cierra. */
  async function notifyStaff(waId: string, conversation: Conversation, order: OrderDetails): Promise<void> {
    const fields = { conversationId: conversation.id, business: order.business, customer: maskPhone(waId) };
    const result = await chatBot.sendStaffNotice(staff[order.business], {
      params: staffTemplateParams(order, waId),
      text: staffNoticeText(order, waId),
    });
    conversations.delete(waId);
    if (result.ok) {
      for (const messageId of result.messageIds) staffMessages.set(messageId, order.business, now().getTime());
      logger.info('bot_order_confirmed', { ...fields, lines: order.lines.length, totalCents: cartTotal(order.lines), offHours: order.offHoursOpening !== null });
      await reply(waId, [confirmedMessage(order)]);
    } else {
      logger.error('bot_staff_send_failed', { ...fields, failure: result.kind, status: result.status, errorCode: result.errorCode });
      await reply(waId, [staffFailedMessage(order, staffContact(order.business))]);
    }
  }

  async function processMessage(message: QueuedMessage): Promise<void> {
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

  function enqueue(message: QueuedMessage): void {
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

  function handleStatuses(delivery: InboundDelivery, time: number): void {
    for (const status of delivery.statuses) {
      if (!FAILED_STATUSES.has(status.status)) continue;
      const business = staffMessages.get(status.id, time);
      if (business !== undefined) logger.error('bot_staff_delivery_failed', { business, errorCode: status.errorCode });
    }
  }

  return {
    chatBot,

    receive(delivery) {
      const time = now().getTime();
      conversations.sweep(time);
      rateLimiter.sweep(time);
      handleStatuses(delivery, time);
      // D-14 (REQ-F-012): sin hora del proveedor, la de recepción.
      const receivedAt = Math.floor(time / 1000);
      const messages: QueuedMessage[] = delivery.messages
        .map((message) => ({ ...message, timestamp: message.timestamp ?? receivedAt }))
        .sort((a, b) => a.timestamp - b.timestamp);
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
