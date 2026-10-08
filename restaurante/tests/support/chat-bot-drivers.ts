import type { Env } from '../../src/config/env.ts';
import type { BotProvider } from '../../src/services/whatsapp-bot/chat-bot.ts';
import type { FetchLike } from '../../src/services/whatsapp-bot/providers/http-send.ts';
import { BOT_ENV, TWILIO_BOT_ENV } from '../helpers.ts';
import { createCloudApiDouble } from './cloud-api-double.ts';
import { formBody, newMessageSid, signTwilio, twilioInbound } from './twilio.ts';
import { createTwilioApiDouble } from './twilio-api-double.ts';
import { CUSTOMER, inboundPayload, newMessageId, sign } from './whatsapp.ts';

/**
 * "Drivers" de la batería de contrato de `ChatBot` (REQ-F-012, CA-19 y CA-20): lo único que cambia
 * entre proveedores es el doble de su API, las variables de entorno y la forma firmada de la
 * entrega. Las pruebas usan la misma app y el mismo orquestador con los dos.
 */

/** Petición HTTP firmada que el proveedor enviaría al webhook. */
export interface SignedDelivery {
  readonly body: string;
  readonly headers: Readonly<Record<string, string>>;
}

/** Lo común de los dobles de las dos APIs. */
export interface ProviderDouble {
  readonly fetch: FetchLike;
  readonly requests: readonly unknown[];
  textsTo(to: string): string[];
  /** Avisos aceptados para el personal (plantilla o texto libre). */
  staffNoticesTo(to: string): { readonly codigo: string | undefined }[];
}

export interface ProviderDriver {
  readonly provider: BotProvider;
  readonly env: Env;
  makeDouble(): ProviderDouble;
  /** Mensaje de texto del cliente. Con `id` se repite una entrega. */
  text(text: string, options: { at: Date; id?: string }): SignedDelivery;
  /** Mensaje que no es texto (imagen). */
  media(options: { at: Date }): SignedDelivery;
  newId(): string;
}

const metaDelivery = (payload: unknown): SignedDelivery => {
  const body = JSON.stringify(payload);
  return { body, headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': sign(body) } };
};

const twilioDelivery = (params: Record<string, string>): SignedDelivery => ({
  body: formBody(params),
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Twilio-Signature': signTwilio(params) },
});

export const META_DRIVER: ProviderDriver = {
  provider: 'meta',
  env: BOT_ENV,
  makeDouble() {
    const double = createCloudApiDouble();
    return {
      fetch: double.fetch,
      requests: double.requests,
      textsTo: (to) => double.textsTo(to),
      staffNoticesTo: (to) => double.templatesTo(to).map((m) => ({ codigo: m.template?.params.codigo })),
    };
  },
  text: (text, { at, id = newMessageId() }) => metaDelivery(inboundPayload('text', { from: CUSTOMER, text, at, id })),
  media: ({ at }) => metaDelivery(inboundPayload('image', { from: CUSTOMER, at })),
  newId: newMessageId,
};

export const TWILIO_DRIVER: ProviderDriver = {
  provider: 'twilio',
  env: TWILIO_BOT_ENV,
  makeDouble() {
    const double = createTwilioApiDouble();
    return {
      fetch: double.fetch,
      requests: double.requests,
      textsTo: (to) => double.textsTo(to),
      staffNoticesTo: (to) => double.sent.filter((m) => m.to === to).map((m) => ({ codigo: /\*Nuevo pedido ([A-Z]-[A-Z0-9]+)\*/.exec(m.text ?? '')?.[1] })),
    };
  },
  // Twilio no envía la hora del mensaje (D-14): `at` no se usa.
  text: (text, { id = newMessageSid() }) => twilioDelivery(twilioInbound('text', { text, sid: id })),
  media: () => twilioDelivery(twilioInbound('image')),
  newId: newMessageSid,
};

export const PROVIDER_DRIVERS: readonly ProviderDriver[] = [META_DRIVER, TWILIO_DRIVER];
