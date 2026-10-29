import { describe, expect, it } from 'vitest';

import type { BusinessId } from '@restaurante/core/shared';
import { toInput } from '@restaurante/core/catalog';

import { botText } from '../../src/content/bot.ts';
import { createDeterministicInterpreter } from '../../src/services/whatsapp-bot/interpreter/deterministic.ts';
import type { OrderInterpreter } from '../../src/services/whatsapp-bot/interpreter/types.ts';
import { MAX_TEMPLATE_BODY_CHARS, buildStaffTemplate, hydrateStaffTemplate, type CartLine, type OrderDetails } from '../../src/services/whatsapp-bot/messages.ts';
import { createBotOrchestrator } from '../../src/services/whatsapp-bot/orchestrator.ts';
import { parseDelivery } from '../../src/services/whatsapp-bot/providers/meta/webhook.ts';
import { createChatBot } from '../../src/services/whatsapp-bot/providers/select.ts';
import { makeRecordingLogger } from '../helpers.ts';
import { createCloudApiDouble } from '../support/cloud-api-double.ts';
import { ANA, makeProductRepository } from '../support/products.ts';
import { CUSTOMER, PHONE_NUMBER_ID, STAFF, WEEK, botConfig, inboundPayload, makeBotHarness, mx, type BotHarness } from '../support/whatsapp.ts';

/**
 * QA de REQ-F-013 (ronda 1, senior-qa): casos límite, batería exploratoria, limitaciones
 * aceptadas, precisión de RF-6.3 ("sí por favor"), sustituibilidad (D-2) y DT-1. Los defectos de
 * la ronda 1 (DEF-NNN del QA Report) se fijaron con `it.fails`; ya corregidos, son pruebas normales.
 */

const TUESDAY = mx(`${WEEK.tue}T12:00`);
const SATURDAY = mx(`${WEEK.sat}T12:00`);
const LANDING: Record<BusinessId, string> = {
  molotes: 'Hola, quiero hacer un pedido de molotes',
  birria: 'Hola, quiero hacer un pedido de birria',
};

async function started(business: BusinessId): Promise<BotHarness> {
  const h = await makeBotHarness({ at: business === 'molotes' ? TUESDAY : SATURDAY });
  await h.ask(LANDING[business]);
  return h;
}

/** Bloque "Agregado:" de la respuesta (las líneas "- ..."). */
/** Líneas de "Agregado:" como "2 × Nombre (opción) · detalle" (REQ-F-029: el detalle va en su renglón, en cursiva). */
const added = (reply: string): string[] => {
  const block = /Agregado:\n((?:(?:- | {4}_).*\n?)+)/.exec(reply)?.[1] ?? '';
  const lines: string[] = [];
  for (const line of block.split('\n')) {
    if (line.startsWith('- ')) lines.push(line.slice(2));
    else if (line.startsWith('    _') && lines.length > 0) lines[lines.length - 1] += ` · ${line.slice(5, -1)}`;
  }
  return lines;
};
const totalOf = (reply: string): string | undefined => /\*Total: (\$[\d,.]+)\*/.exec(reply)?.[1];

async function toSummary(business: BusinessId, items: string, data = 'Ana, recoger, efectivo'): Promise<BotHarness> {
  const h = await started(business);
  await h.ask(items);
  expect(await h.ask(data)).toContain('*Resumen de tu pedido');
  return h;
}

