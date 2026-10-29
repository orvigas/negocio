import { describe, expect, it } from 'vitest';

import { BUSINESS, BUSINESS_IDS, type BusinessId } from '@restaurante/core/shared';

import { botText, getBankAccount } from '../../src/content/bot.ts';
import { buildCatalog, type BotCatalog, type CatalogProduct } from '../../src/services/whatsapp-bot/catalog.ts';
import { createDeterministicInterpreter } from '../../src/services/whatsapp-bot/interpreter/deterministic.ts';
import {
  addedLineBlock,
  cartView,
  clarifyQuestion,
  confirmedMessage,
  fixedNoticeMessage,
  greeting,
  hoursAndLocation,
  menuProductBlock,
  menuText,
  orderCapContactMessage,
  orderLineBlock,
  otherBusiness,
  paymentPrompt,
  personContact,
  staffFailedMessage,
  summary,
  type CartLine,
  type OrderDetails,
} from '../../src/services/whatsapp-bot/messages.ts';
import { TWILIO_MAX_TEXT_CHARS } from '../../src/services/whatsapp-bot/providers/twilio/twilio-bot.ts';
import { INDENT, MAX_LINE_WIDTH, chunkText, emojiCount, fill, splitMessage, visibleWidth } from '../../src/services/whatsapp-bot/text.ts';
import { runFlowScripts } from '../support/bot-golden.ts';
import { ANA, VALID_INPUTS, makeProductRepository } from '../support/products.ts';
import { makeTwilioBotHarness } from '../support/twilio.ts';
import { WEEK, mx } from '../support/whatsapp.ts';

/**
 * Formato de los textos del bot al cliente (REQ-F-029): ancho visible, bloques del menú y del
 * pedido, separación, emojis, contacto en su renglón, redacciones W-1 a W-6 y partición por bloques.
 */

const TUESDAY = mx(`${WEEK.tue}T10:00`);
const { repository } = await makeProductRepository();
const catalogOf = (business: BusinessId): BotCatalog => buildCatalog(business, repository.getPublished(business));
const CATALOGS = { [BUSINESS.MOLOTES]: catalogOf(BUSINESS.MOLOTES), [BUSINESS.BIRRIA]: catalogOf(BUSINESS.BIRRIA) };
const CONTACT = 'https://wa.me/5213300000000';

/** Emojis que ya usaba el bot antes de REQ-F-029 (RF-9: no se agrega ninguno), más 💳 y 🏦 de la forma de pago (REQ-F-035). */
const ALLOWED_EMOJIS = new Set(['💳', '🏦', '👋', '🕒', '🌙', '📋', '🛒', '🙋', '💬', '🤔', '📍', '✅', '🏪', '🛵', '🧹', '🔒', '📝', '🙌', '😋', '🔔', '🔥', '🧀', '🍗', '🥔', '🍄', '🥕', '🌽', '🍹', '🥤', '🍲', '🌮', '🍜']);
const graphemes = new Intl.Segmenter('es', { granularity: 'grapheme' });
const emojisOf = (text: string): string[] => Array.from(graphemes.segment(text), (part) => part.segment).filter((segment) => /\p{Extended_Pictographic}/u.test(segment));

const line = (overrides: Partial<CartLine> = {}): CartLine => ({
  slug: 'queso-oaxaca',
  optionKey: 'orden',
  productName: 'Molotes de Queso Oaxaca',
  optionLabel: 'orden de 3',
  unitPriceCents: 13000,
  quantity: 2,
  detail: '',
  ...overrides,
});
const REFRESCO = line({ slug: 'refrescos', optionKey: 'unico', productName: 'Refrescos Familia Coca-Cola', optionLabel: '', unitPriceCents: 3500, quantity: 1, detail: 'Coca-Cola Sin Azúcar' });

const order = (overrides: Partial<OrderDetails> = {}): OrderDetails => ({
  code: 'M-AB12',
  business: BUSINESS.MOLOTES,
  lines: [line(), REFRESCO],
  name: 'Ana',
  delivery: 'pickup',
  address: undefined,
  notes: '',
  payment: 'cash',
  offHoursOpening: null,
  ...overrides,
});

