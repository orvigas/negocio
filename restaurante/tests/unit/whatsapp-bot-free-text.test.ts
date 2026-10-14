import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { BUSINESS, type BusinessId } from '../../src/config/businesses.ts';
import type { ProductRepository } from '../../src/repositories/product-repository.ts';
import { toInput } from '../../src/services/product-schema.ts';
import { createBotOrchestrator } from '../../src/services/whatsapp-bot/orchestrator.ts';
import type { OrderInterpreter } from '../../src/services/whatsapp-bot/interpreter/types.ts';
import {
  MAX_TEMPLATE_BODY_CHARS,
  STAFF_TEMPLATE_BODY,
  buildStaffTemplate,
  hydrateStaffTemplate,
  staffNoticeText,
  type CartLine,
  type OrderDetails,
} from '../../src/services/whatsapp-bot/messages.ts';
import { parseDelivery } from '../../src/services/whatsapp-bot/providers/meta/webhook.ts';
import { createChatBot } from '../../src/services/whatsapp-bot/providers/select.ts';
import { makeRecordingLogger } from '../helpers.ts';
import { createCloudApiDouble } from '../support/cloud-api-double.ts';
import { ANA, makeProductRepository } from '../support/products.ts';
import { makeTwilioBotHarness } from '../support/twilio.ts';
import { CUSTOMER, PHONE_NUMBER_ID, STAFF, WEEK, botConfig, inboundPayload, makeBotHarness, mx, type BotHarness } from '../support/whatsapp.ts';

/**
 * Conversación en texto libre (REQ-F-013): CA-7 a CA-15, RF-3.3, RF-7.1, D-2 y DT-1, con el bot
 * real, el doble del proveedor y el reloj controlado. Semana de referencia: lunes 5 a domingo 11 de
 * octubre de 2026 (martes: Molotes; sábado: Birria).
 */

const TUESDAY = mx(`${WEEK.tue}T10:00`);
const SATURDAY = mx(`${WEEK.sat}T10:00`);

async function editProduct(h: BotHarness, business: BusinessId, name: string, change: (input: Record<string, unknown>) => void): Promise<void> {
  const repository = h.products as ProductRepository;
  const product = (await repository.list(business)).find((candidate) => candidate.name === name);
  if (!product) throw new Error(`Falta el producto de la semilla: ${name}`);
  const input = { ...toInput(product), available: product.available };
  change(input);
  await repository.update(business, product.id, { input, expectedVersion: product.version }, ANA);
}

/** Pide en texto libre desde el mensaje de la landing hasta el resumen. */
async function toSummary(h: BotHarness, items: string, data = 'Ana Pérez, recoger'): Promise<string> {
  await h.ask('Hola, quiero hacer un pedido');
  await h.ask(items);
  return h.ask(data);
}

describe('compatibilidad con los números (CA-7)', () => {
  it('en el menú, "5" elige el producto 5 como siempre', async () => {
    const h = await makeBotHarness();
    await h.ask('Hola, quiero hacer un pedido de molotes');
    expect(await h.ask('5')).toContain('¿Cuál opción de *Molotes de Hongos Zetas con Epazote*?');
    await h.ask('1');
    const cart = await h.ask('3');
    expect(cart).toContain('- 3 × Molotes de Hongos Zetas con Epazote (pieza)');
    expect(cart).toContain('1. Agregar otro producto');
    expect(await h.ask('2')).toContain('¿Qué producto quitas?');
    expect(await h.ask('1')).toContain('Quitado: Molotes de Hongos Zetas con Epazote (pieza).');
  });
});

