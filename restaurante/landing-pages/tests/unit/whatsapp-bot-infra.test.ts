import { describe, expect, it } from 'vitest';

import { getLocalMinutes } from '@restaurante/core/shared';

import { BUSINESS_HOURS } from '@restaurante/core/schedule';
import { maskPhone } from '@restaurante/core/bot-control';
import { createCloudApiClient, toCloudApiRecipient } from '../../src/services/whatsapp-bot/providers/meta/cloud-api.ts';
import { staffTemplateParams, type OrderDetails } from '../../src/services/whatsapp-bot/messages.ts';
import { acceptsOrders, describeHours, describeOpening, isOpen, nextOpening } from '../../src/services/whatsapp-bot/schedule.ts';
import { createConversationStore, createExpiringMap, createRateLimiter } from '../../src/services/whatsapp-bot/store.ts';
import { chunkText, codePointLength, normalizeInput, parseNumber } from '../../src/services/whatsapp-bot/text.ts';
import { checkSignature, parseDelivery } from '../../src/services/whatsapp-bot/providers/meta/webhook.ts';
import { WhatsAppBot } from '../../src/services/whatsapp-bot/providers/meta/whatsapp-bot.ts';
import { BOT_ENV, makeRecordingLogger } from '../helpers.ts';
import { createCloudApiDouble, graphError, networkError, timeout } from '../support/cloud-api-double.ts';
import { PHONE_NUMBER_ID, WEEK, botConfig, loadFixture, mx, sign } from '../support/whatsapp.ts';

const TZ = 'America/Mexico_City';

describe('firma del webhook (RF-1.2)', () => {
  const body = Buffer.from(JSON.stringify(loadFixture('text')));
  const secret = BOT_ENV.WHATSAPP_BOT_APP_SECRET;

  it('acepta la firma HMAC-SHA256 del cuerpo crudo con el App Secret', () => {
    expect(checkSignature(body, sign(body.toString()), secret)).toBe('valid');
    expect(checkSignature(body, sign(body.toString()).toUpperCase().replace('SHA256=', 'sha256='), secret)).toBe('valid');
  });

  it.each([
    [undefined, 'missing'],
    ['', 'missing'],
    ['abc', 'malformed'],
    ['sha1=abc', 'malformed'],
    [`sha256=${'a'.repeat(63)}`, 'malformed'],
  ])('cabecera %s -> %s', (header, expected) => {
    expect(checkSignature(body, header, secret)).toBe(expected);
  });

  it('otra clave o un cuerpo alterado no coinciden', () => {
    expect(checkSignature(body, sign(body.toString(), 'otraClaveDistinta0123'), secret)).toBe('mismatch');
    expect(checkSignature(Buffer.concat([body, Buffer.from(' ')]), sign(body.toString()), secret)).toBe('mismatch');
  });
});

