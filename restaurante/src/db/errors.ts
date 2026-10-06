import { errorProp } from '../utils/errors.ts';

/**
 * Errores de la base de datos con el servidor en marcha (REQ-F-007, DT-9 y R-3).
 *
 * Los mensajes de Prisma incluyen la invocación y rutas de archivo: nunca se registran ni se
 * muestran. Solo se conservan el nombre y los códigos (P2xxx y el SQLITE_* original).
 */

/** La base de datos no responde: /admin responde 503. */
export class DatabaseUnavailableError extends Error {
  readonly status = 503;
  readonly expose = false;
  readonly details: DatabaseErrorDetails;

  constructor(details: DatabaseErrorDetails) {
    super('Base de datos no disponible');
    this.name = 'DatabaseUnavailableError';
    this.details = details;
  }
}

export interface DatabaseErrorDetails {
  name: string | undefined;
  code: string | undefined;
  originalCode: string | undefined;
}

const asString = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

/** Campos seguros de un error de Prisma/SQLite para el log. */
export function databaseErrorDetails(err: unknown): DatabaseErrorDetails {
  const adapterError = errorProp(errorProp(err, 'meta'), 'driverAdapterError');
  const cause = errorProp(adapterError ?? err, 'cause');
  return {
    name: asString(errorProp(err, 'name')),
    code: asString(errorProp(err, 'code')),
    originalCode: asString(errorProp(cause, 'originalCode')),
  };
}

/** Violación de unicidad (p. ej. usuario repetido en una carrera entre dos peticiones). */
export const isUniqueViolation = (err: unknown): boolean => errorProp(err, 'code') === 'P2002';

/** Convierte cualquier error inesperado de la base de datos en DatabaseUnavailableError. */
export function toUnavailable(err: unknown): DatabaseUnavailableError {
  return err instanceof DatabaseUnavailableError ? err : new DatabaseUnavailableError(databaseErrorDetails(err));
}
