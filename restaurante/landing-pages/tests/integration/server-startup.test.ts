import { afterEach, describe, expect, it } from 'vitest';

import { adminSql, appDatabase, appDatabaseUrl, projectMigrations } from '../support/database.ts';
import { databaseUrl } from '../support/test-database-config.ts';
import { scratch, expectControlledFailure, runCleanups } from '../support/server-startup.ts';

/**
 * Arranque real de `node src/server.ts` sobre MySQL (REQ-F-007 y REQ-F-014; RF-6, CA-7 y CA-9): si
 * la base no está lista, termina con código 1, un `database_init_failed` con un código estable y
 * sin stack, SQL, URL ni credenciales. La app nunca migra (RN-4).
 *
 * REQ-F-041: parte de server-startup.test.ts (preparación en tests/support/server-startup.ts).
 */

afterEach(runCleanups);

describe('arranque con la base de datos no lista (RF-6, CA-7)', () => {
  it('credenciales inválidas -> código 1 al momento (DATABASE_AUTH_FAILED)', async () => {
    const name = await scratch(true);
    const wrong = databaseUrl({ ...appDatabase(name), password: 'contraseña-equivocada' });
    await expectControlledFailure(wrong, { code: 'DATABASE_AUTH_FAILED' });
  });

  it('base sin migrar -> código 1 (MIGRATIONS_PENDING) y la app no crea ninguna tabla (RN-4)', async () => {
    const name = await scratch(false);
    await expectControlledFailure(appDatabaseUrl(name), { code: 'MIGRATIONS_PENDING' });
    expect(((await adminSql(name, 'SHOW TABLES')) as unknown[]).length).toBe(0);
  });

  it('migración pendiente (el código trae una que la base no tiene) -> código 1', async () => {
    const name = await scratch(true);
    const [first] = await projectMigrations();
    await adminSql(name, { sql: 'DELETE FROM _prisma_migrations WHERE migration_name = ?', values: [first] });
    await expectControlledFailure(appDatabaseUrl(name), { code: 'MIGRATIONS_PENDING', migration: first });
  });

  it('base más nueva que el código -> código 1', async () => {
    const name = await scratch(true);
    await adminSql(
      name,
      "INSERT INTO _prisma_migrations (id, checksum, migration_name, finished_at, applied_steps_count) VALUES ('x', 'y', '29990101000000_futura', NOW(3), 1)",
    );
    await expectControlledFailure(appDatabaseUrl(name), { code: 'DATABASE_NEWER_THAN_CODE', migration: '29990101000000_futura' });
  });

  it('migración modificada -> código 1', async () => {
    const name = await scratch(true);
    await adminSql(name, "UPDATE _prisma_migrations SET checksum = 'otro'");
    await expectControlledFailure(appDatabaseUrl(name), { code: 'MIGRATION_MODIFIED' });
  });
});
