import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import { createConnection } from 'mariadb';

import { errorProp, type Logger } from '@restaurante/core/shared';

import type { DatabaseConfig } from './database-config.ts';
import { Prisma } from './generated/prisma/client.ts';
import { poolConfig, type Database } from './client.ts';
import { databaseErrorDetails } from './errors.ts';
import { DB_PACKAGE_DIR } from './paths.ts';

/**
 * Verificación de la base de datos al arrancar (REQ-F-014, RF-6). La app nunca modifica el esquema
 * (RN-4): las migraciones las aplica el proceso aparte `migrate` (prisma migrate deploy). Aquí solo
 * se leen datos (SELECT), en este orden:
 *
 * 1. Conexión, con reintentos durante un máximo de 60 s (MySQL puede estar arrancando). Las
 *    credenciales inválidas y la base inaccesible fallan al momento. Se prueba con una conexión
 *    directa del driver: el pool de Prisma solo informaría de un tiempo agotado (45028).
 * 2. Modo estricto en la sesión (STRICT_TRANS_TABLES o STRICT_ALL_TABLES): sin él, MySQL recortaría
 *    textos en silencio (RN-3).
 * 3. Base en utf8mb4 con utf8mb4_es_0900_as_cs (D-4, D-5).
 * 4. Migraciones: las de prisma/migrations frente a `_prisma_migrations` (checksum = SHA-256 del
 *    migration.sql, el mismo que calcula Prisma). Con `allowNewerSchema` (DATABASE_ALLOW_NEWER_SCHEMA,
 *    solo en la vuelta atrás de un despliegue; REQ-F-016, D-1) se toleran migraciones aplicadas que
 *    este código no conoce: se registran con `database_newer_than_code_allowed`. Las conocidas
 *    siguen siendo obligatorias, terminadas y con su checksum.
 * 5. Tablas y columnas de texto en utf8mb4 con utf8mb4_es_0900_as_cs. `_prisma_migrations`, interna
 *    de Prisma (la crea con utf8mb4_unicode_ci), solo tiene que ser utf8mb4 (CA-2, P-1).
 *
 * Los errores son DatabaseInitError con un código estable; nunca llevan SQL, la URL ni credenciales.
 */

export const DEFAULT_MIGRATIONS_DIR = join(DB_PACKAGE_DIR, 'prisma', 'migrations');
export const EXPECTED_CHARSET = 'utf8mb4';
export const EXPECTED_COLLATION = 'utf8mb4_es_0900_as_cs';
export const PRISMA_MIGRATIONS_TABLE = '_prisma_migrations';
/** Plazo máximo para conectar al arrancar (RF-6, CA-7). */
export const STARTUP_WINDOW_MS = 60_000;
/** Duración máxima de un intento (acquireTimeout del pool en src/db/client.ts). */
export const ATTEMPT_MAX_MS = 5_000;
const BACKOFF_MS = Object.freeze([500, 1000, 2000, 4000]);
const BACKOFF_MAX_MS = 5000;
const MIGRATION_NAME = /^\d{14}_[A-Za-z0-9_]+$/;

export const DATABASE_INIT_CODES = Object.freeze({
  UNREACHABLE: 'DATABASE_UNREACHABLE',
  AUTH_FAILED: 'DATABASE_AUTH_FAILED',
  ACCESS_DENIED: 'DATABASE_ACCESS_DENIED',
  NOT_STRICT: 'DATABASE_NOT_STRICT',
  CHARSET_INVALID: 'DATABASE_CHARSET_INVALID',
  MIGRATIONS_PENDING: 'MIGRATIONS_PENDING',
  MIGRATION_INCOMPLETE: 'MIGRATION_INCOMPLETE',
  MIGRATION_MODIFIED: 'MIGRATION_MODIFIED',
  DATABASE_NEWER_THAN_CODE: 'DATABASE_NEWER_THAN_CODE',
  MIGRATIONS_UNREADABLE: 'MIGRATIONS_UNREADABLE',
  DATABASE_ERROR: 'DATABASE_ERROR',
});
export type DatabaseInitCode = (typeof DATABASE_INIT_CODES)[keyof typeof DATABASE_INIT_CODES];

/** La base de datos no está lista. `migration` u `object` (tabla o tabla.columna) ayudan a diagnosticar. */
export class DatabaseInitError extends Error {
  readonly code: DatabaseInitCode;
  readonly migration: string | undefined;
  readonly object: string | undefined;

  constructor(code: DatabaseInitCode, { migration, object }: { migration?: string; object?: string } = {}) {
    super('La base de datos no está lista');
    this.name = 'DatabaseInitError';
    this.code = code;
    this.migration = migration;
    this.object = object;
  }
}

/** Errores de MySQL que no se arreglan reintentando (errno). */
const AUTH_ERRORS = new Set(['1045', '1698', '45044']);
const ACCESS_ERRORS = new Set(['1044', '1049']);
const TABLE_MISSING = '1146';

