import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.ts';
import type { FetchLike } from '../../src/services/whatsapp-bot/providers/http-send.ts';
import { createBotOrchestrator } from '../../src/services/whatsapp-bot/orchestrator.ts';
import { createChatBot } from '../../src/services/whatsapp-bot/providers/select.ts';
import { twilioSignature } from '../../src/services/whatsapp-bot/providers/twilio/webhook.ts';
import { BOT_ENV, TWILIO_BOT_ENV, VALID_ENV, makeConfig, makeRecordingLogger, makeRepository } from '../helpers.ts';
import { makeBotControl } from '../support/bot-control.ts';
import { listenLocal } from '../support/http.ts';
import { makeProductRepository } from '../support/products.ts';
import { newMessageSid, twilioConfig, twilioInbound, twilioStatus } from '../support/twilio.ts';
import { createTwilioApiDouble, twilioError, twilioNetworkError, twilioTimeout } from '../support/twilio-api-double.ts';
import { CUSTOMER, STAFF, WEEK, inboundPayload, mx, sign } from '../support/whatsapp.ts';

/**
 * QA de REQ-F-012, ronda 1 (QA Action Plan: S-1 a S-7, L-1 a L-6, N-1 a N-5, F-4, P-2, I-5 y
 * respuesta inmediata). La firma se calcula aquí con una implementación propia, escrita a partir
 * del algoritmo documentado por Twilio (URL + parámetros ordenados por nombre; con nombres
 * repetidos, valores ordenados), sin reutilizar el helper de la implementación.
 */

const PATH = '/webhooks/whatsapp';
const URL = TWILIO_BOT_ENV.WHATSAPP_BOT_WEBHOOK_URL;
const TOKEN = TWILIO_BOT_ENV.WHATSAPP_BOT_ACCESS_TOKEN;
const ACCOUNT_SID = TWILIO_BOT_ENV.WHATSAPP_BOT_ACCOUNT_ID;
const SENDER = TWILIO_BOT_ENV.WHATSAPP_MOLOTES;

type Pairs = [string, string][];

function qaSign(pairs: Pairs, { url = URL, token = TOKEN }: { url?: string; token?: string } = {}): string {
  const sorted = [...pairs].sort(([an, av], [bn, bv]) => (an === bn ? (av < bv ? -1 : av > bv ? 1 : 0) : an < bn ? -1 : 1));
  const data = sorted.reduce((acc, [name, value]) => acc + name + value, url);
  return createHmac('sha1', token).update(data, 'utf8').digest('base64');
}

const toPairs = (params: Record<string, string>): Pairs => Object.entries(params);
const encode = (pairs: Pairs): string => new URLSearchParams(pairs).toString();

async function start({ env = {}, fetch }: { env?: Record<string, string>; fetch?: FetchLike } = {}) {
  const clock = { now: mx(`${WEEK.tue}T10:00`) };
  const logger = makeRecordingLogger();
  const double = createTwilioApiDouble();
  const config = makeConfig({ ...TWILIO_BOT_ENV, ...env });
  if (config.whatsappBot?.provider !== 'twilio') throw new Error('Se esperaba Twilio');
  const products = (await makeProductRepository()).repository;
  let codes = 0;
  const bot = createBotOrchestrator({
    chatBot: createChatBot(config.whatsappBot, { fetch: fetch ?? double.fetch, logger, retryDelayMs: 0 }),
    staff: config.whatsappBot.staff,
    timeZone: config.timezone,
    products,
    logger,
    now: () => clock.now,
    newCode: (prefix) => `${prefix}-Q${String((codes += 1)).padStart(3, '0')}`,
  });
  const server = await listenLocal(createApp({ config, repository: await makeRepository(), products, logger, now: () => clock.now, bot }));

  const postRaw = (body: string, signature: string | null, headers: Record<string, string> = {}) => {
    let request = server.request().post(PATH).set('Content-Type', 'application/x-www-form-urlencoded');
    for (const [name, value] of Object.entries(headers)) request = request.set(name, value);
    return (signature === null ? request : request.set('X-Twilio-Signature', signature)).send(body);
  };
  const post = (pairs: Pairs, headers: Record<string, string> = {}) => postRaw(encode(pairs), qaSign(pairs), headers);

  async function write(text: string, from = CUSTOMER): Promise<string> {
    clock.now = new Date(clock.now.getTime() + 3000);
    const before = double.textsTo(from).length;
    expect((await post(toPairs(twilioInbound('text', { text, from })))).status).toBe(200);
    await bot.drain();
    return double.textsTo(from).slice(before).join('\n');
  }

  async function order(): Promise<void> {
    // REQ-F-013 (RF-5, RF-6): los datos en un solo mensaje y la nota, si la hay, en el resumen.
    for (const text of ['Hola', '2', '1', '2', '2', '1', '9', '1', '4', 'Ana Pérez, domicilio, Calle Secreta 742, Colonia Oculta', 'Tocar el timbre azul']) await write(text);
  }

  return { bot, clock, double, logger, server, post, postRaw, write, order };
}

