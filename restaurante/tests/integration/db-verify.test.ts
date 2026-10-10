import { afterEach, describe, expect, it } from 'vitest';

import { createPrismaClient } from '../../src/db/client.ts';
import { DATABASE_INIT_CODES, DatabaseInitError, probeOf, queryOf, verifyDatabase } from '../../src/db/verify.ts';
import { adminSql, makeScratchDatabase } from '../support/database.ts';

/**
 * Verificación al arrancar sobre MySQL real (REQ-F-014; RF-6, CA-2, CA-6 y CA-7), con el usuario
 * de la app (solo DML).
 */

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()?.();
});

async function scratch(migrated = true) {
  const database = await makeScratchDatabase({ migrated });
  cleanups.push(database.cleanup);
  const prisma = createPrismaClient(database.config);
  cleanups.push(() => prisma.$disconnect());
  const verify = () => verifyDatabase({ probe: probeOf(database.config), query: queryOf(prisma), windowMs: 5000 });
  return { ...database, prisma, verify };
}

const failure = (promise: Promise<unknown>) => promise.then(() => null, (error: unknown) => error as DatabaseInitError);

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

  it.each([
    ['la base', (name: string) => `ALTER DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`, (name: string) => name],
    ['una tabla', () => 'ALTER TABLE product_import DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci', () => 'product_import'],
    ['una columna', () => 'ALTER TABLE user MODIFY display_name VARCHAR(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL', () => 'user.display_name'],
    ['_prisma_migrations en utf8mb3', () => 'ALTER TABLE _prisma_migrations CONVERT TO CHARACTER SET utf8mb3', () => '_prisma_migrations'],
  ])('CA-2: %s con otra colación -> DATABASE_CHARSET_INVALID', async (_case, statement, object) => {
    const { verify, name } = await scratch();
    await adminSql(name, statement(name));
    const err = await failure(verify());
    expect(err).toMatchObject({ code: DATABASE_INIT_CODES.CHARSET_INVALID });
    expect(err?.object?.startsWith(object(name))).toBe(true);
  });

  it.each([
    ['sin migrar', null, DATABASE_INIT_CODES.MIGRATIONS_PENDING],
    ['migración modificada', "UPDATE _prisma_migrations SET checksum = 'otro'", DATABASE_INIT_CODES.MIGRATION_MODIFIED],
    ['migración incompleta', 'UPDATE _prisma_migrations SET finished_at = NULL', DATABASE_INIT_CODES.MIGRATION_INCOMPLETE],
    [
      'base más nueva',
      "INSERT INTO _prisma_migrations (id, checksum, migration_name, finished_at, applied_steps_count) VALUES ('x', 'y', '29990101000000_futura', NOW(3), 1)",
      DATABASE_INIT_CODES.DATABASE_NEWER_THAN_CODE,
    ],
  ])('CA-7: %s', async (_case, statement, code) => {
    const { verify, name } = await scratch(statement !== null);
    if (statement) await adminSql(name, statement);
    expect(await failure(verify())).toMatchObject({ code });
  });
});
