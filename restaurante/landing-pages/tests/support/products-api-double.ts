import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo, Socket } from 'node:net';

import { onTestFinished } from 'vitest';

import { isPublicBusinessId, productsResponseSchemas } from '@restaurante/contracts';
import { toPublished, type ProductStore } from '@restaurante/core/catalog';
import type { BusinessId } from '@restaurante/core/shared';

/**
 * Doble HTTP de la API propia (REQ-F-038, RF-10): escucha en 127.0.0.1 sobre el store que se le
 * pase, con la misma conversión (`toPublished`) y el mismo contrato que `api/`. Modos de fallo y
 * contador de peticiones por negocio; se cierra al terminar la prueba (llamarlo dentro de `it`).
 */

/** Comportamiento del doble: datos del store, caído (cierra la conexión), lento, cuerpo inválido o 503. */
export type ApiDoubleMode = 'ok' | 'down' | 'slow' | 'invalid' | 'http503';

export interface ProductsApiDouble {
  readonly url: string;
  /** Peticiones recibidas por negocio. */
  readonly hits: Record<BusinessId, number>;
  setMode(mode: ApiDoubleMode): void;
  /** Retraso del modo `slow`, en milisegundos. */
  slowMs: number;
}

export async function startProductsApiDouble({ store }: { store: Pick<ProductStore, 'listBusiness'> }): Promise<ProductsApiDouble> {
  let mode: ApiDoubleMode = 'ok';
  const hits: Record<BusinessId, number> = { molotes: 0, birria: 0 };
  const sockets = new Set<Socket>();
  const double = {
    url: '',
    hits,
    slowMs: 3000,
    setMode(next: ApiDoubleMode) {
      mode = next;
    },
  };

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const match = /^\/api\/v1\/public\/([^/]+)\/productos$/.exec(req.url ?? '');
    const business = match?.[1];
    if (!isPublicBusinessId(business)) {
      res.writeHead(404, { 'content-type': 'application/json' }).end('{"error":{"code":"NOT_FOUND","message":"x"}}');
      return;
    }
    hits[business] += 1;
    if (mode === 'down') {
      req.socket.destroy();
      return;
    }
    if (mode === 'http503') {
      res.writeHead(503, { 'content-type': 'application/json' }).end('{"error":{"code":"DATABASE_UNAVAILABLE","message":"x"}}');
      return;
    }
    if (mode === 'invalid') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' }).end(JSON.stringify({ data: { menu: [{ nombre: 'sin contrato' }] } }));
      return;
    }
    if (mode === 'slow') await new Promise((resolve) => setTimeout(resolve, double.slowMs));
    const body = productsResponseSchemas[business].parse({ data: toPublished(business, await store.listBusiness(business)) });
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' }).end(JSON.stringify(body));
  }

  const server = createServer((req, res) => {
    handle(req, res).catch(() => {
      if (!res.headersSent) res.writeHead(500).end();
    });
  });
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  server.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  onTestFinished(
    () =>
      new Promise<void>((resolve) => {
        for (const socket of sockets) socket.destroy();
        server.close(() => resolve());
      }),
  );
  // Escucha en TCP (127.0.0.1): address() devuelve un AddressInfo.
  const { port } = server.address() as AddressInfo;
  double.url = `http://127.0.0.1:${port}`;
  return double;
}