describe('QA REQ-F-013: batería exploratoria con resultado correcto (regresión)', () => {
  it.each<[BusinessId, string, string[], string]>([
    ['molotes', 'me das 3 de queso y 2 de tinga porfa', ['3 × Molotes de Queso Oaxaca (pieza)', '2 × Molotes de Tinga de Pollo (pieza)'], '$225'],
    ['molotes', 'quiero 2 ordenes de papa con chorizo y una coca sin azucar', ['2 × Molotes de Papas con Chorizo (orden de 3)', '1 × Refrescos Familia Coca-Cola · Coca-Cola Sin Azúcar'], '$295'],
    ['molotes', '2 molotes de queso, 1 de picadillo y un sprite', ['2 × Molotes de Queso Oaxaca (pieza)', '1 × Molotes de Picadillo de Cerdo con Verduras (pieza)', '1 × Refrescos Familia Coca-Cola · Sprite'], '$173'],
    ['molotes', 'una docena de queso', ['12 × Molotes de Queso Oaxaca (pieza)'], '$540'],
    ['molotes', 'media docena de tinga', ['6 × Molotes de Tinga de Pollo (pieza)'], '$270'],
    ['molotes', 'un par de cocas', ['2 × Refrescos Familia Coca-Cola · Coca-Cola'], '$70'],
    ['molotes', '2 de hongo', ['2 × Molotes de Hongos Zetas con Epazote (pieza)'], '$96'],
    ['molotes', '2 zetas', ['2 × Molotes de Hongos Zetas con Epazote (pieza)'], '$96'],
    ['molotes', '2 de queso sin crema y 2 de queso', ['2 × Molotes de Queso Oaxaca (pieza) · sin crema', '2 × Molotes de Queso Oaxaca (pieza)'], '$180'],
    ['molotes', '2 ordenes de 3 de queso', ['2 × Molotes de Queso Oaxaca (orden de 3)'], '$260'],
    ['molotes', 'quiero 2 de papa\n1 agua de horchata\n1 limon', ['2 × Molotes de Papas con Chorizo (pieza)', '1 × Aguas Frescas Naturales del Día · Horchata', '1 × Aguas Frescas Naturales del Día · Limón con chía'], '$160'],
    ['molotes', '2 de queso + 1 jamaica', ['2 × Molotes de Queso Oaxaca (pieza)', '1 × Aguas Frescas Naturales del Día · Jamaica'], '$125'],
    ['molotes', 'molotes de queso oaxaca 🔥🔥', ['1 × Molotes de Queso Oaxaca (pieza)'], '$45'],
    ['molotes', 'QUIERO 3 DE TINGA!!!', ['3 × Molotes de Tinga de Pollo (pieza)'], '$135'],
    ['molotes', '3 de queso y 2 de tinga, con salsa verde', ['3 × Molotes de Queso Oaxaca (pieza)', '2 × Molotes de Tinga de Pollo (pieza) · con salsa verde'], '$225'],
    ['birria', '3 quesabirrias, 2 tacos sin cebolla, con mucha salsa y un consome grande', ['3 × Quesabirria con Tortilla de Mano', '2 × Taco de Birria con Tortilla de Mano · sin cebolla, con mucha salsa', '1 × Tazón de Consomé Grande'], '$415'],
    ['birria', 'una coca y una jamaica', ['1 × Bebidas Frías del Comal (Coca-Cola Vidrio)', '1 × Bebidas Frías del Comal (Aguas Frescas) · Jamaica'], '$70'],
    ['birria', '2 tacos y 1 agua', ['2 × Taco de Birria con Tortilla de Mano', '1 × Bebidas Frías del Comal (Aguas Frescas)'], '$115'],
    ['birria', '4 tacos de birria', ['4 × Taco de Birria con Tortilla de Mano'], '$160'],
    ['birria', '2 quesabirias', ['2 × Quesabirria con Tortilla de Mano'], '$130'],
    ['birria', '2 tcos', ['2 × Taco de Birria con Tortilla de Mano'], '$80'],
    ['birria', 'consome sin carne', ['1 × Tazón de Consomé Chico (Sin Carne)'], '$45'],
    ['birria', '2 tacos con tortilla de mano', ['2 × Taco de Birria con Tortilla de Mano'], '$80'],
  ])('%s: "%s"', async (business, text, lines, total) => {
    const h = await started(business);
    const reply = await h.ask(text);
    expect(added(reply)).toEqual(lines);
    expect(totalOf(reply)).toBe(total);
    expect(reply).not.toContain('Necesito que me aclares');
    expect(reply).not.toContain('No agregué');
  });

  it('"2 de chicharrón y 2 de chicharron prensado" se suman en una línea (RF-1.6)', async () => {
    const h = await started('molotes');
    const reply = await h.ask('2 de chicharrón y 2 de chicharron prensado');
    expect(reply).toContain('*1.* Molotes de Chicharrón Prensado en Adobo (pieza)\n    4 × $48 c/u = $192');
    expect(totalOf(reply)).toBe('$192');
  });

  it('"1 orden de 2 de tinga" se pregunta (R-6 b)', async () => {
    const h = await started('molotes');
    const reply = await h.ask('1 orden de 2 de tinga');
    expect(reply).toContain('Necesito que me aclares');
    expect(reply).toContain('Molotes de Tinga de Pollo (orden de 3)');
    expect(added(reply)).toEqual([]);
  });

  it('lo no entendido se dice: "3 de champi", "quiero birria", "dos tacos, 1 sin cebolla" (RN-13)', async () => {
    expect(await (await started('molotes')).ask('3 de champi')).toContain('No entendí tu mensaje');
    expect(await (await started('birria')).ask('quiero birria')).toContain('No entendí tu mensaje');
    const reply = await (await started('birria')).ask('dos tacos, 1 sin cebolla');
    expect(added(reply)).toEqual(['2 × Taco de Birria con Tortilla de Mano']);
    expect(reply).toContain('No entendí: "1 sin cebolla".');
  });
});

