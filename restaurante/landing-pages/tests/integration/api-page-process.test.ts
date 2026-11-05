import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { appDatabaseUrl, makeDatabase } from '../support/database.ts';
import { startServer } from '../support/process.ts';

/**
 * El proceso real de la API antes del corte de la página (REQ-F-044, RF-4): `server.ts` debe usar la
 * constante de la imagen. Con filas en MySQL, como tras una vuelta atrás, sigue en "no disponible".
 */

const API_ENTRY = join('..', 'api', 'src', 'server.ts');
const PAGE = { hero: { showcase: { title: 't', description: 'd', priceCents: 100 } }, promo: { badge: 'b', title: 't', description: 'd' } };

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()?.();
});

describe('datos de página en el proceso real, antes del corte', () => {
  it('con filas en la base, responde "no disponible" y no las toca', async () => {
    const database = await makeDatabase();
    cleanups.push(database.cleanup);
    await database.prisma.pageVersion.create({ data: { business: 'birria', slot: 'current', revision: 1, data: JSON.stringify(PAGE) } });
    const api = await startServer({ DATABASE_URL: appDatabaseUrl(database.name), INTERNAL_NOTIFY_TOKEN: undefined }, 30_000, { args: [API_ENTRY] });
    cleanups.push(async () => void (await api.stop()));
    expect(api.started).toBe(true);
    const res = await fetch(`${api.url}/api/v1/public/birria/pagina`);
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: { code: 'PAGE_UNAVAILABLE' } });
    await expect(database.prisma.pageVersion.findMany()).resolves.toMatchObject([{ revision: 1 }]);
  });
});
