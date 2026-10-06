import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import type Koa from 'koa';
import request from 'supertest';
import { onTestFinished } from 'vitest';

/**
 * Servidores HTTP de prueba (REQ-F-011). Única forma de hacer peticiones HTTP a la app en tests/.
 *
 * Uso, dentro de una prueba (`it`):
 *
 *   const server = await listenLocal(createApp({ ... }));
 *   await server.request().get('/molotes');       // petición suelta, sin cookies
 *   const browser = server.browser();             // "navegador" con su propio almacén de cookies
 *
 * El servidor escucha solo en 127.0.0.1, con un puerto libre que asigna el sistema, y supertest
 * recibe únicamente su URL. Nunca pases la app a supertest (`request(app.callback())`): supertest
 * abriría su propio servidor en `::` (todas las interfaces) y conectaría a 127.0.0.1. En macOS ese
 * puerto puede estar ocupado en 127.0.0.1 por otro proceso local, que recibiría la petición.
 * `npm run lint` lo impide en tests/.
 *
 * El servidor se cierra solo al terminar la prueba, también si falla (`onTestFinished`). Llamarla
 * fuera de una prueba (nivel de módulo o `beforeAll`) da error a propósito: no quedan servidores
 * abiertos sin dueño.
 *
 * Excepción: las pruebas de arranque (`server-startup.test.ts`, `tests/support/process.ts`) lanzan
 * el proceso de producción, que escucha en todas las interfaces; se prueba tal cual.
 */

/** Cliente con su propio almacén de cookies (un "navegador"). */
export type Browser = ReturnType<typeof request.agent>;

export interface LocalServer {
  /** `http://127.0.0.1:<puerto>`. */
  readonly url: string;
  readonly address: AddressInfo;
  /** Servidor de Node, para comprobar su estado (p. ej. `listening`). */
  readonly server: Server;
  /** Cliente sin cookies para peticiones sueltas. */
  request(): ReturnType<typeof request>;
  /** Cliente nuevo con su propio almacén de cookies, contra este mismo servidor. */
  browser(): Browser;
  /** Cierra el servidor y sus conexiones. Idempotente. */
  close(): Promise<void>;
}

const LOOPBACK = '127.0.0.1';

/** Abre `app` en 127.0.0.1 con un puerto libre y lo cierra al terminar la prueba en curso. */
export async function listenLocal(app: Koa): Promise<LocalServer> {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve();
    };
    server.once('error', onError);
    server.once('listening', onListening);
  });

  let closing: Promise<void> | undefined;
  const close = (): Promise<void> => {
    closing ??= new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
      // Las conexiones keep-alive del agente HTTP de Node no deben retrasar el cierre.
      server.closeAllConnections();
    });
    return closing;
  };
  // Lanza un error si no hay una prueba en curso; antes se cierra el servidor recién abierto.
  try {
    onTestFinished(close);
  } catch (error) {
    await close();
    throw error;
  }

  const address = server.address();
  if (address === null || typeof address === 'string' || address.address !== LOOPBACK || address.family !== 'IPv4') {
    await close();
    throw new Error(`El servidor de prueba no escucha en ${LOOPBACK}: ${JSON.stringify(address)}`);
  }
  const url = `http://${LOOPBACK}:${address.port}`;
  return {
    url,
    address,
    server,
    request: () => request(url),
    browser: () => request.agent(url),
    close,
  };
}