describe('lectura de las entregas (RF-1)', () => {
  it('extrae el mensaje de texto de la fixture oficial (sin el nombre del perfil)', () => {
    const delivery = parseDelivery(loadFixture('text'), PHONE_NUMBER_ID);
    expect(delivery).toEqual({
      messages: [{ id: expect.stringMatching(/^wamid\./), from: '5215500001234', timestamp: 1749416383, type: 'text', text: 'Hola' }],
      statuses: [],
      ignored: 0,
    });
    expect(JSON.stringify(delivery)).not.toContain('Cliente Ficticio');
  });

  it.each(['image', 'audio', 'sticker', 'location', 'contacts'] as const)('un mensaje %s llega sin texto', (kind) => {
    const [message] = parseDelivery(loadFixture(kind), PHONE_NUMBER_ID).messages;
    expect(message).toMatchObject({ type: kind });
    expect(message?.text).toBeUndefined();
  });

  it('lee los estados y el código del error (nunca su mensaje)', () => {
    expect(parseDelivery(loadFixture('status-delivered'), PHONE_NUMBER_ID).statuses).toEqual([{ id: expect.any(String), status: 'delivered' }]);
    const failed = parseDelivery(loadFixture('status-failed'), PHONE_NUMBER_ID);
    expect(failed.statuses).toEqual([{ id: expect.any(String), status: 'failed', errorCode: 132001 }]);
    expect(JSON.stringify(failed)).not.toContain('detalle');
  });

  it('ignora otro número, otro objeto, otro campo y mensajes mal formados', () => {
    expect(parseDelivery(loadFixture('text'), '999999').messages).toEqual([]);
    expect(parseDelivery({ ...loadFixture('text'), object: 'page' }, PHONE_NUMBER_ID).ignored).toBe(1);
    const otherField = loadFixture('text');
    otherField.entry[0].changes[0].field = 'account_update';
    expect(parseDelivery(otherField, PHONE_NUMBER_ID).messages).toEqual([]);
    const bad = loadFixture('text');
    Object.assign(bad.entry[0].changes[0].value.messages[0], { from: '+52 55', timestamp: 'ayer' });
    expect(parseDelivery(bad, PHONE_NUMBER_ID)).toMatchObject({ messages: [], ignored: 1 });
    for (const payload of [null, 'texto', [], { object: 'whatsapp_business_account', entry: 'x' }]) {
      expect(parseDelivery(payload, PHONE_NUMBER_ID).messages).toEqual([]);
    }
  });

  it('recorta un texto muy largo a 1000 caracteres', () => {
    const long = loadFixture('text');
    long.entry[0].changes[0].value.messages[0].text.body = 'x'.repeat(5000);
    expect(parseDelivery(long, PHONE_NUMBER_ID).messages[0]?.text).toHaveLength(1000);
  });
});

describe('cliente de la Cloud API (RF-7.3, RF-8)', () => {
  const config = { accessToken: BOT_ENV.WHATSAPP_BOT_ACCESS_TOKEN, accountId: PHONE_NUMBER_ID, graphApiVersion: 'v26.0' };
  const setup = () => {
    const double = createCloudApiDouble();
    const logger = makeRecordingLogger();
    const client = createCloudApiClient({ config, fetch: double.fetch, logger, retryDelayMs: 0 });
    return { double, logger, client };
  };

  it('envía texto a la URL de la versión configurada, con el token solo en la cabecera', async () => {
    const { double, client } = setup();
    expect(await client.sendText('5215500001234', 'Hola')).toEqual({ ok: true, messageId: 'wamid.DOBLE1' });
    expect(double.requests).toEqual([
      { url: 'https://graph.facebook.com/v26.0/106540352242922/messages', authorization: `Bearer ${config.accessToken}`, to: '5215500001234', recipient: '525500001234', type: 'text', text: 'Hola' },
    ]);
  });

  it.each([
    ['celular de México (521 + 10 dígitos) sin el 1', '5215500001234', '525500001234'],
    ['México ya con 52 + 10 dígitos, sin cambios', '525500001234', '525500001234'],
    ['otro país, sin cambios', '14155550123', '14155550123'],
    ['otro país que empieza con 521, sin cambios', '5211234567', '5211234567'],
  ])('envía al destino que acepta Meta: %s', async (_name, to, recipient) => {
    expect(toCloudApiRecipient(to)).toBe(recipient);
    const { double, client } = setup();
    expect(await client.sendText(to, 'Hola')).toMatchObject({ ok: true });
    await client.sendTemplate(to, { name: 'nuevo_pedido', language: 'es_MX', params: { codigo: 'M-AB12' } });
    expect(double.requests.map((request) => request.recipient)).toEqual([recipient, recipient]);
  });

  it('el aviso al personal de WhatsAppBot también se envía sin el 1 tras el 52', async () => {
    const double = createCloudApiDouble();
    const bot = new WhatsAppBot({ config: botConfig(), fetch: double.fetch, logger: makeRecordingLogger(), retryDelayMs: 0 });
    expect(await bot.sendStaffNotice('5215511110001', { params: { codigo: 'M-AB12' }, text: 'Nuevo pedido' })).toMatchObject({ ok: true });
    expect(await bot.sendText('5215500001234', 'Hola')).toMatchObject({ ok: true });
    expect(double.requests.map((request) => request.recipient)).toEqual(['525511110001', '525500001234']);
  });

  it('envía la plantilla con parámetros con nombre', async () => {
    const { double, client } = setup();
    await client.sendTemplate('5215511110001', { name: 'nuevo_pedido', language: 'es_MX', params: { codigo: 'M-AB12', total: '$295' } });
    expect(double.sent[0]?.template).toEqual({ name: 'nuevo_pedido', language: 'es_MX', params: { codigo: 'M-AB12', total: '$295' } });
  });

  it.each([
    ['HTTP 500', graphError(500, 2)],
    ['HTTP 429', graphError(429, 130429)],
    ['límite de envío con HTTP 400', graphError(400, 130429)],
    ['conexión rechazada antes de enviar', networkError('ECONNREFUSED')],
    ['DNS', networkError('ENOTFOUND')],
  ])('reintenta una sola vez cuando Meta no aceptó el mensaje: %s', async (_name, failure) => {
    const { double, client } = setup();
    double.failNext(failure);
    expect(await client.sendText('5215500001234', 'Hola')).toMatchObject({ ok: true });
    expect(double.requests).toHaveLength(2);
    expect(double.sent).toHaveLength(1);

    const again = setup();
    again.double.failNext(failure, failure);
    expect(await again.client.sendText('5215500001234', 'Hola')).toMatchObject({ ok: false });
    expect(again.double.requests).toHaveLength(2);
  });

  it.each([
    ['timeout (el mensaje pudo llegar)', timeout(), 'timeout'],
    ['conexión cortada a media respuesta', networkError('ECONNRESET'), 'ambiguous'],
    ['error 4xx de plantilla', graphError(400, 132001), 'http'],
    ['ventana de 24 h', graphError(400, 131047), 'http'],
  ])('no reintenta con %s y registra el fallo sin datos', async (_name, failure, kind) => {
    const { double, logger, client } = setup();
    double.failNext(failure);
    expect(await client.sendTemplate('5215511110001', { name: 'nuevo_pedido', language: 'es_MX', params: { cliente: 'Ana Pérez' } })).toMatchObject({ ok: false, kind });
    expect(double.requests).toHaveLength(1);
    expect(logger.lines).toEqual([expect.objectContaining({ level: 'error', msg: 'bot_api_error', failure: kind, retried: false })]);
    const logged = JSON.stringify(logger.lines);
    for (const secret of [config.accessToken, 'Ana Pérez', 'datos sensibles', '5215511110001']) expect(logged).not.toContain(secret);
  });
});