describe('rechazos (CA-8, CA-9)', () => {
  it('"quiero 25 tacos" no agrega nada; "25 tacos y una coca" agrega la coca', async () => {
    const h = await makeBotHarness({ at: SATURDAY });
    await h.ask('Hola');
    const rejected = await h.ask('quiero 25 tacos');
    expect(rejected).toContain('"quiero 25 tacos": la cantidad debe ser un número entero del 1 al 20.');
    expect(await h.ask('carrito')).toContain('Tu carrito está vacío.');
    const partial = await h.ask('25 tacos y una coca');
    expect(partial).toContain('- 1 × Bebidas Frías del Comal (Coca-Cola Vidrio)');
    expect(partial).toContain('"25 tacos": la cantidad debe ser un número entero del 1 al 20.');
  });

  it('a partir de la línea 16 no se agrega nada y se avisa', async () => {
    const h = await makeBotHarness();
    await h.ask('Hola');
    const lines = ['queso', 'tinga', 'chorizo', 'champiñones', 'hongos', 'picadillo', 'chicharrón', 'huitlacoche'];
    const text = [...lines.map((line) => `1 pieza de ${line}`), ...lines.map((line) => `1 orden de ${line}`)].join(', ');
    const reply = await h.ask(text);
    expect(reply).toContain('1 producto(s) más: entiendo hasta 15 por mensaje.');
    const cart = await h.ask('carrito');
    expect(cart).toContain('15. ');
    expect(cart).not.toContain('16. ');
  });

  it('un producto no disponible no se agrega y se avisa', async () => {
    const h = await makeBotHarness({ at: SATURDAY });
    await editProduct(h, BUSINESS.BIRRIA, 'Taco de Birria con Tortilla de Mano', (input) => {
      input.available = false;
    });
    await h.ask('Hola');
    const reply = await h.ask('2 tacos y una horchata');
    expect(reply).toContain('- Taco de Birria con Tortilla de Mano: no está disponible por ahora.');
    expect(reply).toContain('- 1 × Bebidas Frías del Comal (Aguas Frescas) · Horchata');
  });

  it('"2 tacos de birria" un martes: la nota del otro negocio y nada agregado', async () => {
    const h = await makeBotHarness({ at: TUESDAY });
    await h.ask('Hola');
    const reply = await h.ask('2 tacos de birria');
    expect(reply).toContain('*Birriería El Muñeco* atiende sábado y domingo');
    expect(reply).not.toContain('Agregado');
    expect(await h.ask('carrito')).toContain('Tu carrito está vacío.');
  });

  it('"2 tacos y un molote" en Birria: agrega los tacos y da la nota del otro negocio en el mismo mensaje', async () => {
    const h = await makeBotHarness({ at: SATURDAY });
    await h.ask('Hola');
    const reply = await h.say('2 tacos y un molote');
    expect(reply).toHaveLength(1);
    expect(reply[0]).toContain('- 2 × Taco de Birria con Tortilla de Mano');
    expect(reply[0]).toContain('*Moloteando* atiende');
  });

  it.each([
    [SATURDAY, '2 tacos 1 cocacolota', '*2 tacos, 1 coca*'],
    [SATURDAY, 'quiero 2 tacos a las 3', '*2 tacos, 1 coca*'],
    [SATURDAY, '2 tacos para 3 personas', '*2 tacos, 1 coca*'],
    [TUESDAY, 'mesa 5: 2 de queso', '*2 de queso, 1 coca*'],
    [TUESDAY, '1 coca 2 litros', '*2 de queso, 1 coca*'],
  ])('OBS-2: "%s" pide reescribirlo con un ejemplo fijo del negocio y no agrega nada de ese fragmento', async (at, text, example) => {
    const h = await makeBotHarness({ at });
    await h.ask('Hola');
    const reply = await h.ask(text);
    expect(reply).toContain(`No pude separar "${text}". Escríbelo separado con comas, por ejemplo: ${example}.`);
    expect(reply).not.toContain('Agregado');
    expect(await h.ask('carrito')).toContain('Tu carrito está vacío.');
  });

  it('DEF-007: "3 tacos de 2 tortillas" conserva "2 tortillas" en el detalle', async () => {
    const h = await makeBotHarness({ at: SATURDAY });
    await h.ask('Hola');
    const reply = await h.ask('3 tacos de 2 tortillas');
    expect(reply).toContain('- 3 × Taco de Birria con Tortilla de Mano · 2 tortillas');
    expect(reply).not.toMatch(/· 2\n/);
  });

  it.each([
    ['una orden de tacos', []],
    ['1 orden de tacos 2 quesabirrias', ['- 2 × Quesabirria con Tortilla de Mano']],
    ['una orden de tacos y 2 quesabirrias', ['- 2 × Quesabirria con Tortilla de Mano']],
  ])('OBS-4: "%s" pregunta cuántos tacos y no los agrega; las demás líneas sí', async (text, expected) => {
    const h = await makeBotHarness({ at: SATURDAY });
    await h.ask('Hola');
    const reply = await h.ask(text);
    expect(reply).toContain('No entendí cuántos quieres en "');
    expect(reply).not.toContain('Taco de Birria con Tortilla de Mano');
    for (const line of expected) expect(reply).toContain(line);
    if (expected.length === 0) expect(reply).not.toContain('Agregado');
  });

  it('CA-9: "jsjsj y 2 tacos" agrega los tacos y dice qué no entendió', async () => {
    const h = await makeBotHarness({ at: SATURDAY });
    await h.ask('Hola');
    const reply = await h.ask('jsjsj y 2 tacos');
    expect(reply).toContain('- 2 × Taco de Birria con Tortilla de Mano');
    expect(reply).toContain('- No entendí: "jsjsj".');
  });
});