describe('QA REQ-F-013: limitaciones aceptadas por el usuario', () => {
  // Cambio de forma tras DEF-002 (criterio aceptado por el usuario el 2026-10-09): un mensaje sin
  // separadores que se puede separar con seguridad (cada parte entre cantidades es un producto) se
  // separa con sus cantidades; si no se puede, no se agrega nada de él y se pide reescribirlo con
  // comas. Antes acababa en una pregunta que, al contestarla, perdía el otro producto. La aserción
  // de fondo se mantiene y se refuerza: nunca se agrega una parte perdiendo la otra, ni cambian las
  // cantidades, ni queda un número como detalle.
  it('"2 tacos 1 coca" sin separador agrega los dos con sus cantidades; si no se puede separar, pide comas', async () => {
    const h = await started('birria');
    const reply = await h.ask('2 tacos 1 coca');
    expect(added(reply)).toEqual(['2 × Taco de Birria con Tortilla de Mano', '1 × Bebidas Frías del Comal (Coca-Cola Vidrio)']);
    expect(reply).not.toContain('Necesito que me aclares');

    const unsafe = await started('birria');
    const rewrite = await unsafe.ask('2 tacos 1 cocacolota');
    expect(added(rewrite)).toEqual([]);
    // OBS-2 (ronda 2): el ejemplo es fijo del negocio, no la frase del cliente partida.
    expect(rewrite).toContain('No pude separar "2 tacos 1 cocacolota". Escríbelo separado con comas, por ejemplo: *2 tacos, 1 coca*.');
    expect(rewrite).not.toContain('*2 tacos, 1 cocacolota*');
  });

  it('", bien doraditos" se informa como no entendido y el resto se agrega', async () => {
    const h = await started('molotes');
    const reply = await h.ask('2 de queso, bien doraditos');
    expect(added(reply)).toEqual(['2 × Molotes de Queso Oaxaca (pieza)']);
    expect(reply).toContain('No entendí: "bien doraditos".');
  });
});

