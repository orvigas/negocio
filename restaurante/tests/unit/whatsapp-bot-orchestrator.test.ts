import { describe, expect, it } from 'vitest';

import { parseDelivery } from '../../src/services/whatsapp-bot/providers/meta/webhook.ts';
import { graphError, networkError, timeout } from '../support/cloud-api-double.ts';
import { makeProductRepository } from '../support/products.ts';
import { CUSTOMER, STAFF, WEEK, inboundPayload, loadFixture, makeBotHarness, mx, newMessageId, type BotHarness } from '../support/whatsapp.ts';

/**
 * Orquestador del bot (REQ-F-009): idempotencia, orden, mensajes viejos, límite por número,
 * aviso al personal una sola vez y fallos (RF-1.4, RF-1.5, RF-7, D-18, PT-3 A, PT-4 A).
 */

async function readyToConfirm(h: BotHarness): Promise<void> {
  // REQ-F-013 (RF-5, RF-6): los datos en un solo mensaje y la nota, si la hay, en el resumen.
  for (const text of ['Hola', '2', '9', '1', '4', 'Ana Pérez, recoger']) await h.ask(text);
}

describe('entregas repetidas, desordenadas y viejas', () => {
  it('CA-3: la misma entrega dos veces produce una sola respuesta', async () => {
    const h = await makeBotHarness();
    const payload = inboundPayload('text', { text: 'Hola', at: h.clock.now });
    await h.deliver(payload);
    await h.deliver(structuredClone(payload));
    expect(h.double.textsTo(CUSTOMER)).toHaveLength(1);
  });

  it('un mensaje con un timestamp anterior al último procesado se descarta', async () => {
    const h = await makeBotHarness();
    await h.ask('Hola');
    const old = new Date(h.clock.now.getTime() - 60_000);
    await h.deliver(inboundPayload('text', { text: '1', at: old }));
    expect(h.double.textsTo(CUSTOMER)).toHaveLength(1);
    expect(h.logger.lines.map((line) => line.msg)).toContain('bot_message_out_of_order');
  });

  it('dos mensajes en la misma entrega se procesan en orden de timestamp', async () => {
    const h = await makeBotHarness();
    await h.ask('Hola');
    const payload = inboundPayload('text', { text: '9', at: new Date(h.clock.now.getTime() + 2000) });
    const first = inboundPayload('text', { text: '1', at: new Date(h.clock.now.getTime() + 1000) }).entry[0].changes[0].value.messages[0];
    payload.entry[0].changes[0].value.messages.push(first);
    await h.deliver(payload);
    // Primero "1" (menú) y después "9" (Aguas Frescas, pregunta la cantidad).
    expect(h.double.textsTo(CUSTOMER).at(-1)).toContain('¿Cuántas de *Aguas Frescas Naturales del Día*?');
  });

  it('PT-4 A: un mensaje de hace más de 2 h no recibe respuesta y se registra como bot_message_stale', async () => {
    const h = await makeBotHarness({ at: mx(`${WEEK.tue}T12:00`) });
    await h.deliver(inboundPayload('text', { text: 'Hola', at: mx(`${WEEK.tue}T09:59`) }));
    expect(h.double.requests).toHaveLength(0);
    expect(h.logger.lines).toEqual([expect.objectContaining({ msg: 'bot_message_stale', customer: '*********1234' })]);
    await h.deliver(inboundPayload('text', { text: 'Hola', at: mx(`${WEEK.tue}T10:01`) }));
    expect(h.double.textsTo(CUSTOMER)).toHaveLength(1);
  });

  it('límite por número: más de 20 mensajes en un minuto se ignoran y se avisa una vez en el log', async () => {
    const h = await makeBotHarness();
    for (let i = 0; i < 25; i += 1) await h.deliver(inboundPayload('text', { text: 'ayuda', at: h.clock.now }));
    expect(h.double.textsTo(CUSTOMER)).toHaveLength(20);
    expect(h.logger.lines.filter((line) => line.msg === 'bot_rate_limited')).toHaveLength(1);
    h.clock.now = new Date(h.clock.now.getTime() + 60_000);
    expect(await h.ask('ayuda')).toContain('Puedes escribir tu pedido'); // REQ-F-013, RF-4.9
  });
});

