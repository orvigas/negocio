import { molotesContent } from './index.ts';

/**
 * Textos propios de Moloteando en el bot de WhatsApp (REQ-F-009). Los textos del flujo están en
 * src/content/common/bot.ts; el horario sale de ./hours.ts.
 */
export const molotesBot = Object.freeze({
  name: molotesContent.name,
  /** Prefijo del código de referencia del pedido (D-19). */
  codePrefix: 'M',
  tagline: 'Molotes artesanales recién fritos, con crema, queso y salsas caseras.',
  /** Palabras (normalizadas: minúsculas y sin acentos) que identifican a este negocio (RF-3.4). */
  keywords: Object.freeze(['molote', 'molotes', 'moloteando']),
  /** Títulos de las secciones del menú por categoría (las bebidas van aparte, RF-4.2). */
  sections: Object.freeze({ platillo: 'Molotes', bebida: 'Bebidas' }),
  /**
   * Vocabulario del intérprete de pedidos (REQ-F-013, RF-10.1), normalizado (minúsculas y sin
   * acentos). Los productos se reconocen además por las palabras de su nombre; un slug que no está
   * en el catálogo se ignora. Ver "Vocabulario del bot" en el README.
   */
  vocabulary: Object.freeze({
    /** Ejemplo de la invitación a pedir (RF-4.1). */
    example: '2 molotes de queso y una coca',
    /** Ejemplo con comas para "escríbelo separado con comas" (REQ-F-013, OBS-2). */
    separatedExample: '2 de queso, 1 coca',
    /** Palabras que no identifican un producto: todos los platillos son "Molotes de…" (R-5.1). */
    genericWords: Object.freeze(['molote']),
    products: Object.freeze({
      'queso-oaxaca': { synonyms: ['quesillo'] },
      'papas-con-chorizo': { synonyms: ['papa'] },
      'chicharron-prensado': { synonyms: ['chicharron'] },
      'hongos-zetas-epazote': { synonyms: ['zetas', 'setas'] },
      refrescos: {
        synonyms: ['refresco', 'coca', 'soda'],
        details: [
          { words: 'coca sin azucar', detail: 'Coca-Cola Sin Azúcar' },
          { words: 'coca light', detail: 'Coca-Cola Sin Azúcar' },
          { words: 'coca cola', detail: 'Coca-Cola' },
          { words: 'coca', detail: 'Coca-Cola' },
          { words: 'sprite', detail: 'Sprite' },
          { words: 'sidral', detail: 'Sidral Mundet' },
        ],
      },
      'aguas-frescas': {
        synonyms: ['agua'],
        details: [
          { words: 'jamaica', detail: 'Jamaica' },
          { words: 'horchata', detail: 'Horchata' },
          { words: 'limon', detail: 'Limón con chía' },
        ],
      },
    }),
  }),
});
