import { describe, expect, it } from 'vitest';

import { BUSINESS, type BusinessId } from '../../src/config/businesses.ts';
import { botText, getBotContent } from '../../src/content/bot.ts';
import type { ProductRepository } from '../../src/repositories/product-repository.ts';
import { buildCatalog } from '../../src/services/whatsapp-bot/catalog.ts';
import { createDeterministicInterpreter } from '../../src/services/whatsapp-bot/interpreter/deterministic.ts';
import type { InterpretScope } from '../../src/services/whatsapp-bot/interpreter/types.ts';
import {
  buildStaffTemplate,
  exampleOf,
  greeting,
  menuText,
  otherBusiness,
  summary,
  type OrderDetails,
} from '../../src/services/whatsapp-bot/messages.ts';
import { TWILIO_MAX_TEXT_CHARS } from '../../src/services/whatsapp-bot/providers/twilio/twilio-bot.ts';
import { codePointLength } from '../../src/services/whatsapp-bot/text.ts';
import { ANA, VALID_INPUTS, makeProductRepository } from '../support/products.ts';
import { makeTwilioBotHarness } from '../support/twilio.ts';
import { WEEK, makeBotHarness, mx } from '../support/whatsapp.ts';

/**
 * Emojis en los textos del bot: solo presentación. El intérprete los ignora, así que un cliente
 * que copie un texto del bot se entiende igual; nunca llegan a la plantilla de Meta; acompañan a
 * la palabra (como mucho dos por línea) y el saludo con el menú sigue cabiendo en Twilio.
 */

const EMOJI = /\p{Extended_Pictographic}/u;
const EMOJIS = /\p{Extended_Pictographic}/gu;
const stripEmojis = (text: string): string => text.replace(EMOJIS, '').replace(/\uFE0F/g, '').replace(/ {2,}/g, ' ').replace(/ ([.,*])/g, '$1').trim();
const emojiCount = (line: string): number => line.match(EMOJIS)?.length ?? 0;

const TUESDAY = mx(`${WEEK.tue}T10:00`);
const SATURDAY = mx(`${WEEK.sat}T10:00`);
const BUSINESSES = [
  [BUSINESS.MOLOTES, TUESDAY],
  [BUSINESS.BIRRIA, SATURDAY],
] as const;

const interpreter = createDeterministicInterpreter();

async function scopeOf(business: BusinessId, change?: (repository: ProductRepository) => Promise<void>): Promise<InterpretScope> {
  const { repository } = await makeProductRepository();
  if (change) await change(repository);
  return {
    business,
    catalog: buildCatalog(business, repository.getPublished(business)),
    otherCatalog: buildCatalog(otherBusiness(business), repository.getPublished(otherBusiness(business))),
  };
}

const SCOPES = { [BUSINESS.MOLOTES]: await scopeOf(BUSINESS.MOLOTES), [BUSINESS.BIRRIA]: await scopeOf(BUSINESS.BIRRIA) };

describe('el intérprete entiende igual los textos del bot copiados con emojis', () => {
  it.each([
    [BUSINESS.MOLOTES, '2 molotes de queso y una coca'],
    [BUSINESS.BIRRIA, '3 quesabirrias y un consomé chico con carne'],
  ])('%s: el ejemplo con emojis da las mismas líneas que sin ellos', (business, plain) => {
    const example = exampleOf(business);
    expect(example).toMatch(EMOJI);
    expect(stripEmojis(example)).toBe(plain);
    const scope = SCOPES[business];
    const withEmojis = interpreter.order(example, scope);
    expect(withEmojis).toEqual(interpreter.order(plain, scope));
    expect(withEmojis.lines.length).toBeGreaterThan(0);
    expect(withEmojis.lines.every((line) => line.kind === 'item' && !EMOJI.test(line.detail))).toBe(true);
  });

  it('una línea del menú copiada con su emoji se interpreta igual que sin él', () => {
    const scope = SCOPES[BUSINESS.MOLOTES];
    expect(interpreter.order('2 🧀 Molotes de Queso Oaxaca', scope)).toEqual(interpreter.order('2 Molotes de Queso Oaxaca', scope));
    const birria = SCOPES[BUSINESS.BIRRIA];
    expect(interpreter.order('un 🍜 Birriamen Artesanal grande', birria)).toEqual(interpreter.order('un Birriamen Artesanal grande', birria));
  });

  it.each([
    ['🏪 Recoger en sucursal', 'Recoger en sucursal'],
    ['Ana, 🛵 A domicilio, Calle 5 #10', 'Ana, A domicilio, Calle 5 #10'],
  ])('datos de entrega copiados con emoji: "%s"', (copied, plain) => {
    expect(interpreter.customerData(copied)).toEqual(interpreter.customerData(plain));
  });

  it.each(BUSINESSES)('%s: en la conversación, el ejemplo copiado deja el mismo carrito que sin emojis', async (business, at) => {
    const copied = await makeBotHarness({ at });
    const plain = await makeBotHarness({ at });
    await copied.ask('Hola');
    await plain.ask('Hola');
    const reply = await copied.ask(exampleOf(business));
    expect(reply).toBe(await plain.ask(stripEmojis(exampleOf(business))));
    expect(reply).toContain('✅ Agregado:');
    expect(reply).not.toContain('No entendí');
  });
});

