import { createServer as createHttpServer } from 'node:http';
import { connect, createServer, type AddressInfo } from 'node:net';

import { beforeAll, describe, expect, it, onTestFinished } from 'vitest';

import { createApp } from '../../src/app.ts';
import { makeConfig, makeRepository } from '../helpers.ts';
import { listenLocal, type LocalServer } from '../support/http.ts';
import { makeProductsFor } from '../support/products.ts';

/** Servidores de prueba en 127.0.0.1 (REQ-F-011). */

const FRIDAY_NOON_MX = new Date('2026-10-09T18:00:00Z');
const repository = await makeRepository();
const products = await makeProductsFor(repository);
const makeApp = () => createApp({ config: makeConfig(), repository, products, now: () => FRIDAY_NOON_MX });

/** Resuelve con el código de error al conectar, o 'connected' si alguien acepta la conexión. */
function tryConnect(port: number): Promise<string> {
  return new Promise((resolve) => {
    const socket = connect({ port, host: '127.0.0.1' });
    socket.once('connect', () => {
      socket.destroy();
      resolve('connected');
    });
    socket.once('error', (error: NodeJS.ErrnoException) => resolve(error.code ?? 'error'));
  });
}

describe('listenLocal (REQ-F-011)', () => {
  it('CA-4: el servidor escucha en 127.0.0.1 (IPv4), no en ::, y la URL apunta a esa dirección y ese puerto', async () => {
    const server = await listenLocal(makeApp());
    expect(server.address.address).toBe('127.0.0.1');
    expect(server.address.family).toBe('IPv4');
    expect(server.address.port).toBeGreaterThan(0);
    expect(server.url).toBe(`http://127.0.0.1:${server.address.port}`);
    expect((await server.request().get('/molotes')).status).toBe(200);
  });

  it('CA-5: con un proceso ajeno escuchando en 127.0.0.1, las pruebas no le envían ninguna petición', async () => {
    let foreignRequests = 0;
    const foreign = createHttpServer((_req, res) => {
      foreignRequests += 1;
      res.end('AJENO');
    });
    await new Promise<void>((resolve) => foreign.listen(0, '127.0.0.1', resolve));
    onTestFinished(() => new Promise<void>((resolve) => foreign.close(() => resolve())));
    const foreignPort = (foreign.address() as AddressInfo).port;

    // El sistema nunca puede dar a un servidor de prueba el puerto que el ajeno ocupa en 127.0.0.1.
    const probe = createServer();
    const bindResult = await new Promise<string>((resolve) => {
      probe.once('error', (error: NodeJS.ErrnoException) => resolve(error.code ?? 'error'));
      probe.listen(foreignPort, '127.0.0.1', () => probe.close(() => resolve('listening')));
    });
    expect(bindResult).toBe('EADDRINUSE');

    for (let i = 0; i < 20; i += 1) {
      const server = await listenLocal(makeApp());
      expect(server.address.port).not.toBe(foreignPort);
      const single = await server.request().get('/molotes');
      const viaBrowser = await server.browser().get('/birria');
      for (const res of [single, viaBrowser]) {
        expect(res.status).toBe(200);
        expect(res.text).not.toBe('AJENO');
      }
    }
    expect(foreignRequests).toBe(0);
  });

  describe('cierre del servidor (RF-4)', () => {
    // Se comprueba con `listening` y no conectando al puerto: con las pruebas en paralelo, otro
    // proceso podría reutilizar el puerto liberado entre una prueba y la siguiente.
    let ofPassingTest: LocalServer | undefined;
    let ofFailingTest: LocalServer | undefined;

    it('una prueba abre su servidor', async () => {
      ofPassingTest = await listenLocal(makeApp());
      expect(ofPassingTest.server.listening).toBe(true);
      expect(await tryConnect(ofPassingTest.address.port)).toBe('connected');
    });

    it('al terminar la prueba anterior su servidor está cerrado', () => {
      expect(ofPassingTest?.server.listening).toBe(false);
    });

    it.fails('una prueba que falla a mitad (debe fallar)', async () => {
      ofFailingTest = await listenLocal(makeApp());
      throw new Error('Fallo a propósito con el servidor abierto');
    });

    it('el servidor de la prueba que falló también se cerró', () => {
      expect(ofFailingTest).toBeDefined();
      expect(ofFailingTest?.server.listening).toBe(false);
    });

    it('close() se puede llamar más de una vez, también con conexiones keep-alive abiertas', async () => {
      const server = await listenLocal(makeApp());
      const browser = server.browser();
      expect((await browser.get('/molotes')).status).toBe(200);
      await server.close();
      await server.close();
      expect(server.server.listening).toBe(false);
    });
  });

  describe('fuera de una prueba', () => {
    let outsideError: unknown;
    beforeAll(async () => {
      outsideError = await listenLocal(makeApp()).then(
        () => undefined,
        (error: unknown) => error,
      );
    });

    it('listenLocal en beforeAll falla en lugar de dejar un servidor sin dueño', () => {
      expect(outsideError).toBeInstanceOf(Error);
      expect((outsideError as Error).message).toMatch(/only be called inside a test/);
    });
  });
});
