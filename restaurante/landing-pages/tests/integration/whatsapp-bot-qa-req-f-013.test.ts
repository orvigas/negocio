import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.ts';
import { createBotOrchestrator } from '../../src/services/whatsapp-bot/orchestrator.ts';
import { createChatBot } from '../../src/services/whatsapp-bot/providers/select.ts';
import { makeConfig, makeRecordingLogger, makeRepository } from '../helpers.ts';
import { PROVIDER_DRIVERS, type ProviderDriver } from '../support/chat-bot-drivers.ts';
import { listenLocal } from '../support/http.ts';
import { makeProductRepository } from '../support/products.ts';
import { CUSTOMER, STAFF, WEEK, mx } from '../support/whatsapp.ts';
import { landingProductsFrom } from '../support/landing-products.ts';

/**
 * QA de REQ-F-013 (ronda 1, senior-qa), con Meta y con Twilio, por HTTP firmado, con la misma app
 * y el mismo orquestador: privacidad del log con textos centinela (CA-15, RF-11), detalle en el
 * aviso al personal (CA-11), aviso único, deduplicación y mensajes que no son texto durante una
 * aclaración (RN-10).
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
  const server = await listenLocal(createApp({ config, repository: await makeRepository(), products, landingProducts: landingProductsFrom(products), logger, now: () => clock.now, bot }));

  async function post(delivery: { body: string; headers: Readonly<Record<string, string>> }): Promise<void> {
    expect((await server.request().post(PATH).set(delivery.headers).send(delivery.body)).status).toBe(200);
    await bot.drain();
  }

  async function write(text: string, id?: string): Promise<string> {
    clock.now = new Date(clock.now.getTime() + 3000);
    const before = double.textsTo(CUSTOMER).length;
    await post(driver.text(text, id === undefined ? { at: clock.now } : { at: clock.now, id }));
    return double.textsTo(CUSTOMER).slice(before).join('\n---\n');
  }

  async function media(): Promise<string> {
    clock.now = new Date(clock.now.getTime() + 3000);
    const before = double.textsTo(CUSTOMER).length;
    await post(driver.media({ at: clock.now }));
    return double.textsTo(CUSTOMER).slice(before).join('\n---\n');
  }

  return { double, logger, write, media };
}

describe.each(PROVIDER_DRIVERS)('QA REQ-F-013 con $provider', (driver) => {
  it('CA-15: tras recorrer aclaración, datos o productos, notas, quitar y confirmar, el log no tiene texto del cliente y sí los contadores', async () => {
    const s = await start(driver, mx(`${WEEK.sat}T12:00`));
    await s.write('Hola, quiero hacer un pedido de birria');
    const first = await s.write('zqxfrag y 2 tacos zqxdetalle, consomé y una coca');
    expect(first).toContain('No entendí: "zqxfrag"');
    expect(first).toContain('    _zqxdetalle_');
    expect(first).toContain('Necesito que me aclares');
    expect(await s.write('chico con carne')).toContain('1 × Tazón de Consomé Chico (Con Carne)');
    expect(await s.write('quita la coca')).toContain('Quitado: Bebidas Frías del Comal (Coca-Cola Vidrio).');
    expect(await s.write('2 de quesabirria, recoger')).toContain('*2.* Son mis datos de entrega');
    expect(await s.write('1')).toContain('2 × Quesabirria con Tortilla de Mano');
    const summary = await s.write('Zqxnombre, domicilio, Calle Zqxcalle 5, Col. Centro, al recibir');
    expect(summary).toContain('*Nombre:* Zqxnombre');
    expect(await s.write('zqxnota sin picante')).toContain('*Notas:* zqxnota sin picante');
    expect(await s.write('sí por favor')).toContain('fue enviado a Birria El Muñeco');
    expect(s.double.staffNoticesTo(STAFF.birria)).toHaveLength(1);
    const notice = JSON.stringify(s.double.requests);
    expect(notice).toContain('2 × Taco de Birria con Tortilla de Mano · zqxdetalle a $40 = $80');
    expect(notice).toContain('zqxnota sin picante');

    const log = JSON.stringify(s.logger.lines).toLowerCase();
    expect(log).not.toContain('zqx');
    expect(log).not.toContain('centro');
    expect(log).not.toContain('picante');
    expect(log).not.toContain(CUSTOMER);
    const interpreted = s.logger.lines.filter((line) => line.msg === 'bot_order_interpreted');
    expect(interpreted).toContainEqual(expect.objectContaining({ source: 'order', business: 'birria', recognized: 2, ambiguous: 1, unrecognized: 1 }));
    for (const line of interpreted) expect(Object.keys(line).sort()).toEqual(['ambiguous', 'business', 'conversationId', 'level', 'msg', 'otherBusiness', 'recognized', 'rejected', 'source', 'unavailable', 'unrecognized']);
  });

  it('una entrega repetida (mismo id) no se procesa dos veces y el aviso al personal sale una sola vez', async () => {
    const s = await start(driver, mx(`${WEEK.tue}T12:00`));
    await s.write('Hola, quiero hacer un pedido de molotes');
    const id = driver.newId();
    const first = await s.write('2 de queso', id);
    expect(first).toContain('2 × Molotes de Queso Oaxaca (pieza)');
    expect(await s.write('2 de queso', id)).toBe('');
    expect(await s.write('Ana, recoger, efectivo')).toContain('*Total: $90*');
    const confirm = driver.newId();
    expect(await s.write('sí', confirm)).toContain('fue enviado');
    await s.write('sí', confirm);
    expect(s.double.staffNoticesTo(STAFF.molotes)).toHaveLength(1);
  });

  it('una imagen durante una aclaración no la rompe (D-15) y la respuesta posterior la resuelve', async () => {
    const s = await start(driver, mx(`${WEEK.sat}T12:00`));
    await s.write('Hola, quiero hacer un pedido de birria');
    expect(await s.write('consomé')).toContain('Necesito que me aclares');
    expect(await s.media()).not.toBe('');
    expect(await s.write('1')).toContain('1 × Tazón de Consomé Grande');
  });
});
