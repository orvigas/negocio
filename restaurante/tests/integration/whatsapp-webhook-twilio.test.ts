import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.ts';
import { createBotOrchestrator } from '../../src/services/whatsapp-bot/orchestrator.ts';
import { createChatBot } from '../../src/services/whatsapp-bot/providers/select.ts';
import { EMPTY_TWIML } from '../../src/services/whatsapp-bot/providers/twilio/webhook.ts';
import { TWILIO_BOT_ENV, VALID_ENV, makeConfig, makeRecordingLogger, makeRepository } from '../helpers.ts';
import { listenLocal } from '../support/http.ts';
import { makeProductRepository } from '../support/products.ts';
import { TWILIO_AUTH_TOKEN, TWILIO_SENDER, TWILIO_WEBHOOK_URL, formBody, signTwilio, twilioInbound, twilioStatus } from '../support/twilio.ts';
import { createTwilioApiDouble, twilioError } from '../support/twilio-api-double.ts';
import { CUSTOMER, STAFF, WEEK, mx } from '../support/whatsapp.ts';

/**
 * Webhook del bot con Twilio por HTTP (REQ-F-012, RF-3 a RF-5; CA-2 a CA-7b, CA-12, CA-13). La
 * app real con el bot real y el doble de la API de Twilio: ninguna llamada a Twilio.
 */

const PATH = '/webhooks/whatsapp';
const ACCOUNT_SID = TWILIO_BOT_ENV.WHATSAPP_BOT_ACCOUNT_ID;

async function start({ env = {} }: { env?: Record<string, string> } = {}) {
  const clock = { now: mx(`${WEEK.tue}T10:00`) };
  const logger = makeRecordingLogger();
  const double = createTwilioApiDouble();
  const config = makeConfig({ ...TWILIO_BOT_ENV, ...env });
  if (config.whatsappBot?.provider !== 'twilio') throw new Error('Se esperaba Twilio');
  const products = (await makeProductRepository()).repository;
  let codes = 0;
  const bot = createBotOrchestrator({
    chatBot: createChatBot(config.whatsappBot, { fetch: double.fetch, logger, retryDelayMs: 0 }),
    staff: config.whatsappBot.staff,
    timeZone: config.timezone,
    products,
    logger,
    now: () => clock.now,
    newCode: (prefix) => `${prefix}-T${String((codes += 1)).padStart(3, '0')}`,
  });
  const server = await listenLocal(createApp({ config, repository: await makeRepository(), products, logger, now: () => clock.now, bot }));

  const post = (params: Record<string, string>, signature: string | null = signTwilio(params)) => {
    const request = server.request().post(PATH).set('Content-Type', 'application/x-www-form-urlencoded');
    return (signature === null ? request : request.set('X-Twilio-Signature', signature)).send(formBody(params));
  };

  async function write(text: string): Promise<string> {
    clock.now = new Date(clock.now.getTime() + 3000);
    const before = double.textsTo(CUSTOMER).length;
    const res = await post(twilioInbound('text', { text }));
    expect(res.status).toBe(200);
    await bot.drain();
    return double.textsTo(CUSTOMER).slice(before).join('\n');
  }

  async function order(): Promise<void> {
    // REQ-F-013 (RF-5, RF-6): los datos en un solo mensaje y la nota, si la hay, en el resumen.
    for (const text of ['Hola', '2', '1', '2', '2', '1', '9', '1', '4', 'Ana Pérez, domicilio, Calle Secreta 742, Colonia Oculta', 'Tocar el timbre azul']) await write(text);
  }

  return { bot, double, logger, server, post, write, order };
}

