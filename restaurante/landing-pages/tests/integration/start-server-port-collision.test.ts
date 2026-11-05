import { createServer, type Server } from 'node:net';

import { afterEach, describe, expect, it, onTestFinished } from 'vitest';

import { ADMIN_ENV } from '../support/admin.ts';
import { makeTempDir } from '../support/database.ts';
import { freePorts, startServer } from '../support/process.ts';
import { API_ENTRY } from '../support/users-api-process.ts';

/**
 * startServer ante un puerto que otro proceso tomó después de elegirlo (ejecución 42067335247 del CI):
 * la prueba ocupa el puerto y obliga a elegirlo, así la colisión ocurre siempre y no por azar.
 */

const API = { args: [API_ENTRY] };
const API_ENV = { INTERNAL_NOTIFY_TOKEN: undefined };

const stops: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  while (stops.length > 0) await stops.pop()?.();
});

async function occupiedPort(): Promise<number> {
  const server: Server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  onTestFinished(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const address = server.address();
  if (typeof address !== 'object' || !address) throw new Error('Sin puerto');
  return address.port;
}

/** Elige puertos libres, salvo en los intentos indicados: ahí `replace` ocupa uno de ellos. */
function picker(replace: (ports: number[]) => number[], collidingAttempts: number) {
  const picked: number[][] = [];
  const pickPorts = async (count: number) => {
    const free = await freePorts(count);
    const ports = picked.length < collidingAttempts ? replace(free) : free;
    picked.push(ports);
    return ports;
  };
  return { picked, pickPorts };
}

async function start(...args: Parameters<typeof startServer>) {
  const server = await startServer(...args);
  stops.push(() => server.stop());
  return server;
}

describe('startServer con un puerto ocupado', () => {
  it('reintenta con puertos nuevos si PORT lo eligió el soporte', async () => {
    const taken = await occupiedPort();
    const { picked, pickPorts } = picker(([, ...rest]) => [taken, ...rest], 1);
    const server = await start(API_ENV, 30_000, { ...API, pickPorts });
    expect(server.started, server.output().stderr).toBe(true);
    expect(picked).toHaveLength(2);
    expect(server.port).not.toBe(taken);
    expect(server.output().stdout).toContain(`"port":${String(server.port)}`);
  });

  it('reintenta con puertos nuevos si el ocupado es INTERNAL_PORT, sin cambiar el PORT fijado por la prueba', async () => {
    const temp = await makeTempDir();
    stops.push(temp.cleanup);
    const taken = await occupiedPort();
    const [fixed] = (await freePorts(1)) as [number];
    const { picked, pickPorts } = picker(([port, , ...rest]) => [port as number, taken, ...rest], 1);
    const server = await start({ DATA_DIR: temp.dir, ...ADMIN_ENV, PORT: String(fixed) }, 30_000, { pickPorts });
    expect(server.started, server.output().stderr).toBe(true);
    expect(picked).toHaveLength(2);
    expect(server.internalPort).not.toBe(taken);
    expect(server.output().stdout).toContain(`"port":${String(fixed)}`);
  });

  it('reintenta con puertos nuevos si el ocupado es WEBHOOK_PORT (`server:"webhook"`)', async () => {
    const taken = await occupiedPort();
    const { picked, pickPorts } = picker(([port, internal]) => [port as number, internal as number, taken], 1);
    const server = await start(API_ENV, 30_000, { ...API, pickPorts });
    expect(server.started, server.output().stderr).toBe(true);
    expect(picked).toHaveLength(2);
    expect(server.output().stdout).not.toContain(`"webhookPort":${String(taken)}`);
  });

  it('no reintenta si el WEBHOOK_PORT ocupado lo fijó la prueba', async () => {
    const taken = await occupiedPort();
    const { picked, pickPorts } = picker((ports) => ports, 0);
    const server = await start({ ...API_ENV, WEBHOOK_PORT: String(taken) }, 30_000, { ...API, pickPorts });
    expect(server.started).toBe(false);
    expect(picked).toHaveLength(1);
    expect(server.output().stdout).toContain('"server":"webhook"');
  });

  it('no reintenta si el PORT ocupado lo fijó la prueba: otro proceso puede depender de él', async () => {
    const taken = await occupiedPort();
    const { picked, pickPorts } = picker((ports) => ports, 0);
    const server = await start({ ...API_ENV, PORT: String(taken) }, 30_000, { ...API, pickPorts });
    expect(server.started).toBe(false);
    expect(picked).toHaveLength(1);
    expect(server.output().stdout).toContain('EADDRINUSE');
  });

  it('los reintentos son acotados: si todo sigue ocupado, devuelve el fallo del último intento', async () => {
    const taken = await occupiedPort();
    const { picked, pickPorts } = picker(([, ...rest]) => [taken, ...rest], Number.POSITIVE_INFINITY);
    const server = await start(API_ENV, 30_000, { ...API, pickPorts });
    expect(server.started).toBe(false);
    expect(picked).toHaveLength(3);
    expect(server.output().stderr).toContain('EADDRINUSE');
  });

  it('otro fallo de arranque no se reintenta', async () => {
    const { picked, pickPorts } = picker((ports) => ports, 0);
    const server = await start({ ...API_ENV, HOST: '203.0.113.1' }, 30_000, { ...API, pickPorts });
    expect(server.started).toBe(false);
    expect(picked).toHaveLength(1);
  });
});