describe('QA firma de Twilio (S-1 a S-7, L-1 a L-3)', () => {
  it('S-7: vector oficial de la documentación de Twilio', () => {
    const params = new URLSearchParams({ CallSid: 'CA1234567890ABCDE', Caller: '+12349013030', Digits: '1234', From: '+12349013030', To: '+18005551212' });
    const url = 'https://mycompany.com/myapp.php?foo=1&bar=2';
    expect(qaSign([...params.entries()], { url, token: '12345' })).toBe('0/KCTR6DLpKmkAf8muzZqo1nDgQ=');
    expect(twilioSignature(url, params, '12345')).toBe('0/KCTR6DLpKmkAf8muzZqo1nDgQ=');
  });

  it('S-5: un parámetro alterado después de firmar -> 403 sin procesar', async () => {
    const { bot, double, post, postRaw } = await start();
    const pairs = toPairs(twilioInbound('text', { text: 'Hola' }));
    const signature = qaSign(pairs);
    const altered = pairs.map(([n, v]): [string, string] => (n === 'Body' ? [n, 'Cancelar'] : [n, v]));
    expect((await postRaw(encode(altered), signature)).status).toBe(403);
    const extra: Pairs = [...pairs, ['Extra', '1']];
    expect((await postRaw(encode(extra), signature)).status).toBe(403);
    await bot.drain();
    expect(double.requests).toHaveLength(0);
    // Control: la misma entrega bien firmada sí se procesa.
    expect((await post(pairs)).status).toBe(200);
  });

  it('S-6 / L-3: Host y X-Forwarded-* distintos no cambian la URL de la firma', async () => {
    const { bot, double, post, postRaw } = await start();
    const pairs = toPairs(twilioInbound('text', { text: 'Hola' }));
    const headers = { Host: 'otro-host.example.org', 'X-Forwarded-Host': 'otro-host.example.org', 'X-Forwarded-Proto': 'http', 'X-Original-URL': '/otra' };
    expect((await post(pairs, headers)).status).toBe(200);
    // Firmada con la URL "reconstruida" desde esas cabeceras: rechazada.
    const reconstructed = toPairs(twilioInbound('text', { text: 'Hola' }));
    expect((await postRaw(encode(reconstructed), qaSign(reconstructed, { url: 'http://otro-host.example.org/webhooks/whatsapp' }), headers)).status).toBe(403);
    await bot.drain();
    expect(double.textsTo(CUSTOMER)).toHaveLength(1);
  });

  it('L-1: emojis, acentos, + y & en Body: firma válida y el texto llega íntegro a la conversación', async () => {
    const { write, double } = await start();
    await write('Hola');
    // Nombre con emojis, acentos, + y &: aparece tal cual en el resumen al personal.
    for (const text of ['2', '1', '2', '2', '1', '9', '1', '4']) await write(text);
    // REQ-F-013, RF-5 y RF-6: los datos en un mensaje y la nota en el resumen.
    await write('José Ñúñez 🌮 +1 & Cía, recoger');
    await write('Sin cebolla ¿ok? 🌶️');
    const tail = (await write('1')) + double.textsTo(STAFF.molotes).join('\n');
    expect(double.sent.some((m) => m.text?.includes('José Ñúñez 🌮 +1 & Cía'))).toBe(true);
    expect(tail.length).toBeGreaterThan(0);
  });

  it('L-2: parámetros repetidos: la firma (valores ordenados) es válida y un Body repetido se trata como "no es texto"', async () => {
    const { bot, double, logger, post } = await start();
    const pairs: Pairs = [...toPairs(twilioInbound('text', { text: 'Hola' })), ['Body', 'Adios']];
    expect((await post(pairs)).status).toBe(200);
    await bot.drain();
    // La firma con valores repetidos se acepta; un Body repetido (que Twilio no envía) no se toma
    // como texto: se trata como "no es texto" (D-15), sin usar ninguno de los dos valores.
    expect(logger.lines.map((l) => l.msg)).not.toContain('bot_webhook_signature_invalid');
    const texts = double.textsTo(CUSTOMER).join('\n');
    expect(texts).toContain('Por ahora solo entiendo mensajes de texto.');
  });

  it('S-1/S-2: firma vacía o con espacios y Base64 de otra longitud -> 401, sin valores en el log', async () => {
    const { logger, postRaw } = await start();
    const body = encode(toPairs(twilioInbound('text')));
    for (const signature of ['', '   ', 'AAAA', `${'A'.repeat(43)}=`]) {
      const res = await postRaw(body, signature);
      expect(res.status).toBe(401);
    }
    for (const line of logger.lines.filter((l) => l.msg === 'bot_webhook_signature_invalid')) {
      expect(Object.keys(line).sort()).toEqual(['level', 'msg', 'reason']);
    }
  });
});

