import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { createConnection } from 'mariadb';

import { poolConfig } from '@restaurante/db/client';
import { DB_PACKAGE_DIR } from '@restaurante/db/paths';
import { PRISMA_MIGRATIONS_TABLE } from '@restaurante/db/verify';

import { databaseUrl, testDatabaseConfigs, withDatabase } from './test-database-config.ts';

/**
 * Operaciones del usuario admin de pruebas (REQ-F-014): crear, migrar, vaciar y borrar bases
 * `restaurante_test_*`. Sin dependencias de Vitest: también las usa el globalSetup.
 */

export type Statement = string | { sql: string; values: unknown[] };

/**
 * Punto de entrada del CLI de Prisma, resuelto como lo resuelve Node desde el paquete db (REQ-F-036 y
 * REQ-F-037): con npm workspaces, `node_modules` (y su `.bin`) suele estar en la raíz del monorepo, no
 * en DB_PACKAGE_DIR. Se ejecuta con el mismo Node de las pruebas.
 */
const PRISMA_PACKAGE_JSON = createRequire(join(DB_PACKAGE_DIR, 'package.json')).resolve('prisma/package.json');
const prismaBin = (JSON.parse(readFileSync(PRISMA_PACKAGE_JSON, 'utf8')) as { bin: { prisma: string } }).bin.prisma;
export const PRISMA_CLI = join(dirname(PRISMA_PACKAGE_JSON), prismaBin);

/** Lanza `prisma <args>` en DB_PACKAGE_DIR (su prisma.config.ts), con el entorno dado. */
export const spawnPrisma = (args: string[], env: NodeJS.ProcessEnv) =>
  spawn(process.execPath, [PRISMA_CLI, ...args], { cwd: DB_PACKAGE_DIR, env, stdio: ['ignore', 'pipe', 'pipe'] });

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
    const child = spawnPrisma(['migrate', 'deploy'], {
      PATH: process.env.PATH ?? '',
      HOME: process.env.HOME ?? '',
      MIGRATION_DATABASE_URL: url,
      CHECKPOINT_DISABLE: '1',
      PRISMA_HIDE_UPDATE_MESSAGE: '1',
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

/**
 * Vacía todas las tablas de la app y reinicia sus autoincrementos, con el mismo resultado que un
 * TRUNCATE de todas. REQ-F-041: solo se vacían las que lo necesitan (con filas, o con el
 * autoincremento ya usado): TRUNCATE es DDL y era el coste fijo de cada base reutilizada. Con
 * `information_schema_stats_expiry = 0`, AUTO_INCREMENT es el valor actual, no el de la caché de
 * estadísticas. Todo en una sola conexión.
 */
export async function truncateAll(name: string): Promise<void> {
  const { admin } = testDatabaseConfigs();
  const connection = await createConnection({ ...poolConfig(withDatabase(admin, name)), connectTimeout: 5000 });
  try {
    await connection.query('SET SESSION information_schema_stats_expiry = 0');
    const tables = await connection.query<{ name: string; next: number | bigint | null }[]>(
      'SELECT TABLE_NAME AS name, AUTO_INCREMENT AS next FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME <> ?',
      [name, PRISMA_MIGRATIONS_TABLE],
    );
    if (tables.length === 0) return;
    const filled = await connection.query<{ name: string; used: number | bigint }[]>(
      tables.map((table) => `SELECT ${connection.escape(table.name)} AS name, EXISTS(SELECT 1 FROM \`${table.name}\`) AS used`).join(' UNION ALL '),
    );
    const withRows = new Set(filled.filter((row) => Number(row.used) === 1).map((row) => row.name));
    const dirty = tables.filter((table) => withRows.has(table.name) || (table.next !== null && Number(table.next) > 1));
    if (dirty.length === 0) return;
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of dirty) await connection.query(`TRUNCATE TABLE \`${table.name}\``);
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    await connection.end();
  }
}
