import { request as httpRequest } from 'node:http';

import { afterEach, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.ts';
import { BOT_ENV, makeConfig, makeRecordingLogger, makeRepository } from '../helpers.ts';
import { graphError, timeout } from '../support/cloud-api-double.ts';
import { makeTempDir } from '../support/database.ts';
import { listenLocal } from '../support/http.ts';
import { makeProductRepository } from '../support/products.ts';
import { startServer } from '../support/process.ts';
import { CUSTOMER, STAFF, WEEK, inboundPayload, loadFixture, makeBotHarness, mx, sign, type BotHarness } from '../support/whatsapp.ts';

/**
 * Webhook del bot de WhatsApp por HTTP (REQ-F-009, RF-1, RF-2, RF-8, RF-9; CA-1 a CA-4, CA-14,
 * CA-15, CA-21). La app real con el bot real y el doble de la Cloud API: ninguna llamada a Meta.
 */

const PATH = '/webhooks/whatsapp';
const SECRETS = [BOT_ENV.WHATSAPP_BOT_ACCESS_TOKEN, BOT_ENV.WHATSAPP_BOT_APP_SECRET, BOT_ENV.WHATSAPP_BOT_VERIFY_TOKEN];

async function start({ at = mx(`${WEEK.tue}T10:00`) } = {}) {
  const h = await makeBotHarness({ at });
  const app = createApp({
    config: makeConfig(BOT_ENV),
    repository: await makeRepository(),
    products: (await makeProductRepository()).repository,
    logger: h.logger,
    now: () => h.clock.now,
    bot: h.bot,
  });
  const server = await listenLocal(app);

  /** POST firmado del texto del cliente; espera a que el bot termine. Devuelve lo que recibió. */
  async function write(text: string): Promise<string> {
    h.clock.now = new Date(h.clock.now.getTime() + 3000);
    const before = h.double.textsTo(CUSTOMER).length;
    const body = JSON.stringify(inboundPayload('text', { text, at: h.clock.now }));
    const res = await post(body);
    expect(res.status).toBe(200);
    await h.bot.drain();
    return h.double.textsTo(CUSTOMER).slice(before).join('\n');
  }

  const post = (body: string, signature: string | null = sign(body)) => {
    const request = server.request().post(PATH).set('Content-Type', 'application/json');
    return (signature === null ? request : request.set('X-Hub-Signature-256', signature)).send(body);
  };

  return { h, server, post, write };
}

async function order(write: (text: string) => Promise<string>, { delivery = '2' } = {}): Promise<void> {
  for (const text of ['Hola', '2', '1', '2', '2', '1', '9', '1', '4', 'Ana Pérez', delivery]) await write(text);
  if (delivery === '2') await write('Calle Secreta 742, Colonia Oculta');
  await write('Tocar el timbre azul');
}

const logText = (h: BotHarness): string => JSON.stringify(h.logger.lines);

/**
 * POST que declara `length` bytes pero solo envía el principio del cuerpo: la app responde 413
 * por la longitud declarada antes de que el cliente termine. Con supertest y un cuerpo real de
 * más de 3 MiB, el servidor corta la conexión mientras el cliente aún escribe (ECONNRESET).
 */
function postDeclaringLength(baseUrl: string, length: number): Promise<number> {
  return new Promise((resolve, reject) => {
    let answered = false;
    const req = httpRequest(`${baseUrl}${PATH}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': String(length) } }, (res) => {
      answered = true;
      res.resume();
      resolve(res.statusCode ?? 0);
      req.destroy();
    });
    req.on('error', (err) => {
      if (!answered) reject(err);
    });
    req.write('{');
  });
}

describe('verificación de la suscripción (RF-1.1, CA-1)', () => {
  const query = (token: string, mode = 'subscribe', challenge = '1158201444') =>
    `${PATH}?hub.mode=${mode}&hub.challenge=${challenge}&hub.verify_token=${encodeURIComponent(token)}`;

  it('CA-1: con el token correcto devuelve el reto; con uno incorrecto, 403', async () => {
    const { h, server } = await start();
    const ok = await server.request().get(query(BOT_ENV.WHATSAPP_BOT_VERIFY_TOKEN));
    expect(ok.status).toBe(200);
    expect(ok.text).toBe('1158201444');
    expect(ok.type).toBe('text/plain');

    for (const path of [query('token-incorrecto'), query(BOT_ENV.WHATSAPP_BOT_VERIFY_TOKEN, 'unsubscribe'), query(BOT_ENV.WHATSAPP_BOT_VERIFY_TOKEN, 'subscribe', '<script>'), PATH]) {
      const res = await server.request().get(path);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    }
    // El token nunca llega al log (request-logger registra la ruta sin la query).
    expect(logText(h)).not.toContain(BOT_ENV.WHATSAPP_BOT_VERIFY_TOKEN);
  });
});

describe('recepción (RF-1.2 a RF-1.5)', () => {
  it('CA-2: sin firma 401, firma mal formada 401 y firma inválida 403; no se procesa y queda en el log', async () => {
    const { h, post } = await start();
    const body = JSON.stringify(inboundPayload('text', { text: 'Hola', at: h.clock.now }));
    const cases = [
      [null, 401, 'missing'],
      ['sha256=abc', 401, 'malformed'],
      [sign(body, 'otraClaveDistinta0123456'), 403, 'mismatch'],
      [sign(`${body} `), 403, 'mismatch'],
    ] as const;
    for (const [signature, status, reason] of cases) {
      const res = await post(body, signature);
      expect(res.status).toBe(status);
      expect(res.body.error.code).toBe('INVALID_SIGNATURE');
      expect(h.logger.lines).toContainEqual(expect.objectContaining({ msg: 'bot_webhook_signature_invalid', reason }));
    }
    await h.bot.drain();
    expect(h.double.requests).toHaveLength(0);
    expect(h.bot.conversationCount).toBe(0);
  });

  it('CA-3: la misma entrega dos veces (reintento de Meta) produce una sola respuesta', async () => {
    const { h, post } = await start();
    const body = JSON.stringify(inboundPayload('text', { text: 'Hola', at: h.clock.now }));
    expect((await post(body)).status).toBe(200);
    expect((await post(body)).status).toBe(200);
    await h.bot.drain();
    expect(h.double.textsTo(CUSTOMER)).toHaveLength(1);
  });

  it('RF-1.3: responde 200 sin esperar al procesamiento (aunque Meta tarde o falle)', async () => {
    const { h, post } = await start();
    h.double.failNext(timeout());
    const res = await post(JSON.stringify(inboundPayload('text', { text: 'Hola', at: h.clock.now })));
    expect(res.status).toBe(200);
    expect(res.text).toBe('OK');
    await h.bot.drain();
    expect(h.logger.lines).toContainEqual(expect.objectContaining({ msg: 'bot_api_error', failure: 'timeout' }));
  });

  it('RF-1.5: los estados se aceptan con 200 y se ignoran', async () => {
    const { h, post } = await start();
    for (const name of ['status-delivered', 'status-failed'] as const) {
      expect((await post(JSON.stringify(loadFixture(name)))).status).toBe(200);
    }
    await h.bot.drain();
    expect(h.double.requests).toHaveLength(0);
  });

  it('JSON inválido con firma válida -> 400; cuerpo de más de 3 MiB -> 413; otro método -> 405', async () => {
    const { server, post } = await start();
    expect((await post('{no-json')).status).toBe(400);
    expect(await postDeclaringLength(server.url, 3 * 1024 * 1024 + 1)).toBe(413);
    expect((await server.request().put(PATH).send('{}')).status).toBe(405);
  });

  it('un payload firmado de otro número u objeto se acepta con 200 y no se procesa', async () => {
    const { h, post } = await start();
    const other = inboundPayload('text', { text: 'Hola', at: h.clock.now });
    other.entry[0].changes[0].value.metadata.phone_number_id = '999999';
    expect((await post(JSON.stringify(other))).status).toBe(200);
    expect((await post(JSON.stringify({ object: 'page', entry: [] }))).status).toBe(200);
    await h.bot.drain();
    expect(h.double.requests).toHaveLength(0);
  });
});

describe('pedido completo (CA-14, CA-15, CA-21, CA-22)', () => {
  it('CA-14: el personal recibe exactamente un aviso con todos los datos y el cliente su confirmación', async () => {
    const { h, write } = await start();
    await order(write);
    expect(await write('1')).toContain('¡Listo! Tu pedido *M-T001* fue enviado a Moloteando');
    const [staff, ...others] = h.double.sent.filter((message) => message.to !== CUSTOMER);
    expect(others).toEqual([]);
    expect(staff?.to).toBe(STAFF.molotes);
    expect(staff?.template?.params).toEqual({
      codigo: 'M-T001',
      negocio: 'Moloteando',
      horario: 'En horario',
      cliente: 'Ana Pérez',
      whatsapp: `+${CUSTOMER}`,
      entrega: 'A domicilio: Calle Secreta 742, Colonia Oculta',
      lineas: '2 × Molotes de Queso Oaxaca (orden de 3) a $130 = $260; 1 × Aguas Frescas Naturales del Día a $35 = $35',
      total: '$295',
      notas: 'Tocar el timbre azul',
    });
    // CA-22: la conversación confirmada ya no está en memoria.
    expect(h.bot.hasConversation(CUSTOMER)).toBe(false);
  });

  it('CA-15: si el aviso falla, el cliente recibe el contacto directo', async () => {
    const { h, write } = await start();
    await order(write, { delivery: '1' });
    h.double.failNext(graphError(400, 132001));
    const reply = await write('1');
    expect(reply).toContain(`https://wa.me/${STAFF.molotes}`);
    expect(h.logger.lines).toContainEqual(expect.objectContaining({ msg: 'bot_staff_send_failed', business: 'molotes', errorCode: 132001 }));
  });

  it('CA-21: el log de un flujo completo no tiene tokens, secretos, nombres, direcciones, notas ni números completos', async () => {
    const { h, write } = await start();
    await order(write);
    await write('1');
    await order(write);
    h.double.failNext(graphError(500, 2), graphError(500, 2));
    await write('1');
    await write('Hola');
    await write('cancelar');

    const logged = logText(h);
    for (const value of [...SECRETS, 'Ana Pérez', 'Calle Secreta', 'Colonia Oculta', 'timbre azul', CUSTOMER, STAFF.molotes, 'M-T001', 'M-T002']) {
      expect(logged).not.toContain(value);
    }
    const events = new Set(h.logger.lines.map((line) => line.msg));
    for (const event of ['bot_conversation_started', 'bot_order_confirmed', 'bot_order_cancelled', 'bot_staff_send_failed', 'bot_api_error']) {
      expect(events).toContain(event);
    }
    expect(h.logger.lines.find((line) => line.msg === 'bot_order_confirmed')).toMatchObject({ business: 'molotes', customer: '*********1234', lines: 2, totalCents: 29500, offHours: false });
  });
});

describe('bot deshabilitado y fallos de Meta (RF-2.2, RF-8, CA-4)', () => {
  it('CA-4: sin configuración del bot, el webhook responde 503 y las landings 200', async () => {
    const products = (await makeProductRepository()).repository;
    const logger = makeRecordingLogger();
    const server = await listenLocal(createApp({ config: makeConfig(), repository: await makeRepository(), products, logger }));
    const verify = await server.request().get(`${PATH}?hub.mode=subscribe&hub.challenge=1&hub.verify_token=x`);
    expect(verify.status).toBe(503);
    expect(verify.body.error.code).toBe('BOT_DISABLED');
    const body = JSON.stringify(loadFixture('text'));
    expect((await server.request().post(PATH).set('Content-Type', 'application/json').set('X-Hub-Signature-256', sign(body)).send(body)).status).toBe(503);
    for (const path of ['/', '/molotes', '/birria']) expect((await server.request().get(path)).status).toBe(200);
  });

  it('RF-8: con la Cloud API fallando, las landings siguen respondiendo 200', async () => {
    const { h, server, write } = await start();
    h.double.failNext(graphError(500, 2), graphError(500, 2));
    await write('Hola');
    for (const path of ['/', '/molotes', '/birria']) expect((await server.request().get(path)).status).toBe(200);
  });

  it('las respuestas del webhook nunca incluyen secretos', async () => {
    const { server, post } = await start();
    const responses = [
      await server.request().get(`${PATH}?hub.mode=subscribe&hub.challenge=1&hub.verify_token=x`),
      await post('{}', null),
      await post('{}', 'sha256=0000'),
      await post('{no-json'),
    ];
    for (const res of responses) for (const secret of SECRETS) expect(res.text).not.toContain(secret);
  });
});

describe('arranque real con la configuración del bot (CA-4)', () => {
  const cleanups: (() => Promise<void>)[] = [];
  afterEach(async () => {
    while (cleanups.length > 0) await cleanups.pop()?.();
  });

  async function dataDir(): Promise<string> {
    const temp = await makeTempDir();
    cleanups.push(temp.cleanup);
    return temp.dir;
  }

  it('configuración incompleta -> código 1 con la lista de problemas y sin valores', async () => {
    const server = await startServer({ DATA_DIR: await dataDir(), WHATSAPP_BOT_PROVIDER: 'meta', WHATSAPP_BOT_APP_SECRET: BOT_ENV.WHATSAPP_BOT_APP_SECRET, WHATSAPP_BOT_VERIFY_TOKEN: 'corto' });
    cleanups.push(async () => void (await server.stop()));
    expect(server.started).toBe(false);
    expect(await server.exited).toBe(1);
    const { stdout, stderr } = server.output();
    expect(stderr).toContain('Configuración inválida');
    expect(stderr).toContain('WHATSAPP_BOT_ACCESS_TOKEN es obligatoria');
    expect(stderr).toContain('WHATSAPP_BOT_VERIFY_TOKEN no es válida');
    expect(stdout + stderr).not.toContain(BOT_ENV.WHATSAPP_BOT_APP_SECRET);
  }, 30_000);

  it('configuración completa -> arranca con el bot habilitado; la verificación funciona y nada llega a Meta', async () => {
    const server = await startServer({ DATA_DIR: await dataDir(), ...BOT_ENV });
    cleanups.push(async () => void (await server.stop()));
    expect(server.started).toBe(true);
    const verify = await fetch(`${server.url}${PATH}?hub.mode=subscribe&hub.challenge=42&hub.verify_token=${BOT_ENV.WHATSAPP_BOT_VERIFY_TOKEN}`);
    expect(await verify.text()).toBe('42');
    const unsigned = await fetch(`${server.url}${PATH}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    expect(unsigned.status).toBe(401);
    expect((await fetch(`${server.url}/`)).status).toBe(200);
    const { stdout } = server.output();
    expect(stdout).toContain('"whatsappBot":"enabled"');
    for (const secret of SECRETS) expect(stdout).not.toContain(secret);
  }, 30_000);
});
