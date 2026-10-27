import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { apiErrorSchema, productsResponseSchemas } from '@restaurante/contracts';
import { toPublished } from '@restaurante/core/catalog';
import { createPrismaClient } from '@restaurante/db/client';
import { createPrismaProductStore } from '@restaurante/db/prisma-product-store';

import { PROJECT_DIR } from '../../src/config/env.ts';
import { createProductRepository } from '../../src/repositories/product-repository.ts';
import { ADMIN_ENV } from '../support/admin.ts';
import { appDatabaseUrl, makeDatabase, makeScratchDatabase, makeTempDir } from '../support/database.ts';
import { freePort, startServer } from '../support/process.ts';
import { ANA, seedSources, VALID_INPUTS } from '../support/products.ts';
import { startTcpProxy } from '../support/tcp-proxy.ts';
import { databaseUrl, testDatabaseConfigs } from '../support/test-database-config.ts';

/**
 * El proceso real de la API (`node ../api/src/server.ts`) contra MySQL (REQ-F-038). Se arranca como
 * proceso hijo, sin importar código de `api/` (landing-pages nunca importa la API).
 *
 * - CA-2: el cuerpo valida el contrato y coincide con los productos de la base; 503 con la base caída.
 * - CA-3: sin caché en la API.
 * - CA-10 (O-1): la API y landing-pages arrancan a la vez contra una base recién migrada; la
 *   importación se hace una sola vez y la API nunca importa ni escribe.
 */

const API_ENTRY = join('..', 'api', 'src', 'server.ts');
const API_SRC = join(PROJECT_DIR, '..', 'api', 'src');

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()?.();
});

async function startApi(env: Record<string, string>) {
  const port = await freePort();
  const api = await startServer({ ...env, PORT: String(port) }, 30_000, { args: [API_ENTRY] });
  cleanups.push(async () => void (await api.stop()));
  return { ...api, url: `http://127.0.0.1:${port}` };
}

const logLines = (stdout: string) =>
  stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);

describe('API con MySQL real (CA-2 y CA-3)', () => {
  it('devuelve los productos publicados de la base, validados por el contrato, y sin caché', async () => {
    const database = await makeDatabase();
    cleanups.push(database.cleanup);
    // Autor de los cambios del registro (product_change.actorId tiene clave foránea a user).
    await database.prisma.user.create({ data: { id: ANA.id, username: 'ana', usernameKey: 'ana', displayName: 'Ana', role: 'admin', passwordHash: 'x', updatedAt: new Date() } });
    const products = createProductRepository({ store: createPrismaProductStore({ prisma: database.prisma }), imageExists: async () => true });
    await products.init(seedSources());

    const api = await startApi({ DATABASE_URL: appDatabaseUrl(database.name) });
    expect(api.started).toBe(true);
    expect(logLines(api.output().stdout).find((line) => line.msg === 'server_started')).toMatchObject({ service: 'api' });

    const store = createPrismaProductStore({ prisma: database.prisma });
    for (const business of ['molotes', 'birria'] as const) {
      const res = await fetch(`${api.url}/api/v1/public/${business}/productos`);
      expect(res.status).toBe(200);
      const body: unknown = await res.json();
      expect(productsResponseSchemas[business].safeParse(body).success).toBe(true);
      expect(body).toEqual({ data: toPublished(business, await store.listBusiness(business)) });
    }

    // CA-3: un cambio confirmado en la base se ve en la petición siguiente.
    const chips = (await products.list('birria')).find((product) => product.detailsType === 'chips')!;
    await products.update('birria', chips.id, { input: { ...VALID_INPUTS.birriaChips, name: 'Cambio En La Base', available: true }, expectedVersion: chips.version }, ANA);
    const after = (await (await fetch(`${api.url}/api/v1/public/birria/productos`)).json()) as { data: { menu: { name: string }[] } };
    expect(after.data.menu.map((item) => item.name)).toContain('Cambio En La Base');

    // 404 y 405 con el formato de error.
    expect(apiErrorSchema.safeParse(await (await fetch(`${api.url}/api/v1/public/tacos/productos`)).json()).success).toBe(true);
    expect((await fetch(`${api.url}/api/v1/public/birria/productos`, { method: 'POST' })).status).toBe(405);
  });

  it('con la base caída responde 503 sin stack, SQL ni credenciales, y se recupera sola', async () => {
    const database = await makeDatabase();
    cleanups.push(database.cleanup);
    const proxy = await startTcpProxy(testDatabaseConfigs().app);
    cleanups.push(() => proxy.down());
    const api = await startApi({ DATABASE_URL: databaseUrl({ ...database.config, host: proxy.host, port: proxy.port }) });
    expect(api.started).toBe(true);
    expect((await fetch(`${api.url}/api/v1/public/birria/productos`)).status).toBe(200);

    await proxy.down();
    const res = await fetch(`${api.url}/api/v1/public/birria/productos`);
    expect(res.status).toBe(503);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: { code: 'DATABASE_UNAVAILABLE', message: 'Servicio no disponible temporalmente.' } });
    const output = text + api.output().stdout + api.output().stderr;
    expect(output).not.toMatch(/\n\s+at |SELECT |mysql:\/\//);
    expect(output).not.toContain(database.config.password);

    await proxy.up();
    let status = 0;
    for (let attempt = 0; attempt < 40 && status !== 200; attempt += 1) {
      status = (await fetch(`${api.url}/api/v1/public/birria/productos`)).status;
      if (status !== 200) await new Promise((resolve) => setTimeout(resolve, 250));
    }
    expect(status).toBe(200);
  });
});

