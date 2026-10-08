import type { FetchLike } from '../../src/services/whatsapp-bot/providers/http-send.ts';

/**
 * Doble de la API de mensajes de Twilio (REQ-F-012, RF-8): un `fetch` falso que registra cada
 * petición y responde según un guion. Ninguna prueba llama a Twilio.
 *
 * - `requests`: todos los intentos (también los fallidos y los reintentos).
 * - `sent`: solo los mensajes que el doble "aceptó" (201 con un `sid`).
 * - `failNext(...)`: los próximos intentos responden con lo indicado, en orden.
 *
 * `to` y `from` se guardan sin el prefijo `whatsapp:+` (solo dígitos) para compararlos con los
 * números de las pruebas; `rawTo` y `rawFrom` conservan el valor enviado.
 */

export interface TwilioDoubleRequest {
  readonly url: string;
  readonly authorization: string | null;
  readonly contentType: string | null;
  readonly rawFrom: string;
  readonly rawTo: string;
  readonly from: string;
  readonly to: string;
  readonly statusCallback: string | undefined;
  readonly text?: string;
  readonly contentSid?: string;
  readonly variables?: Record<string, string>;
}

export type TwilioScriptedResponse =
  | { kind: 'twilio-error'; status: number; code: number }
  | { kind: 'network-error'; code: string }
  | { kind: 'timeout' };

export const twilioError = (status: number, code: number): TwilioScriptedResponse => ({ kind: 'twilio-error', status, code });
export const twilioNetworkError = (code: string): TwilioScriptedResponse => ({ kind: 'network-error', code });
export const twilioTimeout = (): TwilioScriptedResponse => ({ kind: 'timeout' });

const digits = (address: string): string => address.replace(/^whatsapp:\+/, '');

function toRequest(url: string, init: RequestInit): TwilioDoubleRequest {
  // El cliente siempre envía el cuerpo como texto del formulario.
  const form = new URLSearchParams(typeof init.body === 'string' ? init.body : '');
  const headers = new Headers(init.headers);
  const rawFrom = form.get('From') ?? '';
  const rawTo = form.get('To') ?? '';
  const request: TwilioDoubleRequest = {
    url,
    authorization: headers.get('Authorization'),
    contentType: headers.get('Content-Type'),
    rawFrom,
    rawTo,
    from: digits(rawFrom),
    to: digits(rawTo),
    statusCallback: form.get('StatusCallback') ?? undefined,
  };
  const body = form.get('Body');
  if (body !== null) return { ...request, text: body };
  const contentSid = form.get('ContentSid');
  if (contentSid !== null) return { ...request, contentSid, variables: JSON.parse(form.get('ContentVariables') ?? '{}') as Record<string, string> };
  return request;
}

export function createTwilioApiDouble() {
  const requests: TwilioDoubleRequest[] = [];
  const sent: (TwilioDoubleRequest & { messageId: string })[] = [];
  const script: TwilioScriptedResponse[] = [];
  let counter = 0;

  const fetch: FetchLike = async (url, init) => {
    const request = toRequest(url, init);
    requests.push(request);
    const next = script.shift();
    if (next?.kind === 'timeout') throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    if (next?.kind === 'network-error') throw new TypeError('fetch failed', { cause: Object.assign(new Error(next.code), { code: next.code }) });
    if (next?.kind === 'twilio-error') {
      return Response.json(
        { code: next.code, message: `Error simulado para ${request.rawTo} con datos sensibles`, more_info: `https://www.twilio.com/docs/errors/${next.code}`, status: next.status },
        { status: next.status },
      );
    }
    counter += 1;
    const messageId = `SM${counter.toString(16).padStart(32, '0')}`;
    sent.push({ ...request, messageId });
    return Response.json({ sid: messageId, status: 'queued', to: request.rawTo, from: request.rawFrom }, { status: 201 });
  };

  return {
    fetch,
    requests,
    sent,
    failNext(...responses: TwilioScriptedResponse[]) {
      script.push(...responses);
    },
    /** Textos aceptados para un número (dígitos), en orden. */
    textsTo(to: string): string[] {
      return sent.filter((m) => m.to === to && m.text !== undefined).map((m) => m.text as string);
    },
    /** Envíos con Content Template a un número. */
    templatesTo(to: string) {
      return sent.filter((m) => m.to === to && m.contentSid !== undefined);
    },
    clear() {
      requests.length = 0;
      sent.length = 0;
    },
  };
}

export type TwilioApiDouble = ReturnType<typeof createTwilioApiDouble>;