describe('QA entregas de Twilio (N-1, N-2, F-4, L-4, L-5)', () => {
  it('N-1: campos mal formados y cuerpo JSON firmados -> 200, ignorados y sin envío', async () => {
    const { bot, double, logger, post, postRaw } = await start();
    const base = twilioInbound('text', { text: 'Hola' });
    const variants: Record<string, string>[] = [
      { ...base, MessageSid: 'XX123' },
      { ...base, MessageSid: newMessageSid(), From: '+5215500001234' },
      { ...base, MessageSid: newMessageSid(), NumMedia: '11' },
      { ...base, MessageSid: newMessageSid(), NumMedia: 'x' },
    ];
    for (const params of variants) expect((await post(toPairs(params))).status).toBe(200);
    const json = JSON.stringify(base);
    const jsonPairs = [...new URLSearchParams(json).entries()];
    expect((await postRaw(json, qaSign(jsonPairs))).status).toBe(200);
    await bot.drain();
    expect(double.requests).toHaveLength(0);
    expect(logger.lines.filter((l) => l.msg === 'bot_webhook_ignored')).toHaveLength(5);
  });

  it('F-4: el mismo MessageSid enviado en paralelo produce una sola respuesta', async () => {
    const { bot, double, post } = await start();
    const pairs = toPairs(twilioInbound('text', { text: 'Hola' }));
    const responses = await Promise.all([post(pairs), post(pairs), post(pairs)]);
    expect(responses.map((r) => r.status)).toEqual([200, 200, 200]);
    await bot.drain();
    expect(double.textsTo(CUSTOMER)).toHaveLength(1);
  });

  it('L-4: se responde al mismo identificador recibido (521… y 52…)', async () => {
    const { bot, double, post } = await start();
    for (const from of ['5215500009999', '525500008888']) expect((await post(toPairs(twilioInbound('text', { from })))).status).toBe(200);
    await bot.drain();
    expect(double.sent.map((m) => m.rawTo).sort()).toEqual(['whatsapp:+5215500009999', 'whatsapp:+525500008888']);
  });

  it('L-5 (D-14): mensajes de Twilio sin timestamp no se descartan como antiguos y se procesan en orden aunque lleguen seguidos', async () => {
    const { bot, double, logger, post } = await start();
    // Tres mensajes en el mismo segundo: saludo, negocio, categoría.
    for (const text of ['Hola', '2', '1']) expect((await post(toPairs(twilioInbound('text', { text })))).status).toBe(200);
    await bot.drain();
    expect(logger.lines.map((l) => l.msg)).not.toContain('bot_message_stale');
    expect(logger.lines.map((l) => l.msg)).not.toContain('bot_message_out_of_order');
    expect(double.textsTo(CUSTOMER).length).toBeGreaterThanOrEqual(3);
  });
});

