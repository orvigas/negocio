import { createLogger, type Logger } from '@restaurante/web';

/** Logger que guarda las líneas (para comprobar que no lleva secretos). */
export function recordingLogger(): Logger & { lines: string[] } {
  const lines: string[] = [];
  return { ...createLogger({ write: (line) => lines.push(line) }), lines };
}