/** Código de MySQL (errno) de un error de Prisma, del adaptador o del driver. */
function mysqlCode(err: unknown): string | undefined {
  const fromPrisma = databaseErrorDetails(err).originalCode;
  if (fromPrisma !== undefined) return fromPrisma;
  for (let current: unknown = err, depth = 0; current != null && depth < 4; current = errorProp(current, 'cause'), depth += 1) {
    const errno = errorProp(current, 'errno');
    if (typeof errno === 'number') return String(errno);
  }
  return undefined;
}

/** Ejecuta una consulta de solo lectura (en producción, `prisma.$queryRaw`). */
export type RawQuery = (sql: Prisma.Sql) => Promise<unknown>;

export const queryOf = (prisma: Database): RawQuery => (sql) => prisma.$queryRaw(sql);

/** Abre y cierra una conexión (lanza el error del driver, con su errno). */
export type ConnectionProbe = () => Promise<void>;

export const probeOf =
  (database: DatabaseConfig): ConnectionProbe =>
  async () => {
    const connection = await createConnection(poolConfig(database));
    try {
      await connection.query('SELECT 1');
    } finally {
      await connection.end();
    }
  };

export interface VerifyOptions {
  probe: ConnectionProbe;
  query: RawQuery;
  logger?: Pick<Logger, 'info' | 'warn'>;
  migrationsDir?: string;
  /** Tolera migraciones aplicadas que este código no conoce (REQ-F-016, D-1). */
  allowNewerSchema?: boolean;
  windowMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

interface LocalMigration {
  name: string;
  checksum: string;
}

async function readMigrations(migrationsDir: string): Promise<LocalMigration[]> {
  let names: string[];
  try {
    const entries = await readdir(migrationsDir, { withFileTypes: true });
    names = entries.filter((entry) => entry.isDirectory() && MIGRATION_NAME.test(entry.name)).map((entry) => entry.name);
  } catch {
    throw new DatabaseInitError(DATABASE_INIT_CODES.MIGRATIONS_UNREADABLE);
  }
  names.sort();
  const migrations: LocalMigration[] = [];
  for (const name of names) {
    try {
      const bytes = await readFile(join(migrationsDir, name, 'migration.sql'));
      migrations.push({ name, checksum: createHash('sha256').update(bytes).digest('hex') });
    } catch {
      throw new DatabaseInitError(DATABASE_INIT_CODES.MIGRATIONS_UNREADABLE, { migration: name });
    }
  }
  return migrations;
}

type Row = Record<string, unknown>;

const rowsOf = (result: unknown): Row[] =>
  Array.isArray(result) ? result.filter((row): row is Row => row !== null && typeof row === 'object') : [];

const text = (value: unknown): string | null => (typeof value === 'string' ? value : null);

async function connect({ probe, logger, windowMs, now, sleep }: Required<Omit<VerifyOptions, 'migrationsDir' | 'query' | 'allowNewerSchema'>>): Promise<void> {
  const deadline = now() + windowMs;
  for (let attempt = 1; ; attempt += 1) {
    try {
      await probe();
      return;
    } catch (err) {
      const code = mysqlCode(err);
      if (code !== undefined && AUTH_ERRORS.has(code)) throw new DatabaseInitError(DATABASE_INIT_CODES.AUTH_FAILED);
      if (code !== undefined && ACCESS_ERRORS.has(code)) throw new DatabaseInitError(DATABASE_INIT_CODES.ACCESS_DENIED);
      const wait = BACKOFF_MS[attempt - 1] ?? BACKOFF_MAX_MS;
      // Otro intento solo si termina dentro del plazo (espera + duración máxima de un intento).
      if (now() + wait + ATTEMPT_MAX_MS > deadline) throw new DatabaseInitError(DATABASE_INIT_CODES.UNREACHABLE);
      logger.info('database_waiting', { attempt, code: code ?? null, retryInMs: wait });
      await sleep(wait);
    }
  }
}

async function checkStrictMode(query: RawQuery): Promise<void> {
  const [row] = rowsOf(await query(Prisma.sql`SELECT @@SESSION.sql_mode AS mode`));
  const modes = (text(row?.mode) ?? '').split(',');
  if (!modes.includes('STRICT_TRANS_TABLES') && !modes.includes('STRICT_ALL_TABLES')) {
    throw new DatabaseInitError(DATABASE_INIT_CODES.NOT_STRICT);
  }
}

async function checkDatabaseCharset(query: RawQuery): Promise<void> {
  const [row] = rowsOf(
    await query(Prisma.sql`SELECT SCHEMA_NAME AS name, DEFAULT_CHARACTER_SET_NAME AS charset, DEFAULT_COLLATION_NAME AS collation
      FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = DATABASE()`),
  );
  if (text(row?.charset) !== EXPECTED_CHARSET || text(row?.collation) !== EXPECTED_COLLATION) {
    throw new DatabaseInitError(DATABASE_INIT_CODES.CHARSET_INVALID, { object: text(row?.name) ?? 'database' });
  }
}

/** Devuelve las migraciones aplicadas que este código no conoce (solo con `allowNewerSchema`). */
async function checkMigrations(query: RawQuery, migrationsDir: string, allowNewerSchema: boolean): Promise<string[]> {
  const local = await readMigrations(migrationsDir);
  let result: unknown;
  try {
    result = await query(Prisma.sql`SELECT migration_name AS name, checksum, finished_at AS finished, rolled_back_at AS rolledBack
      FROM _prisma_migrations`);
  } catch (err) {
    // Sin la tabla de migraciones: la base nunca se migró.
    if (mysqlCode(err) === TABLE_MISSING || errorProp(err, 'code') === 'P2021') {
      throw new DatabaseInitError(DATABASE_INIT_CODES.MIGRATIONS_PENDING, { migration: local[0]?.name });
    }
    throw err;
  }
  const applied = new Map<string, { checksum: string | null; finished: unknown }>();
  for (const row of rowsOf(result)) {
    const name = text(row.name);
    if (name === null || row.rolledBack != null) continue;
    applied.set(name, { checksum: text(row.checksum), finished: row.finished });
  }
  const localNames = new Set(local.map((migration) => migration.name));
  const unknown: string[] = [];
  for (const [name, row] of applied) {
    if (row.finished == null) throw new DatabaseInitError(DATABASE_INIT_CODES.MIGRATION_INCOMPLETE, { migration: name });
    if (localNames.has(name)) continue;
    if (!allowNewerSchema) throw new DatabaseInitError(DATABASE_INIT_CODES.DATABASE_NEWER_THAN_CODE, { migration: name });
    unknown.push(name);
  }
  for (const migration of local) {
    const row = applied.get(migration.name);
    if (!row) throw new DatabaseInitError(DATABASE_INIT_CODES.MIGRATIONS_PENDING, { migration: migration.name });
    if (row.checksum !== migration.checksum) throw new DatabaseInitError(DATABASE_INIT_CODES.MIGRATION_MODIFIED, { migration: migration.name });
  }
  return unknown.sort();
}

const isUtf8mb4Collation = (collation: string | null): boolean => collation !== null && collation.startsWith(`${EXPECTED_CHARSET}_`);

async function checkTablesAndColumns(query: RawQuery): Promise<void> {
  const tables = rowsOf(
    await query(Prisma.sql`SELECT TABLE_NAME AS name, TABLE_COLLATION AS collation
      FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME`),
  );
  for (const table of tables) {
    const name = text(table.name) ?? '?';
    const collation = text(table.collation);
    const valid = name === PRISMA_MIGRATIONS_TABLE ? isUtf8mb4Collation(collation) : collation === EXPECTED_COLLATION;
    if (!valid) throw new DatabaseInitError(DATABASE_INIT_CODES.CHARSET_INVALID, { object: name });
  }
  const columns = rowsOf(
    await query(Prisma.sql`SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName, CHARACTER_SET_NAME AS charset, COLLATION_NAME AS collation
      FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND CHARACTER_SET_NAME IS NOT NULL
      ORDER BY TABLE_NAME, ORDINAL_POSITION`),
  );
  for (const column of columns) {
    const tableName = text(column.tableName) ?? '?';
    const charset = text(column.charset);
    const collation = text(column.collation);
    const valid = tableName === PRISMA_MIGRATIONS_TABLE ? charset === EXPECTED_CHARSET : charset === EXPECTED_CHARSET && collation === EXPECTED_COLLATION;
    if (!valid) throw new DatabaseInitError(DATABASE_INIT_CODES.CHARSET_INVALID, { object: `${tableName}.${text(column.columnName) ?? '?'}` });
  }
}

/**
 * Verifica que la base esté lista para la app.
 * @throws {DatabaseInitError}
 */
export async function verifyDatabase({
  probe,
  query,
  logger = { info: () => {}, warn: () => {} },
  migrationsDir = DEFAULT_MIGRATIONS_DIR,
  allowNewerSchema = false,
  windowMs = STARTUP_WINDOW_MS,
  now = Date.now,
  sleep = (ms) => delay(ms),
}: VerifyOptions): Promise<void> {
  await connect({ probe, logger, windowMs, now, sleep });
  try {
    await checkStrictMode(query);
    await checkDatabaseCharset(query);
    const unknown = await checkMigrations(query, migrationsDir, allowNewerSchema);
    await checkTablesAndColumns(query);
    // Solo nombres de migración (NNNNNNNNNNNNNN_nombre): sin SQL ni datos.
    if (unknown.length > 0) logger.warn('database_newer_than_code_allowed', { migrations: unknown });
  } catch (err) {
    if (err instanceof DatabaseInitError) throw err;
    const code = mysqlCode(err);
    if (code !== undefined && AUTH_ERRORS.has(code)) throw new DatabaseInitError(DATABASE_INIT_CODES.AUTH_FAILED);
    if (code !== undefined && ACCESS_ERRORS.has(code)) throw new DatabaseInitError(DATABASE_INIT_CODES.ACCESS_DENIED);
    throw new DatabaseInitError(DATABASE_INIT_CODES.DATABASE_ERROR);
  }
}
