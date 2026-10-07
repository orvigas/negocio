import { birriaContent } from './index.ts';

/**
 * Textos propios de Birriería El Muñeco en el bot de WhatsApp (REQ-F-009). Los textos del flujo
 * están en src/content/common/bot.ts; el horario sale de ./hours.ts.
 */
export const birriaBot = Object.freeze({
  name: birriaContent.name,
  /** Prefijo del código de referencia del pedido (D-19). */
  codePrefix: 'B',
  tagline: 'Birria de res al estilo tradicional, quesabirrias y consomé.',
  /** Palabras (normalizadas: minúsculas y sin acentos) que identifican a este negocio (RF-3.4). */
  keywords: Object.freeze(['birria', 'birrieria', 'muneco', 'quesabirria']),
  /** Títulos de las secciones del menú por categoría. */
  sections: Object.freeze({ platillo: 'Menú', bebida: 'Bebidas' }),
});