const product = (name: string, options: [string, number][]): CatalogProduct => ({
  slug: name.toLowerCase().replace(/\W+/g, '-'),
  name,
  options: options.map(([label, priceCents], index) => ({ key: `o${index}`, label, priceCents })),
});
const catalogWith = (products: CatalogProduct[]): BotCatalog => ({ sections: [{ category: 'platillo', products }], products, unavailable: [] });

/** Renglones de un texto. */
const rows = (text: string): string[] => text.split('\n');

describe('ancho visible (REQ-F-029, RF-1)', () => {
  it.each([
    ['abc', 3],
    ['', 0],
    ['12345678901234567890123456789012', 32],
    ['*1.* 🧀 *Hola*', 10],
    ['    pieza $45', 9],
    ['\u00A0\u00A0\u00A0\u00A0x', 1],
    ['\u2007\u2007x', 1],
    ['      x', 3],
    ['Ñandú añejo', 11],
    ['2 × $35 · ok', 12],
    ['✅ sí', 5],
    ['❤️ a', 4],
    ['👨‍👩‍👧 a', 4],
    ['_x_ ~y~', 3],
  ])('"%s" mide %i', (text, width) => {
    expect(visibleWidth(text)).toBe(width);
  });

  it('N = 28 por decisión del usuario (D-9)', () => {
    expect(MAX_LINE_WIDTH).toBe(28);
  });

  it('cuenta los emojis por grafema (con selector de variación o ZWJ cuentan como uno)', () => {
    expect(emojiCount('🧀 y 🥤 ❤️ 👨‍👩‍👧')).toBe(4);
    expect(emojiCount('pieza $45 · orden de 3 $130')).toBe(0);
  });
});

describe('partición por bloques (REQ-F-029, RF-12)', () => {
  const lines = Array.from({ length: 300 }, (_, index) => `línea ${index} ${'x'.repeat(index % 40)}`);

  it.each([100, 500, 1600, 4096])('sin renglones en blanco ni sangría da lo mismo que chunkText (max %i)', (max) => {
    expect(splitMessage(lines.join('\n'), max)).toEqual(chunkText(lines.join('\n'), max));
  });

  it('nunca separa un renglón de los renglones con sangría que lo siguen ni deja renglones en blanco en los bordes', () => {
    const blocks = Array.from({ length: 60 }, (_, index) => `*${index + 1}.* Producto ${index}\n${INDENT}_detalle ${index}_\n${INDENT}${index} × $10 c/u = $${index * 10}`);
    const text = ['Título', ...blocks].join('\n\n');
    for (const max of [80, 200, 333, 1600]) {
      const parts = splitMessage(text, max);
      for (const part of parts) {
        expect(part.length).toBeLessThanOrEqual(max);
        expect(part).not.toMatch(/^\s|\s$/);
        expect(part).not.toContain('\n\n\n');
      }
      for (const block of blocks) expect(parts.some((part) => part.includes(block)), block).toBe(true);
      expect(parts.join('\n\n')).toBe(text);
    }
  });

  it('un encabezado en negrita se queda con el bloque que encabeza', () => {
    const text = `${'a'.repeat(30)}\n\n*BEBIDAS*\n\n*9.* Agua\n${INDENT}$35`;
    const parts = splitMessage(text, 45);
    expect(parts).toEqual(['a'.repeat(30), `*BEBIDAS*\n\n*9.* Agua\n${INDENT}$35`]);
  });

  it('un bloque más largo que el límite se parte por renglones; un texto vacío no da partes', () => {
    const block = ['Nombre', ...Array.from({ length: 30 }, (_, index) => `${INDENT}renglón ${index}`)].join('\n');
    const parts = splitMessage(`Antes\n\n${block}\n\nDespués`, 120);
    expect(parts.every((part) => part.length <= 120)).toBe(true);
    expect(parts.join('\n')).toContain('renglón 29');
    expect(splitMessage('')).toEqual([]);
    expect(splitMessage('\n\n\n')).toEqual([]);
  });
});