describe('recepción con Twilio (RF-3.2)', () => {
  it('CA-2: con una firma válida responde 200 con TwiML vacío y el cliente recibe la respuesta desde el número del bot', async () => {
    const { bot, double, post } = await start();
    const res = await post(twilioInbound('text', { text: 'Hola' }));
    expect(res.status).toBe(200);
    expect(res.type).toBe('text/xml');
    expect(res.text).toBe(EMPTY_TWIML);
    await bot.drain();
    expect(double.sent).toHaveLength(1);
    expect(double.sent[0]).toMatchObject({ rawTo: `whatsapp:+${CUSTOMER}`, rawFrom: `whatsapp:+${TWILIO_SENDER}`, statusCallback: TWILIO_WEBHOOK_URL });
    expect(double.sent[0]?.text).toContain('Moloteando');
  });

  it('CA-3: sin firma 401, firma de otra URL 403 y firma mal formada 401; no se procesa y queda en el log', async () => {
    const { bot, double, logger, post } = await start();
    const params = twilioInbound('text', { text: 'Hola' });
    const cases = [
      [null, 401, 'missing'],
      [signTwilio(params, { url: 'https://otro-tunel.example.com/webhooks/whatsapp' }), 403, 'mismatch'],
      [signTwilio(params, { token: '0'.repeat(32) }), 403, 'mismatch'],
      ['abc', 401, 'malformed'],
    ] as const;
    for (const [signature, status, reason] of cases) {
      const res = await post(params, signature);
      expect(res.status).toBe(status);
      expect(res.body.error.code).toBe('INVALID_SIGNATURE');
      expect(logger.lines).toContainEqual(expect.objectContaining({ msg: 'bot_webhook_signature_invalid', reason }));
    }
    await bot.drain();
    expect(double.requests).toHaveLength(0);
    expect(bot.conversationCount).toBe(0);
  });

  it('CA-4: el mismo MessageSid dos veces produce una sola respuesta', async () => {
    const { bot, double, post } = await start();
    const params = twilioInbound('text', { text: 'Hola' });
    expect((await post(params)).status).toBe(200);
    expect((await post(params)).status).toBe(200);
    await bot.drain();
    expect(double.textsTo(CUSTOMER)).toHaveLength(1);
  });

  it('CA-7: un mensaje con adjunto o sin Body recibe el aviso de D-15 (REQ-F-009)', async () => {
    const { bot, double, post } = await start();
    for (const kind of ['image', 'location'] as const) expect((await post(twilioInbound(kind))).status).toBe(200);
    await bot.drain();
    // Una respuesta de D-15 por cada mensaje (la primera, con el saludo).
    expect(double.textsTo(CUSTOMER).filter((text) => text.includes('Por ahora solo entiendo mensajes de texto.'))).toHaveLength(2);
  });

  it('una entrega firmada de otra cuenta o para otro número se acepta con 200 y no se procesa', async () => {
    const { bot, double, logger, post } = await start();
    expect((await post({ ...twilioInbound('text'), AccountSid: 'AC99999999999999999999999999999999' })).status).toBe(200);
    expect((await post({ ...twilioInbound('text'), To: 'whatsapp:+15550000000' })).status).toBe(200);
    await bot.drain();
    expect(double.requests).toHaveLength(0);
    expect(logger.lines.filter((line) => line.msg === 'bot_webhook_ignored')).toHaveLength(2);
  });

  it('DT-5: el GET de verificación de Meta responde 405 con Allow: POST; cuerpo no UTF-8 400; más de 64 KiB 413', async () => {
    const { server } = await start();
    const get = await server.request().get(`${PATH}?hub.mode=subscribe&hub.challenge=1&hub.verify_token=x`);
    expect(get.status).toBe(405);
    expect(get.headers.allow).toBe('POST');
    expect(get.body.error.code).toBe('METHOD_NOT_ALLOWED');
    // Bytes crudos (con el tipo de formulario, el cliente HTTP de las pruebas los reescribiría).
    const invalid = await server.request().post(PATH).set('Content-Type', 'application/octet-stream').set('X-Twilio-Signature', `${'a'.repeat(27)}=`).send(Buffer.from([0x42, 0x3d, 0xff]));
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('INVALID_FORM');
    const big = await server.request().post(PATH).set('Content-Type', 'application/x-www-form-urlencoded').set('X-Twilio-Signature', 'x').send(`Body=${'x'.repeat(64 * 1024)}`);
    expect(big.status).toBe(413);
  });
});

