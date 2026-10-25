import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { inject } from 'vitest';

import type { DatabaseConfig } from '../../src/config/env.ts';
import { createPrismaClient, type Database } from '../../src/db/client.ts';
import { DEFAULT_MIGRATIONS_DIR } from '../../src/db/verify.ts';
import { createDatabase, dropDatabase, migrate, schemaFingerprint, truncateAll } from './database-admin.ts';
import { TEST_DATABASE_PREFIX, databaseUrl, testDatabaseConfigs, withDatabase } from './test-database-config.ts';

export { adminDatabaseUrl, adminSql, runMigrateDeploy, spawnPrisma } from './database-admin.ts';

/**
 * Bases de datos de prueba sobre MySQL 8.4 real (REQ-F-014, RF-13). Nunca una base real: la
 * salvaguarda de test-database-config.ts valida las URL antes de conectar.
 *
 * - Cada trabajador de Vitest tiene sus bases `restaurante_test_<ejecución>_<trabajador>[_n]`,
 *   creadas en el primer uso y migradas con el CLI real (`prisma migrate deploy`, usuario admin).
 * - makeDatabase() toma una libre, la vacía (TRUNCATE: también reinicia los autoincrementos) y
 *   devuelve un cliente con el usuario solo DML, el mismo que usa la app (CA-6). `cleanup` la libera.
 *   Si una prueba anterior alteró su esquema (DROP, ALTER, triggers), se vuelve a crear: su huella
 *   se compara con la de la base de referencia que migra el globalSetup.
 * - makeScratchDatabase() crea una base desechable (vacía o migrada) para las pruebas de arranque,
 *   recuperación y verificación, y la borra al terminar.
 */

/** Carpeta temporal propia; `cleanup` la borra con todo su contenido. */
export async function makeTempDir(prefix = 'restaurante-test-'): Promise<{ dir: string; cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

/** true si el proceso es root (los permisos de archivo no le afectan; p. ej. en Docker). */
export const runningAsRoot = (): boolean => process.getuid?.() === 0;

const configs = () => testDatabaseConfigs();
const runId = (): string => inject('testDatabaseRun');
const workerId = (): string => process.env.VITEST_POOL_ID ?? process.env.VITEST_WORKER_ID ?? '0';

/** Configuración del usuario de la app (solo DML) sobre una base de pruebas. */
export const appDatabase = (name: string): DatabaseConfig => withDatabase(configs().app, name);
/** DATABASE_URL de la app para un proceso hijo. */
export const appDatabaseUrl = (name: string): string => databaseUrl(appDatabase(name));

/** Base de referencia de esta ejecución (migrada por el globalSetup y nunca modificada). */
export const referenceDatabase = (run: string): string => `${TEST_DATABASE_PREFIX}_${run}_ref`;
let referenceFingerprint: string | null | undefined;

/** ¿La base está migrada y con el esquema intacto (igual que la de referencia)? */
async function isPristine(name: string): Promise<boolean> {
  referenceFingerprint ??= await schemaFingerprint(referenceDatabase(runId()));
  if (referenceFingerprint === null) throw new Error('Falta la base de referencia de las pruebas (globalSetup)');
  return (await schemaFingerprint(name)) === referenceFingerprint;
}

// Bases del trabajador en uso dentro de este archivo de pruebas (se ejecutan de una en una).
const inUse = new Set<number>();

export interface TestDatabase {
  name: string;
  prisma: Database;
  /** Conexión del usuario de la app (DATABASE_URL de un proceso hijo: appDatabaseUrl(name)). */
  config: DatabaseConfig;
  cleanup: () => Promise<void>;
}

/** Base migrada y vacía del trabajador, con el cliente del usuario de la app. */
export interface MakeDatabaseOptions {
  /** Cambia el destino de la conexión de la app (p. ej. un proxy TCP para cortar la base, CA-10). */
  route?: (config: DatabaseConfig) => DatabaseConfig;
}

export async function makeDatabase({ route = (config) => config }: MakeDatabaseOptions = {}): Promise<TestDatabase> {
  let slot = 1;
  while (inUse.has(slot)) slot += 1;
  inUse.add(slot);
  const name = `${TEST_DATABASE_PREFIX}_${runId()}_${workerId()}${slot > 1 ? `_${slot}` : ''}`;
  try {
    if (await isPristine(name)) {
      await truncateAll(name);
    } else {
      // Nueva, o alterada por una prueba anterior (tablas borradas, triggers...): se vuelve a crear.
      await dropDatabase(name);
      await createDatabase(name);
      await migrate(name);
    }
  } catch (err) {
    inUse.delete(slot);
    throw err;
  }
  const config = appDatabase(name);
  const prisma = createPrismaClient(route(config));
  let released = false;
  return {
    name,
    prisma,
    config,
    async cleanup() {
      if (released) return;
      released = true;
      // Se libera antes de desconectar: un cliente inactivo no bloquea el TRUNCATE de la siguiente.
      inUse.delete(slot);
      await prisma.$disconnect();
    },
  };
}

let scratchCounter = 0;

/** Base desechable (vacía o migrada). `cleanup` la borra. */
export async function makeScratchDatabase({ migrated = false }: { migrated?: boolean } = {}): Promise<{
  name: string;
  config: DatabaseConfig;
  cleanup: () => Promise<void>;
}> {
  scratchCounter += 1;
  const name = `${TEST_DATABASE_PREFIX}_${runId()}_${workerId()}_x${String(process.pid)}_${String(scratchCounter)}`;
  await createDatabase(name);
  if (migrated) await migrate(name);
  return { name, config: appDatabase(name), cleanup: () => dropDatabase(name) };
}

/** Nombres de las migraciones reales del proyecto. */
export async function projectMigrations(): Promise<string[]> {
  const entries = await readdir(DEFAULT_MIGRATIONS_DIR, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}
