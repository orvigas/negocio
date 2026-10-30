import { afterEach, describe, expect, it } from 'vitest';

import { adminSql } from '../support/database.ts';
import { scratch, runCleanups } from '../support/db-verify.ts';

/**
 * Verificación al arrancar sobre MySQL real (REQ-F-014; RF-6, CA-2, CA-6 y CA-7), con el usuario
 * de la app (solo DML).
 *
 * REQ-F-041: parte de db-verify.test.ts (preparación en tests/support/db-verify.ts).
 */

afterEach(runCleanups);

describe('verifyDatabase sobre MySQL real', () => {
  it('base migrada: correcta con el usuario solo DML (CA-6); _prisma_migrations en utf8mb4_unicode_ci se acepta (P-1)', async () => {
    const { verify, name } = await scratch();
    await expect(verify()).resolves.toBeUndefined();
    const rows = (await adminSql(undefined, {
      sql: "SELECT TABLE_COLLATION AS collation FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = '_prisma_migrations'",
      values: [name],
    })) as { collation: string }[];
    expect(rows[0]?.collation).toBe('utf8mb4_unicode_ci');
  });

  it('CA-2: la base, todas las tablas de la app y todas sus columnas de texto están en utf8mb4_es_0900_as_cs', async () => {
    const { name } = await scratch();
    const schema = (await adminSql(undefined, { sql: 'SELECT DEFAULT_CHARACTER_SET_NAME AS charset, DEFAULT_COLLATION_NAME AS collation FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?', values: [name] })) as Record<string, string>[];
    expect(schema[0]).toEqual({ charset: 'utf8mb4', collation: 'utf8mb4_es_0900_as_cs' });
    const tables = (await adminSql(undefined, { sql: "SELECT DISTINCT TABLE_COLLATION AS collation FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME <> '_prisma_migrations'", values: [name] })) as Record<string, string>[];
    expect(tables).toEqual([{ collation: 'utf8mb4_es_0900_as_cs' }]);
    const columns = (await adminSql(undefined, {
      sql: "SELECT DISTINCT CHARACTER_SET_NAME AS charset, COLLATION_NAME AS collation FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME <> '_prisma_migrations' AND CHARACTER_SET_NAME IS NOT NULL",
      values: [name],
    })) as Record<string, string>[];
    expect(columns).toEqual([{ charset: 'utf8mb4', collation: 'utf8mb4_es_0900_as_cs' }]);
  });

  it('CA-6: el usuario de la app no tiene privilegios DDL', async () => {
    const { prisma } = await scratch();
    await expect(prisma.$executeRawUnsafe('CREATE TABLE intruso (id INT)')).rejects.toThrow();
    await expect(prisma.$executeRawUnsafe('DROP TABLE product_import')).rejects.toThrow();
  });
});
