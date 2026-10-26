import { safeEqualStrings } from '@restaurante/core/identity';
import type { Logger } from '@restaurante/core/shared';

import type { MetaBotConfig } from '../../../../config/env.ts';
import type { ChatBot, DeliveryOutcome, SendResult, StaffNotice, VerifyOutcome, WebhookQuery } from '../../chat-bot.ts';
import { MAX_MESSAGE_CHARS } from '../../text.ts';
import type { FetchLike } from '../http-send.ts';
import { createCloudApiClient, type CloudApiClient, type CloudSendResult } from './cloud-api.ts';
import { MAX_WEBHOOK_BYTES, SIGNATURE_HEADER, checkSignature, parseDelivery } from './webhook.ts';

/**
 * `ChatBot` con la WhatsApp Cloud API de Meta (REQ-F-009; REQ-F-012 DT-1 y DT-3), el proveedor
 * de producción.
 *
 * - GET: verificación de la suscripción con `hub.mode`, `hub.verify_token` y `hub.challenge`.
 * - POST: firma `X-Hub-Signature-256` del cuerpo crudo con el App Secret -> JSON -> entrega.
 *   Respuesta 200 "OK".
 * - Envío con la Cloud API; el aviso al personal siempre con la plantilla aprobada (DT-6 de REQ-F-009).
 */

const CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export interface WhatsAppBotOptions {
  config: MetaBotConfig;
  fetch: FetchLike;
  logger: Logger;
  retryDelayMs?: number;
}

const toSendResult = (result: CloudSendResult): SendResult =>
  result.ok ? { ok: true, messageIds: result.messageId === undefined ? [] : [result.messageId] } : result;

export class WhatsAppBot implements ChatBot {
  readonly provider = 'meta';
  readonly maxTextLength = MAX_MESSAGE_CHARS;
  readonly maxWebhookBytes = MAX_WEBHOOK_BYTES;
  readonly #config: MetaBotConfig;
  readonly #client: CloudApiClient;

  constructor({ config, fetch, logger, retryDelayMs }: WhatsAppBotOptions) {
    this.#config = config;
    this.#client = createCloudApiClient({ config, fetch, logger, ...(retryDelayMs === undefined ? {} : { retryDelayMs }) });
  }

  verifySubscription(query: WebhookQuery): VerifyOutcome {
    const challenge = query['hub.challenge'];
    const tokenMatches = safeEqualStrings(query['hub.verify_token'] ?? '', this.#config.verifyToken);
    if (query['hub.mode'] !== 'subscribe' || !tokenMatches || challenge === undefined || !CHALLENGE_PATTERN.test(challenge)) {
      return { kind: 'rejected' };
    }
    return { kind: 'challenge', challenge };
  }

  handleDelivery(rawBody: Buffer, header: (name: string) => string | undefined): DeliveryOutcome {
    const signature = checkSignature(rawBody, header(SIGNATURE_HEADER), this.#config.appSecret);
    if (signature !== 'valid') return { kind: 'signature_invalid', reason: signature };
    let payload: unknown;
    try {
      payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(rawBody)) as unknown;
    } catch {
      return { kind: 'bad_request', code: 'INVALID_JSON', message: 'El cuerpo no es JSON válido.' };
    }
    return { kind: 'accepted', delivery: parseDelivery(payload, this.#config.accountId), response: { type: 'text/plain', body: 'OK' } };
  }

  async sendText(to: string, body: string): Promise<SendResult> {
    return toSendResult(await this.#client.sendText(to, body));
  }

  async sendStaffNotice(to: string, notice: StaffNotice): Promise<SendResult> {
    const { name, language } = this.#config.staffTemplate;
    return toSendResult(await this.#client.sendTemplate(to, { name, language, params: notice.params }));
  }
}