describe('horario del bot (RF-6, D-16)', () => {
  it('minutos locales en la zona del negocio, no en la del servidor', () => {
    expect(getLocalMinutes(mx(`${WEEK.tue}T08:30`), TZ)).toBe(510);
    expect(getLocalMinutes(new Date('2026-10-06T14:30:00Z'), TZ)).toBe(510);
  });

  it.each([
    ['molotes', `${WEEK.tue}T08:29`, false],
    ['molotes', `${WEEK.tue}T08:30`, true],
    ['molotes', `${WEEK.fri}T14:59`, true],
    ['molotes', `${WEEK.fri}T15:00`, false],
    ['molotes', `${WEEK.mon}T10:00`, false],
    ['molotes', `${WEEK.sat}T10:00`, false],
    ['birria', `${WEEK.sat}T07:59`, false],
    ['birria', `${WEEK.sat}T08:00`, true],
    ['birria', `${WEEK.sun}T14:59`, true],
    ['birria', `${WEEK.sun}T15:00`, false],
    ['birria', `${WEEK.fri}T10:00`, false],
  ] as const)('isOpen(%s, %s) = %s', (business, local, expected) => {
    expect(isOpen(business, mx(local), TZ)).toBe(expected);
  });

  it.each([
    ['molotes', `${WEEK.mon}T10:00`, 'mañana martes a las 08:30', true],
    ['molotes', `${WEEK.tue}T07:00`, 'hoy a las 08:30', true],
    ['molotes', `${WEEK.wed}T16:00`, 'mañana jueves a las 08:30', true],
    ['molotes', `${WEEK.thu}T23:59`, 'mañana viernes a las 08:30', true],
    ['molotes', `${WEEK.fri}T07:00`, 'hoy a las 08:30', true],
    ['molotes', `${WEEK.fri}T16:00`, 'el martes a las 08:30', false],
    ['molotes', `${WEEK.sat}T10:00`, 'el martes a las 08:30', false],
    ['molotes', `${WEEK.sun}T23:59`, 'el martes a las 08:30', false],
    ['birria', `${WEEK.fri}T16:00`, 'mañana sábado a las 08:00', true],
    ['birria', `${WEEK.sat}T16:00`, 'mañana domingo a las 08:00', true],
    ['birria', `${WEEK.sun}T07:00`, 'hoy a las 08:00', true],
    ['birria', `${WEEK.sun}T16:00`, 'el sábado a las 08:00', false],
    ['birria', `${WEEK.wed}T10:00`, 'el sábado a las 08:00', false],
  ] as const)('%s, %s: abre %s; acepta pedidos: %s', (business, local, opening, accepts) => {
    expect(describeOpening(nextOpening(business, mx(local), TZ))).toBe(opening);
    expect(acceptsOrders(business, mx(local), TZ)).toBe(accepts);
  });

  it('con el negocio abierto acepta pedidos', () => {
    expect(acceptsOrders('molotes', mx(`${WEEK.fri}T14:00`), TZ)).toBe(true);
  });

  it('describe el horario de la fuente única (REQ-F-010)', () => {
    expect(describeHours(BUSINESS_HOURS.molotes)).toBe('martes a viernes de 08:30 a 15:00');
    expect(describeHours(BUSINESS_HOURS.birria)).toBe('sábado y domingo de 08:00 a 15:00');
    expect(describeHours({ days: ['Mon', 'Wed', 'Fri'], opens: '09:00', closes: '10:00' })).toBe('lunes, miércoles y viernes de 09:00 a 10:00');
  });
});

