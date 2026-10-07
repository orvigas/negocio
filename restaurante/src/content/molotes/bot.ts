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
});