describe('menú (REQ-F-029, RF-3; CA-1 y CA-2)', () => {
  it.each(BUSINESS_IDS)('%s: nombre y precios en renglones distintos, precios de hasta 28 (D-9) y un renglón en blanco entre productos', (business) => {
    const menu = menuText(business, CATALOGS[business]);
    const lines = rows(menu);
    const names = lines.flatMap((text, index) => (/^\*\d+\.\* /.test(text) ? [index] : []));
    expect(names).toHaveLength(CATALOGS[business].products.length);
    for (const index of names) {
      expect(lines[index]).not.toContain('$');
      expect(lines[index + 1]?.startsWith(INDENT)).toBe(true);
      // Antes de cada producto, exactamente un renglón en blanco.
      expect(lines[index - 1]).toBe('');
      expect(lines[index - 2]).not.toBe('');
    }
    const prices = lines.filter((text) => text.startsWith(INDENT));
    for (const price of prices) expect(price).toContain('$');
    for (const price of prices) expect(visibleWidth(price)).toBeLessThanOrEqual(MAX_LINE_WIDTH);
    expect(menu).not.toContain('\n\n\n');
    expect(menu.endsWith(botText.menuPrompt.slice(-30))).toBe(true);
  });

  it('encabezados de sección en negrita y mayúsculas, con un renglón en blanco antes y después', () => {
    const molotes = menuText(BUSINESS.MOLOTES, CATALOGS.molotes);
    expect(molotes).toContain('\n\n*MOLOTES*\n\n*1.* 🧀 *Molotes de Queso Oaxaca*\n    pieza $45 · orden de 3 $130\n\n*2.*');
    expect(molotes).toContain('\n\n*BEBIDAS*\n\n*9.* 🍹 *Aguas Frescas Naturales del Día*\n    $35\n\n');
  });

  it('CA-2: las opciones que no caben juntas en 28 van una por renglón', () => {
    const birria = menuText(BUSINESS.BIRRIA, CATALOGS.birria);
    expect(birria).toContain('*6.* 🥤 *Bebidas Frías del Comal*\n    Aguas Frescas $35\n    Coca-Cola Vidrio $35');
    // "Con Carne $80 · Sin Carne $45" mide 29: no cabe en 28.
    expect(birria).toContain('*4.* 🍲 *Tazón de Consomé Chico*\n    Con Carne $80\n    Sin Carne $45');
    expect(birria).toContain('*5.* 🍜 *Birriamen Artesanal*\n    Grande $155 · Chica $110');
  });

  it('casos límite: sin emoji, sin etiqueta, 3 opciones, etiqueta de más de 28 y nombre de 80', () => {
    expect(menuProductBlock(1, undefined, product('Café', [['', 3000]]))).toBe('*1.* *Café*\n    $30');
    expect(menuProductBlock(2, '🍲', product('Caldo', [['Chica', 500], ['Media', 600], ['Gde', 700]]))).toBe('*2.* 🍲 *Caldo*\n    Chica $5 · Media $6 · Gde $7');
    // 36 de ancho: no caben juntas.
    expect(menuProductBlock(2, '🍲', product('Caldo', [['Chico', 5000], ['Mediano', 6000], ['Grande', 7000]]))).toBe(
      '*2.* 🍲 *Caldo*\n    Chico $50\n    Mediano $60\n    Grande $70',
    );
    const label = 'Etiqueta de una opción larguísima de verdad';
    expect(menuProductBlock(3, undefined, product('Plato', [[label, 9000], ['Otra', 1000]]))).toBe(`*3.* *Plato*\n    ${label} $90\n    Otra $10`);
    const name = 'N'.repeat(80);
    expect(menuProductBlock(4, '🧀', product(name, [['pieza', 4500], ['orden de 3', 13000]]))).toBe(`*4.* 🧀 *${name}*\n    pieza $45 · orden de 3 $130`);
  });
});

