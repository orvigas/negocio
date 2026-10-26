import { describe, expect, it } from 'vitest';

import { BUSINESS, type BusinessId } from '@restaurante/core/shared';
import { toInput } from '@restaurante/core/catalog';

import { botVocabulary, getBotVocabulary } from '../../src/content/bot.ts';
import type { ProductRepository } from '../../src/repositories/product-repository.ts';
import { buildCatalog } from '../../src/services/whatsapp-bot/catalog.ts';
import { createDeterministicInterpreter } from '../../src/services/whatsapp-bot/interpreter/deterministic.ts';
import { allowedEdits, boundedDistance } from '../../src/services/whatsapp-bot/interpreter/fuzzy.ts';
import { canonical, normalizeWord } from '../../src/services/whatsapp-bot/interpreter/tokens.ts';
import type { InterpretScope, InterpretedLine, OrderInterpretation } from '../../src/services/whatsapp-bot/interpreter/types.ts';
import { otherBusiness } from '../../src/services/whatsapp-bot/messages.ts';
import { ANA, VALID_INPUTS, makeProductRepository } from '../support/products.ts';

/**
 * Intérprete determinista de pedidos (REQ-F-013, RF-1, RF-3, RF-8, RF-10; D-3, D-12). Batería de
 * frases de CA-5 y CA-6 contra el catálogo de las semillas (igual a data/<negocio>/current.json),
 * con el producto, la opción, la cantidad y el detalle exactos. Sin red (CA-15).
 */

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

const MOLOTES = await scopeOf(BUSINESS.MOLOTES);
const BIRRIA = await scopeOf(BUSINESS.BIRRIA);

const order = (scope: InterpretScope, text: string): OrderInterpretation => interpreter.order(text, scope);
const linesOf = (scope: InterpretScope, text: string): readonly InterpretedLine[] => order(scope, text).lines;

/** Forma compacta de una línea para comparar: "2 queso-oaxaca/orden" (+ detalle). */
function brief(line: InterpretedLine): string {
  switch (line.kind) {
    case 'item':
      return `${line.quantity} ${line.slug}/${line.optionKey}${line.detail === '' ? '' : ` [${line.detail}]`}`;
    case 'ambiguous':
      return `? ${line.quantity} ${line.candidates.map((candidate) => `${candidate.slug}/${candidate.optionKey}`).join(' | ')}${line.detail === '' ? '' : ` [${line.detail}]`}`;
    case 'unavailable':
      return `no disponible: ${line.name}`;
    case 'otherBusiness':
      return `otro negocio: ${line.fragment}`;
    case 'outOfRange':
      return `fuera de rango: ${line.fragment}`;
    case 'unknown':
      return `no entendido: ${line.fragment}`;
    case 'unclear':
      return `no separable (${line.reason}): ${line.fragment}`;
  }
}

const briefs = (scope: InterpretScope, text: string): string[] => linesOf(scope, text).map(brief);

describe('CA-5: frases de Molotes', () => {
  it.each([
    ['2 molotes de papa y una coca', ['2 papas-con-chorizo/pieza', '1 refrescos/unico [Coca-Cola]']],
    ['quiero una orden de queso', ['1 queso-oaxaca/orden']],
    ['una orden de 3 de queso', ['1 queso-oaxaca/orden']],
    ['3 ordenes de tinga y 2 de chorizo', ['3 tinga-de-pollo/orden', '2 papas-con-chorizo/orden']],
    ['dos de huitlacoche, una de champiñones', ['2 huitlacoche-epazote/pieza', '1 champinones-epazote/pieza']],
    ['2 de chicharon', ['2 chicharron-prensado/pieza']],
    ['un molote de quesillo', ['1 queso-oaxaca/pieza']],
    ['una agua de jamaica', ['1 aguas-frescas/unico [Jamaica]']],
    ['dos cocas sin azucar', ['2 refrescos/unico [Coca-Cola Sin Azúcar]']],
    ['MOLOTES DE HONGOS', ['1 hongos-zetas-epazote/pieza']],
    ['uno de epazote', ['? 1 champinones-epazote/pieza | hongos-zetas-epazote/pieza | huitlacoche-epazote/pieza']],
    ['2 de queso bien doraditos', ['2 queso-oaxaca/pieza [bien doraditos]']],
  ])('"%s"', (text, expected) => {
    expect(briefs(MOLOTES, text)).toEqual(expected);
  });
});

