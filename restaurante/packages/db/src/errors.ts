import { DatabaseUnavailableError, errorProp, type DatabaseErrorDetails } from '@restaurante/core/shared';

/**
 * Errores de la base de datos con el servidor en marcha (REQ-F-007, DT-9 y R-3).
 *
 * Los mensajes de Prisma incluyen la invocación y rutas de archivo: nunca se registran ni se
 * muestran. Solo se conservan el nombre y los códigos (P2xxx y el errno original de MySQL).
 */

const asString = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

/** Campos seguros de un error de Prisma/MySQL para el log. */
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

/**
 * Interbloqueo o conflicto de escritura entre transacciones (MySQL 1213; Prisma P2034): la
 * transacción se revirtió entera y se puede reintentar (REQ-F-014, RF-7).
 */
export const isTransactionConflict = (err: unknown): boolean =>
  errorProp(err, 'code') === 'P2034' || databaseErrorDetails(err).originalCode === '1213';

/** Convierte cualquier error inesperado de la base de datos en DatabaseUnavailableError. */
export function toUnavailable(err: unknown): DatabaseUnavailableError {
  return err instanceof DatabaseUnavailableError ? err : new DatabaseUnavailableError(databaseErrorDetails(err));
}