describe('cancelar y quitar (CA-10, RF-7)', () => {
  it('"cancelar" como mensaje completo cancela; "cancela la coca" y "quita la coca" quitan la línea', async () => {
    const h = await makeBotHarness();
    await h.ask('Hola');
    await h.ask('2 de queso y una coca');
    const removed = await h.ask('cancela la coca');
    expect(removed).toContain('Quitado: Refrescos Familia Coca-Cola · Coca-Cola.');
    expect(h.bot.hasConversation(CUSTOMER)).toBe(true);
    await h.ask('una coca');
    expect(await h.ask('quita la coca')).toContain('Quitado: Refrescos Familia Coca-Cola · Coca-Cola.');
    expect(await h.ask('quita el chorizo')).toContain('No encontré "el chorizo" en tu carrito.');
    expect(await h.ask('cancelar')).toContain('Pedido cancelado.');
    expect(h.bot.hasConversation(CUSTOMER)).toBe(false);
    expect(h.double.templatesTo(STAFF.molotes)).toHaveLength(0);
  });

  it('si el producto tiene varias líneas, pregunta cuál quitar', async () => {
    const h = await makeBotHarness();
    await h.ask('Hola');
    await h.ask('1 orden de queso, 2 piezas de queso');
    const which = await h.ask('quita el queso');
    expect(which).toContain('¿Cuál quitas? Escribe su número.');
    expect(which).toContain('1. Molotes de Queso Oaxaca (orden de 3)');
    expect(which).toContain('2. Molotes de Queso Oaxaca (pieza)');
    const reply = await h.ask('2');
    expect(reply).toContain('Quitado: Molotes de Queso Oaxaca (pieza).');
    expect(reply).toContain('1 × Molotes de Queso Oaxaca (orden de 3)');
  });
});