describe('CA-6: frases de Birria', () => {
  it.each([
    ['3 quesabirrias y un consome chico con carne', ['3 quesabirria/unico', '1 consome-chico/v:Con Carne']],
    ['2 tacos y una coca', ['2 taco-de-birria/unico', '1 bebidas/v:Coca-Cola Vidrio']],
    ['un birriamen chico', ['1 birriamen/v:Chica']],
    ['un ramen grande', ['1 birriamen/v:Grande']],
    ['una horchata', ['1 bebidas/v:Aguas Frescas [Horchata]']],
    ['consomé', ['? 1 consome-grande/unico | consome-chico/v:Con Carne | consome-chico/v:Sin Carne']],
    ['2 tacos sin cebolla', ['2 taco-de-birria/unico [sin cebolla]']],
  ])('"%s"', (text, expected) => {
    expect(briefs(BIRRIA, text)).toEqual(expected);
  });

  it('RF-8.4: "sin carne" en el consomé chico es la variante; en otro producto, "sin…" es un detalle', () => {
    expect(briefs(BIRRIA, 'consomé chico sin carne')).toEqual(['1 consome-chico/v:Sin Carne']);
    expect(briefs(BIRRIA, 'un consome chico')).toEqual(['? 1 consome-chico/v:Con Carne | consome-chico/v:Sin Carne']);
    expect(briefs(BIRRIA, 'una bebida')).toEqual(['? 1 bebidas/v:Aguas Frescas | bebidas/v:Coca-Cola Vidrio']);
  });
});

describe('cantidades y presentaciones (RF-1.3, RF-1.5, D-3)', () => {
  it.each([
    ['un par de tinga', '2 tinga-de-pollo/pieza'],
    ['media docena de queso', '6 queso-oaxaca/pieza'],
    ['una docena de queso', '12 queso-oaxaca/pieza'],
    ['veinte de queso', '20 queso-oaxaca/pieza'],
    ['3 órdenes de queso', '3 queso-oaxaca/orden'],
    ['2 piezas de queso', '2 queso-oaxaca/pieza'],
    ['queso', '1 queso-oaxaca/pieza'],
  ])('"%s" -> %s', (text, expected) => {
    expect(briefs(MOLOTES, text)).toEqual([expected]);
  });

  it.each(['0 de queso', '21 de queso', 'veinticinco de queso', 'cero de queso'])('"%s" está fuera de rango (D-12)', (text) => {
    expect(linesOf(MOLOTES, text).map((line) => line.kind)).toEqual(['outOfRange']);
  });

  it('"orden de 5" cuando la orden es de 3 se pregunta (R-6 b)', () => {
    expect(briefs(MOLOTES, 'una orden de 5 de queso')).toEqual(['? 1 queso-oaxaca/pieza | queso-oaxaca/orden']);
  });

  it('la herencia de "orden" es solo dentro del mismo mensaje (D-3)', () => {
    expect(briefs(MOLOTES, '2 de chorizo')).toEqual(['2 papas-con-chorizo/pieza']);
    expect(briefs(MOLOTES, 'una orden de tinga, 2 de queso, 1 pieza de hongos')).toEqual([
      '1 tinga-de-pollo/orden',
      '2 queso-oaxaca/orden',
      '1 hongos-zetas-epazote/pieza',
    ]);
  });

  it('las bebidas no tienen presentación: la herencia no aplica', () => {
    expect(briefs(MOLOTES, '2 ordenes de queso y una coca')).toEqual(['2 queso-oaxaca/orden', '1 refrescos/unico [Coca-Cola]']);
  });

  it('separadores: "y", comas, "+", punto y coma y saltos de línea (RF-1.2)', () => {
    expect(briefs(MOLOTES, '1 queso + 1 tinga; 1 chorizo\n1 hongos y 1 coca')).toHaveLength(5);
  });
});

