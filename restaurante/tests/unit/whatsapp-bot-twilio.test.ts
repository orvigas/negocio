import { describe, expect, it } from 'vitest';

import { TwilioBot, STAFF_TEMPLATE_VARIABLES, TWILIO_MAX_TEXT_CHARS } from '../../src/services/whatsapp-bot/providers/twilio/twilio-bot.ts';
import { EMPTY_TWIML, checkTwilioSignature, decodeForm, parseTwilioDelivery, twilioSignature } from '../../src/services/whatsapp-bot/providers/twilio/webhook.ts';
import { makeRecordingLogger, TWILIO_BOT_ENV } from '../helpers.ts';
import { ANA, makeProductRepository, VALID_INPUTS } from '../support/products.ts';
import {
  TWILIO_AUTH_TOKEN,
  TWILIO_SENDER,
  TWILIO_WEBHOOK_URL,
  formBody,
  loadTwilioFixture,
  makeTwilioBotHarness,
  signTwilio,
  twilioConfig,
  twilioInbound,
  twilioStatus,
} from '../support/twilio.ts';
import { createTwilioApiDouble, twilioError, twilioNetworkError, twilioTimeout } from '../support/twilio-api-double.ts';
import { CUSTOMER, STAFF, WEEK, mx } from '../support/whatsapp.ts';

/**
 * Bot con Twilio (REQ-F-012): firma, formulario, envío, aviso al personal, partición y hora de
 * recepción (RF-3, RF-4, RF-5; DT-6 a DT-11). Ninguna prueba llama a Twilio.
 */

const ACCOUNT_SID = TWILIO_BOT_ENV.WHATSAPP_BOT_ACCOUNT_ID;
const parse = (params: Record<string, string>) => parseTwilioDelivery(new URLSearchParams(params), { accountSid: ACCOUNT_SID, sender: TWILIO_SENDER });

describe('firma X-Twilio-Signature (RF-3.2)', () => {
  it('reproduce el ejemplo de la documentación de Twilio ("Webhooks security")', () => {
    const params = new URLSearchParams({ CallSid: 'CA1234567890ABCDE', Caller: '+12349013030', Digits: '1234', From: '+12349013030', To: '+18005551212' });
    expect(twilioSignature('https://mycompany.com/myapp.php?foo=1&bar=2', params, '12345')).toBe('0/KCTR6DLpKmkAf8muzZqo1nDgQ=');
  });

  it('coincide con la firma de referencia de las pruebas para una entrega real, con emojis y acentos', () => {
    const params = twilioInbound('text', { text: 'Quiero 2 molotes 🌮 para Muñeco' });
    const header = signTwilio(params);
    expect(checkTwilioSignature(TWILIO_WEBHOOK_URL, new URLSearchParams(params), header, TWILIO_AUTH_TOKEN)).toBe('valid');
    // El formulario codificado (con + y %XX) se decodifica antes de firmar.
    expect(checkTwilioSignature(TWILIO_WEBHOOK_URL, decodeForm(Buffer.from(formBody(params))) as URLSearchParams, header, TWILIO_AUTH_TOKEN)).toBe('valid');
  });

  it('ordena los nombres y los valores repetidos', () => {
    const params = new URLSearchParams([
      ['b', '2'],
      ['a', 'z'],
      ['a', 'y'],
    ]);
    expect(twilioSignature('https://x.test/w', params, 't')).toBe(twilioSignature('https://x.test/w', new URLSearchParams('a=y&a=z&b=2'), 't'));
  });

  it.each([
    [undefined, 'missing'],
    ['', 'missing'],
    ['abc', 'malformed'],
    ['sha256=abc', 'malformed'],
  ])('cabecera %s -> %s', (header, expected) => {
    expect(checkTwilioSignature(TWILIO_WEBHOOK_URL, new URLSearchParams(twilioInbound('text')), header, TWILIO_AUTH_TOKEN)).toBe(expected);
  });

  it('otra URL (la del túnel o la reconstruida por el proxy), otro token o un parámetro alterado no coinciden', () => {
    const params = twilioInbound('text');
    const valid = new URLSearchParams(params);
    expect(checkTwilioSignature(TWILIO_WEBHOOK_URL, valid, signTwilio(params, { url: 'https://otro-tunel.example.com/webhooks/whatsapp' }), TWILIO_AUTH_TOKEN)).toBe('mismatch');
    expect(checkTwilioSignature(TWILIO_WEBHOOK_URL, valid, signTwilio(params, { url: 'http://127.0.0.1:3000/webhooks/whatsapp' }), TWILIO_AUTH_TOKEN)).toBe('mismatch');
    expect(checkTwilioSignature(TWILIO_WEBHOOK_URL, valid, signTwilio(params, { token: '0'.repeat(32) }), TWILIO_AUTH_TOKEN)).toBe('mismatch');
    expect(checkTwilioSignature(TWILIO_WEBHOOK_URL, new URLSearchParams({ ...params, Body: 'Otro' }), signTwilio(params), TWILIO_AUTH_TOKEN)).toBe('mismatch');
  });

  it('un cuerpo que no es UTF-8 no se interpreta', () => {
    expect(decodeForm(Buffer.from([0x42, 0x6f, 0x64, 0x79, 0x3d, 0xff, 0xfe]))).toBeNull();
  });
});