describe('líneas del pedido, carrito, "Agregado" y resumen (REQ-F-029, RF-4 y RF-5; CA-4)', () => {
  it('bloque de línea con y sin detalle', () => {
    expect(orderLineBlock(line(), '*1.*')).toBe('*1.* Molotes de Queso Oaxaca (orden de 3)\n    2 × $130 c/u = $260');
    expect(orderLineBlock(REFRESCO, '-')).toBe('- Refrescos Familia Coca-Cola\n    _Coca-Cola Sin Azúcar_\n    1 × $35 c/u = $35');
    expect(addedLineBlock(REFRESCO)).toBe('- 1 × Refrescos Familia Coca-Cola\n    _Coca-Cola Sin Azúcar_');
    expect(addedLineBlock(line())).toBe('- 2 × Molotes de Queso Oaxaca (orden de 3)');
  });

  it('carrito: título, bloques, total en negrita separado por renglones en blanco', () => {
    expect(cartView([line(), REFRESCO])).toBe(
      [
        '🛒 *Tu pedido*',
        '',
        '*1.* Molotes de Queso Oaxaca (orden de 3)',
        '    2 × $130 c/u = $260',
        '*2.* Refrescos Familia Coca-Cola',
        '    _Coca-Cola Sin Azúcar_',
        '    1 × $35 c/u = $35',
        '',
        '*Total: $295*',
      ].join('\n'),
    );
  });

  it('resumen para recoger, en horario', () => {
    expect(summary(order(), CONTACT)).toBe(
      [
        '📝 *Resumen de tu pedido*',
        '*M-AB12* · Moloteando',
        '',
        '- Molotes de Queso Oaxaca (orden de 3)',
        '    2 × $130 c/u = $260',
        '- Refrescos Familia Coca-Cola',
        '    _Coca-Cola Sin Azúcar_',
        '    1 × $35 c/u = $35',
        '',
        '*Total: $295*',
        '',
        '🏪 *Entrega:* Recoger en sucursal',
        '💳 *Pago:* Efectivo',
        '*Nombre:* Ana',
        '*Notas:* Sin notas',
        '',
        '✅ Escribe *sí* para confirmar.',
        'O escribe una nota para agregarla.',
        'Escribe *cancelar* para cancelar.',
      ].join('\n'),
    );
  });

  it('resumen a domicilio, fuera de horario, con dirección y notas largas', () => {
    const address = `Calle ${'a'.repeat(190)} #10`;
    const notes = 'n'.repeat(200);
    const text = summary(order({ delivery: 'delivery', address, notes, payment: 'onDelivery', offHoursOpening: 'el martes a las 08:30' }), CONTACT);
    expect(text).toContain(`\n\n🛵 *Entrega:* A domicilio\n${address}\n💳 *Pago:* Pagar al recibir\n*Nombre:* Ana\n*Notas:* ${notes}\nEl personal te confirmará el costo del envío.\n\n`);
    expect(text).toContain('\n\n🌙 *FUERA DE HORARIO*\nTu pedido se atenderá cuando abramos, el martes a las 08:30.\n\n✅ Escribe *sí*');
  });
});

describe('aclaración (REQ-F-029, RF-1; DEF-001)', () => {
  it('cada opción es un bloque como el del menú: nombre en su renglón y el precio debajo, con sangría', () => {
    const text = clarifyQuestion([
      { fragment: 'consomé', options: [{ label: 'Tazón de Consomé Grande', price: '$140' }, { label: 'Tazón de Consomé Chico (Con Carne)', price: '$80' }] },
      { fragment: 'una bebida', options: [{ label: 'Bebidas Frías del Comal (Aguas Frescas)', price: '$35' }, { label: 'slug-sin-catálogo', price: null }] },
    ]);
    expect(text).toBe(
      [
        'Necesito que me aclares:',
        '',
        '*1) consomé*',
        '*1.* Tazón de Consomé Grande',
        '    $140',
        '*2.* Tazón de Consomé Chico (Con Carne)',
        '    $80',
        '',
        '*2) una bebida*',
        '*1.* Bebidas Frías del Comal (Aguas Frescas)',
        '    $35',
        '*2.* slug-sin-catálogo',
        '',
        'Responde con los números en orden (por ejemplo: *2, 1*) o con los nombres.',
      ].join('\n'),
    );
    for (const row of rows(text)) if (row.includes('$')) expect(row.startsWith(INDENT) && visibleWidth(row) <= MAX_LINE_WIDTH, row).toBe(true);
  });
});