describe('líneas, límites y fragmentos (RF-1.6 a RF-1.10, RN-13)', () => {
  it('RF-1.7: interpreta hasta 15 líneas por mensaje y cuenta las demás', () => {
    const text = Array.from({ length: 17 }, () => '1 queso').join(', ');
    const result = order(MOLOTES, text);
    expect(result.lines).toHaveLength(15);
    expect(result.overflow).toBe(2);
  });

  it('CA-9: "jsjsj y 2 tacos" agrega los tacos y cita lo que no entendió', () => {
    expect(briefs(BIRRIA, 'jsjsj y 2 tacos')).toEqual(['no entendido: jsjsj', '2 taco-de-birria/unico']);
  });

  it('el relleno y el saludo no son fragmentos no entendidos (RF-1.4)', () => {
    expect(briefs(MOLOTES, 'Hola, buenas tardes, por favor')).toEqual([]);
    expect(briefs(MOLOTES, 'hola!! 👋 quiero 2 de queso porfa 🙏')).toEqual(['2 queso-oaxaca/pieza']);
  });

  it('el mensaje de cada landing expresa intención y no agrega nada (RF-4.2, R-5.1)', () => {
    const molotes = order(MOLOTES, 'Hola, quiero hacer un pedido de molotes');
    expect(molotes.intent).toBe(true);
    expect(molotes.lines).toEqual([]);
    const birria = order(BIRRIA, 'Hola, quiero hacer un pedido de birria');
    expect(birria.intent).toBe(true);
    expect(birria.lines).toEqual([]);
  });

  it('CA-8: productos del otro negocio (X-9)', () => {
    expect(briefs(MOLOTES, '2 tacos de birria')).toEqual(['otro negocio: 2 tacos de birria']);
    expect(briefs(BIRRIA, '2 tacos y un molote')).toEqual(['2 taco-de-birria/unico', 'otro negocio: un molote']);
    expect(briefs(MOLOTES, 'una quesabirria')).toEqual(['otro negocio: una quesabirria']);
  });

  it('CA-8: "25 tacos y una coca" rechaza solo la primera línea', () => {
    expect(briefs(BIRRIA, '25 tacos y una coca')).toEqual(['fuera de rango: 25 tacos', '1 bebidas/v:Coca-Cola Vidrio']);
  });

  it('mayúsculas, acentos, emojis y género', () => {
    expect(briefs(MOLOTES, 'DOS DE CHAMPIÑONES 🍄')).toEqual(['2 champinones-epazote/pieza']);
    expect(briefs(BIRRIA, 'Un Birriamen Chica')).toEqual(['1 birriamen/v:Chica']);
    expect(briefs(BIRRIA, 'dos birriamenes grandes')).toEqual(['2 birriamen/v:Grande']);
  });

  it('"con" y "sin": lo que sigue es detalle salvo que nombre al mismo producto', () => {
    expect(briefs(MOLOTES, '2 de tinga con queso')).toEqual(['2 tinga-de-pollo/pieza [con queso]']);
    expect(briefs(MOLOTES, 'champiñones con epazote')).toEqual(['1 champinones-epazote/pieza']);
    expect(briefs(MOLOTES, 'papas con chorizo')).toEqual(['1 papas-con-chorizo/pieza']);
  });

  it('RF-8.1: "sin cebolla, con mucha salsa" sigue el detalle de la línea anterior; un segmento con cantidad no', () => {
    expect(briefs(BIRRIA, '2 tacos sin cebolla, con mucha salsa')).toEqual(['2 taco-de-birria/unico [sin cebolla, con mucha salsa]']);
    expect(briefs(BIRRIA, 'jsjsj, con salsa')).toEqual(['no entendido: jsjsj', 'no entendido: con salsa']);
    expect(briefs(BIRRIA, '2 tacos, 2 con salsa')).toEqual(['2 taco-de-birria/unico', 'no entendido: 2 con salsa']);
  });

  it('RF-8.2: el detalle se recorta a 60 caracteres', () => {
    const [line] = linesOf(BIRRIA, `2 tacos ${'con mucha salsa verde '.repeat(5)}`);
    expect(line?.kind).toBe('item');
    if (line?.kind === 'item') {
      expect([...line.detail].length).toBe(60);
      expect(line.detail.endsWith('…')).toBe(true);
    }
  });

  it('nunca lanza con entradas raras ni con 1000 caracteres', () => {
    for (const text of ['', '   ', '🙂🙂🙂', '#$%&', '1'.repeat(1000), 'y y y , , +', 'de de de con sin', 'a'.repeat(1000), 'queso '.repeat(160)]) {
      expect(() => order(MOLOTES, text)).not.toThrow();
      expect(() => interpreter.answer(text, [], MOLOTES)).not.toThrow();
      expect(() => interpreter.customerData(text)).not.toThrow();
    }
  });
});