describe('formulario de Twilio (RF-3.2, D-14, D-15 de REQ-F-009)', () => {
  it('extrae el texto del cliente sin el nombre del perfil ni la hora (Twilio no la envía)', () => {
    const delivery = parse(loadTwilioFixture('text'));
    expect(delivery).toEqual({ messages: [{ id: 'SM11111111111111111111111111111111', from: CUSTOMER, type: 'text', text: 'Hola' }], statuses: [], ignored: 0 });
    expect(JSON.stringify(delivery)).not.toContain('Cliente Ficticio');
  });

  it('un mensaje con adjunto (aunque traiga pie de foto) o sin Body no es texto', () => {
    expect(parse(loadTwilioFixture('image')).messages).toEqual([{ id: 'MM22222222222222222222222222222222', from: CUSTOMER, type: 'media' }]);
    expect(parse(loadTwilioFixture('location')).messages).toEqual([{ id: 'SM44444444444444444444444444444444', from: CUSTOMER, type: 'unsupported' }]);
    const withoutBody = loadTwilioFixture('text');
    delete withoutBody.Body;
    expect(parse(withoutBody).messages[0]).toMatchObject({ type: 'unsupported' });
    expect(parse(withoutBody).messages[0]?.text).toBeUndefined();
  });

  it('conserva emojis y acentos y recorta un texto muy largo a 1000 caracteres', () => {
    expect(parse(twilioInbound('text', { text: 'Birriería El Muñeco 🌮' })).messages[0]?.text).toBe('Birriería El Muñeco 🌮');
    expect(parse(twilioInbound('text', { text: 'x'.repeat(1600) })).messages[0]?.text).toHaveLength(1000);
  });

  it('responde al mismo identificador que recibió (521… o 52…)', () => {
    expect(parse(twilioInbound('text', { from: '525512345678' })).messages[0]?.from).toBe('525512345678');
  });

  it('ignora otra cuenta, otro número del bot y campos mal formados', () => {
    const changes: Record<string, string>[] = [
      { AccountSid: 'AC99999999999999999999999999999999' },
      { To: 'whatsapp:+15550000000' },
      { From: '+5215500001234' },
      { From: 'whatsapp:+52 55' },
      { MessageSid: 'wamid.123' },
      { NumMedia: 'x' },
      { NumMedia: '11' },
    ];
    for (const change of changes) {
      expect(parse({ ...loadTwilioFixture('text'), ...change })).toEqual({ messages: [], statuses: [], ignored: 1 });
    }
  });

  it('lee los StatusCallback con el código de error (nunca otros datos)', () => {
    expect(parse(loadTwilioFixture('status-delivered')).statuses).toEqual([{ id: 'SM55555555555555555555555555555555', status: 'delivered' }]);
    expect(parse(loadTwilioFixture('status-failed')).statuses).toEqual([{ id: 'SM55555555555555555555555555555555', status: 'failed', errorCode: 63016 }]);
    expect(parse(loadTwilioFixture('status-undelivered')).statuses).toEqual([{ id: 'SM55555555555555555555555555555555', status: 'undelivered', errorCode: 63015 }]);
    expect(parse({ ...loadTwilioFixture('status-failed'), From: 'whatsapp:+15550000000' }).ignored).toBe(1);
  });
});

