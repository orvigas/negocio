import { randomBytes } from 'node:crypto';

import { createConnection, type Connection } from 'mariadb';
import type { TestProject } from 'vitest/node';

import { poolConfig } from '@restaurante/db/client';

import { createDatabase, migrate } from '../support/database-admin.ts';
import { HOW_TO_START, TEST_DATABASE_PREFIX, testDatabaseConfigs } from '../support/test-database-config.ts';

/**
 * Preparación global de la base de pruebas (REQ-F-014, RF-13):
 *
 * 1. Salvaguarda: las URL de prueba solo pueden apuntar a hosts y bases de pruebas.
 * 2. MySQL disponible (hasta 10 s): si no, la suite falla con el mensaje de cómo levantarlo.
 *    Nunca se salta ninguna prueba por falta de base.
 * 3. Id de ejecución: las bases de esta suite son restaurante_test_<id>_*; dos suites en paralelo
 *    no se pisan. Al terminar se borran. El id empieza por el segundo en que arrancó la ejecución.
 * 4. Base de referencia restaurante_test_<id>_ref, migrada y nunca modificada: el soporte compara
 *    con ella el esquema de cada base antes de reutilizarla.
 * 5. Limpieza de bases de ejecuciones anteriores interrumpidas (más de 6 h de antigüedad), incluidas
 *    las vacías: information_schema no guarda cuándo se creó una base, así que su antigüedad es la
 *    que dice su nombre. Las bases migradas de ids sin fecha (anteriores a este formato) se reconocen
 *    por la fecha de _prisma_migrations; una vacía de esas no se puede fechar y no se toca.
 */

declare module 'vitest' {
  export interface ProvidedContext {
    testDatabaseRun: string;
  }
}

const WAIT_MS = 10_000;
const INTERRUPTED_AFTER_HOURS = 6;
/** restaurante_test_<segundos de arranque, 8 hex><aleatorio, 6 hex>_... */
const DATED_RUN = new RegExp(`^${TEST_DATABASE_PREFIX}_([0-9a-f]{8})[0-9a-f]{6}_`);

async function adminConnection() {
  const { admin } = testDatabaseConfigs();
  // Sin base por defecto: el usuario admin solo tiene permisos sobre restaurante_test_*.
  return createConnection({ ...poolConfig(admin), database: undefined, connectTimeout: 2000 });
}

async function waitForMysql(): Promise<void> {
  const deadline = Date.now() + WAIT_MS;
  let lastCode = 'sin respuesta';
  while (Date.now() < deadline) {
    try {
      const connection = await adminConnection();
      await connection.end();
      return;
    } catch (err) {
      const code = (err as { code?: unknown } | null)?.code;
      if (typeof code === 'string') lastCode = code;
      if (lastCode === 'ER_ACCESS_DENIED_ERROR') break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error(`No hay MySQL de pruebas disponible (${lastCode}). ${HOW_TO_START}`);
}

/** Reloj de MySQL: el único que comparten todas las suites que usan este servidor. */
async function mysqlSeconds(connection: Connection): Promise<number> {
  const rows: { now: number | bigint }[] = await connection.query('SELECT UNIX_TIMESTAMP() AS now');
  return Number(rows[0]?.now);
}

/** Id de una ejecución nueva: fecha el nombre de cada base suya para la limpieza. */
async function createRunId(): Promise<string> {
  const connection = await adminConnection();
  try {
    return `${(await mysqlSeconds(connection)).toString(16).padStart(8, '0')}${randomBytes(3).toString('hex')}`;
  } finally {
    await connection.end();
  }
}

/** Segundo en que arrancó la ejecución dueña de la base, o null si su nombre no lo dice. */
export function runStartedAt(name: string): number | null {
  const started = DATED_RUN.exec(name)?.[1];
  return started === undefined ? null : Number.parseInt(started, 16);
}

export async function dropDatabases(pattern: string, olderThanHours?: number): Promise<void> {
  const connection = await adminConnection();
  try {
    const schemas: { name: string }[] = await connection.query('SELECT SCHEMA_NAME AS name FROM information_schema.SCHEMATA WHERE SCHEMA_NAME LIKE ?', [pattern]);
    let names = schemas.map(({ name }) => name);
    if (olderThanHours !== undefined) {
      const limit = (await mysqlSeconds(connection)) - olderThanHours * 3600;
      const migrated: { name: string }[] = await connection.query(
        `SELECT DISTINCT TABLE_SCHEMA AS name FROM information_schema.TABLES
         WHERE TABLE_SCHEMA LIKE ? AND TABLE_NAME = '_prisma_migrations' AND CREATE_TIME < NOW() - INTERVAL ? HOUR`,
        [pattern, olderThanHours],
      );
      const dated = names.filter((name) => {
        const started = runStartedAt(name);
        return started !== null && started < limit;
      });
      names = [...new Set([...migrated.map(({ name }) => name), ...dated])];
    }
    for (const name of names) {
      if (!name.startsWith(`${TEST_DATABASE_PREFIX}_`)) continue;
      await connection.query(`DROP DATABASE IF EXISTS \`${name}\``);
    }
  } finally {
    await connection.end();
  }
}

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  testDatabaseConfigs();
  await waitForMysql();
  const run = await createRunId();
  project.provide('testDatabaseRun', run);
  await dropDatabases(`${TEST_DATABASE_PREFIX}\\_%`, INTERRUPTED_AFTER_HOURS);
  const reference = `${TEST_DATABASE_PREFIX}_${run}_ref`;
  await createDatabase(reference);
  await migrate(reference);
  return async () => {
    await dropDatabases(`${TEST_DATABASE_PREFIX}\\_${run}\\_%`);
  };
}