describe('correcciones de la ronda 1 de QA (DEF-001 a DEF-003, DEF-005)', () => {
  it.each([
    ['un consome chico, con carne', ['1 consome-chico/v:Con Carne']],
    ['2 tacos y 1 consome chico, con carne', ['2 taco-de-birria/unico', '1 consome-chico/v:Con Carne']],
    ['1 consome, sin carne', ['1 consome-chico/v:Sin Carne']],
    ['1 birriamen, grande', ['1 birriamen/v:Grande']],
    ['1 bebida, coca', ['1 bebidas/v:Coca-Cola Vidrio']],
    ['3 tacos, con carne', ['3 taco-de-birria/unico [con carne]']],
    ['1 consome, carne', ['? 1 consome-chico/v:Con Carne | consome-chico/v:Sin Carne']],
  ])('DEF-001: "%s" completa la línea anterior y no crea otra', (text, expected) => {
    expect(briefs(BIRRIA, text)).toEqual(expected);
  });

  it.each([
    ['2 tacos 1 coca', ['2 taco-de-birria/unico', '1 bebidas/v:Coca-Cola Vidrio']],
    ['2 tacos 1 quesabirria', ['2 taco-de-birria/unico', '1 quesabirria/unico']],
    // OBS-2: el fragmento se marca como no separable; el ejemplo con comas lo pone la conversación.
    ['2 tacos 3', ['no separable (unseparated): 2 tacos 3']],
    ['2 tacos 1 cocacolota', ['no separable (unseparated): 2 tacos 1 cocacolota']],
  ])('DEF-002 (Birria): "%s" se separa con sus cantidades o se pide con comas', (text, expected) => {
    expect(briefs(BIRRIA, text)).toEqual(expected);
  });

  it.each([
    ['dos de tinga 2 de queso', ['2 tinga-de-pollo/pieza', '2 queso-oaxaca/pieza']],
    ['una coca de 600', ['1 refrescos/unico [Coca-Cola, 600]']],
    ['quiero hacer un pedido 2 de queso', ['2 queso-oaxaca/pieza']],
  ])('DEF-002 (Molotes): "%s"', (text, expected) => {
    expect(briefs(MOLOTES, text)).toEqual(expected);
  });

  it.each([
    ['tinga x2', '2 tinga-de-pollo/pieza'],
    ['2x queso', '2 queso-oaxaca/pieza'],
    ['queso x 3', '3 queso-oaxaca/pieza'],
    ['x2 de chorizo', '2 papas-con-chorizo/pieza'],
  ])('DEF-003: "%s" usa la cantidad escrita', (text, expected) => {
    expect(briefs(MOLOTES, text)).toEqual([expected]);
  });

  it('DEF-003: "3 tacos x2" no adivina la cantidad', () => {
    expect(briefs(BIRRIA, '3 tacos x2')).toEqual(['no separable (quantity): 3 tacos x2']);
  });

  it.each([
    ['1 de 3 de tinga', ['1 tinga-de-pollo/orden']],
    ['una de 3 de queso', ['1 queso-oaxaca/orden']],
    ['2 de 3 de queso', ['2 queso-oaxaca/orden']],
    ['dos de 3 de queso', ['2 queso-oaxaca/orden']],
    ['2 de queso 1 de 3 de tinga', ['2 queso-oaxaca/pieza', '1 tinga-de-pollo/orden']],
    ['2 de queso, 1 de 3 de tinga', ['2 queso-oaxaca/pieza', '1 tinga-de-pollo/orden']],
    ['1 de 3 de tinga, 2 de queso', ['1 tinga-de-pollo/orden', '2 queso-oaxaca/orden']],
    ['1 de 5 de tinga', ['? 1 tinga-de-pollo/pieza | tinga-de-pollo/orden']],
  ])('DEF-006: "%s" son N órdenes de M (o una pregunta si M no es la orden), sin número en el detalle', (text, expected) => {
    expect(briefs(MOLOTES, text)).toEqual(expected);
  });

  it.each([
    ['3 tacos de 2 tortillas', '3 taco-de-birria/unico [2 tortillas]'],
    // "3 tacos con 2 tortillas" es OBS-3 (pregunta por "2 tortillas"), aceptada por el usuario.
  ])('DEF-007: "%s" conserva el texto del detalle, no solo el número', (text, expected) => {
    expect(briefs(BIRRIA, text)).toEqual([expected]);
  });

  it('DEF-005: un fragmento con la palabra de entrega no se informa como no entendido', () => {
    const result = order(MOLOTES, 'Hola soy Pedro, quiero 2 de queso, a domicilio en Calle Falsa 123');
    expect(result.hasDeliveryWord).toBe(true);
    for (const line of result.lines) if ('fragment' in line) expect(line.fragment).not.toMatch(/domicilio|Falsa/);
    expect(result.lines.filter((line) => line.kind === 'item').map(brief)).toEqual(['2 queso-oaxaca/pieza']);
  });
});

