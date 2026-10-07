import { BUSINESS, type BusinessId } from '../config/businesses.ts';
import { birriaBot } from './birria/bot.ts';
import { botText } from './common/bot.ts';
import { molotesBot } from './molotes/bot.ts';

/** Contenido del bot de WhatsApp por negocio (REQ-F-009; CLAUDE.md §7). */

export { botText };

export type BusinessBotContent = typeof molotesBot | typeof birriaBot;

const BOT_CONTENT: Readonly<Record<BusinessId, BusinessBotContent>> = Object.freeze({
  [BUSINESS.MOLOTES]: molotesBot,
  [BUSINESS.BIRRIA]: birriaBot,
});

/** @throws {Error} Si el negocio no existe. */
export function getBotContent(businessId: BusinessId): BusinessBotContent {
  if (!Object.hasOwn(BOT_CONTENT, businessId)) throw new Error(`No hay contenido del bot para el negocio: ${businessId}`);
  return BOT_CONTENT[businessId];
}