describe('contacto y enlaces en su propio renglón (REQ-F-029, RF-6; CA-5)', () => {
  const contactMessages: [string, string][] = [
    ['person', personContact(BUSINESS.MOLOTES, CONTACT)],
    ['staffFailed', staffFailedMessage(order(), CONTACT)],
    ['orderCapContact', orderCapContactMessage(order(), CONTACT)],
    ['orderLimitReached', fixedNoticeMessage('orderLimitReached', BUSINESS.MOLOTES, CONTACT)],
    ['dailyLimitReached', fixedNoticeMessage('dailyLimitReached', BUSINESS.BIRRIA, CONTACT)],
    ['directContactMode', fixedNoticeMessage('directContactMode', BUSINESS.BIRRIA, CONTACT)],
  ];

  it.each(contactMessages)('%s: el contacto va solo en el último renglón, tras una frase que termina en ":"', (_key, text) => {
    const lines = rows(text);
    expect(lines.at(-1)).toBe(CONTACT);
    expect(lines.at(-2)?.endsWith(':')).toBe(true);
  });

  it('horario y ubicación: la URL del mapa va sola en su renglón', () => {
    const lines = rows(hoursAndLocation(BUSINESS.MOLOTES));
    expect(lines.at(-2)).toBe('📍 *Ubicación:*');
    expect(lines.at(-1)).toMatch(/^https:\/\/\S+$/);
  });

  it('confirmado: el código en negrita y la indicación en otro párrafo', () => {
    expect(confirmedMessage(order(), CONTACT)).toBe('¡Listo! 🙌\nTu pedido *M-AB12* fue enviado a Moloteando.\n\nEl personal te escribirá para confirmarlo. 😋');
  });
});

describe('redacciones aprobadas W-1 a W-6 (REQ-F-029; CA-10)', () => {
  it('W-1 a W-6', () => {
    expect(botText.keywordsHint).toBe('💬 En cualquier momento,\nescribe:\n*menú* · *carrito* · *cancelar*\n*persona* · *ayuda*');
    expect(botText.orderInvite).toBe('O escríbeme tu pedido, por ejemplo:\n*{ejemplo}*');
    expect(botText.menuPrompt).toBe('Escríbeme tu pedido, por ejemplo:\n*{ejemplo}*\n\nTambién puedes escribir el número de un producto.');
    expect(botText.help).toBe('Puedes escribir tu pedido con tus palabras, por ejemplo:\n*{ejemplo}*\n\nTambién respondo a números de opción y a palabras clave.');
    expect(botText.askData).toBe(
      'Si es todo, envíame:\n- tu nombre\n- 🏪 *recoger* o\n  🛵 *a domicilio*\n  (con tu dirección)\n- 💳 cómo vas a pagar\n\nPor ejemplo:\n*Ana, recoger, efectivo*\n*Ana, domicilio, Calle 5 #10, Centro, transferencia*',
    );
    expect(botText.dataOrProducts).toBe('Tu mensaje trae productos y datos de entrega.\n¿Qué hago?\n*1.* Agregar los productos\n*2.* Son mis datos de entrega');
    expect(botText.offHours).toBe('🌙 *FUERA DE HORARIO*\nTu pedido se atenderá cuando abramos, {apertura}.');
    expect(botText.confirmPrompt).toBe('✅ Escribe *sí* para confirmar.\nO escribe una nota para agregarla.\nEscribe *cancelar* para cancelar.');
  });

  it('el saludo: saludo, lema, estado, opciones, invitación y palabras clave, cada uno en su párrafo', () => {
    const text = greeting(BUSINESS.MOLOTES, TUESDAY, 'America/Mexico_City');
    expect(text.split('\n\n')).toEqual([
      '¡Hola! 👋 Te atiende el asistente de *Moloteando*.',
      'Molotes artesanales recién fritos 🔥, con crema, queso y salsas caseras.',
      '🕒 Estamos abiertos hasta las 15:00.',
      '*¿Qué deseas hacer?*\n*1.* 📋 Ver el menú\n*2.* 🛒 Hacer un pedido\n*3.* 🕒 Horario y ubicación\n*4.* 🙋 Hablar con una persona',
      'O escríbeme tu pedido, por ejemplo:\n*2 molotes de queso 🧀 y una coca 🥤*',
      botText.keywordsHint,
    ]);
  });
});

