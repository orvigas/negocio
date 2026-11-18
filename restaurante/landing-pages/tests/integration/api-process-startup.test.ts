import { afterEach, describe, expect, it } from 'vitest';

import { createPrismaClient } from '@restaurante/db/client';

import { ADMIN_ENV } from '../support/admin.ts';
import { API_ENTRY, API_ENV, cleanups, logLines, runCleanups } from '../support/api-process.ts';
import { appDatabaseUrl, makeScratchDatabase } from '../support/database.ts';
import { freePort, startServer } from '../support/process.ts';

/**
 * CA-10 (O-1; REQ-F-045): la API (`node ../api/src/server.ts`) y landing-pages arrancan a la vez con
 * una base recién migrada. Solo la api la usa: prepara la instalación (productos, página y primer
 * administrador, una sola vez) y la landing, sin base de datos, la muestra por la API.
 *
 * Parte de api-process.test.ts (preparación en tests/support/api-process.ts); CA-2 y CA-3 están en
 * api-process-products.test.ts.
 */

afterEach(runCleanups);

describe('CA-10 (O-1; REQ-F-045): arranque simultáneo de api y landing-pages', () => {
  it('con una base recién migrada, la api prepara la instalación una vez y la landing, sin base, la muestra por la API', async () => {
    const database = await makeScratchDatabase({ migrated: true });
    cleanups.push(database.cleanup);
    const apiPort = await freePort();
    const DATABASE_URL = appDatabaseUrl(database.name);

    const [api, landing] = await Promise.all([
      startServer({ DATABASE_URL, ...API_ENV, ...ADMIN_ENV, PORT: String(apiPort) }, 60_000, { args: [API_ENTRY] }),
      startServer({ API_INTERNAL_URL: `http://127.0.0.1:${apiPort}` }, 60_000),
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
    expect(await prisma.pageImport.count()).toBe(2);
    expect(await prisma.user.count()).toBe(1);
    const output = api.output().stdout + landing.output().stdout + api.output().stderr + landing.output().stderr;
    expect(output).not.toMatch(/_init_failed|page_seed_failed|admin_bootstrap_failed/);
    // La landing no usa la base ni prepara nada.
    expect(landing.output().stdout).not.toMatch(/database_|products_imported|page_seeded|page_import|admin_bootstrap/);
  });
});