describe('detalle por línea (CA-11, RF-8)', () => {
  const longDetail = 'sin cebolla con mucha salsa verde bien doraditos calientitos crujientes de verdad';

  it('se recorta a 60, se ve en el resumen y en la plantilla de Meta, y no cambia el precio', async () => {
    const h = await makeBotHarness({ at: SATURDAY });
    const summary = await toSummary(h, `2 tacos ${longDetail}`);
    expect(summary).toMatch(/2 × Taco de Birria con Tortilla de Mano · sin cebolla[^\n]*… — \$40 c\/u = \$80/);
    expect(await h.ask('sí')).toContain('fue enviado');
    const params = h.double.templatesTo(STAFF.birria)[0]?.template?.params;
    expect(params?.lineas).toMatch(/^2 × Taco de Birria con Tortilla de Mano · sin cebolla.*… a \$40 = \$80$/);
    expect(params?.total).toBe('$80');
    const detail = /· (.*…)/.exec(params?.lineas ?? '')?.[1]?.replace(/ a \$40 = \$80$/, '') ?? '';
    expect([...detail]).toHaveLength(60);
  });

  it('también en el texto libre de Twilio', async () => {
    const h = await makeTwilioBotHarness({ at: SATURDAY });
    for (const text of ['Hola', `2 tacos ${longDetail}`, 'Ana, recoger', 'sí']) await h.say(text);
    const notice = h.double.sent.find((message) => message.to === STAFF.birria)?.text ?? '';
    expect(notice).toMatch(/2 × Taco de Birria con Tortilla de Mano · sin cebolla[^\n]*… a \$40 = \$80/);
  });
});

describe('datos del cliente (CA-12, RF-5)', () => {
  it('"Juan, recoger" pasa al resumen; "Ana, domicilio, …" lleva la dirección', async () => {
    const pickup = await makeBotHarness();
    const summary = await toSummary(pickup, '2 de queso', 'Juan, recoger');
    expect(summary).toContain('Nombre: Juan');
    expect(summary).toContain('Entrega: Recoger en sucursal');

    const delivery = await makeBotHarness();
    const home = await toSummary(delivery, '2 de queso', 'Ana, domicilio, Calle 5 #10 Col. Centro');
    expect(home).toContain('Entrega: A domicilio: Calle 5 #10 Col. Centro');
    expect(home).toContain('El personal te confirmará el costo del envío.');
  });

  it('"Ana, domicilio" pide solo la dirección; "recoger" sin nombre pide solo el nombre', async () => {
    const h = await makeBotHarness();
    expect(await toSummary(h, '2 de queso', 'Ana, domicilio')).toBe('¿Cuál es la dirección de entrega? (calle, número, colonia y referencias)');
    expect(await h.ask('Calle 5 #10, Centro')).toContain('Entrega: A domicilio: Calle 5 #10, Centro');

    const other = await makeBotHarness();
    expect(await toSummary(other, '2 de queso', 'recoger')).toBe('¿A nombre de quién es el pedido?');
    expect(await other.ask('Juan')).toContain('Nombre: Juan');
  });

  it('"Juan" cuando espera productos o datos: la ayuda breve', async () => {
    const h = await makeBotHarness();
    await h.ask('Hola, quiero hacer un pedido');
    await h.ask('2 de queso');
    const reply = await h.ask('Juan');
    expect(reply).toContain('No entendí tu mensaje.');
    expect(reply).toContain('Puedes escribir tu pedido con tus palabras');
  });

  it('productos y una palabra de entrega: una pregunta para aclararlo', async () => {
    const h = await makeBotHarness();
    await h.ask('Hola, quiero hacer un pedido');
    await h.ask('2 de queso');
    expect(await h.ask('Ana, domicilio, Calle Tinga 5')).toContain('Tu mensaje trae productos y datos de entrega.');
    expect(await h.ask('2')).toContain('Entrega: A domicilio: Calle Tinga 5');

    const other = await makeBotHarness();
    await other.ask('Hola, quiero hacer un pedido');
    await other.ask('2 de queso');
    await other.ask('una coca para recoger');
    const reply = await other.ask('1');
    expect(reply).toContain('- 1 × Refrescos Familia Coca-Cola · Coca-Cola');
  });

  it.each([
    ['después de agregar', []],
    ['después de "4"', ['4']],
  ])('OBS-1: "Ana" sola %s: la ayuda breve recuerda indicar "recoger" o "a domicilio"', async (_label, before) => {
    const h = await makeBotHarness();
    await h.ask('Hola, quiero hacer un pedido');
    await h.ask('2 de queso');
    for (const text of before) await h.ask(text);
    const reply = await h.ask('Ana');
    expect(reply).toContain('No entendí tu mensaje.');
    expect(reply).toContain('Si es tu nombre, escribe también si es para *recoger* o *a domicilio* (con tu dirección), por ejemplo: *Ana, recoger*.');
    expect(reply).toContain('Puedes escribir tu pedido con tus palabras');
    expect(await h.ask('Ana, recoger')).toContain('Nombre: Ana');
  });

  it('OBS-1: antes de pedir, "Ana" da la ayuda sin el recordatorio de la entrega', async () => {
    const h = await makeBotHarness();
    await h.ask('Hola');
    expect(await h.ask('Ana')).not.toContain('Si es tu nombre');
  });

  it('DEF-005: el primer mensaje con datos de entrega no los cita como no entendidos y avisa que se piden después', async () => {
    const h = await makeBotHarness();
    const reply = await h.ask('Hola soy Pedro, quiero 2 de queso, a domicilio en Calle Falsa 123');
    expect(reply).toContain('- 2 × Molotes de Queso Oaxaca (pieza)');
    expect(reply).not.toContain('a domicilio en Calle Falsa');
    expect(reply).not.toContain('Calle Falsa');
    expect(reply).toContain('Tus datos de entrega te los pido al final, cuando termines tu pedido.');
    const summary = await h.ask('Juan, recoger');
    expect(summary).toContain('Nombre: Juan');
    expect(summary).not.toContain('Falsa');
  });

  it('X-5: un nombre o una dirección en el primer mensaje no se capturan', async () => {
    const h = await makeBotHarness();
    await h.ask('Hola, soy Ana Secreta, 2 de queso a domicilio');
    const summary = await h.ask('Juan, recoger');
    expect(summary).toContain('Nombre: Juan');
    expect(summary).not.toContain('Secreta');
  });
});

