import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { connect, createServer, type Server } from 'node:net';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { PROJECT_DIR } from '../../src/config/env.ts';
import { makeTempDir } from '../support/database.ts';
import { startServer, type StartOptions } from '../support/process.ts';

/**
 * REQ-F-015: arranque real de `node src/server.ts` (y de los scripts `start` y `dev` de
 * package.json) con NODE_ENV obligatorio y HOST. Los procesos no heredan el entorno del
 * desarrollador (ni su .env): los scripts usan un .env temporal.
 */

const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()?.();
});

const NODE_ENV_VALUES = 'development, production, test';

/** IPv4 de una interfaz no interna (existe en el CI y en el contenedor de pruebas). */
const externalIPv4 = Object.values(networkInterfaces())
  .flat()
  .find((entry) => entry?.family === 'IPv4' && !entry.internal)?.address;
/** Loopback IPv6 (Docker lo desactiva en redes sin IPv6). */
const hasIPv6Loopback = Object.values(networkInterfaces())
  .flat()
  .some((entry) => entry?.family === 'IPv6' && entry.address === '::1');

type LogLine = { level?: string; msg?: string } & Record<string, unknown>;

function logLines(stdout: string): LogLine[] {
  return stdout
    .split('\n')
    .filter((line) => line.startsWith('{'))
    .map((line) => JSON.parse(line) as LogLine);
}

/** true si se puede abrir una conexión TCP a host:port. */
function connects(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host, port });
    socket.setTimeout(3000, () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
}

/**
 * Servidor TCP centinela: DATABASE_URL apunta a él para comprobar que la app no intenta conectar
 * a MySQL cuando la configuración es inválida (RF-1).
 */
