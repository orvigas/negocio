import { createServer, connect, type Server, type Socket } from 'node:net';

import { afterEach, describe, expect, it } from 'vitest';

import { ADMIN_PASSWORD, ADMIN_USER, loginAs, setupAdmin } from '../support/admin.ts';
import { testDatabaseConfigs } from '../support/test-database-config.ts';

/**
 * Cortes de red a mitad del handshake de MySQL con el servidor en marcha (REQ-F-014, RF-9 y la
 * desviación aprobada: mariadb@3.4.5 dejaba una promesa rechazada sin manejar si la red fallaba
 * mientras una conexión nueva se iniciaba). Un proxy TCP deja pasar solo los primeros N bytes en
 * un sentido y corta la conexión, para cubrir el saludo, la autenticación y lo que venga después.
 * El proceso no debe registrar ningún rechazo sin manejar, la app responde 503 (o 200 si una
 * conexión ya abierta sirve la petición) y se recupera al volver la red.
 */

type Mode = { direction: 'down' | 'up'; bytes: number } | null;

async function startCuttingProxy(target: { host: string; port: number }) {
  const sockets = new Set<Socket>();
  let mode: Mode = null;
  const server: Server = createServer((client) => {
    const upstream = connect(target.port, target.host);
    const current = mode;
    let seen = 0;
    for (const socket of [client, upstream]) {
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
      socket.on('error', () => {
        client.destroy();
        upstream.destroy();
      });
    }
    const relay = (from: Socket, to: Socket, cut: boolean) => {
      from.on('data', (chunk: Buffer) => {
        if (!cut || current === null) {
          to.write(chunk);
          return;
        }
        const allowed = Math.max(0, current.bytes - seen);
        seen += chunk.length;
        if (allowed > 0) to.write(chunk.subarray(0, allowed));
        if (seen >= current.bytes) {
          client.destroy();
          upstream.destroy();
        }
      });
    };
    relay(upstream, client, current?.direction === 'down');
    relay(client, upstream, current?.direction === 'up');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return {
    host: '127.0.0.1',
    port,
    /** Corta las conexiones abiertas y aplica el modo a las nuevas. */
    setMode(next: Mode) {
      mode = next;
      for (const socket of sockets) socket.destroy();
    },
    close: () =>
      new Promise<void>((resolve) => {
        for (const socket of sockets) socket.destroy();
        server.close(() => resolve());
      }),
  };
}

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()?.();
});

describe('cortes a mitad del handshake de MySQL (RF-9, desviación del cliente)', () => {
  it('ningún rechazo sin manejar, 503 mientras dura y recuperación sola', async () => {
    const rejections: unknown[] = [];
    const onRejection = (reason: unknown) => rejections.push(reason);
    process.on('unhandledRejection', onRejection);
    cleanups.push(async () => {
      process.off('unhandledRejection', onRejection);
    });

    const { app: target } = testDatabaseConfigs();
    const proxy = await startCuttingProxy(target);
    cleanups.push(() => proxy.close());
    const context = await setupAdmin({ routeDatabase: (config) => ({ ...config, host: proxy.host, port: proxy.port }) });
    const session = await loginAs(context.browser(), ADMIN_USER, ADMIN_PASSWORD);
    expect((await session.get('/admin/api/molotes/productos')).status).toBe(200);

    const modes: Mode[] = [
      ...[4, 40, 78, 90, 110, 140, 200, 400, 1000, 4000].map((bytes) => ({ direction: 'down' as const, bytes })),
      ...[4, 40, 100, 200, 400, 1000].map((bytes) => ({ direction: 'up' as const, bytes })),
    ];
    const seen = new Set<number>();
    for (const mode of modes) {
      proxy.setMode(mode);
      const responses = await Promise.all([
        session.get('/admin/api/molotes/productos'),
        session.get('/admin/usuarios'),
        session.get('/admin/api/birria/productos'),
      ]);
      for (const res of responses) {
        seen.add(res.status);
        expect([200, 503]).toContain(res.status);
      }
      // Las landings no dependen de la base (caché).
      expect((await context.request().get('/molotes')).status).toBe(200);
    }
    console.info(`[QA] códigos vistos durante los cortes: ${[...seen].join(', ')}`);
    expect(seen.has(503)).toBe(true);

    proxy.setMode(null);
    expect((await session.get('/admin/api/molotes/productos')).status).toBe(200);
    expect((await session.get('/admin/usuarios')).status).toBe(200);
    // Margen para que un rechazo tardío llegue al evento.
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(rejections).toEqual([]);
    const logged = context.logger.lines.filter((line) => line.msg === 'database_unavailable');
    for (const line of logged) expect(JSON.stringify(line)).not.toMatch(/mysql:\/\/|test-dev|restaurante_test_app|SELECT/i);
  }, 180_000);
});