describe('tolerancia de ortografía (D-12)', () => {
  it('ediciones permitidas por longitud', () => {
    expect([3, 4, 7, 8, 12].map(allowedEdits)).toEqual([0, 1, 1, 2, 2]);
    expect(boundedDistance('chicharon', 'chicharron', 2)).toBe(1);
    expect(boundedDistance('tniga', 'tinga', 1)).toBe(1);
    expect(boundedDistance('abcdef', 'uvwxyz', 2)).toBe(3);
  });

  it.each([
    ['2 de tniga', '2 tinga-de-pollo/pieza'],
    ['1 de huitlacochee', '1 huitlacoche-epazote/pieza'],
    ['1 de huitlakoshe', '1 huitlacoche-epazote/pieza'],
    ['1 de quezo', '1 queso-oaxaca/pieza'],
  ])('"%s" -> %s', (text, expected) => {
    expect(briefs(MOLOTES, text)).toEqual([expected]);
  });

  it('palabras de 3 letras o menos no se corrigen; 2 ediciones en una palabra de 4 a 7 letras tampoco', () => {
    expect(briefs(MOLOTES, '1 ques')).toEqual(['1 queso-oaxaca/pieza']);
    expect(briefs(MOLOTES, '1 qso')).toEqual(['no entendido: 1 qso']);
    expect(briefs(MOLOTES, '1 tnigaa')).toEqual(['no entendido: 1 tnigaa']);
  });

  it('un empate por la tolerancia se pregunta', () => {
    const [line] = linesOf(BIRRIA, 'un tazo');
    expect(line?.kind).toBe('ambiguous');
  });
});

