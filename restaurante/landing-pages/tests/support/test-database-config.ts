import { parseDatabaseUrl, type DatabaseConfig } from '../../src/config/env.ts';

/**
 * URL de las bases de pruebas (REQ-F-014, RF-13) y su salvaguarda.
 *
 * - TEST_DATABASE_URL: usuario solo DML (el que usa la app en toda la suite; CA-6).
 * - TEST_ADMIN_DATABASE_URL: usuario con DDL, solo para el soporte (crear, migrar, vaciar y borrar).
 *
 * Sin ellas se usan las del MySQL local de compose.yaml (`npm run db:up`; credenciales de
 * desarrollo, no secretas). Las dos solo pueden apuntar a un host local o al servicio `mysql-dev`
 * y a bases con el prefijo `restaurante_test`: cualquier otra se rechaza antes de conectar, para no
 * tocar nunca una base real.
 */

export const DEFAULT_TEST_DATABASE_URL = 'mysql://restaurante_test_app:test-dev@127.0.0.1:3307/restaurante_test';
export const DEFAULT_TEST_ADMIN_DATABASE_URL = 'mysql://restaurante_test_admin:test-dev@127.0.0.1:3307/restaurante_test';
export const TEST_DATABASE_HOSTS: readonly string[] = Object.freeze(['127.0.0.1', 'localhost', '::1', 'mysql-dev']);
export const TEST_DATABASE_PREFIX = 'restaurante_test';

export const HOW_TO_START =
  'Levanta el MySQL de pruebas con `npm run db:up` (Docker; escucha en 127.0.0.1:3307) o define TEST_DATABASE_URL y TEST_ADMIN_DATABASE_URL.';

export const isTestDatabaseName = (name: string): boolean => name === TEST_DATABASE_PREFIX || name.startsWith(`${TEST_DATABASE_PREFIX}_`);

function guarded(name: string, raw: string): DatabaseConfig {
  const issues: string[] = [];
  const config = parseDatabaseUrl(raw, name, issues);
  if (!config) throw new Error(`Base de datos de pruebas: ${issues.join('; ')}`);
  if (!TEST_DATABASE_HOSTS.includes(config.host)) {
    throw new Error(`Base de datos de pruebas: ${name} apunta a un host que no es de pruebas (solo ${TEST_DATABASE_HOSTS.join(', ')}). Las pruebas nunca usan una base real.`);
  }
  if (!isTestDatabaseName(config.database)) {
    throw new Error(`Base de datos de pruebas: ${name} apunta a una base sin el prefijo "${TEST_DATABASE_PREFIX}". Las pruebas nunca usan una base real.`);
  }
  return config;
}

/**
 * Configuraciones validadas por la salvaguarda.
 * @throws {Error} si alguna URL no es de pruebas (el mensaje nunca incluye la URL).
 */
export function testDatabaseConfigs(env: NodeJS.ProcessEnv = process.env): { app: DatabaseConfig; admin: DatabaseConfig } {
  const read = (name: string, fallback: string) => env[name]?.trim() || fallback;
  return {
    app: guarded('TEST_DATABASE_URL', read('TEST_DATABASE_URL', DEFAULT_TEST_DATABASE_URL)),
    admin: guarded('TEST_ADMIN_DATABASE_URL', read('TEST_ADMIN_DATABASE_URL', DEFAULT_TEST_ADMIN_DATABASE_URL)),
  };
}

/** Misma conexión con otra base (siempre de pruebas). */
export function withDatabase(config: DatabaseConfig, database: string): DatabaseConfig {
  if (!isTestDatabaseName(database)) throw new Error(`La base "${database}" no es de pruebas`);
  return Object.freeze({ ...config, database });
}

/** URL para un proceso hijo (DATABASE_URL o MIGRATION_DATABASE_URL). */
export function databaseUrl(config: DatabaseConfig): string {
  const host = config.host.includes(':') ? `[${config.host}]` : config.host;
  return `mysql://${encodeURIComponent(config.user)}:${encodeURIComponent(config.password)}@${host}:${config.port}/${config.database}`;
}