describe('resumen, notas y confirmación (CA-13, RF-6)', () => {
  it('nota, edición, "no", "sin notas" y confirmar', async () => {
    const h = await makeBotHarness();
    await toSummary(h, '2 de queso');
    const noted = await h.ask('sin picante, por favor');
    expect(noted).toContain('Notas: sin picante, por favor');
    expect(noted).toContain('Escribe *sí* para confirmar');
    const edited = await h.ask('agrega una coca');
    expect(edited).toContain('- 1 × Refrescos Familia Coca-Cola · Coca-Cola');
    expect(edited).toContain('*Total: $125*');
    expect(edited).toContain('Notas: sin picante, por favor');
    expect(await h.ask('no')).toBe('✅ Escribe *sí* para confirmar, o escribe una nota para agregarla. *cancelar* para cancelar.');
    const removed = await h.ask('sin la coca');
    expect(removed).toContain('Quitado: Refrescos Familia Coca-Cola · Coca-Cola.');
    expect(removed).toContain('*Total: $90*');
    expect(await h.ask('sin notas')).toContain('Notas: Sin notas');
    expect(await h.ask('Sí')).toContain('fue enviado');
    expect(h.double.templatesTo(STAFF.molotes)[0]?.template?.params.notas).toBe('Sin notas');
  });

  it.each(['sí', 'Sí por favor', 'ok gracias', 'si porfa', 'dale, gracias', 'Confirmo, muchas gracias 🙏', 'listo, gracias'])(
    'precisión aprobada (RF-6.3): "%s" confirma el pedido',
    async (word) => {
      const h = await makeBotHarness();
      await toSummary(h, '2 de queso');
      expect(await h.ask(word)).toContain('fue enviado a Moloteando');
      expect(h.double.templatesTo(STAFF.molotes)).toHaveLength(1);
      expect(h.double.templatesTo(STAFF.molotes)[0]?.template?.params.notas).toBe('Sin notas');
    },
  );

  it.each([
    ['si, sin cebolla en los tacos', 'Notas: si, sin cebolla en los tacos'],
    ['sí, agrega una coca', 'Notas: sí, agrega una coca'],
    ['si quiero picante', 'Notas: si quiero picante'],
  ])('precisión aprobada: "%s" no confirma (queda como nota)', async (text, expected) => {
    const h = await makeBotHarness();
    await toSummary(h, '2 de queso');
    expect(await h.ask(text)).toContain(expected);
    expect(h.double.templatesTo(STAFF.molotes)).toHaveLength(0);
    expect(h.bot.hasConversation(CUSTOMER)).toBe(true);
  });

  it.each(['no', 'no gracias'])('"%s" en el resumen ni cancela ni confirma (RF-6.5)', async (word) => {
    const h = await makeBotHarness();
    await toSummary(h, '2 de queso');
    expect(await h.ask(word)).toBe('✅ Escribe *sí* para confirmar, o escribe una nota para agregarla. *cancelar* para cancelar.');
    expect(h.double.templatesTo(STAFF.molotes)).toHaveLength(0);
    expect(h.bot.hasConversation(CUSTOMER)).toBe(true);
  });

  it.each(['2', 'cancelar'])('"%s" en el resumen cancela', async (word) => {
    const h = await makeBotHarness();
    await toSummary(h, '2 de queso');
    expect(await h.ask(word)).toContain('Pedido cancelado.');
    expect(h.double.templatesTo(STAFF.molotes)).toHaveLength(0);
  });
});

