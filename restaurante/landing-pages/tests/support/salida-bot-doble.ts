import { appendFileSync } from 'node:fs';

/**
 * Doble de salida del bot (QA de REQ-F-042): se precarga con `node --import` en los procesos reales,
 * que nunca deben salir de la máquina. Sustituye el `fetch` global: registra en `QA_SALIDA_LOG` cada
 * envío a Meta o a Twilio y responde como el proveedor; cualquier otro host externo se rechaza y se
 * registra. Las peticiones a 127.0.0.1 no cambian (aviso interno y productos entre los procesos).
 *
 * `QA_DESFASE_MS` adelanta o atrasa el reloj del proceso una cantidad fija: los dos procesos de la
 * prueba comparten así un martes a viernes en horario, sin depender del día en que corre la suite.
 */

const logPath = process.env.QA_SALIDA_LOG ?? '';
const offset = Number(process.env.QA_DESFASE_MS ?? '0');
const realFetch = globalThis.fetch;
const RealDate = Date;

if (offset !== 0) {
  class ShiftedDate extends RealDate {
    constructor(...args: unknown[]) {
      // @ts-expect-error: reenvía los argumentos del constructor de Date tal como llegan.
      super(...(args.length === 0 ? [RealDate.now() + offset] : args));
    }
    static override now(): number {
      return RealDate.now() + offset;
    }
  }
  globalThis.Date = ShiftedDate as DateConstructor;
}

const record = (entry: Record<string, unknown>): void => {
  if (logPath !== '') appendFileSync(logPath, `${JSON.stringify(entry)}\n`);
};

globalThis.fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.hostname === '127.0.0.1') return realFetch(input, init);
  const raw = init?.body;
  const body = typeof raw === 'string' ? raw : raw instanceof URLSearchParams ? raw.toString() : '';
  if (url.hostname === 'graph.facebook.com') {
    record({ provider: 'meta', path: url.pathname, body });
    return Response.json({ messaging_product: 'whatsapp', messages: [{ id: `wamid.QA${String(RealDate.now())}` }] });
  }
  if (url.hostname === 'api.twilio.com') {
    record({ provider: 'twilio', path: url.pathname, body });
    return Response.json({ sid: `SM${'0'.repeat(32)}`, status: 'queued' }, { status: 201 });
  }
  record({ provider: 'rechazado', host: url.hostname });
  throw new TypeError(`Salida externa no permitida: ${url.hostname}`);
};