describe('texto, teléfono y plantilla', () => {
  it('normaliza acentos, mayúsculas, signos y emojis (D-10)', () => {
    expect(normalizeInput('  ¡MENÚ!  ')).toBe('menu');
    expect(normalizeInput('Birriería El Muñeco 🌮')).toBe('birrieria el muneco');
  });

  it.each([
    ['2', 2],
    [' 12 ', 12],
    ['#3', 3],
    ['4.', 4],
    ['-1', null],
    ['2.5', null],
    ['abc', null],
    ['', null],
    ['12345', null],
  ])('parseNumber(%s) = %s', (text, expected) => {
    expect(parseNumber(text)).toBe(expected);
  });

  it('cuenta los emojis como un carácter', () => {
    expect(codePointLength('Ana 😀')).toBe(5);
  });

  it('parte los mensajes largos en trozos de hasta 4096 caracteres por líneas', () => {
    const lines = Array.from({ length: 300 }, (_, i) => `${i}. ${'x'.repeat(30)}`);
    const chunks = chunkText(lines.join('\n'));
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 4096)).toBe(true);
    expect(chunks.join('\n')).toBe(lines.join('\n'));
    expect(chunkText('y'.repeat(9000))).toHaveLength(3);
  });

  it('enmascara el número del cliente: solo los 4 últimos dígitos (RF-9.2)', () => {
    expect(maskPhone('5215512345678')).toBe('*********5678');
    expect(maskPhone('447700900123')).toBe('********0123');
  });

  it('los parámetros de la plantilla no llevan saltos de línea, tabuladores ni espacios repetidos, ni van vacíos', () => {
    const order: OrderDetails = {
      code: 'M-AB12',
      business: 'molotes',
      lines: [{ slug: 'a', optionKey: 'unico', productName: 'Agua', optionLabel: '', unitPriceCents: 3500, quantity: 2, detail: '' }],
      name: 'Ana\tPérez',
      delivery: 'delivery',
      address: 'Calle 1\n\nCol.     Centro',
      notes: '',
      payment: 'transfer',
      offHoursOpening: null,
    };
    const params = staffTemplateParams(order, '5215500001234');
    expect(params).toEqual({
      codigo: 'M-AB12',
      negocio: 'Moloteando',
      horario: 'En horario',
      cliente: 'Ana Pérez',
      whatsapp: '+5215500001234',
      entrega: 'A domicilio: Calle 1 Col. Centro · Pago: transferencia',
      lineas: '2 × Agua a $35 = $70',
      total: '$70',
      notas: 'Sin notas',
    });
    for (const value of Object.values(params)) expect(value).not.toMatch(/[\n\t]| {2,}|^$/);
  });
});

