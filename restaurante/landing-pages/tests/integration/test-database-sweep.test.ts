import { randomBytes } from 'node:crypto';

import { describe, expect, inject, it, onTestFinished } from 'vitest';

import { dropDatabases, runStartedAt } from '../setup/database-global.ts';
import { adminSql, makeScratchDatabase } from '../support/database.ts';
import { createDatabase, dropDatabase } from '../support/database-admin.ts';
import { TEST_DATABASE_PREFIX } from '../support/test-database-config.ts';

/** Limpieza de bases de ejecuciones interrumpidas: lo que hace cada suite al arrancar. */

const HOUR = 3600;
const SWEEP = `${TEST_DATABASE_PREFIX}\\_%`;

async function mysqlNow(): Promise<number> {
  const rows = (await adminSql(undefined, 'SELECT UNIX_TIMESTAMP() AS now')) as { now: number | bigint }[];
  return Number(rows[0]?.now);
}

const suffix = () => randomBytes(3).toString('hex');
const hexSeconds = (seconds: number) => seconds.toString(16).padStart(8, '0');

async function emptyDatabase(run: string): Promise<string> {
  const name = `${TEST_DATABASE_PREFIX}_${run}_1`;
  await createDatabase(name);
  onTestFinished(() => dropDatabase(name));
  return name;
}

async function exists(name: string): Promise<boolean> {
  const rows = (await adminSql(undefined, { sql: 'SELECT 1 FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?', values: [name] })) as unknown[];
  return rows.length === 1;
}

describe('limpieza de bases de ejecuciones interrumpidas', () => {
  it('borra una base vacía de una ejecución de hace más de 6 h', async () => {
    const stale = await emptyDatabase(`${hexSeconds((await mysqlNow()) - 6 * HOUR - 60)}${suffix()}`);
    await dropDatabases(SWEEP, 6);
    expect(await exists(stale)).toBe(false);
  });

  it('respeta una base vacía recién creada: la de esta suite y la de otra en paralelo', async () => {
    const parallel = await emptyDatabase(`${hexSeconds((await mysqlNow()) - 6 * HOUR + 60)}${suffix()}`);
    const own = await makeScratchDatabase();
    onTestFinished(own.cleanup);
    await dropDatabases(SWEEP, 6);
    expect(await exists(parallel)).toBe(true);
    expect(await exists(own.name)).toBe(true);
  });

  it('no toca una base vacía cuyo nombre no dice su fecha', async () => {
    const undated = await emptyDatabase(suffix());
    await dropDatabases(SWEEP, 6);
    expect(await exists(undated)).toBe(true);
  });

  it('el id de esta ejecución lleva su fecha en el reloj de MySQL', async () => {
    const started = runStartedAt(`${TEST_DATABASE_PREFIX}_${inject('testDatabaseRun')}_1`);
    expect(started).not.toBeNull();
    expect(Math.abs((await mysqlNow()) - (started as number))).toBeLessThan(HOUR);
  });
});
