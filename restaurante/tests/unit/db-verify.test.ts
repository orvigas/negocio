import { describe, expect, it } from 'vitest';

import type { Prisma } from '../../src/generated/prisma/client.ts';
import {
  ATTEMPT_MAX_MS,
  DATABASE_INIT_CODES,
  DatabaseInitError,
  STARTUP_WINDOW_MS,
  verifyDatabase,
  type RawQuery,
} from '../../src/db/verify.ts';
import { projectMigrationChecksums } from '../support/migrations.ts';

/**
 * Lógica de la verificación al arrancar (REQ-F-014, RF-6 y CA-7) con dobles: reintentos dentro de
 * 60 s con un reloj falso, fallos inmediatos y comprobaciones que no se pueden provocar en un MySQL
 * compartido (modo estricto). Los casos sobre MySQL real están en tests/integration/db-verify.test.ts.
 */

const COLLATION = 'utf8mb4_es_0900_as_cs';

interface FakeState {
  sqlMode?: string;
  database?: { charset: string; collation: string };
  migrations?: Record<string, unknown>[] | 'missing';
  tables?: { name: string; collation: string }[];
  columns?: { tableName: string; columnName: string; charset: string; collation: string }[];
  fail?: Error;
}

async function fakeQuery(state: FakeState): Promise<RawQuery> {
  const applied = (await projectMigrationChecksums()).map(({ name, checksum }) => ({ name, checksum, finished: new Date(), rolledBack: null }));
  return (sql: Prisma.Sql) => {
    const text = sql.sql;
    if (state.fail) return Promise.reject(state.fail);
    if (text.includes('sql_mode')) return Promise.resolve([{ mode: state.sqlMode ?? 'STRICT_TRANS_TABLES,NO_ZERO_DATE' }]);
    if (text.includes('SCHEMATA')) return Promise.resolve([{ name: 'restaurante', ...(state.database ?? { charset: 'utf8mb4', collation: COLLATION }) }]);
    if (text.includes('_prisma_migrations')) {
      if (state.migrations === 'missing') return Promise.reject(Object.assign(new Error('x'), { code: 'P2021' }));
      return Promise.resolve(state.migrations ?? applied);
    }
    if (text.includes('information_schema.TABLES')) return Promise.resolve(state.tables ?? [{ name: 'user', collation: COLLATION }]);
    if (text.includes('information_schema.COLUMNS')) return Promise.resolve(state.columns ?? [{ tableName: 'user', columnName: 'username', charset: 'utf8mb4', collation: COLLATION }]);
    return Promise.reject(new Error(`consulta inesperada: ${text}`));
  };
}

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  const err = await promise.then(
    () => undefined,
    (error: unknown) => error,
  );
  if (err === undefined) return undefined;
  expect(err).toBeInstanceOf(DatabaseInitError);
  return (err as DatabaseInitError).code;
}

/** Reloj y espera falsos: `sleep` avanza el reloj; cada intento fallido tarda `attemptMs`. */
function fakeTime(attemptMs = 0) {
  let now = 0;
  return {
    now: () => now,
    sleep: (ms: number) => {
      now += ms;
      return Promise.resolve();
    },
    attempt: () => {
      now += attemptMs;
    },
    elapsed: () => now,
  };
}

const refused = Object.assign(new Error('connect ECONNREFUSED'), { errno: -61, code: 'ECONNREFUSED' });