async function sentinel(): Promise<{ url: string; connections: () => number }> {
  let count = 0;
  const server: Server = createServer((socket) => {
    count += 1;
    socket.destroy();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  cleanups.push(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('Sin puerto');
  return { url: `mysql://centinela:centinela@127.0.0.1:${address.port}/restaurante_test_centinela`, connections: () => count };
}

async function boot(env: Record<string, string | undefined>, options: StartOptions = {}) {
  const temp = await makeTempDir();
  cleanups.push(() => temp.cleanup());
  const server = await startServer({ DATA_DIR: temp.dir, ...env }, 20_000, options);
  cleanups.push(() => server.stop());
  return server;
}

async function expectConfigFailure(env: Record<string, string | undefined>, expected: string[], options: StartOptions = {}) {
  const database = await sentinel();
  const server = await boot({ DATABASE_URL: database.url, ...env }, options);
  expect(server.started).toBe(false);
  expect(await server.exited).toBe(1);
  const { stdout, stderr } = server.output();
  for (const text of expected) expect(stderr).toContain(text);
  expect(stdout).not.toContain('server_started');
  expect(database.connections()).toBe(0);
  expect(await connects('127.0.0.1', server.port)).toBe(false);
  return stdout + stderr;
}

async function expectStarted(env: Record<string, string | undefined>, options: StartOptions = {}) {
  const server = await boot(env, options);
  const { stdout, stderr } = server.output();
  expect(server.started, stdout + stderr).toBe(true);
  const started = logLines(stdout).find((line) => line.msg === 'server_started');
  expect(started).toBeDefined();
  return { server, started: started!, lines: () => logLines(server.output().stdout) };
}

/** Argumentos de un script de package.json, con el .env sustituido por uno temporal. */
async function scriptArgs(name: 'start' | 'dev', envFile: string): Promise<string[]> {
  const scripts = (JSON.parse(readFileSync(join(PROJECT_DIR, 'package.json'), 'utf8')) as { scripts: Record<string, string> }).scripts;
  const script = scripts[name];
  expect(script).toBeDefined();
  // RF-12: el script no fija NODE_ENV por su cuenta (salvo dev, mediante su punto de entrada).
  expect(script).not.toContain('NODE_ENV');
  const [command, ...args] = script!.split(' ');
  expect(command).toBe('node');
  expect(args).toContain('--env-file-if-exists=.env');
  const temp = await makeTempDir();
  cleanups.push(() => temp.cleanup());
  const path = join(temp.dir, '.env');
  await writeFile(path, envFile);
  return args.map((arg) => (arg === '--env-file-if-exists=.env' ? `--env-file-if-exists=${path}` : arg));
}

describe('REQ-F-015: NODE_ENV obligatorio al arrancar', () => {
  it.each([
    ['ausente', undefined],
    ['vacío', ''],
    ['solo espacios', '  '],
  ])('CA-1: NODE_ENV %s -> código 1, mensaje con los valores, sin puerto ni MySQL', async (_case, value) => {
    await expectConfigFailure({ NODE_ENV: value }, ['NODE_ENV', NODE_ENV_VALUES]);
  });

  it('CA-2: sin NODE_ENV y con PORT=abc el mensaje lista los dos problemas', async () => {
    const database = await sentinel();
    const server = await boot({ NODE_ENV: undefined, PORT: 'abc', DATABASE_URL: database.url });
    expect(await server.exited).toBe(1);
    const { stderr } = server.output();
    expect(stderr).toContain('NODE_ENV es obligatorio');
    expect(stderr).toContain('PORT debe ser');
    expect(stderr).not.toContain('abc');
    expect(database.connections()).toBe(0);
  });

  it('CA-14: npm start con un .env sin NODE_ENV no arranca; con NODE_ENV=production sí', async () => {
    const withoutNodeEnv = await scriptArgs('start', 'PORT=3000\n');
    await expectConfigFailure({ NODE_ENV: undefined }, ['NODE_ENV', NODE_ENV_VALUES], { args: withoutNodeEnv });

    const production = await scriptArgs('start', 'NODE_ENV=production\n');
    const { started } = await expectStarted({ NODE_ENV: undefined }, { args: production });
    expect(started).toMatchObject({ nodeEnv: 'production', host: '127.0.0.1' });
  }, 60_000);

  it('CA-4: npm run dev arranca con development aunque el .env no lo defina o diga production', async () => {
    for (const envFile of ['PORT=3000\n', 'NODE_ENV=production\n']) {
      const args = await scriptArgs('dev', envFile);
      expect(args).toContain('--watch');
      const { server, started } = await expectStarted({ NODE_ENV: undefined }, { args });
      expect(started).toMatchObject({ nodeEnv: 'development' });
      await server.stop();
    }
  }, 60_000);
});

describe('REQ-F-015: HOST', () => {
  it.each([
    ['development', undefined],
    ['production', 'true'],
    ['test', 'false'],
  ])('CA-6: sin HOST, con NODE_ENV=%s y TRUST_PROXY=%s escucha solo en 127.0.0.1', async (nodeEnv, trustProxy) => {
    const { server, started } = await expectStarted({ NODE_ENV: nodeEnv, TRUST_PROXY: trustProxy });
    expect(started).toMatchObject({ host: '127.0.0.1', port: server.port, nodeEnv });
    const res = await fetch(`${server.url}/molotes`);
    expect(res.status).toBe(200);
  }, 60_000);

  it.runIf(externalIPv4 !== undefined)('CA-6: sin HOST no acepta conexiones por una interfaz que no es loopback', async () => {
    const { server } = await expectStarted({});
    expect(await connects('127.0.0.1', server.port)).toBe(true);
    expect(await connects(externalIPv4!, server.port)).toBe(false);
  });

  it('CA-7 y CA-13: HOST=0.0.0.0 con TRUST_PROXY=true escucha en todas las interfaces sin avisos adicionales', async () => {
    const baseline = await expectStarted({});
    const warnings = (lines: LogLine[]) => lines.filter((line) => line.level === 'warn').map((line) => line.msg);
    const expectedWarnings = warnings(baseline.lines());
    await baseline.server.stop();

    const { server, started, lines } = await expectStarted({ HOST: '0.0.0.0', TRUST_PROXY: 'true' });
    expect(started).toMatchObject({ host: '0.0.0.0', trustProxy: true });
    expect(await connects('127.0.0.1', server.port)).toBe(true);
    if (externalIPv4 !== undefined) expect(await connects(externalIPv4, server.port)).toBe(true);
    expect(warnings(lines())).toEqual(expectedWarnings);
  }, 60_000);

  it.runIf(hasIPv6Loopback)('CA-12: HOST=::1 escucha solo en el loopback IPv6; HOST=:: en todas', async () => {
    const loopback = await expectStarted({ HOST: '::1' });
    expect(loopback.started).toMatchObject({ host: '::1' });
    expect((await fetch(`http://[::1]:${loopback.server.port}/molotes`)).status).toBe(200);
    expect(await connects('127.0.0.1', loopback.server.port)).toBe(false);
    await loopback.server.stop();

    const all = await expectStarted({ HOST: '::' });
    expect(all.started).toMatchObject({ host: '::' });
    expect(await connects('::1', all.server.port)).toBe(true);
    expect(await connects('127.0.0.1', all.server.port)).toBe(true);
  }, 60_000);

  it.each(['localhost', '999.1.1.1', 'abc def', '127.0.0.1:3000'])('CA-8: HOST=%s -> código 1 sin repetir el valor ni abrir puertos', async (host) => {
    const output = await expectConfigFailure({ HOST: host }, ['HOST', 'IP literal IPv4 o IPv6']);
    expect(output).not.toContain(host);
  });

  it('IP que no es de la máquina: termina con 1, nombra HOST y no se queda colgado', async () => {
    // 192.0.2.1 (TEST-NET-1, RFC 5737) nunca se asigna a una interfaz.
    const server = await boot({ HOST: '192.0.2.1' });
    expect(server.started).toBe(false);
    expect(await server.exited).toBe(1);
    const { stdout, stderr } = server.output();
    expect(stderr).toContain('HOST');
    expect(stderr).not.toContain('192.0.2.1');
    expect(stdout).not.toContain('192.0.2.1');
    expect(logLines(stdout).find((line) => line.msg === 'server_listen_failed')).toMatchObject({ level: 'error', code: 'EADDRNOTAVAIL' });
  });
});