describe('aclaraciones (RF-3)', () => {
  it('una respuesta parcial agrega lo resuelto y vuelve a preguntar solo lo que falta', async () => {
    const h = await makeBotHarness({ at: SATURDAY });
    await h.ask('Hola');
    await h.ask('consomé y una bebida');
    const partial = await h.ask('grande');
    expect(partial).toContain('- 1 × Tazón de Consomé Grande');
    expect(partial).toContain('*1) una bebida*');
    expect(partial).not.toContain('consomé*');
    expect(await h.ask('coca')).toContain('- 1 × Bebidas Frías del Comal (Coca-Cola Vidrio)');
  });

  it('otro pedido en lugar de la respuesta: lo pendiente se descarta con aviso', async () => {
    const h = await makeBotHarness();
    await h.ask('Hola');
    expect(await h.ask('uno de epazote')).toContain('Necesito que me aclares');
    const reply = await h.ask('2 de queso');
    expect(reply).toContain('Dejé sin agregar lo que te había preguntado');
    expect(reply).toContain('- 2 × Molotes de Queso Oaxaca (pieza)');
    expect(reply).not.toContain('Epazote (pieza)\n');
  });
});

describe('horario (CA-14, RF-9)', () => {
  it.each(['Hola, quiero hacer un pedido de molotes', '2 molotes de queso'])('un viernes a las 16:00, "%s": mensaje de D-16 y carrito vacío', async (text) => {
    const h = await makeBotHarness({ at: mx(`${WEEK.fri}T16:00`) });
    const reply = await h.say(text);
    expect(reply).toHaveLength(1);
    expect(reply[0]).toContain('*Moloteando* no está tomando pedidos: abre el martes a las 08:30');
    expect(await h.ask('carrito')).toContain('Tu carrito está vacío.');
  });

  it('un lunes a las 10:00 los productos se agregan y el resumen lleva la marca', async () => {
    const h = await makeBotHarness({ at: mx(`${WEEK.mon}T10:00`) });
    const summary = await toSummary(h, '2 de queso');
    expect(summary).toContain('FUERA DE HORARIO: tu pedido se atenderá cuando abramos, mañana martes a las 08:30.');
  });
});

