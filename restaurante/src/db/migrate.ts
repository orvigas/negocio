import { createHash, randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import Database from 'better-sqlite3';

import { PROJECT_DIR } from '../config/env.ts';
import { errorProp } from '../utils/errors.ts';

/**
 * Preparación de la base de datos al arrancar (REQ-F-007, DT-3 y R-2).
 *
 * 1. Abre el .db (lo crea si no existe), activa WAL y comprueba integridad (`quick_check`) y
 *    escritura real: un .db de solo lectura o una carpeta sin permisos fallan aquí aunque no
 *    haya migraciones pendientes.
 * 2. Aplica las migraciones de prisma/migrations que falten, en orden, y las registra en
 *    `_prisma_migrations` con el mismo formato que `prisma migrate deploy` (checksum = SHA-256
 *    del migration.sql). El CLI de Prisma reconoce la base como propia (prueba de compatibilidad
 *    en tests/integration/db-prisma-compat.test.ts), sin necesitarlo en producción.
 *
 * Cada migración es atómica. Las FK se desactivan FUERA de la transacción (dentro, el PRAGMA no
 * tiene efecto y un DROP TABLE de las migraciones que redefinen tablas borraría en cascada las
 * filas hijas) y se comprueban con `foreign_key_check` antes de confirmar.
 *
 * Los errores son DatabaseInitError con un código estable; nunca llevan SQL ni rutas.
 */

export const DEFAULT_MIGRATIONS_DIR = join(PROJECT_DIR, 'prisma', 'migrations');
const MIGRATION_NAME = /^\d{14}_[A-Za-z0-9_]+$/;
const BUSY_TIMEOUT_MS = 5000;

/** DDL de la tabla de migraciones de Prisma para SQLite (idéntico al que crea su motor). */
const MIGRATIONS_TABLE = `CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id"                    TEXT PRIMARY KEY NOT NULL,
    "checksum"              TEXT NOT NULL,
    "finished_at"           DATETIME,
    "migration_name"        TEXT NOT NULL,
    "logs"                  TEXT,
    "rolled_back_at"        DATETIME,
    "started_at"            DATETIME NOT NULL DEFAULT current_timestamp,
    "applied_steps_count"   INTEGER UNSIGNED NOT NULL DEFAULT 0
)`;

export const DATABASE_INIT_CODES = Object.freeze({
  DATA_DIR_MISSING: 'DATA_DIR_MISSING',
  CORRUPT: 'DATABASE_CORRUPT',
  MIGRATION_FAILED: 'MIGRATION_FAILED',
  MIGRATION_MODIFIED: 'MIGRATION_MODIFIED',
  MIGRATION_INCOMPLETE: 'MIGRATION_INCOMPLETE',
  DATABASE_NEWER_THAN_CODE: 'DATABASE_NEWER_THAN_CODE',
  FOREIGN_KEY_CHECK: 'FOREIGN_KEY_CHECK',
  MIGRATIONS_UNREADABLE: 'MIGRATIONS_UNREADABLE',
});

/** La base de datos no se pudo preparar. `code`: código de SQLite (SQLITE_*) o de DATABASE_INIT_CODES. */
export class DatabaseInitError extends Error {
  readonly code: string;
  readonly migration: string | undefined;

  constructor(code: string, migration?: string) {
    super('No se pudo preparar la base de datos');
    this.name = 'DatabaseInitError';
    this.code = code;
    this.migration = migration;
  }
}

interface AppliedRow {
  name: string;
  checksum: string;
  finished: number | string | null;
  rolledBack: number | string | null;
}

interface LocalMigration {
  name: string;
  sql: string;
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
    let bytes: Buffer;
    try {
      bytes = await readFile(join(migrationsDir, name, 'migration.sql'));
    } catch {
      throw new DatabaseInitError(DATABASE_INIT_CODES.MIGRATIONS_UNREADABLE, name);
    }
    migrations.push({ name, sql: bytes.toString('utf8'), checksum: createHash('sha256').update(bytes).digest('hex') });
  }
  return migrations;
}