describe('emojis de los productos en el menú', () => {
  it.each(BUSINESSES)('%s: cada slug con emoji existe en las semillas y cada producto de las semillas tiene uno', (business) => {
    const slugs = SCOPES[business].catalog.products.map((product) => product.slug);
    const emojis = getBotContent(business).emojis;
    for (const slug of Object.keys(emojis)) expect(slugs, slug).toContain(slug);
    for (const slug of slugs) expect(emojis[slug], slug).toMatch(EMOJI);
  });

  it('el emoji acompaña al nombre del producto', () => {
    const menu = menuText(BUSINESS.MOLOTES, SCOPES[BUSINESS.MOLOTES].catalog);
    expect(menu).toContain('*1.* 🧀 *Molotes de Queso Oaxaca*\n    pieza $45 · orden de 3 $130');
    expect(menu).toContain('*10.* 🥤 *Refrescos Familia Coca-Cola*\n    $35');
    expect(menuText(BUSINESS.BIRRIA, SCOPES[BUSINESS.BIRRIA].catalog)).toContain('*5.* 🍜 *Birriamen Artesanal*\n    Grande $155 · Chica $110');
  });

  it('un producto sin emoji asignado se muestra sin emoji y sin error', async () => {
    const scope = await scopeOf(BUSINESS.MOLOTES, async (repository) => {
      const input = { ...VALID_INPUTS.molotesPlatillo, name: 'Molote de Frijol con Queso' };
      const created = await repository.create(BUSINESS.MOLOTES, { input: { category: 'platillo', ...input } }, ANA);
      await repository.update(BUSINESS.MOLOTES, created.id, { input: { ...input, available: true }, expectedVersion: created.version }, ANA);
    });
    const frijol = scope.catalog.products.find((product) => product.name === 'Molote de Frijol con Queso');
    expect(frijol).toBeDefined();
    expect(getBotContent(BUSINESS.MOLOTES).emojis[frijol?.slug ?? '']).toBeUndefined();
    const line = menuText(BUSINESS.MOLOTES, scope.catalog)
      .split('\n')
      .find((text) => text.includes('Molote de Frijol con Queso'));
    expect(line).toMatch(/^\*\d+\.\* \*Molote de Frijol con Queso\*$/);
  });
});

describe('uso moderado y accesible de los emojis', () => {
  const order: OrderDetails = {
    code: 'M-T001',
    business: BUSINESS.MOLOTES,
    lines: [{ slug: 'queso-oaxaca', optionKey: 'orden', productName: 'Molotes de Queso Oaxaca', optionLabel: 'orden de 3', unitPriceCents: 13000, quantity: 2, detail: '' }],
    name: 'Ana',
    delivery: 'delivery',
    address: 'Calle 5 #10',
    notes: '',
    offHoursOpening: 'mañana a las 9:00',
  };

  it('como mucho dos emojis por línea y nunca una línea solo de emojis', () => {
    const texts = [
      ...Object.values(botText).flatMap((value) => (typeof value === 'string' ? [value] : [])),
      ...BUSINESSES.flatMap(([business, at]) => [greeting(business, at, 'America/Mexico_City'), menuText(business, SCOPES[business].catalog)]),
      summary(order),
    ];
    for (const text of texts) {
      for (const line of text.split('\n')) {
        expect(emojiCount(line), line).toBeLessThanOrEqual(2);
        if (emojiCount(line) > 0) expect(line, line).toMatch(/\p{L}{2,}/u);
      }
    }
  });

  it('el resumen acompaña la forma de entrega con su ícono', () => {
    expect(summary(order)).toContain('🛵 *Entrega:* A domicilio\nCalle 5 #10');
    expect(summary({ ...order, delivery: 'pickup', address: undefined })).toContain('🏪 *Entrega:* Recoger en sucursal');
  });

  it('los parámetros de la plantilla de Meta no llevan emojis (su texto lo fija la plantilla aprobada)', () => {
    for (const candidate of [order, { ...order, delivery: 'pickup' as const, address: undefined, offHoursOpening: null }]) {
      const { params } = buildStaffTemplate(candidate, '5215500001234');
      for (const [name, value] of Object.entries(params)) expect(value, name).not.toMatch(EMOJI);
    }
  });
});

describe('Twilio: el saludo con el menú y emojis cabe en un mensaje', () => {
  it.each(BUSINESSES)('%s: un solo mensaje de 1600 o menos en UTF-16 y en puntos de código', async (_business, at) => {
    const h = await makeTwilioBotHarness({ at });
    const reply = await h.say('Hola, quiero hacer un pedido');
    expect(reply).toHaveLength(1);
    const text = reply[0] ?? '';
    expect(text).toMatch(EMOJI);
    // `length` cuenta unidades UTF-16 (un emoji vale 2): es como lo mide el código al partir mensajes.
    expect(text.length).toBeLessThanOrEqual(TWILIO_MAX_TEXT_CHARS);
    expect(codePointLength(text)).toBeLessThanOrEqual(TWILIO_MAX_TEXT_CHARS);
    expect(text.length).toBeGreaterThan(codePointLength(text));
  });
});