describe('privacidad y logs (CA-15, RF-11)', () => {
  it('el log no tiene textos, detalles, nombres, direcciones ni notas, y sí los contadores', async () => {
    const h = await makeBotHarness({ at: SATURDAY });
    const secrets = ['tacos', 'cebollita morada', 'Rosa Secreta', 'Calle Escondida 99', 'tocar fuerte', 'jsjsj', 'horchata'];
    for (const text of ['Hola, quiero hacer un pedido de birria', 'jsjsj y 2 tacos con cebollita morada', 'consomé', '1', 'una horchata', 'Rosa Secreta, domicilio, Calle Escondida 99', 'tocar fuerte', 'sí']) {
      await h.ask(text);
    }
    expect(h.double.templatesTo(STAFF.birria)).toHaveLength(1);
    const logged = JSON.stringify(h.logger.lines);
    for (const secret of secrets) expect(logged).not.toContain(secret);
    const counters = h.logger.lines.filter((line) => line.msg === 'bot_order_interpreted');
    expect(counters.length).toBeGreaterThanOrEqual(3);
    expect(counters[0]).toEqual({
      level: 'info',
      msg: 'bot_order_interpreted',
      conversationId: expect.any(String),
      business: 'birria',
      source: 'order',
      recognized: 1,
      ambiguous: 0,
      unrecognized: 1,
      rejected: 0,
      unavailable: 0,
      otherBusiness: 0,
    });
  });
});

describe('intérprete sustituible (D-2)', () => {
  it('un intérprete falso controla la conversación sin cambiarla', async () => {
    const { repository } = await makeProductRepository();
    const double = createCloudApiDouble();
    const config = botConfig();
    const calls: string[] = [];
    const fake: OrderInterpreter = {
      order: (text) => {
        calls.push('order');
        return text === 'lo de siempre'
          ? { lines: [{ kind: 'item', slug: 'queso-oaxaca', optionKey: 'orden', quantity: 2, detail: 'como siempre', exact: true }], overflow: 0, intent: false, hasDeliveryWord: false }
          : { lines: [], overflow: 0, intent: false, hasDeliveryWord: text.includes('#') };
      },
      answer: () => ({ choices: [], looksLikeOrder: false }),
      customerData: (text) => (text.includes('#') ? { name: 'Cliente Falso', delivery: 'pickup' } : {}),
    };
    let now = TUESDAY;
    const bot = createBotOrchestrator({
      chatBot: createChatBot(config, { fetch: double.fetch, logger: makeRecordingLogger(), retryDelayMs: 0 }),
      staff: config.staff,
      timeZone: 'America/Mexico_City',
      products: repository,
      now: () => now,
      interpreter: fake,
    });
    for (const text of ['Hola', 'lo de siempre', '#datos']) {
      now = new Date(now.getTime() + 3000);
      bot.receive(parseDelivery(inboundPayload('text', { text, at: now }), PHONE_NUMBER_ID));
      await bot.drain();
    }
    const replies = double.textsTo(CUSTOMER).join('\n');
    expect(replies).toContain('2 × Molotes de Queso Oaxaca (orden de 3) · como siempre — $130 c/u = $260');
    expect(replies).toContain('Nombre: Cliente Falso');
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });
});