describe('limitador por número sin datos personales (RN-5, DEF-001)', () => {
  const OTHER = '5215599990000';

  it('tras un pedido confirmado y otro cancelado, pasados 60 s y con la entrega de otro número, ya no está el primer cliente', async () => {
    const h = await makeBotHarness();
    await readyToConfirm(h);
    await h.ask('1');
    await h.ask('Hola');
    await h.ask('cancelar');
    expect(h.bot.hasConversation(CUSTOMER)).toBe(false);
    // Dentro de su ventana sigue contando (solo con la clave seudónima).
    expect(h.bot.isRateTracked(CUSTOMER)).toBe(true);

    // La ventana dura 60 s desde su inicio: pasados 60 s desde el último mensaje ya venció.
    h.clock.now = new Date(h.clock.now.getTime() + 60_000);
    await h.ask('Hola', { from: OTHER });
    expect(h.bot.isRateTracked(CUSTOMER)).toBe(false);
    expect(h.bot.isRateTracked(OTHER)).toBe(true);
    expect(h.bot.rateTrackedCount).toBe(1);
  });

  it('cualquier entrega (también solo de estados) limpia las ventanas vencidas', async () => {
    const h = await makeBotHarness();
    await h.ask('Hola');
    h.clock.now = new Date(h.clock.now.getTime() + 60_000);
    await h.deliver(loadFixture('status-delivered'));
    expect(h.bot.rateTrackedCount).toBe(0);
  });

  it('el mensaje 21 en 60 s se ignora con un solo aviso y el número vuelve a ser atendido después', async () => {
    const h = await makeBotHarness();
    for (let i = 0; i < 21; i += 1) await h.deliver(inboundPayload('text', { text: 'ayuda', at: h.clock.now }));
    expect(h.double.textsTo(CUSTOMER)).toHaveLength(20);
    expect(h.logger.lines.filter((line) => line.msg === 'bot_rate_limited')).toEqual([expect.objectContaining({ customer: '*********1234' })]);
    h.clock.now = new Date(h.clock.now.getTime() + 60_000);
    await h.deliver(inboundPayload('text', { text: 'ayuda', at: h.clock.now }));
    expect(h.double.textsTo(CUSTOMER)).toHaveLength(21);
  });

  it('con más de 1000 números el limitador sigue acotado', async () => {
    const h = await makeBotHarness();
    const payload = inboundPayload('text', { text: 'Hola', at: h.clock.now });
    const template = payload.entry[0].changes[0].value.messages[0];
    payload.entry[0].changes[0].value.messages = Array.from({ length: 1100 }, (_, i) => ({ ...template, id: newMessageId(), from: String(5215500100000 + i) }));
    h.bot.receive(parseDelivery(payload, h.config.accountId));
    await h.bot.drain();
    expect(h.bot.rateTrackedCount).toBe(1000);
  });

  it('la clave del limitador nunca aparece en los logs ni el número completo', async () => {
    const h = await makeBotHarness();
    for (let i = 0; i < 22; i += 1) await h.deliver(inboundPayload('text', { text: 'ayuda', at: h.clock.now }));
    const logged = JSON.stringify(h.logger.lines);
    expect(logged).not.toContain(CUSTOMER);
    expect(logged).not.toMatch(/[A-Za-z0-9_-]{43}/);
  });
});

