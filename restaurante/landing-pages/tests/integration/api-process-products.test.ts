import { afterEach, describe, expect, it } from 'vitest';

import { apiErrorSchema, productsResponseSchemas } from '@restaurante/contracts';
import { createProductRepository, toPublished } from '@restaurante/core/catalog';
import { createPrismaProductStore } from '@restaurante/db/prisma-product-store';

import { cleanups, logLines, runCleanups, startApi } from '../support/api-process.ts';
import { appDatabaseUrl, makeDatabase } from '../support/database.ts';
import { ANA, seedSources, VALID_INPUTS } from '../support/products.ts';
import { startTcpProxy } from '../support/tcp-proxy.ts';
import { databaseUrl, testDatabaseConfigs } from '../support/test-database-config.ts';

/**
 * El proceso real de la API (`node ../api/src/server.ts`) contra MySQL (REQ-F-038).
 *
 * - CA-2: el cuerpo valida el contrato y coincide con los productos de la base; 503 con la base caída.
 * - CA-3: sin caché en la API.
 *
 * Parte de api-process.test.ts (preparación en tests/support/api-process.ts); el arranque simultáneo
 * con landing-pages (CA-10) está en api-process-startup.test.ts.
 */

afterEach(runCleanups);

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
