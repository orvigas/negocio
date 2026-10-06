import { chmod, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

import { DATABASE_INIT_CODES, DatabaseInitError, prepareDatabase } from '../../src/db/migrate.ts';
import { databaseFile } from '../../src/db/paths.ts';
import { copyMigrations, makeTempDir, projectMigrations, runningAsRoot, writeMigration } from '../support/database.ts';

/** Aplicador de migraciones (REQ-F-007, DT-3, R-2 y CA-4). */

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()?.();
});

async function tempDir() {
  const temp = await makeTempDir();
  cleanups.push(async () => {
    await chmod(temp.dir, 0o700).catch(() => {});
    await temp.cleanup();
  });
  return temp.dir;
}

/** Ejecuta `fn` con el .db abierto por better-sqlite3 y lo cierra. */
function withDb<T>(file: string, fn: (db: Database.Database) => T): T {
  const db = new Database(file);
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

async function expectInitError(promise: Promise<unknown>, code: string | RegExp, migration?: string) {
  const err = await promise.then(
    () => null,
    (error: unknown) => error,
  );
  expect(err).toBeInstanceOf(DatabaseInitError);
  const initError = err as DatabaseInitError;
  if (typeof code === 'string') expect(initError.code).toBe(code);
  else expect(initError.code).toMatch(code);
  if (migration) expect(initError.migration).toBe(migration);
  // Mensaje fijo: sin SQL ni rutas.
  expect(initError.message).toBe('No se pudo preparar la base de datos');
}

describe('prepareDatabase con las migraciones del proyecto', () => {
  it('crea el .db, aplica las migraciones y las registra como Prisma', async () => {
    const dir = await tempDir();
    const file = databaseFile(dir);
    const applied = await prepareDatabase({ file });
    expect(applied).toEqual(await projectMigrations());

    withDb(file, (db) => {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").pluck().all();
      expect(tables).toEqual(
        expect.arrayContaining(['_prisma_migrations', 'user', 'user_business', 'user_audit', 'product', 'product_variant', 'product_chip', 'product_change', 'product_import']),
      );
      expect(tables).not.toContain('_write_probe');
      const rows = db.prepare('SELECT * FROM _prisma_migrations').all() as Record<string, unknown>[];
      expect(rows).toHaveLength(applied.length);
      for (const row of rows) {
        expect(row.checksum).toMatch(/^[0-9a-f]{64}$/);
        expect(row.finished_at).not.toBeNull();
        expect(row.applied_steps_count).toBe(1);
      }
      expect(db.pragma('journal_mode', { simple: true })).toBe('wal');
    });
  });

  it('es idempotente: un segundo arranque no aplica nada', async () => {
    const file = databaseFile(await tempDir());
    await prepareDatabase({ file });
    expect(await prepareDatabase({ file })).toEqual([]);
  });
});

describe('prepareDatabase: migraciones inconsistentes', () => {
  it('rechaza una migración aplicada cuyo migration.sql cambió', async () => {
    const dir = await tempDir();
    const migrations = join(dir, 'migrations');
    await writeMigration(migrations, '20260101000000_uno', 'CREATE TABLE "a" ("id" INTEGER PRIMARY KEY);\n');
    const file = databaseFile(dir);
    await prepareDatabase({ file, migrationsDir: migrations });
    await writeMigration(migrations, '20260101000000_uno', 'CREATE TABLE "a" ("id" INTEGER PRIMARY KEY, "x" TEXT);\n');
    await expectInitError(prepareDatabase({ file, migrationsDir: migrations }), DATABASE_INIT_CODES.MIGRATION_MODIFIED, '20260101000000_uno');
  });

  it('rechaza una base más nueva que el código (migración aplicada que no existe)', async () => {
    const dir = await tempDir();
    const newer = join(dir, 'newer');
    await copyMigrations(newer);
    await writeMigration(newer, '29990101000000_futura', 'CREATE TABLE "futura" ("id" INTEGER PRIMARY KEY);\n');
    const file = databaseFile(dir);
    await prepareDatabase({ file, migrationsDir: newer });
    await expectInitError(prepareDatabase({ file }), DATABASE_INIT_CODES.DATABASE_NEWER_THAN_CODE, '29990101000000_futura');
  });

  it('rechaza una migración registrada sin terminar', async () => {
    const file = databaseFile(await tempDir());
    await prepareDatabase({ file });
    withDb(file, (db) => db.exec("UPDATE _prisma_migrations SET finished_at = NULL"));
    await expectInitError(prepareDatabase({ file }), DATABASE_INIT_CODES.MIGRATION_INCOMPLETE);
  });

  it('una migración que falla se revierte entera y no queda registrada', async () => {
    const dir = await tempDir();
    const migrations = join(dir, 'migrations');
    await copyMigrations(migrations);
    await writeMigration(
      migrations,
      '29990101000000_rota',
      'CREATE TABLE "parcial" ("id" INTEGER PRIMARY KEY);\nINSERT INTO "no_existe" VALUES (1);\n',
    );
    const file = databaseFile(dir);
    await expectInitError(prepareDatabase({ file, migrationsDir: migrations }), DATABASE_INIT_CODES.MIGRATION_FAILED, '29990101000000_rota');
    withDb(file, (db) => {
      expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'parcial'").get()).toBeUndefined();
      const names = db.prepare('SELECT migration_name FROM _prisma_migrations').pluck().all();
      expect(names).not.toContain('29990101000000_rota');
      // Las migraciones anteriores sí quedaron aplicadas.
      expect(names.length).toBeGreaterThan(0);
    });
  });

  it('rechaza una migración que deja claves foráneas rotas', async () => {
    const dir = await tempDir();
    const migrations = join(dir, 'migrations');
    await writeMigration(
      migrations,
      '20260101000000_huerfano',
      'CREATE TABLE "p" ("id" INTEGER PRIMARY KEY);\nCREATE TABLE "c" ("id" INTEGER PRIMARY KEY, "p_id" INTEGER NOT NULL REFERENCES "p" ("id"));\nINSERT INTO "c" VALUES (1, 99);\n',
    );
    const file = databaseFile(dir);
    await expectInitError(prepareDatabase({ file, migrationsDir: migrations }), DATABASE_INIT_CODES.FOREIGN_KEY_CHECK);
    withDb(file, (db) => expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'c'").get()).toBeUndefined());
  });
});

describe('prepareDatabase: redefinición de tablas (S-7)', () => {
  it('una migración que redefine la tabla padre conserva las filas hijas con ON DELETE CASCADE', async () => {
    const dir = await tempDir();
    const migrations = join(dir, 'migrations');
    await writeMigration(
      migrations,
      '20260101000000_base',
      'CREATE TABLE "padre" ("id" INTEGER NOT NULL PRIMARY KEY, "nombre" TEXT NOT NULL);\nCREATE TABLE "hija" ("id" INTEGER NOT NULL PRIMARY KEY, "padre_id" INTEGER NOT NULL, CONSTRAINT "hija_padre_id_fkey" FOREIGN KEY ("padre_id") REFERENCES "padre" ("id") ON DELETE CASCADE ON UPDATE CASCADE);\n',
    );
    const file = databaseFile(dir);
    await prepareDatabase({ file, migrationsDir: migrations });
    withDb(file, (db) => {
      db.exec('INSERT INTO "padre" VALUES (1, \'a\'); INSERT INTO "hija" VALUES (1, 1), (2, 1);');
    });

    // Script con la forma exacta que genera `prisma migrate dev` para SQLite.
    await writeMigration(
      migrations,
      '20260102000000_redefine',
      [
        '-- RedefineTables',
        'PRAGMA defer_foreign_keys=ON;',
        'PRAGMA foreign_keys=OFF;',
        'CREATE TABLE "new_padre" ("id" INTEGER NOT NULL PRIMARY KEY, "nombre" TEXT NOT NULL DEFAULT \'x\');',
        'INSERT INTO "new_padre" ("id", "nombre") SELECT "id", "nombre" FROM "padre";',
        'DROP TABLE "padre";',
        'ALTER TABLE "new_padre" RENAME TO "padre";',
        'PRAGMA foreign_keys=ON;',
        'PRAGMA defer_foreign_keys=OFF;',
        '',
      ].join('\n'),
    );
    expect(await prepareDatabase({ file, migrationsDir: migrations })).toEqual(['20260102000000_redefine']);
    withDb(file, (db) => {
      expect(db.prepare('SELECT COUNT(*) FROM "hija"').pluck().get()).toBe(2);
      expect(db.pragma('foreign_key_check')).toEqual([]);
    });
  });
});

describe('prepareDatabase: redefinición de la tabla de productos (REQ-F-008, S-2)', () => {
  it('una migración futura que redefine "product" conserva variantes, chips y registro', async () => {
    const dir = await tempDir();
    const migrations = join(dir, 'migrations');
    await copyMigrations(migrations);
    const file = databaseFile(dir);
    await prepareDatabase({ file, migrationsDir: migrations });
    withDb(file, (db) => {
      db.pragma('foreign_keys = ON');
      db.exec(`INSERT INTO "user" (id, username, username_key, display_name, role, password_hash, updated_at) VALUES (1, 'a', 'a', 'Ana', 'admin', 'x', 0);
        INSERT INTO "product" (id, business, category, slug, name, position, updated_at, details_type) VALUES (1, 'birria', 'platillo', 'a', 'A', 1, 0, 'variants'), (2, 'birria', 'platillo', 'b', 'B', 2, 0, 'chips');
        INSERT INTO "product_variant" (product_id, position, label, price_cents, description, available) VALUES (1, 1, 'Chica', 100, 'd', 1), (1, 2, 'Grande', 200, 'd', 1);
        INSERT INTO "product_chip" (product_id, position, text, highlight) VALUES (2, 1, 'x', 0);
        INSERT INTO "product_change" (at, business, product_id, slug, action, actor_id, actor_name, changes) VALUES (0, 'birria', 1, 'a', 'create', 1, 'Ana', '[]');`);
    });

    // Redefinición con la forma que genera `prisma migrate dev` (columna nueva en "product").
    const original = await readFile(join(migrations, (await projectMigrations()).find((name) => name.endsWith('_productos')) ?? '', 'migration.sql'), 'utf8');
    const createProduct = /CREATE TABLE "product" \(([\s\S]*?)\n\);/.exec(original)?.[1] ?? '';
    expect(createProduct).not.toBe('');
    const columns = [...createProduct.matchAll(/^\s+"([a-z_]+)" /gm)].map((match) => `"${match[1]}"`).join(', ');
    await writeMigration(
      migrations,
      '29990101000000_redefine_product',
      [
        'PRAGMA defer_foreign_keys=ON;',
        'PRAGMA foreign_keys=OFF;',
        `CREATE TABLE "new_product" (${createProduct},\n    "extra" TEXT\n);`,
        `INSERT INTO "new_product" (${columns}) SELECT ${columns} FROM "product";`,
        'DROP TABLE "product";',
        'ALTER TABLE "new_product" RENAME TO "product";',
        'CREATE UNIQUE INDEX "product_business_slug_key" ON "product"("business", "slug");',
        'PRAGMA foreign_keys=ON;',
        'PRAGMA defer_foreign_keys=OFF;',
        '',
      ].join('\n'),
    );
    expect(await prepareDatabase({ file, migrationsDir: migrations })).toEqual(['29990101000000_redefine_product']);
    withDb(file, (db) => {
      expect(db.prepare('SELECT COUNT(*) FROM "product_variant"').pluck().get()).toBe(2);
      expect(db.prepare('SELECT COUNT(*) FROM "product_chip"').pluck().get()).toBe(1);
      expect(db.prepare('SELECT COUNT(*) FROM "product_change"').pluck().get()).toBe(1);
      expect(db.pragma('foreign_key_check')).toEqual([]);
    });
  });
});

describe('prepareDatabase: base de datos no disponible (CA-4)', () => {
  it('archivo dañado -> SQLITE_NOTADB', async () => {
    const dir = await tempDir();
    await writeFile(databaseFile(dir), Buffer.alloc(8192, 7));
    await expectInitError(prepareDatabase({ file: databaseFile(dir) }), 'SQLITE_NOTADB');
  });

  it('carpeta inexistente -> DATA_DIR_MISSING', async () => {
    const dir = await tempDir();
    await expectInitError(prepareDatabase({ file: databaseFile(join(dir, 'no-existe')) }), DATABASE_INIT_CODES.DATA_DIR_MISSING);
  });

  it.skipIf(runningAsRoot())('.db de solo lectura sin migraciones pendientes -> SQLITE_READONLY', async () => {
    const dir = await tempDir();
    const file = databaseFile(dir);
    await prepareDatabase({ file });
    await chmod(file, 0o444);
    await expectInitError(prepareDatabase({ file }), /^SQLITE_READONLY/);
  });

  it.skipIf(runningAsRoot())('carpeta sin permisos de escritura -> error de SQLite', async () => {
    const dir = await tempDir();
    await prepareDatabase({ file: databaseFile(dir) });
    await chmod(dir, 0o500);
    await expectInitError(prepareDatabase({ file: databaseFile(dir) }), /^SQLITE_(READONLY|CANTOPEN)/);
  });

  it.skipIf(runningAsRoot())('carpeta sin permisos y sin .db -> error de SQLite', async () => {
    const dir = await tempDir();
    await chmod(dir, 0o500);
    await expectInitError(prepareDatabase({ file: databaseFile(dir) }), /^SQLITE_(READONLY|CANTOPEN)/);
  });
});
