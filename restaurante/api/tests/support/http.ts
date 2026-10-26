import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import type Koa from 'koa';
import { onTestFinished } from 'vitest';

/**
 * Servidor de prueba de la API (REQ-F-011 y REQ-F-038): escucha solo en 127.0.0.1 con un puerto
 * libre y se cierra al terminar la prueba. Las peticiones se hacen con fetch a su URL.
 */
export async function listenLocal(app: Koa): Promise<{ url: string }> {
  const server: Server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  onTestFinished(() => new Promise<void>((resolve) => server.close(() => resolve())));
  // Escucha en TCP (127.0.0.1): address() devuelve un AddressInfo, nunca una ruta ni null.
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}` };
}
