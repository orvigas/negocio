/**
 * Conexión a MySQL (REQ-F-014, RF-5), a partir de DATABASE_URL. Contiene la contraseña: nunca se
 * registra ni se incluye en errores o respuestas.
 */
export interface DatabaseConfig {
  readonly host: string;
  readonly port: number;
  readonly user: string;
  readonly password: string;
  readonly database: string;
}