describe('QA REQ-F-013: defectos de la ronda 1, corregidos', () => {
  // DEF-001: un fragmento "con carne"/"sin carne" tras una coma se toma como un consomé aparte.
  it('DEF-001: "3 tacos, con carne" no agrega un consomé que el cliente no pidió', async () => {
    const h = await started('birria');
    const reply = await h.ask('3 tacos, con carne');
    expect(reply).not.toContain('Consomé');
  });

  it.each(['un consome chico, con carne', '2 tacos y 1 consome chico, con carne', '1 consome, sin carne'])(
    'DEF-001: "%s" agrega el consomé o pregunta por él, pero no las dos cosas',
    async (text) => {
      const h = await started('birria');
      const reply = await h.ask(text);
      const consomeAdded = added(reply).some((line) => line.includes('Consomé'));
      expect(consomeAdded && reply.includes('Necesito que me aclares')).toBe(false);
    },
  );

  // DEF-002 (ronda 2, criterio aceptado): sin separador, se agregan todas las partes con su
  // cantidad o no se agrega nada y se piden comas; nunca se pierde una parte ni queda un número
  // como detalle.
  it.each<[BusinessId, string, string[]]>([
    ['birria', '2 tacos 1 coca', ['2 × Taco de Birria con Tortilla de Mano', '1 × Bebidas Frías del Comal (Coca-Cola Vidrio)']],
    ['birria', '2 tacos 1 quesabirria', ['2 × Taco de Birria con Tortilla de Mano', '1 × Quesabirria con Tortilla de Mano']],
    ['birria', 'dos tacos tres quesabirrias', ['2 × Taco de Birria con Tortilla de Mano', '3 × Quesabirria con Tortilla de Mano']],
    ['birria', '2 tacos 2 quesabirrias 1 coca 1 jamaica', ['2 × Taco de Birria con Tortilla de Mano', '2 × Quesabirria con Tortilla de Mano', '1 × Bebidas Frías del Comal (Coca-Cola Vidrio)', '1 × Bebidas Frías del Comal (Aguas Frescas) · Jamaica']],
    ['molotes', 'dos de tinga 2 de queso', ['2 × Molotes de Tinga de Pollo (pieza)', '2 × Molotes de Queso Oaxaca (pieza)']],
    ['molotes', '2 ordenes de queso 1 coca', ['2 × Molotes de Queso Oaxaca (orden de 3)', '1 × Refrescos Familia Coca-Cola · Coca-Cola']],
  ])('DEF-002: %s "%s" agrega todas las partes con su cantidad', async (business, text, lines) => {
    const h = await started(business);
    const reply = await h.ask(text);
    expect(added(reply)).toEqual(lines);
    expect(reply).not.toContain('Necesito que me aclares');
  });

  it.each(['2 tacos 1 cocacolota', '2 tacos 3', '2 tacos 1 sin cebolla', 'quiero 2 tacos a las 3'])('DEF-002: "%s" no se puede separar: no agrega nada y pide comas', async (text) => {
    const h = await started('birria');
    const reply = await h.ask(text);
    expect(added(reply)).toEqual([]);
    expect(reply).toContain(`No pude separar "${text}"`);
  });

  // DEF-003 (ronda 2): "x2" y "2x" son cantidad; una cantidad y un multiplicador a la vez no se adivinan.
  it.each<[BusinessId, string, string[]]>([
    ['molotes', 'tinga x2', ['2 × Molotes de Tinga de Pollo (pieza)']],
    ['molotes', '2x queso', ['2 × Molotes de Queso Oaxaca (pieza)']],
    ['birria', 'taco x2, quesabirria x3', ['2 × Taco de Birria con Tortilla de Mano', '3 × Quesabirria con Tortilla de Mano']],
  ])('DEF-003: %s "%s" usa la cantidad del multiplicador', async (business, text, lines) => {
    const h = await started(business);
    expect(added(await h.ask(text))).toEqual(lines);
  });

  it.each(['3 tacos x2', '1 taco x 2'])('DEF-003: "%s" no se adivina: no agrega y pide una sola cantidad', async (text) => {
    const h = await started('birria');
    const reply = await h.ask(text);
    expect(added(reply)).toEqual([]);
    expect(reply).toContain(`No entendí cuántos quieres en "${text}"`);
  });

  // DEF-004: la compactación de DT-1 corta un emoji por la mitad (sustituto suelto en `lineas`).
  it('DEF-004: la plantilla compactada no deja sustitutos UTF-16 sueltos', () => {
    const line = (index: number): CartLine => ({
      slug: `p${index}`,
      optionKey: 'unico',
      productName: `P${'🌮'.repeat(9)}`,
      optionLabel: '',
      unitPriceCents: 4500,
      quantity: 3,
      detail: '🔥'.repeat(60),
    });
    const order: OrderDetails = {
      code: 'M-ABCD',
      business: 'molotes',
      lines: Array.from({ length: 15 }, (_, index) => line(index)),
      name: 'Ana',
      delivery: 'delivery',
      address: 'C'.repeat(200),
      notes: 'N'.repeat(200),
      payment: 'onDelivery',
      offHoursOpening: null,
    };
    const body = hydrateStaffTemplate(buildStaffTemplate(order, '5215500001234').params);
    expect(body).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/);
  });
});

describe('QA REQ-F-013: defectos de la ronda 2, corregidos', () => {
  // DEF-006: "N de M de <producto>" sin "orden" toma M como cantidad y deja N como detalle.
  it.each([
    ['1 de 3 de tinga', ['1 × Molotes de Tinga de Pollo (orden de 3)']],
    ['2 de 3 de queso', ['2 × Molotes de Queso Oaxaca (orden de 3)']],
    ['2 de queso 1 de 3 de tinga', ['2 × Molotes de Queso Oaxaca (pieza)', '1 × Molotes de Tinga de Pollo (orden de 3)']],
  ])('DEF-006: "%s" no cambia la cantidad ni deja un número como detalle', async (text, expected) => {
    const h = await started('molotes');
    const reply = await h.ask(text);
    expect(added(reply).some((line) => /^3 × /.test(line) || / · \d+$/.test(line))).toBe(false);
    // Aserción positiva (senior-fullstack, ronda 2): N órdenes de M con la orden del catálogo.
    expect(added(reply)).toEqual(expected);
  });

  it('DEF-006: "1 de 5 de tinga" (M distinta de la orden) pregunta y no agrega esa línea', async () => {
    const h = await started('molotes');
    const reply = await h.ask('1 de 5 de tinga');
    expect(added(reply)).toEqual([]);
    expect(reply).toContain('Necesito que me aclares');
    expect(reply).toContain('Molotes de Tinga de Pollo (orden de 3)');
  });
});

