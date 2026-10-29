/**
 * Logger estructurado mínimo (JSON por línea) sin dependencias. Movido de core/shared (REQ-F-039,
 * P-1): core conserva solo la interfaz `Logger` y `silentLogger`; las apps crean el logger aquí.
 * Nunca registrar secretos, tokens ni datos personales: pasar solo campos necesarios.
 */

const LEVELS = Object.freeze({ debug: 10, info: 20, warn: 30, error: 40, silent: Infinity });

export type LogLevel = keyof typeof LEVELS;
export type LogFields = Record<string, unknown>;
export type LogMethod = (msg: string, fields?: LogFields) => void;

/** Misma forma que `Logger` de core/shared (tipado estructural: son intercambiables). */
export interface Logger {
  readonly debug: LogMethod;
  readonly info: LogMethod;
  readonly warn: LogMethod;
  readonly error: LogMethod;
}

export interface LoggerOptions {
  level?: LogLevel;
  write?: (line: string) => void;
}

/** Serializa un Error sin propiedades arbitrarias (que podrían contener datos sensibles). */
export function serializeError(err: unknown): { name?: string; message: string; stack?: string | undefined } {
  if (!(err instanceof Error)) return { message: String(err) };
  return { name: err.name, message: err.message, stack: err.stack };
}

export function createLogger({ level = 'info', write = (line) => process.stdout.write(line) }: LoggerOptions = {}): Logger {
  if (!Object.hasOwn(LEVELS, level)) throw new TypeError(`Nivel de log inválido: ${level}`);
  const threshold = LEVELS[level];

  const log = (lvl: Exclude<LogLevel, 'silent'>): LogMethod => (msg, fields = {}) => {
    if (LEVELS[lvl] < threshold) return;
    write(`${JSON.stringify({ time: new Date().toISOString(), level: lvl, msg, ...fields })}\n`);
  };

  return Object.freeze({
    debug: log('debug'),
    info: log('info'),
    warn: log('warn'),
    error: log('error'),
  });
}
