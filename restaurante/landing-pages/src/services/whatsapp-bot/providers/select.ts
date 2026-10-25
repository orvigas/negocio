import type { MetaBotConfig, TwilioBotConfig } from '../../../config/env.ts';
import type { Logger } from '../../../utils/logger.ts';
import type { ChatBot } from '../chat-bot.ts';
import type { FetchLike } from './http-send.ts';
import { WhatsAppBot } from './meta/whatsapp-bot.ts';
import { TwilioBot } from './twilio/twilio-bot.ts';

/**
 * Único punto de selección del proveedor del bot (REQ-F-012, RF-1.3; CA-17): el único módulo que
 * importa `WhatsAppBot` y `TwilioBot`. Cambiar de proveedor solo requiere cambiar
 * `WHATSAPP_BOT_PROVIDER` (y sus variables) y reiniciar la app.
 */

export type { FetchLike };

export interface ChatBotDeps {
  fetch: FetchLike;
  logger: Logger;
  /** Espera antes del reintento (las pruebas la bajan a 0). */
  retryDelayMs?: number;
}

export function createChatBot(config: MetaBotConfig | TwilioBotConfig, deps: ChatBotDeps): ChatBot {
  return config.provider === 'meta' ? new WhatsAppBot({ config, ...deps }) : new TwilioBot({ config, ...deps });
}
