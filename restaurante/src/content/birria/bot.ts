import { birriaContent } from './index.ts';

/**
 * Textos propios de Birriería El Muñeco en el bot de WhatsApp (REQ-F-009). Los textos del flujo
 * están en src/content/common/bot.ts; el horario sale de ./hours.ts.
 */
export const birriaBot = Object.freeze({
  name: birriaContent.name,
  /** Prefijo del código de referencia del pedido (D-19). */
  codePrefix: 'B',
  tagline: 'Birria de res al estilo tradicional, quesabirrias y consomé 🍲.',
  /**
   * Emoji de cada producto en el menú del bot, por slug. Un producto sin emoji se muestra sin él.
   * Solo es presentación: el intérprete no lo usa.
   */
  emojis: Object.freeze({
    quesabirria: '🧀',
    'taco-de-birria': '🌮',
    'consome-grande': '🍲',
    'consome-chico': '🍲',
    birriamen: '🍜',
    bebidas: '🥤',
  } as Readonly<Record<string, string>>),
  /** Palabras (normalizadas: minúsculas y sin acentos) que identifican a este negocio (RF-3.4). */
  keywords: Object.freeze(['birria', 'birrieria', 'muneco', 'quesabirria']),
  /** Títulos de las secciones del menú por categoría. */
  sections: Object.freeze({ platillo: 'Menú', bebida: 'Bebidas' }),
  /**
   * Vocabulario del intérprete de pedidos (REQ-F-013, RF-10.1), normalizado (minúsculas y sin
   * acentos). Los productos se reconocen además por las palabras de su nombre y de sus variantes;
   * un slug que no está en el catálogo se ignora. Ver "Vocabulario del bot" en el README.
   */
  vocabulary: Object.freeze({
    /** Ejemplo de la invitación a pedir (RF-4.1). */
    example: '3 quesabirrias 🧀 y un consomé chico con carne 🍲',
    /** Ejemplo con comas para "escríbelo separado con comas" (REQ-F-013, OBS-2). */
    separatedExample: '2 tacos, 1 coca',
    /** "birria" no identifica un producto: el mensaje de la landing es "…un pedido de birria" (R-5.1). */
    genericWords: Object.freeze(['birria', 'birrieria']),
    products: Object.freeze({
      'taco-de-birria': { synonyms: ['taco'] },
      birriamen: { synonyms: ['ramen'] },
      bebidas: {
        synonyms: ['bebida', 'refresco'],
        variants: { 'Coca-Cola Vidrio': ['coca', 'refresco', 'sidral'], 'Aguas Frescas': ['agua'] },
        details: [
          { words: 'coca sin azucar', detail: 'Coca-Cola Sin Azúcar', variant: 'Coca-Cola Vidrio' },
          { words: 'sidral', detail: 'Sidral Mundet', variant: 'Coca-Cola Vidrio' },
          { words: 'horchata', detail: 'Horchata', variant: 'Aguas Frescas' },
          { words: 'jamaica', detail: 'Jamaica', variant: 'Aguas Frescas' },
        ],
      },
    }),
  }),
});
