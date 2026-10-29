import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { DEFAULT_MIGRATIONS_DIR } from '@restaurante/db/verify';

import { projectMigrationFiles } from '../support/migrations.ts';

/**
 * Migraciones revisadas a mano (REQ-F-014, D-4 y D-5): Prisma escribe `COLLATE utf8mb4_unicode_ci`
 * en cada CREATE TABLE; en este proyecto todas las tablas usan utf8mb4 con utf8mb4_es_0900_as_cs.
 * Si `npm run db:migrate:dev` genera una migración nueva, esta prueba falla hasta corregirla.
 */

const TABLE_SUFFIX = ') DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_es_0900_as_cs;';

describe('migraciones de MySQL', () => {
  it('el proveedor de las migraciones es MySQL', async () => {
    expect(await readFile(join(DEFAULT_MIGRATIONS_DIR, 'migration_lock.toml'), 'utf8')).toContain('provider = "mysql"');
  });

  it('hay al menos una migración', async () => {
    expect((await projectMigrationFiles()).length).toBeGreaterThan(0);
  });

  it('cada CREATE TABLE termina con utf8mb4 y utf8mb4_es_0900_as_cs', async () => {
    for (const { name, sql } of await projectMigrationFiles()) {
      const statements = sql.split(/;\s*\n/).map((statement) => `${statement.trim()};`);
      for (const statement of statements.filter((candidate) => /^(--[^\n]*\n\s*)*CREATE TABLE/i.test(candidate))) {
        expect(statement.endsWith(TABLE_SUFFIX), `${name}: ${statement.split('\n').find((line) => /CREATE TABLE/i.test(line)) ?? ''}`).toBe(true);
      }
    }
  });

  it('ninguna migración usa otra colación ni utf8/utf8mb3', async () => {
    for (const { name, sql } of await projectMigrationFiles()) {
      const code = sql.replace(/--[^\n]*/g, '');
      for (const collation of code.match(/COLLATE\s+\w+/gi) ?? []) expect(collation, name).toBe('COLLATE utf8mb4_es_0900_as_cs');
      for (const charset of code.match(/CHARACTER SET\s+\w+/gi) ?? []) expect(charset, name).toBe('CHARACTER SET utf8mb4');
      expect(code, name).not.toMatch(/\butf8mb3\b|\bCHARSET\s*=?\s*utf8\b/i);
    }
  });
});