/** Todo lo que el bot puede decir: las claves de `botText` y las respuestas de los recorridos dorados. */
async function corpus(): Promise<string[]> {
  const sample = { negocio: 'Moloteando', lema: 'Lema', apertura: 'el martes a las 08:30', cierre: '15:00', ejemplo: '2 de queso', producto: 'Producto', max: 15, min: 10 };
  const texts = Object.entries(botText).flatMap(([key, value]) => {
    if (key === 'staffNotice') return []; // Aviso al personal en texto libre: fuera de alcance.
    if (typeof value === 'string') return [fill(value, { ...sample, opciones: '*1.* a', lineas: '- a', otro: 'Birria', aperturaOtro: 'el sábado', horarioOtro: 'sábado', horario: 'martes', mapa: 'https://x', contacto: CONTACT, codigo: 'M-AB12', fragmento: 'x', numero: 1, texto: 'x', cantidad: 3, direccion: 'Calle', motivo: 'x', precio: '$1', total: '$1' })];
    return Object.values(value as Record<string, string>);
  });
  for (const business of BUSINESS_IDS) texts.push(menuText(business, CATALOGS[business]), greeting(business, TUESDAY, 'America/Mexico_City'));
  texts.push(summary(order({ delivery: 'delivery', address: 'Calle 5 #10, Centro', offHoursOpening: 'el martes a las 08:30' }), CONTACT));
  // REQ-F-035: el bloque de transferencia en el resumen y la confirmación, y las preguntas de pago.
  for (const overrides of [{ payment: 'transfer' as const }, { payment: 'transfer' as const, delivery: 'delivery' as const, address: 'Calle 5 #10, Centro' }, { payment: 'transfer' as const, offHoursOpening: 'el martes a las 08:30' }]) {
    texts.push(summary(order(overrides), CONTACT), confirmedMessage(order(overrides), CONTACT));
  }
  texts.push(paymentPrompt('pickup'), paymentPrompt('delivery'));
  await runFlowScripts((_script, _input, result) => texts.push(...result.replies));
  return texts;
}

const ALL = await corpus();

describe('separación, emojis y renglones estructurados en todo lo que dice el bot (REQ-F-029; CA-3)', () => {
  const all = ALL;

  it('RF-7: sin dos renglones en blanco seguidos, sin espacios finales y sin renglones en blanco en los bordes', () => {
    expect(all.length).toBeGreaterThan(100);
    for (const text of all) {
      expect(text, text).not.toContain('\n\n\n');
      expect(text, text).not.toMatch(/^\s|\s$/);
      for (const row of rows(text)) expect(row, text).not.toMatch(/[ \t\u00A0]$/);
    }
  });

  it('RF-9: como mucho dos emojis por renglón y ninguno nuevo', () => {
    for (const text of all) {
      for (const row of rows(text)) expect(emojiCount(row), row).toBeLessThanOrEqual(2);
      for (const emoji of emojisOf(text)) expect(ALLOWED_EMOJIS.has(emoji), emoji).toBe(true);
    }
  });

  it('RF-1: los renglones estructurados sin datos variables miden 28 o menos (D-9)', () => {
    const structured = [
      // Listas fijas (sus elementos) y palabras clave.
      ...[botText.rootOptions, botText.cartOptions, botText.askDelivery, botText.dataOrProducts, paymentPrompt('pickup'), paymentPrompt('delivery')].flatMap((text) => rows(text).filter((row) => row.startsWith('*'))),
      ...rows(botText.keywordsHint),
      ...rows(botText.askData).filter((row) => !row.startsWith('*')), // Los ejemplos son contenido editable (dato variable).
      botText.cartTitle,
      botText.cartEmpty,
      botText.clarifyTitle,
      rows(botText.summaryTitle)[0] ?? '',
      rows(botText.offHours)[0] ?? '',
      ...Object.values(botText.summaryFields),
      // Bloque de transferencia (REQ-F-035): los renglones fijos y los datos de la cuenta.
      ...rows(fill(botText.transferData, { beneficiario: getBankAccount().beneficiary, banco: getBankAccount().bank, clabe: getBankAccount().clabe, codigo: 'M-AB12' })),
      // Precios, cantidades y totales del menú y de los pedidos.
      ...all.flatMap((text) => rows(text).filter((row) => (row.startsWith(INDENT) && !row.startsWith(`${INDENT}_`)) || /^\*Total: /.test(row) || /^\*[A-ZÁÉÍÓÚÑ ]+\*$/.test(row))),
    ];
    for (const row of structured) expect(visibleWidth(row), row).toBeLessThanOrEqual(MAX_LINE_WIDTH);
  });

  it('un renglón del menú copiado y enviado se interpreta igual que el texto plano (CA-9)', () => {
    const interpreter = createDeterministicInterpreter();
    const scope = { business: BUSINESS.MOLOTES, catalog: CATALOGS.molotes, otherCatalog: CATALOGS[otherBusiness(BUSINESS.MOLOTES)] };
    const plain = interpreter.order('1 Molotes de Queso Oaxaca', scope);
    for (const indent of ['', INDENT, '\u00A0\u00A0\u00A0\u00A0', '\u2007\u2007\u2007\u2007']) {
      expect(interpreter.order(`${indent}*1.* 🧀 *Molotes de Queso Oaxaca*`, scope)).toEqual(plain);
    }
  });
});

