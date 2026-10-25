import { chmod } from 'node:fs/promises';

import { afterEach, describe, expect, it } from 'vitest';

import { ADMIN_ENV, ADMIN_PASSWORD, ADMIN_USER } from '../support/admin.ts';
import { adminSql, appDatabase, appDatabaseUrl, makeScratchDatabase, makeTempDir, projectMigrations, runningAsRoot } from '../support/database.ts';
import { databaseUrl } from '../support/test-database-config.ts';
import { startServer } from '../support/process.ts';

/**
 * Arranque real de `node src/server.ts` sobre MySQL (REQ-F-007 y REQ-F-014; RF-6, CA-7 y CA-9): si
 * la base no está lista, termina con código 1, un `database_init_failed` con un código estable y
 * sin stack, SQL, URL ni credenciales. La app nunca migra (RN-4).
 */

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()?.();
});

async function dataDir() {
  const temp = await makeTempDir();
  cleanups.push(async () => {
    await chmod(temp.dir, 0o700).catch(() => {});
    await temp.cleanup();
  });
  return temp.dir;
}

async function scratch(migrated: boolean) {
  const database = await makeScratchDatabase({ migrated });
  cleanups.push(database.cleanup);
  return database.name;
}

async function boot(env: Record<string, string>) {
  const server = await startServer({ DATA_DIR: await dataDir(), ...ADMIN_ENV, ...env });
  cleanups.push(async () => void (await server.stop()));
  return server;
}

function logLines(stdout: string) {
  return stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

async function expectControlledFailure(databaseUrlValue: string, expected: Record<string, unknown>) {
  const server = await boot({ DATABASE_URL: databaseUrlValue });
  expect(server.started).toBe(false);
  expect(await server.exited).toBe(1);
  const { stdout, stderr } = server.output();
  expect(stderr).toContain(`No se pudo usar la base de datos (${String(expected.code)})`);
  expect(logLines(stdout).find((line) => line.msg === 'database_init_failed')).toMatchObject(expected);
  // Sin stack trace, SQL, URL ni credenciales.
  const output = stdout + stderr;
  expect(output).not.toMatch(/\n\s+at |CREATE TABLE|INSERT INTO|SELECT |mysql:\/\//);
  const { password, user } = appDatabase('restaurante_test');
  expect(output).not.toContain(password);
  expect(output).not.toContain(user);
}

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

  it('migración incompleta o fallida -> código 1', async () => {
    const name = await scratch(true);
    await adminSql(name, 'UPDATE _prisma_migrations SET finished_at = NULL');
    await expectControlledFailure(appDatabaseUrl(name), { code: 'MIGRATION_INCOMPLETE' });
  });

  it('columna con otra colación -> código 1 (DATABASE_CHARSET_INVALID, CA-2)', async () => {
    const name = await scratch(true);
    await adminSql(name, 'ALTER TABLE product MODIFY name VARCHAR(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL');
    await expectControlledFailure(appDatabaseUrl(name), { code: 'DATABASE_CHARSET_INVALID', object: 'product.name' });
  });

  it('D-15: si los productos no se pueden leer al arrancar -> código 1 con un mensaje controlado', async () => {
    const name = await scratch(true);
    // Una tabla que falta hace fallar la lectura de Prisma (la verificación no comprueba tablas).
    await adminSql(name, 'DROP TABLE product_chip');
    const server = await boot({ DATABASE_URL: appDatabaseUrl(name) });
    expect(server.started).toBe(false);
    expect(await server.exited).toBe(1);
    const { stdout, stderr } = server.output();
    expect(stderr).toContain('No se pudieron preparar los productos en la base de datos.');
    expect(stdout).toContain('"msg":"products_init_failed"');
    expect(stdout + stderr).not.toMatch(/\n\s+at |SELECT |prisma\.|product_chip/);
  });

  it.skipIf(runningAsRoot())('DATA_DIR sin permisos de escritura -> código 1 sin stack', async () => {
    const dir = await dataDir();
    await chmod(dir, 0o500);
    const server = await startServer({ DATA_DIR: dir, ...ADMIN_ENV });
    cleanups.push(async () => void (await server.stop()));
    expect(server.started).toBe(false);
    expect(await server.exited).toBe(1);
    const { stdout, stderr } = server.output();
    // Falla antes, al preparar los datos editables (REQ-F-001), con su propio mensaje controlado.
    expect(stderr).toContain('No se pudo preparar la carpeta de datos');
    expect(stdout + stderr).not.toMatch(/\n\s+at /);
  });
});

describe('primer arranque (CA-9)', () => {
  it('base vacía y migrada: importa los productos, crea el administrador y se entra con la contraseña de siempre', async () => {
    const name = await scratch(true);
    const server = await boot({ DATABASE_URL: appDatabaseUrl(name) });
    expect(server.started).toBe(true);

    const res = await fetch(`${server.url}/admin/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ username: ADMIN_USER, password: ADMIN_PASSWORD }),
      redirect: 'manual',
    });
    expect(res.status).toBe(303);
    expect((await fetch(`${server.url}/`)).status).toBe(200);

    const lines = logLines(server.output().stdout);
    expect(lines.map((line) => line.msg)).toEqual(expect.arrayContaining(['admin_bootstrap_created', 'products_imported', 'server_started', 'admin_login_succeeded']));
    expect(lines.filter((line) => line.msg === 'products_imported')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ business: 'molotes', count: 10 }),
        expect.objectContaining({ business: 'birria', count: 6 }),
      ]),
    );
    expect(lines.map((line) => line.msg)).not.toContain('database_migrated');
    expect(server.output().stdout).not.toContain(ADMIN_ENV.ADMIN_PASSWORD_HASH);

    expect(await server.stop()).toBe(0);
    expect(await adminSql(name, 'SELECT action, actor_kind AS actorKind FROM user_audit')).toEqual([{ action: 'bootstrap', actorKind: 'system' }]);

    // Segundo arranque con la misma base: no vuelve a crear el administrador ni a importar.
    const again = await boot({ DATABASE_URL: appDatabaseUrl(name) });
    expect(again.started).toBe(true);
    const output = again.output().stdout;
    expect(output).not.toContain('admin_bootstrap_created');
    // La importación de productos ocurre una sola vez (REQ-F-008, CA-3).
    expect(output).not.toContain('products_imported');
    expect(output).toContain('"msg":"admin_bootstrap_ignored"');
  }, 60_000);
});