describe('estado en memoria acotado', () => {
  it('la conversación caduca tras 2 h sin actividad y el tope descarta la menos reciente', () => {
    const store = createConversationStore({ idleMs: 1000, max: 2 });
    const entry = (lastSeen: number) => ({ conversation: {} as never, lastSeen, lastTimestamp: 0 });
    store.set('a', entry(0));
    store.set('b', entry(10));
    expect(store.set('c', entry(20))).toBe(true);
    expect(store.has('a')).toBe(false);
    expect(store.get('b', 1009)).not.toBeNull();
    expect(store.get('b', 1010)).toBeNull();
    store.sweep(5000);
    expect(store.size).toBe(0);
  });

  it('los ids vistos caducan y tienen tope', () => {
    const seen = createExpiringMap<true>({ ttlMs: 100, max: 2 });
    seen.set('a', true, 0);
    seen.set('b', true, 50);
    seen.set('c', true, 60);
    expect(seen.get('a', 60)).toBeUndefined();
    expect(seen.get('b', 60)).toBe(true);
    expect(seen.get('b', 150)).toBeUndefined();
    expect(seen.size).toBe(1);
  });

  it('el límite por número avisa una vez por ventana', () => {
    const limiter = createRateLimiter({ max: 2, windowMs: 1000, maxTracked: 10, keyOf: (id) => id });
    expect([limiter.hit('x', 0), limiter.hit('x', 1), limiter.hit('x', 2), limiter.hit('x', 3)]).toEqual(['ok', 'ok', 'first-limited', 'limited']);
    expect(limiter.hit('x', 1000)).toBe('ok');
    expect(limiter.hit('y', 3)).toBe('ok');
  });

  it('DEF-001: el limitador guarda solo la clave seudónima y olvida las ventanas vencidas', () => {
    const keys: string[] = [];
    const limiter = createRateLimiter({ max: 2, windowMs: 1000, maxTracked: 10, keyOf: (id) => `h(${id.length})${keys.push(id)}` });
    limiter.hit('5215500001234', 0);
    expect(limiter.size).toBe(1);
    // La clave es la que devuelve keyOf (en el bot, un HMAC), no el número.
    expect(keys).toContain('5215500001234');
    limiter.sweep(999);
    expect(limiter.size).toBe(1);
    limiter.sweep(1000);
    expect(limiter.size).toBe(0);
    // También se limpia en cada hit de otro número.
    limiter.hit('5215500001234', 2000);
    limiter.hit('5215599990000', 3000);
    expect(limiter.size).toBe(1);
  });

  it('DEF-001: con más números que el tope, el limitador sigue acotado', () => {
    const limiter = createRateLimiter({ max: 20, windowMs: 60_000, maxTracked: 1000, keyOf: (id) => id });
    for (let i = 0; i < 1500; i += 1) limiter.hit(String(5215500000000 + i), i);
    expect(limiter.size).toBe(1000);
    expect(limiter.has('5215500000000')).toBe(false);
    expect(limiter.has(String(5215500000000 + 1499))).toBe(true);
  });
});

describe('ninguna prueba llama a Meta ni a Twilio (REQ-F-009 RF-11.1; REQ-F-012 RF-8.1)', () => {
  it('el fetch global de las pruebas rechaza la Graph API', async () => {
    await expect(fetch('https://graph.facebook.com/v26.0/1/messages', { method: 'POST' })).rejects.toThrow(/Una prueba intentó llamar a Meta/);
  });

  it('el fetch global de las pruebas rechaza la API de Twilio', async () => {
    await expect(fetch('https://api.twilio.com/2010-04-01/Accounts/AC1/Messages.json', { method: 'POST' })).rejects.toThrow(/Una prueba intentó llamar a Twilio/);
  });
});
