import type { Logger } from '@restaurante/core/shared';

import type { TwilioBotConfig } from '../../../../config/env.ts';
import type { ChatBot, DeliveryOutcome, SendResult, StaffNotice, VerifyOutcome } from '../../chat-bot.ts';
import { chunkText } from '../../text.ts';
import type { FetchLike } from '../http-send.ts';
import { createTwilioApiClient, type TwilioApiClient, type TwilioSendResult } from './twilio-api.ts';
import { EMPTY_TWIML, MAX_TWILIO_WEBHOOK_BYTES, TWILIO_SIGNATURE_HEADER, checkTwilioSignature, decodeForm, parseTwilioDelivery } from './webhook.ts';

/**
 * `ChatBot` con Twilio (REQ-F-012; DT-1, DT-6 a DT-10), el proveedor de desarrollo (sandbox de
 * WhatsApp). Nunca se usa en producción (D-5).
 *
 * - GET: Twilio no verifica el webhook por GET (`unsupported`: el webhook responde 405).
 * - POST: sin `X-Twilio-Signature` -> 401; cuerpo que no es UTF-8 -> 400; firma distinta -> 403;
 *   si todo es correcto, TwiML vacío.
 * - Aviso al personal (D-6): con `WHATSAPP_BOT_STAFF_TEMPLATE` (`HX…`), Content Template con las
 *   variables numeradas en el orden de STAFF_TEMPLATE_VARIABLES; sin ella, texto libre (en
 *   partes solo si supera 1600 caracteres; DT-9).
 */

/** Límite del cuerpo de un mensaje de WhatsApp en Twilio. */
export const TWILIO_MAX_TEXT_CHARS = 1600;

/**
 * Orden de las variables del Content Template ("1" a "9"), documentado en el README. Las claves
 * son los parámetros con nombre que genera la conversación (staffTemplateParams).
 */
export const STAFF_TEMPLATE_VARIABLES = Object.freeze(['codigo', 'negocio', 'horario', 'cliente', 'whatsapp', 'entrega', 'lineas', 'total', 'notas'] as const);

export interface TwilioBotOptions {
  config: TwilioBotConfig;
  fetch: FetchLike;
  logger: Logger;
  retryDelayMs?: number;
}

const idsOf = (result: TwilioSendResult & { ok: true }): string[] => (result.messageId === undefined ? [] : [result.messageId]);

export class TwilioBot implements ChatBot {
  readonly provider = 'twilio';
  readonly maxTextLength = TWILIO_MAX_TEXT_CHARS;
  readonly maxWebhookBytes = MAX_TWILIO_WEBHOOK_BYTES;
  readonly #config: TwilioBotConfig;
  readonly #client: TwilioApiClient;

  constructor({ config, fetch, logger, retryDelayMs }: TwilioBotOptions) {
    this.#config = config;
    this.#client = createTwilioApiClient({ config, fetch, logger, ...(retryDelayMs === undefined ? {} : { retryDelayMs }) });
  }

  verifySubscription(): VerifyOutcome {
    return { kind: 'unsupported' };
  }

  handleDelivery(rawBody: Buffer, header: (name: string) => string | undefined): DeliveryOutcome {
    const signatureHeader = header(TWILIO_SIGNATURE_HEADER);
    if (signatureHeader === undefined || signatureHeader === '') return { kind: 'signature_invalid', reason: 'missing' };
    const params = decodeForm(rawBody);
    if (params === null) return { kind: 'bad_request', code: 'INVALID_FORM', message: 'El cuerpo no es un formulario válido.' };
    const signature = checkTwilioSignature(this.#config.webhookUrl, params, signatureHeader, this.#config.accessToken);
    if (signature !== 'valid') return { kind: 'signature_invalid', reason: signature };
    const delivery = parseTwilioDelivery(params, { accountSid: this.#config.accountId, sender: this.#config.sender });
    return { kind: 'accepted', delivery, response: { type: 'text/xml', body: EMPTY_TWIML } };
  }

  async sendText(to: string, body: string): Promise<SendResult> {
    const result = await this.#client.send(to, { body }, 'text');
    return result.ok ? { ok: true, messageIds: idsOf(result) } : result;
  }

  async sendStaffNotice(to: string, notice: StaffNotice): Promise<SendResult> {
    const contentSid = this.#config.staffContentSid;
    if (contentSid !== undefined) {
      const variables = Object.fromEntries(STAFF_TEMPLATE_VARIABLES.map((name, index) => [String(index + 1), notice.params[name] ?? '-']));
      const result = await this.#client.send(to, { contentSid, variables }, 'template');
      return result.ok ? { ok: true, messageIds: idsOf(result) } : result;
    }
    // Texto libre: un mensaje; en partes ordenadas solo si supera el límite (DT-9). Una parte
    // aceptada nunca se reenvía; si una falla, el aviso cuenta como fallido (D-18).
    const messageIds: string[] = [];
    for (const part of chunkText(notice.text, TWILIO_MAX_TEXT_CHARS)) {
      const result = await this.#client.send(to, { body: part }, 'text');
      if (!result.ok) return result;
      messageIds.push(...idsOf(result));
    }
    return { ok: true, messageIds };
  }
}
