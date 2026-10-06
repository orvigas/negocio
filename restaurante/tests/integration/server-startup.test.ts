import { chmod, writeFile } from 'node:fs/promises';

import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

import { prepareDatabase } from '../../src/db/migrate.ts';
import { databaseFile } from '../../src/db/paths.ts';
import { ADMIN_ENV, ADMIN_PASSWORD, ADMIN_USER } from '../support/admin.ts';
import { makeTempDir, runningAsRoot } from '../support/database.ts';
import { startServer } from '../support/process.ts';

/**
 * Arranque real de `node src/server.ts` (REQ-F-007, R-1, R-2 y R-4; CA-1 y CA-4): con la base de
 * datos no disponible termina con código 1 y un mensaje controlado, sin stack, SQL ni rutas.
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

async function expectControlledFailure(dir: string, expectedCode: string | RegExp) {
  const server = await startServer({ DATA_DIR: dir, ...ADMIN_ENV });
  cleanups.push(async () => void (await server.stop()));
  expect(server.started).toBe(false);
  expect(await server.exited).toBe(1);
  const { stdout, stderr } = server.output();
  expect(stderr).toContain('No se pudo preparar la base de datos en DATA_DIR');
  const logLine = stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>)
    .find((line) => line.msg === 'database_init_failed');
  expect(logLine).toBeDefined();
  if (typeof expectedCode === 'string') expect(logLine?.code).toBe(expectedCode);
  else expect(String(logLine?.code)).toMatch(expectedCode);
  // Sin stack trace, SQL ni rutas del sistema.
  const output = stdout + stderr;
  expect(output).not.toMatch(/\n\s+at |CREATE TABLE|INSERT INTO|SELECT /);
  expect(output).not.toContain(dir);
}

describe('arranque con la base de datos no disponible (CA-4)', () => {
  it('.db dañado -> código 1', async () => {
    const dir = await dataDir();
    await writeFile(databaseFile(dir), Buffer.alloc(8192, 7));
    await expectControlledFailure(dir, 'SQLITE_NOTADB');
  }, 30_000);

  it('migración que falla (la tabla ya existe sin registro de migraciones) -> código 1 y nada a medias', async () => {
    const dir = await dataDir();
    const db = new Database(databaseFile(dir));
    db.exec('CREATE TABLE "user" ("id" INTEGER PRIMARY KEY)');
    db.close();
    await expectControlledFailure(dir, 'MIGRATION_FAILED');
    const after = new Database(databaseFile(dir), { readonly: true });
    expect(after.prepare("SELECT COUNT(*) FROM sqlite_master WHERE name = 'user_audit'").pluck().get()).toBe(0);
    after.close();
  }, 30_000);

  it('base de datos más nueva que el código -> código 1', async () => {
    const dir = await dataDir();
    await prepareDatabase({ file: databaseFile(dir) });
    const db = new Database(databaseFile(dir));
    db.exec("INSERT INTO _prisma_migrations (id, checksum, migration_name, finished_at, applied_steps_count) VALUES ('x', 'y', '29990101000000_futura', 1, 1)");
    db.close();
    await expectControlledFailure(dir, 'DATABASE_NEWER_THAN_CODE');
  }, 30_000);

  it.skipIf(runningAsRoot())('.db de solo lectura -> código 1', async () => {
    const dir = await dataDir();
    await prepareDatabase({ file: databaseFile(dir) });
    await chmod(databaseFile(dir), 0o444);
    await expectControlledFailure(dir, /^SQLITE_READONLY/);
  }, 30_000);

  it.skipIf(runningAsRoot())('DATA_DIR sin permisos de escritura -> código 1 sin stack', async () => {
    const dir = await dataDir();
    await chmod(dir, 0o500);
    const server = await startServer({ DATA_DIR: dir, ...ADMIN_ENV });
    expect(server.started).toBe(false);
    expect(await server.exited).toBe(1);
    const { stdout, stderr } = server.output();
    // Falla antes, al preparar los datos editables (REQ-F-001), con su propio mensaje controlado.
    expect(stderr).toMatch(/No se pudo preparar (la carpeta de datos|la base de datos)/);
    expect(stdout + stderr).not.toMatch(/\n\s+at /);
  }, 30_000);
});

describe('primer arranque (CA-1)', () => {
  it('crea el .db, migra, crea el administrador y se entra con la contraseña de siempre', async () => {
    const dir = await dataDir();
    const server = await startServer({ DATA_DIR: dir, ...ADMIN_ENV });
    cleanups.push(async () => void (await server.stop()));
    expect(server.started).toBe(true);

    const res = await fetch(`${server.url}/admin/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ username: ADMIN_USER, password: ADMIN_PASSWORD }),
      redirect: 'manual',
    });
    expect(res.status).toBe(303);
    expect((await fetch(`${server.url}/`)).status).toBe(200);

    const messages = server
      .output()
      .stdout.split('\n')
      .filter(Boolean)
      .map((line) => (JSON.parse(line) as { msg: string }).msg);
    expect(messages).toEqual(expect.arrayContaining(['database_migrated', 'admin_bootstrap_created', 'server_started', 'admin_login_succeeded']));
    expect(server.output().stdout).not.toContain(ADMIN_ENV.ADMIN_PASSWORD_HASH);

    expect(await server.stop()).toBe(0);
    const db = new Database(databaseFile(dir), { readonly: true });
    expect(db.prepare('SELECT action, actor_kind AS actorKind FROM user_audit').all()).toEqual([{ action: 'bootstrap', actorKind: 'system' }]);
    db.close();

    // Segundo arranque con el mismo DATA_DIR: no vuelve a migrar ni a crear el administrador.
    const again = await startServer({ DATA_DIR: dir, ...ADMIN_ENV });
    cleanups.push(async () => void (await again.stop()));
    expect(again.started).toBe(true);
    const output = again.output().stdout;
    expect(output).not.toContain('database_migrated');
    expect(output).not.toContain('admin_bootstrap_created');
    expect(output).toContain('"msg":"admin_bootstrap_ignored"');
  }, 60_000);
});