describe('verifyDatabase: conexión (RF-6)', () => {
  it.each([0, ATTEMPT_MAX_MS])('MySQL que no responde: reintenta y falla con DATABASE_UNREACHABLE dentro de 60 s (cada intento tarda %i ms)', async (attemptMs) => {
    const time = fakeTime(attemptMs);
    let attempts = 0;
    const waits: number[] = [];
    const code = await codeOf(
      verifyDatabase({
        probe: () => {
          attempts += 1;
          time.attempt();
          return Promise.reject(refused);
        },
        query: await fakeQuery({}),
        now: time.now,
        sleep: async (ms) => {
          waits.push(ms);
          await time.sleep(ms);
        },
        logger: { info: () => {}, warn: () => {} },
      }),
    );
    expect(code).toBe(DATABASE_INIT_CODES.UNREACHABLE);
    expect(attempts).toBeGreaterThan(3);
    expect(time.elapsed()).toBeLessThanOrEqual(STARTUP_WINDOW_MS);
    expect(waits.slice(0, 4)).toEqual([500, 1000, 2000, 4000]);
  });

  it('MySQL que tarda en arrancar: espera y continúa (registra database_waiting sin detalles)', async () => {
    const time = fakeTime();
    let attempts = 0;
    const lines: { msg: string; fields?: Record<string, unknown> }[] = [];
    await verifyDatabase({
      probe: () => (++attempts < 4 ? Promise.reject(refused) : Promise.resolve()),
      query: await fakeQuery({}),
      now: time.now,
      sleep: time.sleep,
      logger: { info: (msg, fields) => lines.push({ msg, ...(fields ? { fields } : {}) }), warn: () => {} },
    });
    expect(attempts).toBe(4);
    expect(lines.map((line) => line.msg)).toEqual(['database_waiting', 'database_waiting', 'database_waiting']);
    expect(lines[0]?.fields).toEqual({ attempt: 1, code: '-61', retryInMs: 500 });
  });

  it.each([
    ['credenciales inválidas (1045)', 1045, DATABASE_INIT_CODES.AUTH_FAILED],
    ['clave RSA no disponible (45044)', 45044, DATABASE_INIT_CODES.AUTH_FAILED],
    ['sin acceso a la base (1044)', 1044, DATABASE_INIT_CODES.ACCESS_DENIED],
    ['base inexistente (1049)', 1049, DATABASE_INIT_CODES.ACCESS_DENIED],
  ])('%s -> falla al momento, sin reintentar', async (_case, errno, expected) => {
    let attempts = 0;
    const code = await codeOf(
      verifyDatabase({
        probe: () => {
          attempts += 1;
          return Promise.reject(Object.assign(new Error('Access denied for user'), { errno }));
        },
        query: await fakeQuery({}),
        sleep: () => Promise.reject(new Error('no debe esperar')),
      }),
    );
    expect(code).toBe(expected);
    expect(attempts).toBe(1);
  });
});