describe('aviso al personal (RF-7, RN-4)', () => {
  it('CA-14: un solo mensaje de plantilla al personal del negocio, con todos los datos', async () => {
    const h = await makeBotHarness();
    await readyToConfirm(h);
    expect(await h.ask('1')).toContain('¡Listo! Tu pedido *M-T001* fue enviado a Moloteando');
    expect(h.double.templatesTo(STAFF.molotes)).toHaveLength(1);
    expect(h.double.templatesTo(STAFF.molotes)[0]?.template).toEqual({
      name: 'nuevo_pedido',
      language: 'es_MX',
      params: {
        codigo: 'M-T001',
        negocio: 'Moloteando',
        horario: 'En horario',
        cliente: 'Ana Pérez',
        whatsapp: `+${CUSTOMER}`,
        entrega: 'Recoger en sucursal',
        lineas: '1 × Aguas Frescas Naturales del Día a $35 = $35',
        total: '$35',
        notas: 'Sin notas',
      },
    });
    expect(h.double.sent.filter((message) => message.to !== CUSTOMER)).toHaveLength(1);
  });

  it('un "1" repetido tras confirmar no envía otro aviso (la conversación ya se cerró)', async () => {
    const h = await makeBotHarness();
    await readyToConfirm(h);
    await h.ask('1');
    await h.ask('1');
    expect(h.double.templatesTo(STAFF.molotes)).toHaveLength(1);
  });

  it('reintenta una vez si Meta no aceptó el aviso (5xx) y lo envía una sola vez', async () => {
    const h = await makeBotHarness();
    await readyToConfirm(h);
    h.double.failNext(graphError(503, 2));
    expect(await h.ask('1')).toContain('fue enviado');
    expect(h.double.templatesTo(STAFF.molotes)).toHaveLength(1);
  });

  it.each([
    ['timeout (ambiguo: sin reintento)', [timeout()], 1],
    ['dos 5xx seguidos', [graphError(500, 1), graphError(500, 1)], 2],
    ['plantilla inexistente', [graphError(400, 132001)], 1],
    ['red caída', [networkError('ENOTFOUND'), networkError('ENOTFOUND')], 2],
  ])('CA-15: si falla (%s), el cliente recibe el contacto directo y el log no tiene datos personales', async (_name, failures, attempts) => {
    const h = await makeBotHarness();
    await readyToConfirm(h);
    h.double.failNext(...failures);
    const reply = await h.ask('1');
    expect(reply).toContain('No pude enviar tu pedido *M-T001* al personal de Moloteando');
    expect(reply).toContain(`https://wa.me/${STAFF.molotes}`);
    expect(h.double.requests.filter((request) => request.to === STAFF.molotes)).toHaveLength(attempts);
    expect(h.bot.hasConversation(CUSTOMER)).toBe(false);
    const failed = h.logger.lines.find((line) => line.msg === 'bot_staff_send_failed');
    expect(failed).toMatchObject({ level: 'error', business: 'molotes', customer: '*********1234' });
    const logged = JSON.stringify(h.logger.lines);
    for (const value of ['Ana Pérez', CUSTOMER, STAFF.molotes, 'M-T001', h.config.accessToken]) expect(logged).not.toContain(value);
  });

  it('PT-3 A: un estado "failed" posterior del aviso al personal se registra sin teléfonos y no avisa al cliente', async () => {
    const h = await makeBotHarness();
    await readyToConfirm(h);
    await h.ask('1');
    const staffMessage = h.double.templatesTo(STAFF.molotes)[0];
    const status = loadFixture('status-failed');
    status.entry[0].changes[0].value.statuses[0].id = staffMessage?.messageId;
    const sentBefore = h.double.sent.length;
    await h.deliver(status);
    expect(h.double.sent).toHaveLength(sentBefore);
    expect(h.logger.lines.at(-1)).toEqual({ level: 'error', msg: 'bot_staff_delivery_failed', business: 'molotes', errorCode: 132001 });
  });

  it('RF-1.5: los demás estados se ignoran', async () => {
    const h = await makeBotHarness();
    await h.deliver(loadFixture('status-delivered'));
    await h.deliver(loadFixture('status-failed'));
    expect(h.double.requests).toHaveLength(0);
    expect(h.logger.lines).toEqual([]);
  });

  it('un fallo al responder al cliente se registra y la conversación sigue', async () => {
    const h = await makeBotHarness();
    h.double.failNext(graphError(400, 131047));
    await h.deliver(inboundPayload('text', { id: newMessageId(), text: 'Hola', at: h.clock.now }));
    expect(h.logger.lines.map((line) => line.msg)).toEqual(['bot_conversation_started', 'bot_api_error']);
    expect(h.bot.hasConversation(CUSTOMER)).toBe(true);
    expect(await h.ask('1')).toContain('Menú de Moloteando');
  });
});

describe('catálogo con la base de datos caída (RF-5.2, CA-20)', () => {
  it('muestra los últimos productos válidos de la caché (nunca consulta la base de datos)', async () => {
    const { repository, store } = await makeProductRepository();
    const h = await makeBotHarness({ products: repository });
    store.failNext(10);
    await h.ask('Hola');
    expect(await h.ask('1')).toContain('Molotes de Queso Oaxaca');
  });
});
