import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.ts';
import { createBotOrchestrator } from '../../src/services/whatsapp-bot/orchestrator.ts';
import { createChatBot } from '../../src/services/whatsapp-bot/providers/select.ts';
import { makeConfig, makeRecordingLogger, makeRepository } from '../helpers.ts';
import { PROVIDER_DRIVERS, type ProviderDriver } from '../support/chat-bot-drivers.ts';
import { listenLocal } from '../support/http.ts';
import { makeProductRepository } from '../support/products.ts';
import { CUSTOMER, STAFF, WEEK, mx } from '../support/whatsapp.ts';

/**
 * Conteo de mensajes (REQ-F-013, D-11; CA-1 a CA-4) con Meta y con Twilio, por HTTP y con la
 * misma app y el mismo orquestador. Se cuentan los mensajes del cliente (cada `write`) y los
 * textos que recibe el cliente; el aviso al personal se cuenta aparte.
 */

const PATH = '/webhooks/whatsapp';

async function start(driver: ProviderDriver, at: Date) {
  const clock = { now: at };
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
  let sent = 0;

  /** El cliente escribe; devuelve los mensajes que recibió por este mensaje. */
  async function write(text: string): Promise<string[]> {
    clock.now = new Date(clock.now.getTime() + 3000);
    sent += 1;
    const before = double.textsTo(CUSTOMER).length;
    const delivery = driver.text(text, { at: clock.now });
    expect((await server.request().post(PATH).set(delivery.headers).send(delivery.body)).status).toBe(200);
    await bot.drain();
    return double.textsTo(CUSTOMER).slice(before);
  }

  return {
    double,
    logger,
    write,
    get customerMessages() {
      return sent;
    },
    get botMessages() {
      return double.textsTo(CUSTOMER).length;
    },
  };
}

