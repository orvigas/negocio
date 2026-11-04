import type { BotControl } from '@restaurante/core/bot-control';

/**
 * Temporizadores del control del bot en la api (REQ-F-042), el único proceso que los ejecuta:
 *
 * - **Mantenimiento** (RF-11, D-T5 de REQ-F-025): caducidades, retención y reintentos cada hora. La
 *   página "Bot" del /admin actual (landing-pages) ya no lo ejecuta: así cada caducidad se audita una
 *   sola vez (CA-13).
 * - **Refresco periódico** (RF-9, H-2): la pausa y los bloqueos los cambia /admin desde otro proceso.
 *   El refresco perezoso del control solo se dispara al llegar un mensaje y lo evalúa con la copia
 *   anterior; con este temporizador la copia nunca tiene más de `refreshMs` y el primer mensaje
 *   posterior ya ve el cambio (CA-5).
 *
 * Los temporizadores no retienen el proceso. Ninguna llamada lanza (el control registra sus fallos).
 */

export const BOT_MAINTENANCE_MS = 60 * 60 * 1000;

export function startBotControlTimers({
  botControl,
  refreshMs,
  maintenanceMs = BOT_MAINTENANCE_MS,
}: {
  botControl: Pick<BotControl, 'maintenance' | 'refresh'>;
  refreshMs: number;
  maintenanceMs?: number;
}): () => void {
  let refreshing: Promise<void> | null = null;
  const refreshTimer = setInterval(() => {
    if (refreshing) return;
    refreshing = botControl.refresh().finally(() => {
      refreshing = null;
    });
  }, refreshMs);
  const maintenanceTimer = setInterval(() => void botControl.maintenance(), maintenanceMs);
  refreshTimer.unref();
  maintenanceTimer.unref();
  return () => {
    clearInterval(refreshTimer);
    clearInterval(maintenanceTimer);
  };
}
