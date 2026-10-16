import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../../src/app.ts';
import { createBotOrchestrator } from '../../src/services/whatsapp-bot/orchestrator.ts';
import { createChatBot } from '../../src/services/whatsapp-bot/providers/select.ts';
import { makeConfig, makeRecordingLogger, makeRepository } from '../helpers.ts';
import { PROVIDER_DRIVERS, type ProviderDriver, type SignedDelivery } from '../support/chat-bot-drivers.ts';
import { makeBotControl } from '../support/bot-control.ts';
import { listenLocal } from '../support/http.ts';
import { makeProductRepository } from '../support/products.ts';
import { CUSTOMER, STAFF, WEEK, mx } from '../support/whatsapp.ts';

/**
 * Batería de contrato de `ChatBot` (REQ-F-012, CA-19 y CA-20): los mismos recorridos, por HTTP y
 * con la misma app y el mismo orquestador, con `WhatsAppBot` (Meta) y con `TwilioBot` (Twilio).
 * Solo cambian el doble de la API del proveedor, las variables de entorno y la entrega firmada.
 */

const PATH = '/webhooks/whatsapp';

async function start(driver: ProviderDriver) {
  const clock = { now: mx(`${WEEK.tue}T10:00`) };
  const logger = makeRecordingLogger();
  const double = driver.makeDouble();
  const config = makeConfig(driver.env);
  if (!config.whatsappBot) throw new Error('El driver debe habilitar el bot');
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

  async function post(delivery: SignedDelivery): Promise<number> {
    const res = await server.request().post(PATH).set(delivery.headers).send(delivery.body);
    await bot.drain();
    return res.status;
  }

  /** El cliente escribe; devuelve lo que recibió por este mensaje. */
  async function write(text: string): Promise<string> {
    clock.now = new Date(clock.now.getTime() + 3000);
    const before = double.textsTo(CUSTOMER).length;
    expect(await post(driver.text(text, { at: clock.now }))).toBe(200);
    return double.textsTo(CUSTOMER).slice(before).join('\n');
  }

  return { bot, double, logger, clock, post, write };
}

describe.each(PROVIDER_DRIVERS)('contrato de ChatBot con $provider (CA-19)', (driver) => {
  it('pedido completo: un solo aviso al personal del negocio y la confirmación al cliente', async () => {
    const { bot, double, write } = await start(driver);
    // REQ-F-013 (RF-5, RF-6): los datos en un solo mensaje y la nota, si la hay, en el resumen.
    for (const text of ['Hola', '2', '9', '1', '4', 'Ana Pérez, recoger, efectivo']) await write(text);
    expect(await write('1')).toContain('¡Listo! 🙌\nTu pedido *M-T001* fue enviado a Moloteando');
    expect(double.staffNoticesTo(STAFF.molotes)).toEqual([{ codigo: 'M-T001' }]);
    expect(double.staffNoticesTo(STAFF.birria)).toEqual([]);
    expect(bot.hasConversation(CUSTOMER)).toBe(false);
  });

  it('pedido con transferencia (REQ-F-035): pregunta del pago, bloque de transferencia en el resumen y la confirmación', async () => {
    const { double, write } = await start(driver);
    for (const text of ['Hola', '2', '9', '1', '4']) await write(text);
    expect(await write('Ana Pérez, recoger')).toContain('*3.* Transferencia');
    const summary = await write('3');
    expect(summary).toContain('💳 *Pago:* Transferencia');
    expect(summary).toContain('Concepto: *M-T001*');
    expect(summary).toContain(`https://wa.me/${STAFF.molotes}`);
    const confirmed = await write('sí');
    expect(confirmed).toContain('Tu pedido *M-T001* fue enviado a Moloteando');
    expect(confirmed).toContain('Concepto: *M-T001*');
    expect(confirmed.split('\n').at(-1)).toBe(`https://wa.me/${STAFF.molotes}`);
    expect(double.staffNoticesTo(STAFF.molotes)).toEqual([{ codigo: 'M-T001' }]);
  });

  it('cancelación: no avisa al personal y cierra la conversación', async () => {
    const { bot, double, write } = await start(driver);
    for (const text of ['Hola', '2', '9', '1']) await write(text);
    expect(await write('cancelar')).toContain('Pedido cancelado');
    expect(double.staffNoticesTo(STAFF.molotes)).toEqual([]);
    expect(bot.hasConversation(CUSTOMER)).toBe(false);
  });

  it('"persona": el contacto directo del personal del negocio', async () => {
    const { write } = await start(driver);
    await write('Hola');
    expect(await write('persona')).toContain(`https://wa.me/${STAFF.molotes}`);
  });

  it('un mensaje que no es texto recibe el aviso de D-15 (REQ-F-009)', async () => {
    const { double, clock, post } = await start(driver);
    expect(await post(driver.media({ at: clock.now }))).toBe(200);
    expect(double.textsTo(CUSTOMER).join('\n')).toContain('Por ahora solo entiendo mensajes de texto.');
  });

  it('una entrega duplicada produce una sola respuesta', async () => {
    const { double, clock, post } = await start(driver);
    const delivery = driver.text('Hola', { at: clock.now, id: driver.newId() });
    expect(await post(delivery)).toBe(200);
    expect(await post(delivery)).toBe(200);
    expect(double.textsTo(CUSTOMER)).toHaveLength(1);
  });
});

describe.each(PROVIDER_DRIVERS)('selección por configuración con $provider (CA-17, CA-20)', (driver) => {
  it('la app crea el bot del proveedor configurado, sin cambiar código, y lo registra al arrancar', async () => {
    const double = driver.makeDouble();
    const logger = makeRecordingLogger();
    const clock = { now: mx(`${WEEK.tue}T10:00`) };
    const products = (await makeProductRepository()).repository;
    const config = makeConfig(driver.env);
    const botControl = await makeBotControl(config, { now: () => clock.now });
    const app = createApp({ config, repository: await makeRepository(), products, logger, now: () => clock.now, providerFetch: double.fetch, botControl });
    expect(logger.lines).toContainEqual({ level: 'info', msg: 'bot_provider_selected', provider: driver.provider });

    const server = await listenLocal(app);
    const delivery = driver.text('Hola', { at: clock.now });
    expect((await server.request().post(PATH).set(delivery.headers).send(delivery.body)).status).toBe(200);
    await vi.waitFor(() => expect(double.textsTo(CUSTOMER)).toHaveLength(1));
    expect(double.textsTo(CUSTOMER)[0]).toContain('Moloteando');
  });
});