describe('presupuesto de la plantilla del aviso (DT-1)', () => {
  const line = (index: number): CartLine => ({
    slug: `producto-${index}`,
    optionKey: 'unico',
    productName: `Producto especial de la casa número ${String(index).padStart(2, '0')} con un nombre muy largo y`.slice(0, 80),
    optionLabel: '',
    unitPriceCents: 12345,
    quantity: 20,
    detail: 'd'.repeat(60),
  });
  const order = (lines: CartLine[]): OrderDetails => ({
    code: 'M-ABCD',
    business: 'molotes',
    lines,
    name: 'N'.repeat(60),
    delivery: 'delivery',
    address: 'A'.repeat(200),
    notes: 'B'.repeat(200),
    offHoursOpening: 'el martes a las 08:30',
  });

  it('un pedido normal no se compacta', () => {
    const normal = { ...order([line(1), line(2)]), name: 'Ana Pérez', address: 'Calle Hidalgo 123, Centro', notes: 'Sin cebolla, por favor' };
    const { level, params } = buildStaffTemplate(normal, '5215500001234');
    expect(level).toBe(0);
    expect(params.lineas).toContain(' a $123.45 = $2,469');
    expect(params.notas).toBe('Sin cebolla, por favor');
  });

  it('con todos los campos al máximo y emojis cabe recortando los textos libres, nunca las líneas ni el total', () => {
    const extreme: OrderDetails = {
      ...order(Array.from({ length: 15 }, (_, index) => ({ ...line(index + 1), optionLabel: 'O'.repeat(40), unitPriceCents: 9_999_999 }))),
      business: 'birria',
      name: '🌮'.repeat(60),
      address: '🌮'.repeat(200),
      notes: '🌮'.repeat(200),
      offHoursOpening: 'mañana miércoles a las 08:30',
    };
    const { level, params } = buildStaffTemplate(extreme, '5215500001234');
    expect(level).toBe(3);
    expect(hydrateStaffTemplate(params).length).toBeLessThanOrEqual(MAX_TEMPLATE_BODY_CHARS);
    expect(params.lineas?.split('; ')).toHaveLength(15);
    expect(params.total).toBe('$29,999,997');
    expect(params.notas?.endsWith('…')).toBe(true);
    expect(params.whatsapp).toBe('+5215500001234');
    expect(staffNoticeText(extreme, '5215500001234')).toContain('🌮'.repeat(200));
  });

  it('sin notas y con nombre y dirección al máximo en emojis, recorta las notas y la entrega y conserva el nombre y el total', () => {
    const extreme: OrderDetails = {
      ...order(Array.from({ length: 15 }, (_, index) => line(index + 1))),
      name: '🌮'.repeat(60),
      address: '🌮'.repeat(200),
      notes: '',
    };
    const { params } = buildStaffTemplate(extreme, '5215500001234');
    expect(hydrateStaffTemplate(params).length).toBeLessThanOrEqual(MAX_TEMPLATE_BODY_CHARS);
    expect(params.notas).toBe('…');
    expect(params.entrega).toMatch(/^A domicilio: (🌮)+…$/u);
    expect(params.cliente).toBe('🌮'.repeat(60));
    expect(params.lineas?.split('; ')).toHaveLength(15);
    expect(params.total).toBe('$37,035');
  });

  it('el peor caso cabe en 1024 caracteres sin perder líneas, cantidades ni el total; el texto libre no se compacta', () => {
    const worst = order(Array.from({ length: 15 }, (_, index) => line(index + 1)));
    const { level, params } = buildStaffTemplate(worst, '5215500001234');
    expect(level).toBeGreaterThan(0);
    const body = hydrateStaffTemplate(params);
    expect(body.length).toBeLessThanOrEqual(MAX_TEMPLATE_BODY_CHARS);
    expect(params.lineas?.startsWith('(abreviado) ')).toBe(true);
    expect(params.lineas?.split('; ')).toHaveLength(15);
    for (const value of params.lineas?.split('; ') ?? []) expect(value).toMatch(/^(\(abreviado\) )?20 × /);
    expect(params.total).toBe('$37,035');
    expect(staffNoticeText(worst, '5215500001234')).toContain('d'.repeat(60));
  });

  it('el README documenta el mismo cuerpo de la plantilla', () => {
    const readme = readFileSync(new URL('../../README.md', import.meta.url), 'utf8');
    expect(readme).toContain(STAFF_TEMPLATE_BODY);
  });
});

describe('Twilio: el saludo con el menú (R-3)', () => {
  it('con el catálogo actual llega en un solo mensaje de 1600 caracteres o menos', async () => {
    for (const at of [TUESDAY, SATURDAY]) {
      const h = await makeTwilioBotHarness({ at });
      const reply = await h.say('Hola, quiero hacer un pedido');
      expect(reply).toHaveLength(1);
      expect(reply[0]?.length).toBeLessThanOrEqual(1600);
    }
  });
});
