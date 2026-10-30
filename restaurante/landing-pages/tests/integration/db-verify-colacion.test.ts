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
});
