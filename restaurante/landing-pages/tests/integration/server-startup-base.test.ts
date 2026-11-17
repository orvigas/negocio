import { afterEach, describe, expect, it } from 'vitest';

import { ADMIN_ENV, ADMIN_PASSWORD, ADMIN_USER } from '../support/admin.ts';
import { adminSql, appDatabaseUrl } from '../support/database.ts';
import { scratch, bootApi, logLines, expectControlledFailure, runCleanups } from '../support/server-startup.ts';

/**
 * Arranque real sobre MySQL (REQ-F-007 y REQ-F-014; RF-6, CA-7 y CA-9): si la base no está lista,
 * termina con código 1, un `database_init_failed` con un código estable y sin stack, SQL, URL ni
 * credenciales. Nunca migra (RN-4). Desde REQ-F-045 (CA-6 y CA-9) la instalación nueva la prepara la
 * api (`node ../api/src/server.ts`).
 *
 * REQ-F-041: parte de server-startup.test.ts (preparación en tests/support/server-startup.ts).
 */

afterEach(runCleanups);

describe('arranque con la base de datos no lista (RF-6, CA-7)', () => {
  it('migración incompleta o fallida -> código 1', async () => {
    const name = await scratch(true);
    await adminSql(name, 'UPDATE _prisma_migrations SET finished_at = NULL');
    await expectControlledFailure(appDatabaseUrl(name), { code: 'MIGRATION_INCOMPLETE' }, bootApi);
  });

  it('D-15: si los productos no se pueden leer al arrancar -> código 1 con un mensaje controlado', async () => {
    const name = await scratch(true);
    // Una tabla que falta hace fallar la lectura de Prisma (la verificación no comprueba tablas).
    await adminSql(name, 'DROP TABLE product_chip');
    const server = await bootApi({ DATABASE_URL: appDatabaseUrl(name) });
    expect(server.started).toBe(false);
    expect(await server.exited).toBe(1);
    const { stdout, stderr } = server.output();
    expect(stderr).toContain('No se pudieron preparar los productos en la base de datos.');
    expect(stdout).toContain('"msg":"products_init_failed"');
    expect(stdout + stderr).not.toMatch(/\n\s+at |SELECT |prisma\.|product_chip/);
  });
});

describe('primer arranque (CA-9; REQ-F-045, CA-6)', () => {
  it('base vacía y migrada: la api siembra productos y página, crea el administrador y se entra con la contraseña de siempre', async () => {
    const name = await scratch(true);
    const server = await bootApi({ DATABASE_URL: appDatabaseUrl(name) });
    expect(server.started, server.output().stderr).toBe(true);

    const res = await fetch(`${server.url}/api/v1/admin/sesion`, {
      method: 'POST',
      // IP del visitante, como la escribe el admin nuevo (RF-2 de REQ-F-039).
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7' },
      body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASSWORD }),
    });
    expect(res.status).toBe(201);
    for (const business of ['molotes', 'birria']) {
      expect((await fetch(`${server.url}/api/v1/public/${business}/productos`)).status).toBe(200);
      expect((await fetch(`${server.url}/api/v1/public/${business}/pagina`)).status).toBe(200);
    }

    const lines = logLines(server.output().stdout);
    expect(lines.map((line) => line.msg)).toEqual(expect.arrayContaining(['admin_bootstrap_created', 'products_imported', 'page_seeded', 'server_started']));
    expect(lines.filter((line) => line.msg === 'products_imported')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ business: 'molotes', source: 'seed', count: 10 }),
        expect.objectContaining({ business: 'birria', source: 'seed', count: 6 }),
      ]),
    );
    expect(lines.filter((line) => line.msg === 'page_seeded').map((line) => line.business).sort()).toEqual(['birria', 'molotes']);
    expect(lines.map((line) => line.msg)).not.toContain('database_migrated');
    expect(server.output().stdout).not.toContain(ADMIN_ENV.ADMIN_PASSWORD_HASH);

    expect(await server.stop()).toBe(0);
    expect(await adminSql(name, 'SELECT action, actor_kind AS actorKind FROM user_audit')).toEqual([{ action: 'bootstrap', actorKind: 'system' }]);
    const counts = 'SELECT (SELECT COUNT(*) FROM product) AS products, (SELECT COUNT(*) FROM product_import) AS productImports, (SELECT COUNT(*) FROM page_version) AS pages, (SELECT COUNT(*) FROM page_import) AS pageImports, (SELECT COUNT(*) FROM user) AS users, (SELECT COUNT(*) FROM user_audit) AS audit';
    // COUNT(*) llega como BigInt: se compara como número.
    const readCounts = async () => Object.fromEntries(Object.entries(((await adminSql(name, counts)) as Record<string, unknown>[])[0] ?? {}).map(([key, value]) => [key, Number(value)]));
    const before = await readCounts();
    expect(before).toMatchObject({ productImports: 2, pageImports: 2, users: 1 });

    // Segundo arranque con la misma base: no vuelve a crear el administrador, ni a importar, ni a sembrar.
    const again = await bootApi({ DATABASE_URL: appDatabaseUrl(name) });
    expect(again.started).toBe(true);
    const output = again.output().stdout;
    expect(output).not.toContain('admin_bootstrap_created');
    // La importación de productos ocurre una sola vez (REQ-F-008, CA-3).
    expect(output).not.toContain('products_imported');
    expect(output).not.toContain('page_seeded');
    expect(output).toContain('"msg":"admin_bootstrap_ignored"');
    expect(await again.stop()).toBe(0);
    expect(await readCounts()).toEqual(before);
  }, 60_000);
});