/** Comprueba integridad y escritura real (S-8 del Technical Action Plan). */
function checkWritable(db: Database.Database): void {
  db.pragma('journal_mode = WAL');
  const integrity: unknown = db.pragma('quick_check', { simple: true });
  if (integrity !== 'ok') throw new DatabaseInitError(DATABASE_INIT_CODES.CORRUPT);
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec('CREATE TABLE "_write_probe" ("x" INTEGER); DROP TABLE "_write_probe";');
    db.exec('COMMIT');
  } catch (err) {
    if (db.inTransaction) db.exec('ROLLBACK');
    throw err;
  }
}

function applyOne(db: Database.Database, migration: LocalMigration, now: () => Date): void {
  const startedAt = now().getTime();
  db.pragma('foreign_keys = OFF');
  try {
    db.exec('BEGIN IMMEDIATE');
    try {
      try {
        db.exec(migration.sql);
      } catch {
        throw new DatabaseInitError(DATABASE_INIT_CODES.MIGRATION_FAILED, migration.name);
      }
      const violations = db.pragma('foreign_key_check') as unknown[];
      if (violations.length > 0) throw new DatabaseInitError(DATABASE_INIT_CODES.FOREIGN_KEY_CHECK, migration.name);
      db.prepare(
        `INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
         VALUES (?, ?, ?, ?, NULL, NULL, ?, 1)`,
      ).run(randomUUID(), migration.checksum, now().getTime(), migration.name, startedAt);
      db.exec('COMMIT');
    } catch (err) {
      if (db.inTransaction) db.exec('ROLLBACK');
      throw err;
    }
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

export interface PrepareOptions {
  file: string;
  migrationsDir?: string;
  now?: () => Date;
}

/**
 * Prepara el .db y aplica las migraciones pendientes. Devuelve los nombres aplicados.
 * @throws {DatabaseInitError}
 */
export async function prepareDatabase({ file, migrationsDir = DEFAULT_MIGRATIONS_DIR, now = () => new Date() }: PrepareOptions): Promise<string[]> {
  const migrations = await readMigrations(migrationsDir);

  let db: Database.Database;
  try {
    db = new Database(file, { timeout: BUSY_TIMEOUT_MS });
  } catch (err) {
    // better-sqlite3 lanza TypeError si la carpeta no existe.
    const code = errorProp(err, 'code');
    throw new DatabaseInitError(typeof code === 'string' ? code : DATABASE_INIT_CODES.DATA_DIR_MISSING);
  }

  try {
    checkWritable(db);
    db.exec(MIGRATIONS_TABLE);
    const rows = db
      .prepare('SELECT "migration_name" AS name, "checksum", "finished_at" AS finished, "rolled_back_at" AS rolledBack FROM "_prisma_migrations"')
      .all() as AppliedRow[];
    const applied = new Map(rows.filter((row) => row.rolledBack === null).map((row) => [row.name, row]));
    const local = new Set(migrations.map((migration) => migration.name));

    for (const row of applied.values()) {
      if (row.finished === null) throw new DatabaseInitError(DATABASE_INIT_CODES.MIGRATION_INCOMPLETE, row.name);
      if (!local.has(row.name)) throw new DatabaseInitError(DATABASE_INIT_CODES.DATABASE_NEWER_THAN_CODE, row.name);
    }

    const done: string[] = [];
    for (const migration of migrations) {
      const previous = applied.get(migration.name);
      if (previous) {
        if (previous.checksum !== migration.checksum) {
          throw new DatabaseInitError(DATABASE_INIT_CODES.MIGRATION_MODIFIED, migration.name);
        }
        continue;
      }
      applyOne(db, migration, now);
      done.push(migration.name);
    }
    return done;
  } catch (err) {
    if (err instanceof DatabaseInitError) throw err;
    const code = errorProp(err, 'code');
    throw new DatabaseInitError(typeof code === 'string' ? code : 'DATABASE_ERROR');
  } finally {
    db.close();
  }
}
