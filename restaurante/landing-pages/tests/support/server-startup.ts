import { chmod } from 'node:fs/promises';

import { expect } from 'vitest';

import { ADMIN_ENV } from './admin.ts';
import { appDatabase, makeScratchDatabase, makeTempDir } from './database.ts';
import { startServer } from './process.ts';

/**
 * Arranque real con la base de datos (REQ-F-014) en server-startup.test.ts y
 * server-startup-base.test.ts. REQ-F-041: preparación compartida por los archivos en que se partió
 * server-startup.test.ts, sin cambios.
 */

export const cleanups: (() => Promise<void>)[] = [];
/** Limpieza de la prueba (procesos, bases, proxies): cada archivo la registra con afterEach. */
export async function runCleanups(): Promise<void> {
  while (cleanups.length > 0) await cleanups.pop()?.();
}

export async function dataDir() {
  const temp = await makeTempDir();
  cleanups.push(async () => {
    await chmod(temp.dir, 0o700).catch(() => {});
    await temp.cleanup();
  });
  return temp.dir;
}

export async function scratch(migrated: boolean) {
  const database = await makeScratchDatabase({ migrated });
  cleanups.push(database.cleanup);
  return database.name;
}

export async function boot(env: Record<string, string>) {
  const server = await startServer({ DATA_DIR: await dataDir(), ...ADMIN_ENV, ...env });
  cleanups.push(async () => void (await server.stop()));
  return server;
}

export function logLines(stdout: string) {
  return stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

export async function expectControlledFailure(databaseUrlValue: string, expected: Record<string, unknown>) {
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
