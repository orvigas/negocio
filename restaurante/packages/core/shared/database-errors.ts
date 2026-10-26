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