describe('vocabulario configurable (RF-10, CA-16)', () => {
  it('el vocabulario está normalizado (minúsculas y sin acentos)', () => {
    const words = [
      ...botVocabulary.filler,
      ...botVocabulary.intent,
      ...botVocabulary.pickup,
      ...botVocabulary.delivery,
      ...botVocabulary.confirm,
      ...botVocabulary.finish,
      ...botVocabulary.remove,
      ...botVocabulary.add,
      ...botVocabulary.connectors,
      ...Object.keys(botVocabulary.quantityWords),
      ...Object.keys(botVocabulary.quantityPhrases),
    ];
    for (const business of [BUSINESS.MOLOTES, BUSINESS.BIRRIA]) {
      const vocabulary = getBotVocabulary(business);
      words.push(...vocabulary.genericWords);
      for (const product of Object.values(vocabulary.products)) {
        words.push(...(product.synonyms ?? []), ...(product.details ?? []).map((detail) => detail.words), ...Object.values(product.variants ?? {}).flat());
      }
    }
    for (const word of words) expect(word, word).toBe(normalizeWord(word).replace(/[^\p{L}\p{N} ]/gu, '').trim());
  });

  it('los slugs del vocabulario existen en las semillas (un error de escritura se detecta aquí)', () => {
    for (const [business, scope] of [[BUSINESS.MOLOTES, MOLOTES], [BUSINESS.BIRRIA, BIRRIA]] as const) {
      const slugs = scope.catalog.products.map((product) => product.slug);
      for (const slug of Object.keys(getBotVocabulary(business).products)) expect(slugs, slug).toContain(slug);
    }
  });

  it('formas canónicas: plural y género', () => {
    expect(['orden', 'ordenes', 'órdenes'].map((word) => canonical(normalizeWord(word)))).toEqual(['orden', 'orden', 'orden']);
    expect(canonical('chica')).toBe(canonical('chico'));
    expect(canonical('grandes')).toBe(canonical('grande'));
    expect(canonical('papas')).toBe(canonical('papa'));
  });

  it('CA-16: un producto nuevo o renombrado sin sinónimos se reconoce por su nombre', async () => {
    const scope = await scopeOf(BUSINESS.MOLOTES, async (repository) => {
      // Un producto nuevo se crea no disponible; se publica como lo haría la administración.
      const input = { ...VALID_INPUTS.molotesPlatillo, name: 'Molote de Frijol con Queso' };
      const created = await repository.create(BUSINESS.MOLOTES, { input: { category: 'platillo', ...input } }, ANA);
      await repository.update(BUSINESS.MOLOTES, created.id, { input: { ...input, available: true }, expectedVersion: created.version }, ANA);
      const [tinga] = (await repository.list(BUSINESS.MOLOTES)).filter((product) => product.name === 'Molotes de Tinga de Pollo');
      if (!tinga) throw new Error('falta la tinga');
      await repository.update(BUSINESS.MOLOTES, tinga.id, { input: { ...toInput(tinga), name: 'Molotes de Pollo en Mole', available: true }, expectedVersion: tinga.version }, ANA);
    });
    const [frijol] = scope.catalog.products.filter((product) => product.name.includes('Frijol'));
    expect(briefs(scope, '2 de frijol')).toEqual([`2 ${frijol?.slug ?? ''}/pieza`]);
    expect(briefs(scope, 'una orden de mole')).toEqual(['1 tinga-de-pollo/orden']);
  });

  it('CA-16: un sinónimo de un slug que no existe se ignora sin error', async () => {
    const scope = await scopeOf(BUSINESS.MOLOTES, async (repository) => {
      const [papas] = (await repository.list(BUSINESS.MOLOTES)).filter((product) => product.name === 'Molotes de Papas con Chorizo');
      if (!papas) throw new Error('faltan las papas');
      await repository.remove(BUSINESS.MOLOTES, papas.id, papas.version, ANA);
    });
    // "papa" era sinónimo de un producto eliminado: se trata como texto no reconocido (RF-1.9).
    expect(briefs(scope, '2 de papa')).toEqual(['no entendido: 2 de papa']);
    expect(briefs(scope, '2 de queso')).toEqual(['2 queso-oaxaca/pieza']);
  });

  it('RF-1.9: un producto o una variante no disponibles se avisan y no se agregan', async () => {
    const scope = await scopeOf(BUSINESS.BIRRIA, async (repository) => {
      for (const product of await repository.list(BUSINESS.BIRRIA)) {
        if (product.name.startsWith('Taco de Birria')) {
          await repository.update(BUSINESS.BIRRIA, product.id, { input: { ...toInput(product), available: false }, expectedVersion: product.version }, ANA);
        }
        if (product.name === 'Tazón de Consomé Chico') {
          const input = { ...toInput(product), available: true } as Record<string, unknown>;
          input.variants = (input.variants as Record<string, unknown>[]).map((variant, index) => ({ ...variant, available: index !== 0 }));
          await repository.update(BUSINESS.BIRRIA, product.id, { input, expectedVersion: product.version }, ANA);
        }
      }
    });
    expect(briefs(scope, '2 tacos')).toEqual(['no disponible: Taco de Birria con Tortilla de Mano']);
    expect(briefs(scope, 'un consome chico con carne')).toEqual(['no disponible: Tazón de Consomé Chico (Con Carne)']);
    expect(briefs(scope, 'un consome chico sin carne')).toEqual(['1 consome-chico/v:Sin Carne']);
  });
});

