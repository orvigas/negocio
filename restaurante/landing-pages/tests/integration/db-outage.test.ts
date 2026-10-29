import { afterEach, describe, expect, it } from 'vitest';

import { ADMIN_PASSWORD, ADMIN_USER, loginAs, setupAdmin } from '../support/admin.ts';
import { testDatabaseConfigs } from '../support/test-database-config.ts';
import { startTcpProxy } from '../support/tcp-proxy.ts';

/**
 * MySQL se cae con el servidor en marcha y vuelve (REQ-F-014, RF-9 y CA-10): landings en 200
 * desde la caché, /admin en 503 HTML, la API en 503 JSON DATABASE_UNAVAILABLE, log
 * `database_unavailable` solo con códigos; al volver, todo responde 200 sin reiniciar la app.
 */

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()?.();
});

describe('corte real de la base de datos (CA-10)', () => {
  it('503 mientras MySQL no responde y recuperación sola al volver', async () => {
    const { app: target } = testDatabaseConfigs();
    const proxy = await startTcpProxy(target);
    cleanups.push(() => proxy.down());
    const context = await setupAdmin({ routeDatabase: (config) => ({ ...config, host: proxy.host, port: proxy.port }) });
    const session = await loginAs(context.browser(), ADMIN_USER, ADMIN_PASSWORD);
    expect((await session.get('/admin/molotes')).status).toBe(200);
    expect((await session.get('/admin/api/molotes/productos')).status).toBe(200);

    await proxy.down();
    const html = await session.get('/admin/molotes');
    expect(html.status).toBe(503);
    expect(html.headers['content-type']).toMatch(/^text\/html/);
    const api = await session.get('/admin/api/molotes/productos');
    expect(api.status).toBe(503);
    expect(api.body).toEqual({ error: { code: 'DATABASE_UNAVAILABLE', message: 'Base de datos no disponible' } });
    for (const path of ['/molotes', '/birria']) expect((await context.request().get(path)).status).toBe(200);
    const logged = context.logger.lines.filter((line) => line.msg === 'database_unavailable');
    expect(logged.length).toBeGreaterThan(0);
    for (const line of logged) expect(JSON.stringify(line)).not.toMatch(/mysql:\/\/|127\.0\.0\.1|pool timeout|SELECT/i);

    await proxy.up();
    expect((await session.get('/admin/molotes')).status).toBe(200);
    expect((await session.get('/admin/api/molotes/productos')).status).toBe(200);
  }, 90_000);
});