describe('verifyDatabase: estado de la base (RF-6, CA-2 y CA-7)', () => {
  const run = async (state: FakeState) => codeOf(verifyDatabase({ probe: () => Promise.resolve(), query: await fakeQuery(state) }));

  it('base correcta -> sin error', async () => {
    expect(await run({})).toBeUndefined();
  });

  it.each(['', 'NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO', 'ANSI_QUOTES'])('modo estricto ausente (%s) -> DATABASE_NOT_STRICT', async (sqlMode) => {
    expect(await run({ sqlMode })).toBe(DATABASE_INIT_CODES.NOT_STRICT);
  });

  it('STRICT_ALL_TABLES también es modo estricto', async () => {
    expect(await run({ sqlMode: 'STRICT_ALL_TABLES' })).toBeUndefined();
  });

  it.each([
    ['otra colación', { charset: 'utf8mb4', collation: 'utf8mb4_0900_ai_ci' }],
    ['utf8mb3', { charset: 'utf8mb3', collation: 'utf8mb3_general_ci' }],
  ])('base con %s -> DATABASE_CHARSET_INVALID', async (_case, database) => {
    expect(await run({ database })).toBe(DATABASE_INIT_CODES.CHARSET_INVALID);
  });

  it('_prisma_migrations, interna de Prisma, solo tiene que ser utf8mb4 (P-1)', async () => {
    const tables = [
      { name: '_prisma_migrations', collation: 'utf8mb4_unicode_ci' },
      { name: 'user', collation: COLLATION },
    ];
    const columns = [{ tableName: '_prisma_migrations', columnName: 'logs', charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' }];
    expect(await run({ tables, columns })).toBeUndefined();
    expect(await run({ tables: [{ name: '_prisma_migrations', collation: 'utf8mb3_general_ci' }] })).toBe(DATABASE_INIT_CODES.CHARSET_INVALID);
    expect(await run({ tables, columns: [{ ...columns[0]!, charset: 'utf8mb3', collation: 'utf8mb3_general_ci' }] })).toBe(DATABASE_INIT_CODES.CHARSET_INVALID);
  });

  it('una tabla o columna de la app con otra colación -> DATABASE_CHARSET_INVALID con el objeto', async () => {
    const err = await verifyDatabase({
      probe: () => Promise.resolve(),
      query: await fakeQuery({ columns: [{ tableName: 'product', columnName: 'name', charset: 'utf8mb4', collation: 'utf8mb4_0900_ai_ci' }] }),
    }).catch((error: unknown) => error);
    expect(err).toMatchObject({ code: DATABASE_INIT_CODES.CHARSET_INVALID, object: 'product.name' });
    expect(await run({ tables: [{ name: 'user', collation: 'utf8mb4_bin' }] })).toBe(DATABASE_INIT_CODES.CHARSET_INVALID);
  });

  it('sin tabla de migraciones -> MIGRATIONS_PENDING', async () => {
    expect(await run({ migrations: 'missing' })).toBe(DATABASE_INIT_CODES.MIGRATIONS_PENDING);
  });

  it('una migración revertida no cuenta como aplicada', async () => {
    const [migration] = await projectMigrationChecksums();
    expect(await run({ migrations: [{ name: migration!.name, checksum: migration!.checksum, finished: null, rolledBack: new Date() }] })).toBe(
      DATABASE_INIT_CODES.MIGRATIONS_PENDING,
    );
  });

  it('error inesperado de la base -> DATABASE_ERROR (sin detalles)', async () => {
    const err = await verifyDatabase({ probe: () => Promise.resolve(), query: await fakeQuery({ fail: new Error('SELECT secreto') }) }).catch((error: unknown) => error);
    expect(err).toMatchObject({ code: DATABASE_INIT_CODES.DATABASE_ERROR, message: 'La base de datos no está lista' });
  });

  it('carpeta de migraciones ilegible -> MIGRATIONS_UNREADABLE', async () => {
    const code = await codeOf(verifyDatabase({ probe: () => Promise.resolve(), query: await fakeQuery({}), migrationsDir: '/no/existe' }));
    expect(code).toBe(DATABASE_INIT_CODES.MIGRATIONS_UNREADABLE);
  });

  it('migración aplicada desconocida -> DATABASE_NEWER_THAN_CODE salvo con allowNewerSchema (REQ-F-016, D-1)', async () => {
    const applied = (await projectMigrationChecksums()).map(({ name, checksum }) => ({ name, checksum, finished: new Date(), rolledBack: null }));
    const migrations = [...applied, { name: '29990101000000_futura', checksum: 'x', finished: new Date(), rolledBack: null }];
    expect(await run({ migrations })).toBe(DATABASE_INIT_CODES.DATABASE_NEWER_THAN_CODE);
    const warnings: string[] = [];
    await verifyDatabase({
      probe: () => Promise.resolve(),
      query: await fakeQuery({ migrations }),
      allowNewerSchema: true,
      logger: { info: () => {}, warn: (msg) => warnings.push(msg) },
    });
    expect(warnings).toEqual(['database_newer_than_code_allowed']);
  });

  it('allowNewerSchema sin migraciones desconocidas no registra nada', async () => {
    const warnings: string[] = [];
    await verifyDatabase({ probe: () => Promise.resolve(), query: await fakeQuery({}), allowNewerSchema: true, logger: { info: () => {}, warn: (msg) => warnings.push(msg) } });
    expect(warnings).toEqual([]);
  });
});
