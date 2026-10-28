/**
 * Contrato del logger estructurado que usan core y db. La implementación (JSON por línea,
 * `createLogger`) está en `@restaurante/web` desde REQ-F-039 (P-1): core no tiene E/S.
 * Nunca registrar secretos, tokens ni datos personales: pasar solo campos necesarios.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';
export type LogFields = Record<string, unknown>;
export type LogMethod = (msg: string, fields?: LogFields) => void;

export interface Logger {
  readonly debug: LogMethod;
  readonly info: LogMethod;
  readonly warn: LogMethod;
  readonly error: LogMethod;
}

const ignore: LogMethod = () => {};

/** Logger que no escribe nada (valor por defecto de las fábricas y de las pruebas). */
export const silentLogger: Logger = Object.freeze({ debug: ignore, info: ignore, warn: ignore, error: ignore });