describe('QA StatusCallback (N-5, CA-7b)', () => {
  it('delivered/sent/read del aviso no son fallo; undelivered sí; failed de una respuesta al cliente o de un id desconocido no registra fallo del personal', async () => {
    const { bot, double, logger, post, order, write } = await start();
    await order();
    await write('1');
    const staffId = double.sent.find((m) => m.to === STAFF.molotes)?.messageId ?? '';
    const customerId = double.sent.find((m) => m.to === CUSTOMER)?.messageId ?? '';
    expect(staffId).not.toBe('');
    const delivered = twilioStatus('status-delivered', staffId);
    for (const status of ['sent', 'delivered', 'read']) expect((await post(toPairs({ ...delivered, MessageStatus: status, SmsStatus: status }))).status).toBe(200);
    await bot.drain();
    expect(logger.lines.map((l) => l.msg)).not.toContain('bot_staff_delivery_failed');

    expect((await post(toPairs(twilioStatus('status-failed', customerId)))).status).toBe(200);
    expect((await post(toPairs(twilioStatus('status-failed', `SM${'9'.repeat(32)}`)))).status).toBe(200);
    await bot.drain();
    expect(logger.lines.map((l) => l.msg)).not.toContain('bot_staff_delivery_failed');

    expect((await post(toPairs(twilioStatus('status-undelivered', staffId)))).status).toBe(200);
    await bot.drain();
    const failures = logger.lines.filter((l) => l.msg === 'bot_staff_delivery_failed');
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({ business: 'molotes' });
    expect(typeof failures[0]?.errorCode).toBe('number');
    expect(JSON.stringify(failures)).not.toMatch(/\d{10,}/);
  });
});

describe('QA aviso al personal en partes (L-6, DT-9)', () => {
  const longNotice = () => {
    const lines = Array.from({ length: 40 }, (_, i) => `${i + 1} × Producto de prueba con un nombre bastante largo número ${i + 1} a $10 = $10`);
    return { params: {}, text: ['*Nuevo pedido M-X* - Moloteando', ...lines, 'Total: $400'].join('\n') };
  };

  it('más de 1600 caracteres: partes ordenadas de 1600 o menos, sin perder ni partir líneas', async () => {
    const double = createTwilioApiDouble();
    const chatBot = createChatBot(twilioConfig(), { fetch: double.fetch, logger: makeRecordingLogger(), retryDelayMs: 0 });
    const notice = longNotice();
    expect(notice.text.length).toBeGreaterThan(1600);
    const result = await chatBot.sendStaffNotice(STAFF.molotes, notice);
    expect(result.ok).toBe(true);
    expect(double.sent.length).toBeGreaterThan(1);
    for (const part of double.sent) expect((part.text ?? '').length).toBeLessThanOrEqual(1600);
    expect(double.sent.map((p) => p.text).join('\n')).toBe(notice.text);
    if (result.ok) expect(result.messageIds).toEqual(double.sent.map((p) => p.messageId));
  });

  it('si falla una parte, el aviso falla y ninguna parte aceptada se reenvía', async () => {
    const double = createTwilioApiDouble();
    let calls = 0;
    const fetch: FetchLike = async (url, init) => {
      calls += 1;
      if (calls === 2) return Response.json({ code: 63016, message: 'x' }, { status: 400 });
      return double.fetch(url, init);
    };
    const chatBot = createChatBot(twilioConfig(), { fetch, logger: makeRecordingLogger(), retryDelayMs: 0 });
    const result = await chatBot.sendStaffNotice(STAFF.molotes, longNotice());
    expect(result.ok).toBe(false);
    expect(calls).toBe(2);
    expect(double.sent).toHaveLength(1);
  });

  it('con 503 en la segunda parte reintenta solo esa parte, una vez', async () => {
    const double = createTwilioApiDouble();
    let calls = 0;
    const fetch: FetchLike = async (url, init) => {
      calls += 1;
      if (calls === 2) return Response.json({ code: 20503, message: 'x' }, { status: 503 });
      return double.fetch(url, init);
    };
    const chatBot = createChatBot(twilioConfig(), { fetch, logger: makeRecordingLogger(), retryDelayMs: 0 });
    const notice = longNotice();
    const result = await chatBot.sendStaffNotice(STAFF.molotes, notice);
    expect(result.ok).toBe(true);
    expect(double.sent.map((p) => p.text).join('\n')).toBe(notice.text);
    expect(new Set(double.sent.map((p) => p.text)).size).toBe(double.sent.length);
  });
});