describe('respuesta a una aclaración (RF-3.3)', () => {
  const blocksOf = (scope: InterpretScope, text: string) =>
    linesOf(scope, text).flatMap((line) => (line.kind === 'ambiguous' ? [{ fragment: line.fragment, quantity: line.quantity, detail: line.detail, candidates: line.candidates }] : []));

  it('con números en orden, con nombres o en parte', () => {
    const blocks = blocksOf(BIRRIA, 'consomé y una bebida');
    expect(blocks).toHaveLength(2);
    expect(interpreter.answer('2, 1', blocks, BIRRIA).choices).toEqual([1, 0]);
    expect(interpreter.answer('2 1', blocks, BIRRIA).choices).toEqual([1, 0]);
    expect(interpreter.answer('chico con carne y coca', blocks, BIRRIA).choices).toEqual([1, 1]);
    expect(interpreter.answer('grande', blocks, BIRRIA).choices).toEqual([0, null]);
    expect(interpreter.answer('9', blocks, BIRRIA).choices).toEqual([null, null]);
  });

  it('otro pedido en lugar de la respuesta', () => {
    const blocks = blocksOf(MOLOTES, 'uno de epazote');
    expect(interpreter.answer('hongos', blocks, MOLOTES).choices).toEqual([1]);
    expect(interpreter.answer('2 de queso', blocks, MOLOTES)).toEqual({ choices: [null], looksLikeOrder: true });
  });
});

describe('datos del cliente (RF-5.2, CA-12)', () => {
  it.each([
    ['Juan, recoger', { name: 'Juan', delivery: 'pickup' }],
    ['Ana, domicilio, Calle 5 #10, Col. Centro, junto a la farmacia', { name: 'Ana', delivery: 'delivery', address: 'Calle 5 #10, Col. Centro, junto a la farmacia' }],
    ['Ana, domicilio', { name: 'Ana', delivery: 'delivery' }],
    ['soy Juan Pérez y paso a recoger', { name: 'Juan Pérez', delivery: 'pickup' }],
    ['Juan para recoger a las 3', { name: 'Juan', delivery: 'pickup', note: 'a las 3' }],
    ['a domicilio: Av. Reforma 222', { delivery: 'delivery', address: 'Av. Reforma 222' }],
    ['Tina, envío a Calle Tinga 5', { name: 'Tina', delivery: 'delivery', address: 'Calle Tinga 5' }],
    ['Juan', {}],
  ])('"%s"', (text, expected) => {
    expect(interpreter.customerData(text)).toEqual(expected);
  });
});
