import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { DEFAULT_MIGRATIONS_DIR } from '@restaurante/db/verify';

/** Migraciones reales del proyecto (REQ-F-014): nombre, SQL y checksum (el mismo que calcula Prisma). */
export async function projectMigrationFiles(): Promise<{ name: string; sql: string; checksum: string }[]> {
  const entries = await readdir(DEFAULT_MIGRATIONS_DIR, { withFileTypes: true });
  const names = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  return Promise.all(
    names.map(async (name) => {
      const bytes = await readFile(join(DEFAULT_MIGRATIONS_DIR, name, 'migration.sql'));
      return { name, sql: bytes.toString('utf8'), checksum: createHash('sha256').update(bytes).digest('hex') };
    }),
  );
}

export async function projectMigrationChecksums(): Promise<{ name: string; checksum: string }[]> {
  return (await projectMigrationFiles()).map(({ name, checksum }) => ({ name, checksum }));
}