describe.each(PROVIDER_DRIVERS)('conteo de mensajes con $provider (REQ-F-013, D-11)', (driver) => {
  it('CA-1: ejemplo 1 en texto libre desde el mensaje de la landing: 4 del cliente y 4 del bot (≤ 5)', async () => {
    const s = await start(driver, mx(`${WEEK.tue}T10:00`));
    const greeting = await s.write('Hola, quiero hacer un pedido de molotes');
    // El saludo y el menú caben en un mensaje, también con el límite de 1600 de Twilio (R-3).
    expect(greeting).toHaveLength(1);
    expect(greeting[0]?.length).toBeLessThanOrEqual(1600);
    expect(greeting[0]).toContain('Menú de Moloteando');
    expect(greeting[0]).not.toContain('1. 📋 Ver el menú');
    const cart = (await s.write('2 órdenes de queso y una coca')).join('\n');
    expect(cart).toContain('- 2 × Molotes de Queso Oaxaca (orden de 3)');
    expect(cart).toContain('- 1 × Refrescos Familia Coca-Cola\n    _Coca-Cola_');
    expect(cart).toContain('*Total: $295*');
    expect(cart).toContain('Solo se usan para este pedido y no se guardan.');
    const summary = (await s.write('Juan, recoger')).join('\n');
    expect(summary).toContain('*Nombre:* Juan');
    expect(summary).toContain('*Entrega:* Recoger en sucursal');
    expect((await s.write('sí')).join('\n')).toContain('fue enviado a Moloteando');
    expect(s.customerMessages).toBe(4);
    expect(s.botMessages).toBe(4);
    expect(s.double.staffNoticesTo(STAFF.molotes)).toEqual([{ codigo: 'M-T001' }]);
  });

  it.each([
    ['para recoger', 'Ana, recoger', 'Recoger en sucursal'],
    ['a domicilio', 'Ana, domicilio, Calle 5 #10, Col. Centro', 'A domicilio\nCalle 5 #10, Col. Centro'],
  ])('CA-1: Birria con 2 productos sin ambigüedad, %s: ≤ 4 del cliente y ≤ 5 del bot', async (_label, data, delivery) => {
    const s = await start(driver, mx(`${WEEK.sat}T10:00`));
    await s.write('Hola, quiero hacer un pedido de birria');
    expect((await s.write('3 quesabirrias y un consome chico con carne')).join('\n')).toContain('*Total: $275*');
    expect((await s.write(data)).join('\n')).toContain(`*Entrega:* ${delivery}`);
    expect((await s.write('confirmo')).join('\n')).toContain('fue enviado a Birria El Muñeco');
    expect(s.customerMessages).toBeLessThanOrEqual(4);
    expect(s.botMessages).toBeLessThanOrEqual(5);
    expect(s.double.staffNoticesTo(STAFF.birria)).toHaveLength(1);
  });

  it('CA-2: el pedido completo en el primer mensaje: 3 del cliente', async () => {
    const s = await start(driver, mx(`${WEEK.tue}T10:00`));
    const first = (await s.write('Hola, quiero 2 órdenes de queso y una coca')).join('\n');
    expect(first).toContain('Te atiende el asistente de *Moloteando*');
    expect(first).toContain('*Total: $295*');
    await s.write('Juan, recoger');
    expect((await s.write('si')).join('\n')).toContain('fue enviado');
    expect(s.customerMessages).toBe(3);
    expect(s.botMessages).toBe(3);
  });

  it('CA-3: el ejemplo 1 solo con números (datos en un mensaje): 10 del cliente, mismo carrito, total y aviso', async () => {
    const s = await start(driver, mx(`${WEEK.tue}T10:00`));
    for (const text of ['Hola, quiero hacer un pedido de molotes', '1', '2', '2', '1', '10', '1', '4', 'Juan, recoger']) await s.write(text);
    expect((await s.write('1')).join('\n')).toContain('fue enviado a Moloteando');
    expect(s.customerMessages).toBe(10);
    expect(s.double.staffNoticesTo(STAFF.molotes)).toHaveLength(1);
    const notice = JSON.stringify(s.double.requests);
    expect(notice).toContain('2 × Molotes de Queso Oaxaca (orden de 3) a $130 = $260');
    expect(notice).toContain('1 × Refrescos Familia Coca-Cola a $35 = $35');
    expect(notice).toContain('$295');
  });

  it('CA-4: 2 líneas ambiguas y 1 clara: se agrega la clara, una pregunta, y la respuesta agrega las dos (+1 y +1)', async () => {
    const s = await start(driver, mx(`${WEEK.sat}T10:00`));
    await s.write('Hola, quiero hacer un pedido de birria');
    const question = await s.write('consomé, una bebida y 2 tacos');
    expect(question).toHaveLength(1);
    expect(question[0]).toContain('- 2 × Taco de Birria con Tortilla de Mano');
    expect(question[0]).toContain('Necesito que me aclares:');
    const answer = await s.write('2, 1');
    expect(answer).toHaveLength(1);
    expect(answer[0]).toContain('- 1 × Tazón de Consomé Chico (Con Carne)');
    expect(answer[0]).toContain('- 1 × Bebidas Frías del Comal (Aguas Frescas)');
    expect(answer[0]).toContain('*Total: $195*');
    await s.write('Ana, recoger');
    await s.write('sí');
    // 4 del flujo sin ambigüedad + 1 del cliente y 1 del bot por la aclaración.
    expect(s.customerMessages).toBe(5);
    expect(s.botMessages).toBe(5);
    const logged = s.logger.lines.filter((line) => line.msg === 'bot_order_interpreted');
    expect(logged).toContainEqual(expect.objectContaining({ source: 'order', business: 'birria', recognized: 1, ambiguous: 2, unrecognized: 0, rejected: 0 }));
    expect(logged).toContainEqual(expect.objectContaining({ source: 'answer', recognized: 2, ambiguous: 0 }));
  });
});
