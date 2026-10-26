import { afterEach, describe, expect, it } from 'vitest';

import { createPrismaClient } from '@restaurante/db/client';
import { probeOf, queryOf, verifyDatabase } from '@restaurante/db/verify';

import { adminDatabaseUrl, adminSql, makeScratchDatabase, runMigrateDeploy, spawnPrisma } from '../support/database.ts';
import { projectMigrationChecksums } from '../support/migrations.ts';

/**
 * Las migraciones con el CLI real de Prisma (REQ-F-014, RF-6 y CA-6): `prisma migrate deploy`
 * crea el esquema en una base vacía y la app la reconoce como al día (sustituye a la prueba de
 * compatibilidad del aplicador propio de SQLite).
 */

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()?.();
});

function prismaCli(args: string[], url: string): Promise<{ code: number | null; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawnPrisma(args, { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', MIGRATION_DATABASE_URL: url, CHECKPOINT_DISABLE: '1', PRISMA_HIDE_UPDATE_MESSAGE: '1' });
    let output = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => (output += chunk));
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => (output += chunk));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, output }));
  });
}

describe('prisma migrate deploy (proceso migrate)', () => {
  it('crea el esquema en una base vacía (código 0), queda registrado como Prisma y la app lo verifica', async () => {
    const database = await makeScratchDatabase();
    cleanups.push(database.cleanup);
    const first = await runMigrateDeploy(database.name);
    expect(first.code, first.output).toBe(0);

    const rows = (await adminSql(database.name, 'SELECT migration_name AS name, checksum FROM _prisma_migrations ORDER BY migration_name')) as Record<string, unknown>[];
    expect(rows.map((row) => ({ name: row.name, checksum: row.checksum }))).toEqual(await projectMigrationChecksums());

    const status = await prismaCli(['migrate', 'status'], adminDatabaseUrl(database.name));
    expect(status.code, status.output).toBe(0);
    expect(status.output).toContain('Database schema is up to date');

    const prisma = createPrismaClient(database.config);
    cleanups.push(() => prisma.$disconnect());
    await expect(verifyDatabase({ probe: probeOf(database.config), query: queryOf(prisma) })).resolves.toBeUndefined();

    // Volver a ejecutarlo no aplica nada.
    const again = await runMigrateDeploy(database.name);
    expect(again.code).toBe(0);
    expect(again.output).toContain('No pending migrations to apply');
  });
});