describe('QA REQ-F-013: defectos de la ronda 3, corregidos', () => {
  // DEF-008: "N (orden) de M de <producto sin orden>" descartaba "de M" en silencio (criterio de DEF-006: si M no es la orden, se pregunta).
  it.each<[BusinessId, string]>([
    ['birria', '1 orden de 3 de tacos'],
    ['birria', 'una de 3 de tacos'],
    ['molotes', '1 de 3 de coca'],
  ])('DEF-008: %s "%s" no descarta "de 3" en silencio', async (business, text) => {
    const h = await started(business);
    const reply = await h.ask(text);
    const informed = reply.includes('Necesito que me aclares') || reply.includes('No agregué') || added(reply).some((line) => line.startsWith('3 × '));
    expect(informed).toBe(true);
  });

  // Refuerzo pedido por QA (ronda 3), con la decisión del usuario (A y B).
  it.each<[BusinessId, string, string[]]>([
    ['birria', '1 orden de 3 de tacos', ['3 × Taco de Birria con Tortilla de Mano']],
    ['birria', '2 órdenes de 3 tacos', ['6 × Taco de Birria con Tortilla de Mano']],
    ['molotes', '1 orden de 3 de coca', ['3 × Refrescos Familia Coca-Cola · Coca-Cola']],
  ])('DEF-008 A: %s "%s" agrega N×M unidades, sin "de 3" en el detalle', async (business, text, expected) => {
    const h = await started(business);
    expect(added(await h.ask(text))).toEqual(expected);
  });

  it('DEF-008 A: "3 órdenes de 7 tacos" (21) se rechaza con el mensaje de D-12', async () => {
    const h = await started('birria');
    const reply = await h.ask('3 órdenes de 7 tacos');
    expect(added(reply)).toEqual([]);
    expect(reply).toContain('"3 órdenes de 7 tacos": la cantidad debe ser un número entero del 1 al 20.');
  });

  it.each<[BusinessId, string]>([
    ['birria', 'una de 3 de tacos'],
    ['birria', '2 de 3 de quesabirria'],
    ['molotes', '1 de 3 de coca'],
    ['birria', '1 de 2 de consome grande'],
  ])('DEF-008 B: %s "%s" (sin la palabra "orden") pregunta y no agrega la línea', async (business, text) => {
    const h = await started(business);
    const reply = await h.ask(text);
    expect(added(reply)).toEqual([]);
    expect(reply).toContain(`No entendí cuántos quieres en "${text}".`);
  });

  // DEF-009: "de N piezas" dejaba solo el número como detalle (criterio de DEF-007).
  it.each<[BusinessId, string]>([
    ['birria', '2 tacos de 3 piezas'],
    ['molotes', '2 de queso de 3 piezas'],
  ])('DEF-009: %s "%s" no deja un número solo como detalle', async (business, text) => {
    const h = await started(business);
    const reply = await h.ask(text);
    expect(added(reply).some((line) => / · \d+$/.test(line))).toBe(false);
    expect(added(reply).every((line) => line.startsWith('2 × ') && line.endsWith(' · 3 piezas'))).toBe(true);
  });
});

describe('QA REQ-F-013: ronda 4, una línea que pide la cantidad no impide separar el resto', () => {
  it.each<[BusinessId, string, string[], string[]]>([
    ['birria', '2 tacos 1 orden de tacos 3 quesabirrias', ['2 × Taco de Birria con Tortilla de Mano', '3 × Quesabirria con Tortilla de Mano'], ['1 orden de tacos']],
    ['birria', 'una de 3 de tacos 1 de 2 de quesabirria 1 coca', ['1 × Bebidas Frías del Comal (Coca-Cola Vidrio)'], ['una de 3 de tacos', '1 de 2 de quesabirria']],
    ['birria', '3 tacos x2 1 coca', ['1 × Bebidas Frías del Comal (Coca-Cola Vidrio)'], ['3 tacos x2']],
    ['molotes', '1 orden de coca 1 de 3 de queso 1 jamaica', ['1 × Molotes de Queso Oaxaca (orden de 3)', '1 × Aguas Frescas Naturales del Día · Jamaica'], ['1 orden de coca']],
  ])('%s "%s": agrega lo claro y pide la cantidad del resto', async (business, text, lines, asked) => {
    const h = await started(business);
    const reply = await h.ask(text);
    expect(added(reply)).toEqual(lines);
    for (const fragment of asked) expect(reply).toContain(`No entendí cuántos quieres en "${fragment}".`);
  });

  it.each(['una orden de tacos 2 quesabirrias 1 cocacolota', 'una orden de tacos para 3 personas', 'una orden de tacos 3'])('birria "%s": si algo no se puede separar, no agrega nada y pide comas', async (text) => {
    const h = await started('birria');
    const reply = await h.ask(text);
    expect(added(reply)).toEqual([]);
    expect(reply).toContain(`No pude separar "${text}". Escríbelo separado con comas, por ejemplo: *2 tacos, 1 coca*.`);
  });
});