describe('pedido completo con Twilio (CA-5, CA-7b, CA-13)', () => {
  it('CA-5: sin STAFF_TEMPLATE, exactamente un texto libre al personal con los datos del pedido', async () => {
    const { double, write, order } = await start();
    await order();
    expect(await write('1')).toContain('¡Listo! 🙌\nTu pedido *M-T001* fue enviado a Moloteando');
    const staff = double.sent.filter((message) => message.to !== CUSTOMER);
    expect(staff).toHaveLength(1);
    expect(staff[0]).toMatchObject({ to: STAFF.molotes, rawFrom: `whatsapp:+${TWILIO_SENDER}` });
    expect(staff[0]?.text).toBe(
      [
        '🔔 *Nuevo pedido M-T001* - Moloteando',
        'En horario',
        'Cliente: Ana Pérez',
        `WhatsApp: +${CUSTOMER}`,
        'Entrega: A domicilio: Calle Secreta 742, Colonia Oculta',
        '2 × Molotes de Queso Oaxaca (orden de 3) a $130 = $260',
        '1 × Aguas Frescas Naturales del Día a $35 = $35',
        'Total: $295',
        'Notas: Tocar el timbre azul',
      ].join('\n'),
    );
  });

  it('CA-5: con STAFF_TEMPLATE (ContentSid), exactamente un envío con ese ContentSid y las variables del pedido', async () => {
    const contentSid = `HX${'c3'.repeat(16)}`;
    const { double, write, order } = await start({ env: { WHATSAPP_BOT_STAFF_TEMPLATE: contentSid } });
    await order();
    await write('1');
    const staff = double.sent.filter((message) => message.to !== CUSTOMER);
    expect(staff).toHaveLength(1);
    expect(staff[0]).toMatchObject({ to: STAFF.molotes, contentSid });
    expect(staff[0]?.variables).toEqual({
      1: 'M-T001',
      2: 'Moloteando',
      3: 'En horario',
      4: 'Ana Pérez',
      5: `+${CUSTOMER}`,
      6: 'A domicilio: Calle Secreta 742, Colonia Oculta',
      7: '2 × Molotes de Queso Oaxaca (orden de 3) a $130 = $260; 1 × Aguas Frescas Naturales del Día a $35 = $35',
      8: '$295',
      9: 'Tocar el timbre azul',
    });
  });

  it('si el aviso falla (p. ej. personal sin unirse al sandbox), el cliente recibe el contacto directo', async () => {
    const { double, logger, write, order } = await start();
    await order();
    double.failNext(twilioError(400, 63015));
    expect(await write('1')).toContain(`https://wa.me/${STAFF.molotes}`);
    expect(logger.lines).toContainEqual(expect.objectContaining({ msg: 'bot_staff_send_failed', business: 'molotes', errorCode: 63015 }));
  });

  it('CA-7b: un StatusCallback failed del aviso, firmado, se registra como bot_staff_delivery_failed sin teléfonos', async () => {
    const { bot, double, logger, post, write, order } = await start();
    await order();
    await write('1');
    const staffMessage = double.sent.find((message) => message.to === STAFF.molotes);
    const res = await post(twilioStatus('status-failed', staffMessage?.messageId ?? ''));
    expect(res.status).toBe(200);
    await bot.drain();
    expect(logger.lines).toContainEqual({ level: 'error', msg: 'bot_staff_delivery_failed', business: 'molotes', errorCode: 63016 });
  });

  it('CA-13: el log de un flujo con Twilio no tiene el Auth Token, el Account SID, textos, nombres, direcciones ni números', async () => {
    const { double, logger, write, order, post } = await start();
    await order();
    await write('1');
    await order();
    double.failNext(twilioError(400, 63016));
    await write('1');
    await write('Hola');
    await write('cancelar');
    await post(twilioInbound('text'), 'firma-invalida-SECRETA');

    const logged = JSON.stringify(logger.lines);
    for (const value of [TWILIO_AUTH_TOKEN, ACCOUNT_SID, 'Ana Pérez', 'Calle Secreta', 'Colonia Oculta', 'timbre azul', CUSTOMER, STAFF.molotes, TWILIO_SENDER, 'M-T001', 'SECRETA']) {
      expect(logged).not.toContain(value);
    }
    expect(logger.lines.filter((line) => line.msg === 'bot_provider_selected')).toEqual([{ level: 'info', msg: 'bot_provider_selected', provider: 'twilio' }]);
  });
});

describe('Twilio deshabilitado (CA-12)', () => {
  it('con WHATSAPP_BOT_PROVIDER=twilio y sin datos de cuenta, el webhook responde 503 y las landings 200', async () => {
    const env = { ...VALID_ENV, WHATSAPP_BOT_PROVIDER: 'twilio', WHATSAPP_BOT_ACCOUNT_ID: '', WHATSAPP_BOT_ACCESS_TOKEN: '', WHATSAPP_BOT_WEBHOOK_URL: '' };
    const logger = makeRecordingLogger();
    const products = (await makeProductRepository()).repository;
    const server = await listenLocal(createApp({ config: makeConfig(env), repository: await makeRepository(), products, logger }));
    const params = twilioInbound('text');
    for (const res of [
      await server.request().post(PATH).set('X-Twilio-Signature', signTwilio(params)).send(formBody(params)),
      await server.request().get(PATH),
    ]) {
      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('BOT_DISABLED');
    }
    for (const path of ['/', '/molotes', '/birria']) expect((await server.request().get(path)).status).toBe(200);
    expect(logger.lines.map((line) => line.msg)).not.toContain('bot_provider_selected');
  });
});