describe('TwilioBot: webhook (RF-3, DT-5, DT-6)', () => {
  const bot = () => new TwilioBot({ config: twilioConfig(), fetch: createTwilioApiDouble().fetch, logger: makeRecordingLogger() });
  const header = (signature: string | undefined) => (name: string) => (name === 'X-Twilio-Signature' ? signature : undefined);

  it('no admite la verificación por GET de Meta (405)', () => {
    expect(bot().verifySubscription()).toEqual({ kind: 'unsupported' });
  });

  it('con la firma correcta acepta la entrega y responde con TwiML vacío', () => {
    const params = twilioInbound('text');
    const outcome = bot().handleDelivery(Buffer.from(formBody(params)), header(signTwilio(params)));
    expect(outcome).toMatchObject({ kind: 'accepted', response: { type: 'text/xml', body: EMPTY_TWIML }, delivery: { messages: [{ text: 'Hola' }] } });
  });

  it('sin firma -> missing (antes de leer el cuerpo); cuerpo no UTF-8 -> 400; firma distinta -> mismatch', () => {
    expect(bot().handleDelivery(Buffer.from([0xff]), header(undefined))).toEqual({ kind: 'signature_invalid', reason: 'missing' });
    expect(bot().handleDelivery(Buffer.from([0xff]), header('x'.repeat(27) + '='))).toMatchObject({ kind: 'bad_request', code: 'INVALID_FORM' });
    const params = twilioInbound('text');
    expect(bot().handleDelivery(Buffer.from(formBody(params)), header(signTwilio({ ...params, Body: 'otro' })))).toEqual({ kind: 'signature_invalid', reason: 'mismatch' });
  });
});