describe('QA REQ-F-013: RF-6.3 con la precisión aprobada ("sí por favor")', () => {
  it.each(['sí por favor', 'ok gracias', 'si porfa', 'dale, gracias', 'Sí, muchas gracias', 'sí, nada más', 'SI'])('"%s" confirma', async (text) => {
    const h = await toSummary('molotes', '2 de queso');
    expect(await h.ask(text)).toContain('fue enviado a Moloteando');
    expect(h.double.templatesTo(STAFF.molotes)).toHaveLength(1);
  });

  it.each(['sí, agrega una coca', 'si quiero picante', 'sí pero sin cebolla', 'si, otra coca', 'si para llevar'])('"%s" no confirma: queda como nota', async (text) => {
    const h = await toSummary('molotes', '2 de queso');
    const reply = await h.ask(text);
    expect(reply).not.toContain('fue enviado');
    expect(reply).toContain(`*Notas:* ${text}`);
    expect(h.double.templatesTo(STAFF.molotes)).toHaveLength(0);
  });

  it.each(['no gracias', 'no quiero', 'No, gracias'])('"%s" se trata como "no": repite la indicación sin cancelar ni guardar nota', async (text) => {
    const h = await toSummary('molotes', '2 de queso');
    const reply = await h.ask(text);
    expect(reply).toBe(botText.confirmPrompt);
    expect(await h.ask('sí')).toContain('fue enviado');
  });
});

describe('QA REQ-F-013: resumen, edición y notas', () => {
  it('confirmaciones como mensaje completo (RF-6.3)', async () => {
    for (const text of ['confirmo', 'ok', 'va', 'dale', 'listo', 'correcto', '1', 'Confirmar']) {
      const h = await toSummary('molotes', '2 de queso');
      expect(await h.ask(text)).toContain('fue enviado');
    }
  });

  it('una nota de 200 caracteres se acepta, una de 201 no, y "0" borra la nota', async () => {
    const h = await toSummary('molotes', '2 de queso');
    expect(await h.ask('n'.repeat(201))).toContain('200');
    expect(await h.ask('n'.repeat(200))).toContain(`*Notas:* ${'n'.repeat(200)}`);
    expect(await h.ask('0')).toContain('*Notas:* Sin notas');
  });

  it('"también 2 de tinga" edita desde el resumen y "quita la tinga" la quita', async () => {
    const h = await toSummary('molotes', '2 de queso');
    const edited = await h.ask('también 2 de tinga');
    expect(edited).toContain('2 × Molotes de Tinga de Pollo (pieza)');
    expect(edited).toContain('*Total: $180*');
    const removed = await h.ask('quita la tinga');
    expect(removed).toContain('*Total: $90*');
  });

  it('"quita 1 taco" quita la línea completa y dice qué quitó (precisión v2)', async () => {
    const h = await started('birria');
    await h.ask('3 tacos y 2 quesabirrias');
    const reply = await h.ask('quita 1 taco');
    expect(reply).toContain('Quitado: Taco de Birria con Tortilla de Mano.');
    expect(reply).toContain('*Total: $130*');
  });

  it('D-13 con detalle: si el precio cambia antes de confirmar, se avisa y la línea conserva su detalle', async () => {
    const { repository } = await makeProductRepository();
    const h = await makeBotHarness({ at: SATURDAY, products: repository });
    await h.ask(LANDING.birria);
    await h.ask('2 tacos sin cebolla');
    expect(await h.ask('Ana, recoger, efectivo')).toContain('- Taco de Birria con Tortilla de Mano\n    _sin cebolla_\n    2 × $40 c/u = $80');
    const products = repository;
    const taco = (await products.list('birria')).find((product) => product.name === 'Taco de Birria con Tortilla de Mano');
    if (!taco) throw new Error('Falta el taco de la semilla');
    const input = { ...toInput(taco), available: taco.available } as Record<string, unknown>;
    const variants = input.variants as { price: string }[] | undefined;
    if (variants && variants.length > 0) for (const variant of variants) variant.price = '50';
    else input.price = '50';
    await products.update('birria', taco.id, { input, expectedVersion: taco.version }, ANA);
    const reply = await h.ask('sí');
    expect(reply).not.toContain('fue enviado');
    expect(reply).toContain('· sin cebolla');
    expect(reply).toContain('$50');
    expect(await h.ask('sí')).toContain('fue enviado');
    expect(h.double.templatesTo(STAFF.birria)[0]?.template?.params?.lineas).toContain('2 × Taco de Birria con Tortilla de Mano · sin cebolla a $50 = $100');
  });
});

