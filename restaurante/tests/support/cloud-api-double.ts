import type { FetchLike } from '../../src/services/whatsapp-bot/cloud-api.ts';

/**
 * Doble de la WhatsApp Cloud API (REQ-F-009, RF-11): un `fetch` falso que registra cada petición
 * y responde según un guion. Ninguna prueba llama a Meta.
 *
 * - `requests`: todos los intentos (también los fallidos y los reintentos).
 * - `sent`: solo los mensajes que el doble "entregó" (respuesta 200 con un `wamid`).
 * - `failNext(...)`: los próximos intentos responden con lo indicado, en orden.
 */

export interface DoubleRequest {
  readonly url: string;
  readonly authorization: string | null;
  readonly to: string;
  readonly type: string;
  readonly text?: string;
  readonly template?: { name: string; language: string; params: Record<string, string> };
}

export type ScriptedResponse =
  | { kind: 'graph-error'; status: number; code: number }
  | { kind: 'network-error'; code: string }
  | { kind: 'timeout' };

export const graphError = (status: number, code: number): ScriptedResponse => ({ kind: 'graph-error', status, code });
export const networkError = (code: string): ScriptedResponse => ({ kind: 'network-error', code });
export const timeout = (): ScriptedResponse => ({ kind: 'timeout' });

interface RawPayload {
  to: string;
  type: string;
  text?: { body: string };
  template?: { name: string; language: { code: string }; components: { parameters: { parameter_name: string; text: string }[] }[] };
}

function toRequest(url: string, init: RequestInit): DoubleRequest {
  // El cliente siempre envía el cuerpo como texto JSON.
  const payload = JSON.parse(typeof init.body === 'string' ? init.body : '{}') as RawPayload;
  const headers = new Headers(init.headers);
  const request: DoubleRequest = { url, authorization: headers.get('Authorization'), to: payload.to, type: payload.type };
  if (payload.text) return { ...request, text: payload.text.body };
  if (payload.template) {
    const params = Object.fromEntries((payload.template.components[0]?.parameters ?? []).map((p) => [p.parameter_name, p.text]));
    return { ...request, template: { name: payload.template.name, language: payload.template.language.code, params } };
  }
  return request;
}

export function createCloudApiDouble() {
  const requests: DoubleRequest[] = [];
  const sent: (DoubleRequest & { messageId: string })[] = [];
  const script: ScriptedResponse[] = [];
  let counter = 0;

  const fetch: FetchLike = async (url, init) => {
    const request = toRequest(url, init);
    requests.push(request);
    const next = script.shift();
    if (next?.kind === 'timeout') throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    if (next?.kind === 'network-error') throw new TypeError('fetch failed', { cause: Object.assign(new Error(next.code), { code: next.code }) });
    if (next?.kind === 'graph-error') {
      return Response.json({ error: { message: `(#${next.code}) error simulado con datos sensibles`, code: next.code, fbtrace_id: 'x' } }, { status: next.status });
    }
    counter += 1;
    const messageId = `wamid.DOBLE${counter}`;
    sent.push({ ...request, messageId });
    return Response.json({ messaging_product: 'whatsapp', contacts: [{ input: request.to, wa_id: request.to }], messages: [{ id: messageId }] });
  };

  return {
    fetch,
    requests,
    sent,
    failNext(...responses: ScriptedResponse[]) {
      script.push(...responses);
    },
    /** Textos entregados a un número, en orden. */
    textsTo(to: string): string[] {
      return sent.filter((m) => m.to === to && m.text !== undefined).map((m) => m.text as string);
    },
    templatesTo(to: string) {
      return sent.filter((m) => m.to === to && m.template !== undefined);
    },
    clear() {
      requests.length = 0;
      sent.length = 0;
    },
  };
}

export type CloudApiDouble = ReturnType<typeof createCloudApiDouble>;