describe('TwilioBot: envío (RF-4, DT-10)', () => {
  const setup = (env = {}) => {
    const double = createTwilioApiDouble();
    const logger = makeRecordingLogger();
    const bot = new TwilioBot({ config: twilioConfig(env), fetch: double.fetch, logger, retryDelayMs: 0 });
    return { double, logger, bot };
  };

  it('envía el texto con Basic Auth, en formulario, desde el número del bot y con StatusCallback', async () => {
    const { double, bot } = setup();
    expect(await bot.sendText(CUSTOMER, 'Hola')).toEqual({ ok: true, messageIds: [double.sent[0]?.messageId] });
    const basic = Buffer.from(`${ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
    expect(double.requests).toEqual([
      {
        url: `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`,
        authorization: `Basic ${basic}`,
        contentType: 'application/x-www-form-urlencoded',
        rawFrom: `whatsapp:+${TWILIO_SENDER}`,
        rawTo: `whatsapp:+${CUSTOMER}`,
        from: TWILIO_SENDER,
        to: CUSTOMER,
        statusCallback: TWILIO_WEBHOOK_URL,
        text: 'Hola',
      },
    ]);
    // El token nunca va en la URL.
    expect(double.requests[0]?.url).not.toContain(TWILIO_AUTH_TOKEN);
  });

  it.each([
    ['HTTP 429', twilioError(429, 20429)],
    ['HTTP 503', twilioError(503, 20503)],
    ['conexión rechazada antes de enviar', twilioNetworkError('ECONNREFUSED')],
  ])('reintenta una sola vez cuando Twilio no aceptó el mensaje: %s', async (_name, failure) => {
    const { double, bot } = setup();
    double.failNext(failure);
    expect(await bot.sendText(CUSTOMER, 'Hola')).toMatchObject({ ok: true });
    expect(double.requests).toHaveLength(2);
    expect(double.sent).toHaveLength(1);
  });

  it.each([
    ['timeout (el mensaje pudo llegar)', twilioTimeout(), 'timeout'],
    ['HTTP 500 (ambiguo)', twilioError(500, 20500), 'http'],
    ['número no unido al sandbox', twilioError(400, 63015), 'http'],
    ['conexión cortada a media respuesta', twilioNetworkError('ECONNRESET'), 'ambiguous'],
  ])('no reintenta con %s y registra el fallo sin datos', async (_name, failure, kind) => {
    const { double, logger, bot } = setup();
    double.failNext(failure);
    expect(await bot.sendText(CUSTOMER, 'Hola Ana')).toMatchObject({ ok: false, kind });
    expect(double.requests).toHaveLength(1);
    expect(logger.lines).toEqual([expect.objectContaining({ level: 'error', msg: 'bot_api_error', failure: kind, retried: false })]);
    const logged = JSON.stringify(logger.lines);
    for (const secret of [TWILIO_AUTH_TOKEN, ACCOUNT_SID, CUSTOMER, 'Hola Ana', 'datos sensibles']) expect(logged).not.toContain(secret);
  });

  const notice = { params: Object.fromEntries(STAFF_TEMPLATE_VARIABLES.map((name) => [name, `valor-${name}`])), text: 'Nuevo pedido M-AB12' };

  it('D-6: con ContentSid, el aviso usa el Content Template con las variables numeradas en orden', async () => {
    const contentSid = `HX${'b2'.repeat(16)}`;
    const { double, bot } = setup({ WHATSAPP_BOT_STAFF_TEMPLATE: contentSid });
    expect(await bot.sendStaffNotice(STAFF.molotes, notice)).toMatchObject({ ok: true });
    expect(double.sent).toHaveLength(1);
    expect(double.sent[0]).toMatchObject({ to: STAFF.molotes, contentSid, statusCallback: TWILIO_WEBHOOK_URL });
    expect(double.sent[0]?.variables).toEqual({
      1: 'valor-codigo',
      2: 'valor-negocio',
      3: 'valor-horario',
      4: 'valor-cliente',
      5: 'valor-whatsapp',
      6: 'valor-entrega',
      7: 'valor-lineas',
      8: 'valor-total',
      9: 'valor-notas',
    });
  });

  it('D-6: sin ContentSid, el aviso va como un solo texto libre', async () => {
    const { double, bot } = setup();
    expect(await bot.sendStaffNotice(STAFF.molotes, notice)).toEqual({ ok: true, messageIds: [double.sent[0]?.messageId] });
    expect(double.textsTo(STAFF.molotes)).toEqual(['Nuevo pedido M-AB12']);
  });

  it('DT-9: un texto libre de más de 1600 caracteres va en partes ordenadas, por líneas', async () => {
    const lines = Array.from({ length: 30 }, (_, i) => `${i + 1} × ${'Producto con nombre largo '.repeat(3)}`);
    const long = { ...notice, text: lines.join('\n') };
    const ok = setup();
    const result = await ok.bot.sendStaffNotice(STAFF.molotes, long);
    const parts = ok.double.textsTo(STAFF.molotes);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((part) => part.length <= TWILIO_MAX_TEXT_CHARS)).toBe(true);
    expect(parts.join('\n')).toBe(long.text);
    expect(result).toEqual({ ok: true, messageIds: ok.double.sent.map((m) => m.messageId) });
  });

  it('DT-9: si la segunda parte falla, el aviso cuenta como fallido y la primera no se reenvía', async () => {
    const lines = Array.from({ length: 30 }, (_, i) => `${i + 1} × ${'Producto con nombre largo '.repeat(3)}`);
    const double = createTwilioApiDouble();
    // La primera parte se acepta y la segunda recibe un 400.
    const originalFetch = double.fetch;
    let calls = 0;
    const fetch: typeof originalFetch = async (url, init) => {
      calls += 1;
      if (calls === 2) double.failNext(twilioError(400, 63016));
      return originalFetch(url, init);
    };
    const flaky = new TwilioBot({ config: twilioConfig(), fetch, logger: makeRecordingLogger(), retryDelayMs: 0 });
    expect(await flaky.sendStaffNotice(STAFF.molotes, { ...notice, text: lines.join('\n') })).toMatchObject({ ok: false, kind: 'http', errorCode: 63016 });
    expect(double.requests).toHaveLength(2);
    expect(double.sent).toHaveLength(1);
  });
});

describe('conversación con Twilio (RF-4.2, D-14)', () => {
  it('CA-6: un menú de más de 1600 caracteres llega en varios mensajes de 1600 o menos, sin cortar un producto', async () => {
    const { repository } = await makeProductRepository();
    const names: string[] = [];
    for (let i = 0; i < 30; i += 1) {
      const name = `Bebida especial de la casa número ${String(i + 1).padStart(2, '0')} con nombre largo`;
      names.push(name);
      // Un producto nuevo se crea no disponible; se publica como lo haría la administración.
      const input = { ...VALID_INPUTS.molotesBebida, name };
      const created = await repository.create('molotes', { input: { category: 'bebida', ...input } }, ANA);
      await repository.update('molotes', created.id, { input: { ...input, available: true }, expectedVersion: created.version }, ANA);
    }
    const h = await makeTwilioBotHarness({ products: repository });
    await h.say('Hola');
    const menu = await h.say('1');
    const all = menu.join('\n');
    expect(all.length).toBeGreaterThan(TWILIO_MAX_TEXT_CHARS);
    expect(menu.length).toBeGreaterThan(1);
    expect(menu.every((part) => part.length <= TWILIO_MAX_TEXT_CHARS)).toBe(true);
    // Cada producto queda completo en una sola parte.
    for (const name of names) expect(menu.filter((part) => part.includes(name))).toHaveLength(1);
  });

  it('D-14: sin hora del proveedor, un mensaje recibido tarde no se descarta como antiguo', async () => {
    const h = await makeTwilioBotHarness({ at: mx(`${WEEK.tue}T12:00`) });
    expect((await h.say('Hola')).join('\n')).toContain('Moloteando');
    expect(h.logger.lines.map((line) => line.msg)).not.toContain('bot_message_stale');
  });

  it('CA-7b: un StatusCallback failed o undelivered del aviso al personal se registra sin teléfonos', async () => {
    for (const kind of ['status-failed', 'status-undelivered'] as const) {
      const h = await makeTwilioBotHarness();
      // REQ-F-013 (RF-5, RF-6): los datos en un solo mensaje y la nota, si la hay, en el resumen.
      for (const text of ['Hola', '2', '9', '1', '4', 'Ana Pérez, recoger, efectivo', '1']) await h.say(text);
      const staffMessage = h.double.sent.find((m) => m.to === STAFF.molotes);
      expect(staffMessage).toBeDefined();
      const sentBefore = h.double.sent.length;
      await h.deliver(twilioStatus(kind, staffMessage?.messageId ?? ''));
      expect(h.double.sent).toHaveLength(sentBefore);
      expect(h.logger.lines.at(-1)).toEqual({ level: 'error', msg: 'bot_staff_delivery_failed', business: 'molotes', errorCode: kind === 'status-failed' ? 63016 : 63015 });
      const logged = JSON.stringify(h.logger.lines);
      for (const value of [CUSTOMER, STAFF.molotes, TWILIO_SENDER]) expect(logged).not.toContain(value);
    }
  });

  it('un StatusCallback delivered, o de otro mensaje, se ignora', async () => {
    const h = await makeTwilioBotHarness();
    await h.deliver(twilioStatus('status-delivered', 'SM55555555555555555555555555555555'));
    await h.deliver(twilioStatus('status-failed', 'SM55555555555555555555555555555555'));
    expect(h.double.requests).toHaveLength(0);
    expect(h.logger.lines).toEqual([]);
  });
});