describe('QA REQ-F-013: números por paso (RF-4.4, X-4) y palabras clave', () => {
  it('con el menú del primer turno, "1" es el producto 1 (R-5.2)', async () => {
    const h = await started('molotes');
    expect(await h.ask('1')).toContain('¿Cuál opción de *Molotes de Queso Oaxaca*?');
  });

  it('saludo sin intención: "1" muestra el menú; "2" empieza el pedido', async () => {
    const h = await makeBotHarness({ at: TUESDAY });
    expect(await h.ask('Hola')).toContain('*1.* 📋 Ver el menú');
    expect(await h.ask('1')).toContain('*Menú de Moloteando*');
  });

  it('opción, cantidad, carrito y quitar por número siguen igual', async () => {
    const h = await started('molotes');
    await h.ask('2');
    expect(await h.ask('2')).toContain('¿Cuántas de *Molotes de Tinga de Pollo*?');
    expect(await h.ask('3')).toContain('3 × Molotes de Tinga de Pollo (orden de 3)');
    expect(await h.ask('2')).toContain('¿Qué producto quitas?');
    expect(await h.ask('1')).toContain('Quitado: Molotes de Tinga de Pollo (orden de 3).');
  });

  it('"pedido" en el primer mensaje es intención; a mitad del flujo muestra el carrito (R-5.3)', async () => {
    const h = await makeBotHarness({ at: TUESDAY });
    expect(await h.ask('quiero hacer un pedido')).toContain('*Menú de Moloteando*');
    await h.ask('2 de queso');
    expect(await h.ask('pedido')).toContain('*Tu pedido*');
  });

  it.each(['hablar con alguien', 'quiero hablar con alguien', 'atención', 'operador'])('"%s" como mensaje completo da el contacto (RF-10.2)', async (text) => {
    const h = await started('molotes');
    expect(await h.ask(text)).toContain('Para hablar con una persona de *Moloteando*');
  });

  it('"cancelar por favor" no cancela el pedido; "CANCELAR" sí (X-3)', async () => {
    const h = await started('molotes');
    await h.ask('2 de queso');
    expect(await h.ask('cancelar por favor')).not.toContain('cancelado');
    expect(await h.ask('carrito')).toContain('Molotes de Queso Oaxaca (pieza)\n    2 × ');
    const h2 = await started('molotes');
    await h2.ask('2 de queso');
    expect(await h2.ask('CANCELAR')).toContain('Pedido cancelado.');
  });
});

describe('QA REQ-F-013: datos del cliente', () => {
  it('"Tina, recoger" son datos aunque se parezca a "tinga" (R-5.5)', async () => {
    const h = await started('birria');
    await h.ask('2 tacos');
    const summary = await h.ask('Tina, recoger, efectivo');
    expect(summary).toContain('*Nombre:* Tina');
    expect(summary).toContain('*Total: $80*');
  });

  it('una dirección con palabras de producto: una pregunta y, con "2", la dirección completa', async () => {
    const h = await started('molotes');
    await h.ask('2 de queso');
    expect(await h.ask('Luis, domicilio, Calle de la Papa 10, Col. Centro, transferencia')).toContain('*2.* Son mis datos de entrega');
    const summary = await h.ask('2');
    expect(summary).toContain('*Entrega:* A domicilio\nCalle de la Papa 10, Col. Centro');
    expect(summary).toContain('*Nombre:* Luis');
    expect(summary).toContain('*Total: $90*');
  });

  it('datos sin comas y la nota tras "recoger" (R-6 a)', async () => {
    const h = await started('molotes');
    await h.ask('2 de queso');
    expect(await h.ask('Paco domicilio Reforma 123')).toContain('💳 *¿Cómo vas a pagar?*');
    const summary = await h.ask('al recibir');
    expect(summary).toContain('*Entrega:* A domicilio\nReforma 123');
    expect(summary).toContain('*Nombre:* Paco');
    const h2 = await started('molotes');
    await h2.ask('2 de queso');
    expect(await h2.ask('Juan, recoger, paso a las 3')).toContain('💳 *¿Cómo vas a pagar?*');
    expect(await h2.ask('efectivo')).toContain('*Notas:* a las 3');
  });

  it('límites: nombre de 61 caracteres y direcciones de 4 y 201 se rechazan', async () => {
    const h = await started('molotes');
    await h.ask('2 de queso');
    expect(await h.ask(`${'J'.repeat(61)}, recoger`)).not.toContain('*Resumen de tu pedido');
    const h2 = await started('molotes');
    await h2.ask('2 de queso');
    await h2.ask('Ana, domicilio');
    expect(await h2.ask('Av 1')).toContain('entre 5 y 200');
    expect(await h2.ask('C'.repeat(201))).toContain('entre 5 y 200');
    expect(await h2.ask('Calle 5 #10')).toContain('💳 *¿Cómo vas a pagar?*');
    expect(await h2.ask('1')).toContain('*Entrega:* A domicilio\nCalle 5 #10');
  });

  it('X-5: un nombre y una dirección del primer mensaje no se capturan', async () => {
    const h = await makeBotHarness({ at: TUESDAY });
    const first = await h.ask('Hola soy Pedro, quiero 2 de queso, a domicilio en Calle Falsa 123');
    expect(added(first)).toEqual(['2 × Molotes de Queso Oaxaca (pieza)']);
    const summary = await h.ask('Ana, recoger, efectivo');
    expect(summary).not.toContain('Pedro');
    expect(summary).not.toContain('Calle Falsa');
  });
});

