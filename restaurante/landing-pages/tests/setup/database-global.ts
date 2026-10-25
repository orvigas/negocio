import { randomBytes } from 'node:crypto';

import { createConnection } from 'mariadb';
import type { TestProject } from 'vitest/node';

import { poolConfig } from '../../src/db/client.ts';
import { createDatabase, migrate } from '../support/database-admin.ts';
import { HOW_TO_START, TEST_DATABASE_PREFIX, testDatabaseConfigs } from '../support/test-database-config.ts';

/**
 * Preparación global de la base de pruebas (REQ-F-014, RF-13):
 *
 * 1. Salvaguarda: las URL de prueba solo pueden apuntar a hosts y bases de pruebas.
 * 2. MySQL disponible (hasta 10 s): si no, la suite falla con el mensaje de cómo levantarlo.
 *    Nunca se salta ninguna prueba por falta de base.
 * 3. Id de ejecución: las bases de esta suite son restaurante_test_<id>_*; dos suites en paralelo
 *    no se pisan. Al terminar se borran.
 * 4. Base de referencia restaurante_test_<id>_ref, migrada y nunca modificada: el soporte compara
 *    con ella el esquema de cada base antes de reutilizarla.
 * 5. Limpieza de bases de ejecuciones anteriores interrumpidas (más de 6 h de antigüedad).
 */

declare module 'vitest' {
  export interface ProvidedContext {
    testDatabaseRun: string;
  }
}

const WAIT_MS = 10_000;

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

async function dropDatabases(pattern: string, olderThanHours?: number): Promise<void> {
  const connection = await adminConnection();
  try {
    const rows: { name: string }[] =
      olderThanHours === undefined
        ? await connection.query('SELECT SCHEMA_NAME AS name FROM information_schema.SCHEMATA WHERE SCHEMA_NAME LIKE ?', [pattern])
        : await connection.query(
            `SELECT DISTINCT TABLE_SCHEMA AS name FROM information_schema.TABLES
             WHERE TABLE_SCHEMA LIKE ? AND TABLE_NAME = '_prisma_migrations' AND CREATE_TIME < NOW() - INTERVAL ? HOUR`,
            [pattern, olderThanHours],
          );
    for (const { name } of rows) {
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
  const run = randomBytes(3).toString('hex');
  project.provide('testDatabaseRun', run);
  await dropDatabases(`${TEST_DATABASE_PREFIX}\\_%`, 6);
  const reference = `${TEST_DATABASE_PREFIX}_${run}_ref`;
  await createDatabase(reference);
  await migrate(reference);
  return async () => {
    await dropDatabases(`${TEST_DATABASE_PREFIX}\\_${run}\\_%`);
  };
}