describe('CA-10 (O-1): arranque simultáneo de api y landing-pages', () => {
  it('los dos arrancan contra una base recién migrada, la importación se hace una vez y la landing usa la API', async () => {
    const database = await makeScratchDatabase({ migrated: true });
    cleanups.push(database.cleanup);
    const dataDir = await makeTempDir();
    cleanups.push(dataDir.cleanup);
    const apiPort = await freePort();
    const DATABASE_URL = appDatabaseUrl(database.name);

    const [api, landing] = await Promise.all([
      startServer({ DATABASE_URL, PORT: String(apiPort) }, 60_000, { args: [API_ENTRY] }),
      startServer({ DATABASE_URL, DATA_DIR: dataDir.dir, ...ADMIN_ENV, API_INTERNAL_URL: `http://127.0.0.1:${apiPort}` }, 60_000),
    ]);
    cleanups.push(async () => void (await api.stop()), async () => void (await landing.stop()));
    expect(api.started, api.output().stderr).toBe(true);
    expect(landing.started, landing.output().stderr).toBe(true);

    // La landing termina mostrando los datos de la API (al primer intento o tras un reintento).
    const loaded = () => logLines(landing.output().stdout).some((line) => line.business === 'birria' && (line.msg === 'landing_products_loaded' || line.msg === 'landing_products_recovered'));
    for (let attempt = 0; attempt < 30 && !loaded(); attempt += 1) {
      expect((await fetch(`${landing.url}/birria`)).status).toBe(200);
      if (!loaded()) await new Promise((resolve) => setTimeout(resolve, 500));
    }
    expect(loaded()).toBe(true);

    const prisma = createPrismaClient(database.config);
    cleanups.push(() => prisma.$disconnect());
    expect(await prisma.productImport.count()).toBe(2);
    const output = api.output().stdout + landing.output().stdout + api.output().stderr + landing.output().stderr;
    expect(output).not.toContain('products_init_failed');
    expect(output).not.toContain('database_init_failed');
    expect(logLines(api.output().stdout).some((line) => line.msg === 'products_imported')).toBe(false);
  });

  it('el código de la API no importa semillas ni tiene rutas de escritura', async () => {
    const files = (await readdir(API_SRC, { recursive: true })).filter((file) => file.endsWith('.ts'));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = await readFile(join(API_SRC, file), 'utf8');
      expect(source, file).not.toMatch(/products\.init|importBusiness|seeds|content\/|createProductRepository|\.transaction\(|\.insert\(|\.replace\(|markImported|addChange/);
    }
  });
});
