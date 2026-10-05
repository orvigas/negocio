import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { DEFAULT_MIGRATIONS_DIR } from '../../src/db/migrate.ts';
import { openDatabase, type Database } from '../../src/db/client.ts';

/**
 * Bases de datos de prueba (REQ-F-007): siempre en carpetas temporales, nunca en data/.
 */

/** Carpeta temporal propia; `cleanup` la borra con todo su contenido. */
export async function makeTempDir(prefix = 'restaurante-test-'): Promise<{ dir: string; cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

/** DATA_DIR temporal con la base de datos migrada y su cliente. */
export async function makeDatabase(): Promise<{ dataDir: string; prisma: Database; cleanup: () => Promise<void> }> {
  const { dir, cleanup } = await makeTempDir();
  const { prisma } = await openDatabase({ dataDir: dir });
  return {
    dataDir: dir,
    prisma,
    async cleanup() {
      await prisma.$disconnect();
      await cleanup();
    },
  };
}

/** Copia las migraciones reales a `target` (para añadir migraciones de prueba). */
export async function copyMigrations(target: string): Promise<void> {
  const { cp } = await import('node:fs/promises');
  await cp(DEFAULT_MIGRATIONS_DIR, target, { recursive: true });
}

/** Escribe una migración de prueba `<name>/migration.sql` en `dir`. */
export async function writeMigration(dir: string, name: string, sql: string): Promise<void> {
  await mkdir(join(dir, name), { recursive: true });
  await writeFile(join(dir, name, 'migration.sql'), sql);
}

/** Nombres de las migraciones reales del proyecto. */
export async function projectMigrations(): Promise<string[]> {
  const entries = await readdir(DEFAULT_MIGRATIONS_DIR, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}

/** true si el proceso es root (los permisos de archivo no le afectan; p. ej. en Docker). */
export const runningAsRoot = (): boolean => process.getuid?.() === 0;