describe('QA REQ-F-013: intérprete sustituible y robusto (D-2, R-5.7)', () => {
  it('un intérprete que lanza deja bot_processing_failed sin texto y no rompe la conversación', async () => {
    const double = createCloudApiDouble();
    const logger = makeRecordingLogger();
    const config = botConfig();
    const throwing: OrderInterpreter = {
      order: () => {
        throw new Error('ZQXSECRETO intérprete roto');
      },
      answer: () => {
        throw new Error('ZQXSECRETO');
      },
      customerData: () => {
        throw new Error('ZQXSECRETO');
      },
    };
    let now = TUESDAY;
    const bot = createBotOrchestrator({
      chatBot: createChatBot(config, { fetch: double.fetch, logger, retryDelayMs: 0 }),
      staff: config.staff,
      timeZone: 'America/Mexico_City',
      products: (await makeProductRepository()).repository,
      logger,
      now: () => now,
      interpreter: throwing,
    });
    for (const text of ['Hola', '2 de queso ZQXTEXTO']) {
      now = new Date(now.getTime() + 3000);
      bot.receive(parseDelivery(inboundPayload('text', { text, at: now }), PHONE_NUMBER_ID));
      await bot.drain();
    }
    const log = JSON.stringify(logger.lines);
    expect(logger.lines.some((line) => line.msg === 'bot_processing_failed')).toBe(true);
    expect(log).not.toContain('ZQX');
    expect(double.textsTo(CUSTOMER).join('\n')).not.toContain('ZQX');
  });

  it('el estado con una aclaración pendiente y un texto pendiente se puede clonar (structuredClone)', async () => {
    const h = await started('birria');
    expect(await h.ask('consomé y una bebida')).toContain('Necesito que me aclares');
    expect(await h.ask('2, 1')).toContain('Agregado:');
    await h.ask('2 tacos, recoger');
    expect(await h.ask('1')).toContain('2 × Taco de Birria con Tortilla de Mano');
  });

  it('nunca lanza con entradas raras', () => {
    const interpreter = createDeterministicInterpreter();
    for (const text of ['', ' ', ',,,,', 'y y y y', '+++', '\u0000​', '🌮'.repeat(500), 'a'.repeat(1000), '1 2 3 4 5 6 7 8 9 '.repeat(50)]) {
      expect(() => interpreter.customerData(text)).not.toThrow();
    }
  });
});

describe('QA REQ-F-013: DT-1 en caracteres, con emojis', () => {
  const order = (lines: CartLine[], fill: string): OrderDetails => ({
    code: 'M-ABCD',
    business: 'molotes',
    lines,
    name: fill.repeat(60),
    delivery: 'delivery',
    address: fill.repeat(200),
    notes: fill.repeat(200),
    payment: 'onDelivery',
    offHoursOpening: 'el martes a las 08:30',
  });
  const line = (index: number, detailChar: string): CartLine => ({
    slug: `p${index}`,
    optionKey: 'unico',
    productName: `Producto ${index} ${'x'.repeat(80)}`.slice(0, 80),
    optionLabel: '',
    unitPriceCents: 12345,
    quantity: 20,
    detail: detailChar.repeat(60),
  });

  it.each(['A', '🌮'])('peor caso con "%s": ≤ 1024 caracteres, 15 cantidades y el total exacto', (fill) => {
    const { params, level } = buildStaffTemplate(order(Array.from({ length: 15 }, (_, index) => line(index, fill)), fill), '5215500001234');
    const body = hydrateStaffTemplate(params);
    expect([...body].length).toBeLessThanOrEqual(MAX_TEMPLATE_BODY_CHARS);
    expect(level).toBe(3);
    expect(params.lineas?.split('; ')).toHaveLength(15);
    expect(params.total).toBe('$37,035');
    for (const value of Object.values(params)) expect(value).not.toMatch(/[\n\t]| {4}/);
  });
});