describe('partición con el límite de Twilio sin cortar bloques (REQ-F-029; CA-7)', () => {
  const blocksIntact = (parts: readonly string[], blocks: readonly string[]): void => {
    for (const part of parts) {
      expect(part.length).toBeLessThanOrEqual(TWILIO_MAX_TEXT_CHARS);
      expect(part.startsWith(' ')).toBe(false);
    }
    for (const block of blocks) expect(parts.some((part) => part.includes(block)), block).toBe(true);
  };

  it('un menú de 50 productos con nombres de 80 caracteres', () => {
    const products = Array.from({ length: 50 }, (_, index) => product(`${'Producto de prueba con un nombre muy largo '.repeat(2)}${index}`.slice(0, 80), [['pieza', 4500], ['orden de 3', 13000]]));
    const menu = menuText(BUSINESS.MOLOTES, catalogWith(products));
    const parts = splitMessage(menu, TWILIO_MAX_TEXT_CHARS);
    expect(parts.length).toBeGreaterThan(1);
    blocksIntact(
      parts,
      products.map((item, index) => menuProductBlock(index + 1, undefined, item)),
    );
  });

  it('un carrito de 15 líneas con detalles de 60 (carrito y resumen)', () => {
    const lines = Array.from({ length: 15 }, (_, index) => line({ slug: `p${index}`, productName: `Producto ${index} ${'x'.repeat(60)}`, detail: 'd'.repeat(60), quantity: index + 1 }));
    const details = order({ lines, delivery: 'delivery', address: 'a'.repeat(200), notes: 'n'.repeat(200) });
    blocksIntact(
      splitMessage(cartView(lines), TWILIO_MAX_TEXT_CHARS),
      lines.map((item, index) => orderLineBlock(item, `*${index + 1}.*`)),
    );
    const parts = splitMessage(summary(details, CONTACT), TWILIO_MAX_TEXT_CHARS);
    expect(parts.length).toBeGreaterThan(1);
    blocksIntact(
      parts,
      lines.map((item) => orderLineBlock(item, '-')),
    );
  });

  it('con Twilio, el orquestador envía el menú largo en partes sin separar un producto de su precio', async () => {
    const { repository: products } = await makeProductRepository();
    for (let index = 0; index < 40; index += 1) {
      const input = { ...VALID_INPUTS.molotesPlatillo, name: `Molote de prueba ${index} ${'con un nombre muy largo para la partición '.repeat(2)}`.slice(0, 80).trim() };
      const created = await products.create(BUSINESS.MOLOTES, { input: { category: 'platillo', ...input } }, ANA);
      await products.update(BUSINESS.MOLOTES, created.id, { input: { ...input, available: true }, expectedVersion: created.version }, ANA);
    }
    const h = await makeTwilioBotHarness({ at: TUESDAY, products });
    await h.say('Hola');
    const parts = await h.say('menú');
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) {
      expect(part.length).toBeLessThanOrEqual(TWILIO_MAX_TEXT_CHARS);
      const lines = rows(part);
      expect(lines[0]?.startsWith(INDENT)).toBe(false);
      lines.forEach((row, index) => {
        if (/^\*\d+\.\* /.test(row)) expect(lines[index + 1]?.startsWith(INDENT), row).toBe(true);
      });
    }
  });
});
