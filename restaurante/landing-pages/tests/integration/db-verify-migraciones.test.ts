import { afterEach, describe, expect, it } from 'vitest';

import { DATABASE_INIT_CODES } from '@restaurante/db/verify';

import { adminSql } from '../support/database.ts';
import { scratch, failure, runCleanups } from '../support/db-verify.ts';

/**
 * Verificación al arrancar sobre MySQL real (REQ-F-014; RF-6, CA-2, CA-6 y CA-7), con el usuario
 * de la app (solo DML).
 *
 * REQ-F-041: parte de db-verify.test.ts (preparación en tests/support/db-verify.ts).
 */

afterEach(runCleanups);

describe('verifyDatabase sobre MySQL real', () => {
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

  describe('DATABASE_ALLOW_NEWER_SCHEMA (REQ-F-016, D-1): vuelta atrás tras una migración', () => {
    const FUTURE = "INSERT INTO _prisma_migrations (id, checksum, migration_name, finished_at, applied_steps_count) VALUES ('x', 'y', '29990101000000_futura', NOW(3), 1)";

    it('tolera una migración aplicada desconocida y la registra con database_newer_than_code_allowed', async () => {
      const { verify, name } = await scratch();
      await adminSql(name, FUTURE);
      const warnings: { msg: string; fields?: object }[] = [];
      await expect(verify({ allowNewerSchema: true, logger: { info: () => {}, warn: (msg, fields) => warnings.push({ msg, ...(fields ? { fields } : {}) }) } })).resolves.toBeUndefined();
      expect(warnings).toEqual([{ msg: 'database_newer_than_code_allowed', fields: { migrations: ['29990101000000_futura'] } }]);
    });

    it.each([
      ['migración desconocida incompleta', "INSERT INTO _prisma_migrations (id, checksum, migration_name, finished_at, applied_steps_count) VALUES ('x', 'y', '29990101000000_futura', NULL, 0)", DATABASE_INIT_CODES.MIGRATION_INCOMPLETE],
      ['migración conocida modificada', "UPDATE _prisma_migrations SET checksum = 'otro'", DATABASE_INIT_CODES.MIGRATION_MODIFIED],
    ])('sigue fallando con %s', async (_case, statement, code) => {
      const { verify, name } = await scratch();
      await adminSql(name, statement);
      expect(await failure(verify({ allowNewerSchema: true }))).toMatchObject({ code });
    });

    it('sigue exigiendo las migraciones conocidas (base sin migrar -> MIGRATIONS_PENDING)', async () => {
      const { verify } = await scratch(false);
      expect(await failure(verify({ allowNewerSchema: true }))).toMatchObject({ code: DATABASE_INIT_CODES.MIGRATIONS_PENDING });
    });
  });
});
