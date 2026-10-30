import { silentLogger, type Logger } from '@restaurante/core/shared';
import { createBotControl, createMemoryBotControlStore, type BotControl, type BotControlStore, type BotLimits } from '@restaurante/core/bot-control';

import type { Config } from '../../src/config/env.ts';

/**
 * Protección del bot para las pruebas (REQ-F-025): store en memoria salvo que se pase otro (p. ej.
 * el de Prisma sobre la base de pruebas), ya inicializada.
 */
export async function makeBotControl(
  config: Config,
  { now = () => new Date(), store = createMemoryBotControlStore(), logger = silentLogger, limits = config.botLimits }: { now?: () => Date; store?: BotControlStore; logger?: Logger; limits?: BotLimits } = {},
): Promise<BotControl> {
  const control = createBotControl({
    store,
    keys: config.botKeys,
    limits,
    timeZone: config.timezone,
    staff: config.whatsappBot ? Object.values(config.whatsappBot.staff) : [],
    logger,
    now,
  });
  await control.init();
  return control;
}
