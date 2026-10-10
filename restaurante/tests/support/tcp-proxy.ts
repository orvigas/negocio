import { createServer, connect, type Server, type Socket } from 'node:net';

/**
 * Proxy TCP local (REQ-F-014, CA-10) para simular que MySQL se cae y vuelve con el servidor en
 * marcha, sin detener el MySQL compartido de las pruebas. Escucha solo en 127.0.0.1.
 */
export async function startTcpProxy(target: { host: string; port: number }) {
  const sockets = new Set<Socket>();
  let server: Server | null = null;
  let port = 0;

  const listen = () =>
    new Promise<void>((resolve, reject) => {
      const next = createServer((client) => {
        const upstream = connect(target.port, target.host);
        for (const socket of [client, upstream]) {
          sockets.add(socket);
          socket.on('close', () => sockets.delete(socket));
          socket.on('error', () => {
            client.destroy();
            upstream.destroy();
          });
        }
        client.pipe(upstream).pipe(client);
      });
      next.once('error', reject);
      next.listen(port, '127.0.0.1', () => {
        const address = next.address();
        if (typeof address === 'object' && address) port = address.port;
        server = next;
        resolve();
      });
    });

  await listen();
  return {
    host: '127.0.0.1',
    get port() {
      return port;
    },
    /** Corta la base: deja de aceptar conexiones y cierra las abiertas. */
    async down() {
      const current = server;
      server = null;
      for (const socket of sockets) socket.destroy();
      if (current) await new Promise<void>((resolve) => current.close(() => resolve()));
    },
    /** La base vuelve (mismo puerto). */
    up: listen,
  };
}
