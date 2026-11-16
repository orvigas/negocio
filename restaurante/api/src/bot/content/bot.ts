import { BUSINESS, type BusinessId } from '@restaurante/core/shared';

import { birriaBot } from './birria/bot.ts';
import { botKeywords, botText, botVocabulary } from './common/bot.ts';
import { getBankAccount, type BankAccount } from './common/payment.ts';
import { molotesBot } from './molotes/bot.ts';

/** Contenido del bot de WhatsApp por negocio (REQ-F-009; CLAUDE.md §7). */

export { botKeywords, botText, botVocabulary, getBankAccount, type BankAccount };

export type BusinessBotContent = typeof molotesBot | typeof birriaBot;

/** Detalle reconocido de un producto (REQ-F-013, RF-8.1): identifica el producto y queda como detalle. */
export interface RecognizedDetail {
  /** Palabras normalizadas que lo identifican ("coca sin azucar"). */
  readonly words: string;
  /** Texto del detalle que ven el cliente y el personal ("Coca-Cola Sin Azúcar"). */
  readonly detail: string;
  /** Etiqueta de la variante que fija, si el producto tiene variantes. */
  readonly variant?: string;
}

/** Vocabulario de un producto, por slug (REQ-F-013, RF-10.1). */
export interface ProductVocabulary {
  readonly synonyms?: readonly string[];
  /** Sinónimos por etiqueta de variante. */
  readonly variants?: Readonly<Record<string, readonly string[]>>;
  readonly details?: readonly RecognizedDetail[];
}

/** Vocabulario del intérprete de un negocio (REQ-F-013, RF-10.1). */
export interface BusinessVocabulary {
  readonly example: string;
  /** Ejemplo de un pedido escrito con comas, para pedir que se reescriba (OBS-2). */
  readonly separatedExample: string;
  readonly genericWords: readonly string[];
  readonly products: Readonly<Record<string, ProductVocabulary>>;
}

const BOT_CONTENT: Readonly<Record<BusinessId, BusinessBotContent>> = Object.freeze({
  [BUSINESS.MOLOTES]: molotesBot,
  [BUSINESS.BIRRIA]: birriaBot,
});

/** El contenido de los dos negocios cumple el contrato del vocabulario (lo verifica `tsc`). */
const VOCABULARY: Readonly<Record<BusinessId, BusinessVocabulary>> = Object.freeze({
  [BUSINESS.MOLOTES]: molotesBot.vocabulary,
  [BUSINESS.BIRRIA]: birriaBot.vocabulary,
});

/** @throws {Error} Si el negocio no existe. */
export function getBotContent(businessId: BusinessId): BusinessBotContent {
  if (!Object.hasOwn(BOT_CONTENT, businessId)) throw new Error(`No hay contenido del bot para el negocio: ${businessId}`);
  return BOT_CONTENT[businessId];
}

/** @throws {Error} Si el negocio no existe. */
export function getBotVocabulary(businessId: BusinessId): BusinessVocabulary {
  if (!Object.hasOwn(VOCABULARY, businessId)) throw new Error(`No hay vocabulario del bot para el negocio: ${businessId}`);
  return VOCABULARY[businessId];
}