describe('QA privacidad del log (P-2) y respuesta inmediata', () => {
  it('flujo con errores de la API, timeout y red: el log no tiene secretos, números ni datos del cliente', async () => {
    const { double, logger, order, write, post, postRaw } = await start();
    await order();
    double.failNext(twilioError(500, 20500));
    await write('1');
    await order();
    double.failNext(twilioTimeout());
    await write('1');
    double.failNext(twilioNetworkError('ECONNRESET'), twilioNetworkError('ECONNRESET'));
    await write('Hola');
    double.failNext(twilioError(429, 20429), twilioError(401, 20003));
    await write('menu');
    await post(toPairs(twilioStatus('status-failed', double.sent.find((m) => m.to === STAFF.molotes)?.messageId ?? newMessageSid())));
    await postRaw(encode(toPairs(twilioInbound('text'))), `${'B'.repeat(27)}=`);

    const logged = JSON.stringify(logger.lines);
    for (const value of [TOKEN, ACCOUNT_SID, ACCOUNT_SID.slice(2), 'whatsapp:+', 'api.twilio.com', 'datos sensibles', 'Ana Pérez', 'Calle Secreta', 'Colonia Oculta', 'timbre azul', CUSTOMER, STAFF.molotes, SENDER, URL, 'Basic ']) {
      expect(logged, value).not.toContain(value);
    }
    expect(logger.lines.some((l) => l.msg === 'bot_api_error')).toBe(true);
  });

  it('el webhook responde 200 sin esperar al envío (proveedor lento)', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const double = createTwilioApiDouble();
    const slow: FetchLike = async (url, init) => {
      await gate;
      return double.fetch(url, init);
    };
    const { bot, post } = await start({ fetch: slow });
    const res = await post(toPairs(twilioInbound('text', { text: 'Hola' })));
    expect(res.status).toBe(200);
    expect(double.sent).toHaveLength(0);
    release();
    await bot.drain();
    expect(double.sent).toHaveLength(1);
  });
});

describe('QA intercambiabilidad sin bot inyectado (I-5, CA-20) y 503 con Meta (N-4)', () => {
  it('createApp con el mismo código usa el proveedor del entorno y responde por él', async () => {
    const at = mx(`${WEEK.tue}T10:00`);
    for (const provider of ['meta', 'twilio'] as const) {
      const env = provider === 'meta' ? BOT_ENV : TWILIO_BOT_ENV;
      const hosts: string[] = [];
      const providerFetch: FetchLike = async (url) => {
        hosts.push(new globalThis.URL(url).host);
        return Response.json({ messages: [{ id: 'wamid.QA' }], sid: `SM${'1'.repeat(32)}` }, { status: 201 });
      };
      const logger = makeRecordingLogger();
      const products = (await makeProductRepository()).repository;
      const config = makeConfig({ ...env });
      const botControl = await makeBotControl(config, { now: () => at });
      const server = await listenLocal(createApp({ config, repository: await makeRepository(), products, logger, now: () => at, providerFetch, botControl }));
      expect(logger.lines.filter((l) => l.msg === 'bot_provider_selected')).toEqual([{ level: 'info', msg: 'bot_provider_selected', provider }]);
      if (provider === 'meta') {
        const body = JSON.stringify(inboundPayload('text', { text: 'Hola', at }));
        const res = await server.request().post(PATH).set('Content-Type', 'application/json').set('X-Hub-Signature-256', sign(body)).send(body);
        expect(res.status).toBe(200);
      } else {
        const pairs = toPairs(twilioInbound('text', { text: 'Hola' }));
        const res = await server.request().post(PATH).set('Content-Type', 'application/x-www-form-urlencoded').set('X-Twilio-Signature', qaSign(pairs)).send(encode(pairs));
        expect(res.status).toBe(200);
      }
      await expect.poll(() => hosts.length).toBeGreaterThan(0);
      expect(new Set(hosts)).toEqual(new Set([provider === 'meta' ? 'graph.facebook.com' : 'api.twilio.com']));
    }
  });

  it('Meta deshabilitado: GET y POST 503', async () => {
    const products = (await makeProductRepository()).repository;
    const server = await listenLocal(createApp({ config: makeConfig({ ...VALID_ENV, WHATSAPP_BOT_PROVIDER: 'meta' }), repository: await makeRepository(), products }));
    expect((await server.request().get(PATH)).status).toBe(503);
    expect((await server.request().post(PATH).send('{}')).status).toBe(503);
  });
});
