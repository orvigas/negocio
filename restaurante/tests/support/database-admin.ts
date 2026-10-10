import { spawn } from 'node:child_process';
import { join } from 'node:path';

import { createConnection } from 'mariadb';

import { PROJECT_DIR } from '../../src/config/env.ts';
import { poolConfig } from '../../src/db/client.ts';
import { PRISMA_MIGRATIONS_TABLE } from '../../src/db/verify.ts';
import { databaseUrl, testDatabaseConfigs, withDatabase } from './test-database-config.ts';

/**
 * Operaciones del usuario admin de pruebas (REQ-F-014): crear, migrar, vaciar y borrar bases
 * `restaurante_test_*`. Sin dependencias de Vitest: también las usa el globalSetup.
 */

export type Statement = string | { sql: string; values: unknown[] };

/**
 * Ejecuta sentencias con el usuario admin de pruebas, sobre `database` (siempre de pruebas) o sin
 * base. Devuelve el resultado de la última.
 */
export async function adminSql(database: string | undefined, ...statements: Statement[]): Promise<unknown> {
  const { admin } = testDatabaseConfigs();
  const target = database === undefined ? { ...poolConfig(admin), database: undefined } : poolConfig(withDatabase(admin, database));
  const connection = await createConnection({ ...target, connectTimeout: 5000 });
  try {
    let result: unknown;
    for (const statement of statements) {
      result = typeof statement === 'string' ? await connection.query(statement) : await connection.query(statement.sql, statement.values);
    }
    return result;
  } finally {
    await connection.end();
  }
}

/** MIGRATION_DATABASE_URL (usuario admin de pruebas) para un proceso hijo. */
export const adminDatabaseUrl = (name: string): string => databaseUrl(withDatabase(testDatabaseConfigs().admin, name));

export async function createDatabase(name: string): Promise<void> {
  withDatabase(testDatabaseConfigs().admin, name);
  await adminSql(undefined, `CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs`);
}

export async function dropDatabase(name: string): Promise<void> {
  withDatabase(testDatabaseConfigs().admin, name);
  await adminSql(undefined, `DROP DATABASE IF EXISTS \`${name}\``);
}

/** `prisma migrate deploy` real (el CLI de Prisma) sobre una base de pruebas. */
export function runMigrateDeploy(name: string): Promise<{ code: number | null; output: string }> {
  const url = adminDatabaseUrl(name);
  return new Promise((resolve, reject) => {
    const child = spawn(join(PROJECT_DIR, 'node_modules', '.bin', 'prisma'), ['migrate', 'deploy'], {
      cwd: PROJECT_DIR,
      env: {
        PATH: process.env.PATH ?? '',
        HOME: process.env.HOME ?? '',
        MIGRATION_DATABASE_URL: url,
        CHECKPOINT_DISABLE: '1',
        PRISMA_HIDE_UPDATE_MESSAGE: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => (output += chunk));
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => (output += chunk));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, output }));
  });
}

export async function migrate(name: string): Promise<void> {
  const { code, output } = await runMigrateDeploy(name);
  if (code !== 0) throw new Error(`prisma migrate deploy falló sobre ${name} (código ${String(code)}):\n${output}`);
}

/**
 * Huella del esquema (columnas, índices, triggers y migraciones registradas), o null si la base no
 * existe o no está migrada. Sirve para detectar una base que una prueba alteró (DROP, ALTER,
 * triggers) y volver a crearla antes de reutilizarla.
 */
export async function schemaFingerprint(name: string): Promise<string | null> {
  const rows = (await adminSql(
    undefined,
    'SET SESSION group_concat_max_len = 1048576',
    {
      sql: `SELECT
        (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?) AS migrated,
        (SELECT MD5(GROUP_CONCAT(CONCAT_WS(',', TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, IFNULL(COLLATION_NAME, '')) ORDER BY TABLE_NAME, ORDINAL_POSITION SEPARATOR '|'))
           FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ?) AS columns_hash,
        (SELECT MD5(GROUP_CONCAT(CONCAT_WS(',', TABLE_NAME, INDEX_NAME, COLUMN_NAME, NON_UNIQUE) ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX SEPARATOR '|'))
           FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ?) AS indexes_hash,
        (SELECT COUNT(*) FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = ?) AS triggers`,
      values: [name, PRISMA_MIGRATIONS_TABLE, name, name, name],
    },
  )) as Record<string, unknown>[];
  const row = rows[0];
  if (!row || Number(row.migrated) === 0) return null;
  const migrations = (await adminSql(
    name,
    'SELECT migration_name AS name, checksum, finished_at IS NOT NULL AS done, rolled_back_at IS NULL AS live FROM _prisma_migrations ORDER BY migration_name',
  )) as Record<string, unknown>[];
  const applied = migrations.map((m) => `${String(m.name)}:${String(m.checksum)}:${String(m.done)}:${String(m.live)}`).join('|');
  return `${String(row.columns_hash)}/${String(row.indexes_hash)}/${String(row.triggers)}/${applied}`;
}

/** Vacía todas las tablas de la app (TRUNCATE: también reinicia los autoincrementos). */
export async function truncateAll(name: string): Promise<void> {
  const rows = (await adminSql(undefined, {
    sql: 'SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME <> ?',
    values: [name, PRISMA_MIGRATIONS_TABLE],
  })) as { name: string }[];
  await adminSql(name, 'SET FOREIGN_KEY_CHECKS = 0', ...rows.map((row) => `TRUNCATE TABLE \`${row.name}\``), 'SET FOREIGN_KEY_CHECKS = 1');
}
