import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { connect, createServer, type Server } from 'node:net';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';

import { expect } from 'vitest';

import { PROJECT_DIR } from '../../src/config/env.ts';
import { makeTempDir } from './database.ts';
import { startServer, type StartOptions } from './process.ts';

/**
 * Arranque real del servidor según su configuración (REQ-F-015 y REQ-F-038) en
 * server-startup-config.test.ts y server-startup-host*.test.ts. REQ-F-041: preparación compartida
 * por los archivos en que se partió server-startup-config.test.ts, sin cambios.
 */

export const cleanups: (() => Promise<unknown>)[] = [];
/** Limpieza de la prueba (procesos, bases, proxies): cada archivo la registra con afterEach. */
export async function runCleanups(): Promise<void> {
  while (cleanups.length > 0) await cleanups.pop()?.();
}

export const NODE_ENV_VALUES = 'development, production, test';

/** IPv4 de una interfaz no interna (existe en el CI y en el contenedor de pruebas). */
export const externalIPv4 = Object.values(networkInterfaces())
  .flat()
  .find((entry) => entry?.family === 'IPv4' && !entry.internal)?.address;
/** Loopback IPv6 (Docker lo desactiva en redes sin IPv6). */
export const hasIPv6Loopback = Object.values(networkInterfaces())
  .flat()
  .some((entry) => entry?.family === 'IPv6' && entry.address === '::1');

export type LogLine = { level?: string; msg?: string } & Record<string, unknown>;

export function logLines(stdout: string): LogLine[] {
  return stdout
    .split('\n')
    .filter((line) => line.startsWith('{'))
    .map((line) => JSON.parse(line) as LogLine);
}

/** true si se puede abrir una conexión TCP a host:port. */
export function connects(host: string, port: number): Promise<boolean> {
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
export async function sentinel(): Promise<{ url: string; connections: () => number }> {
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

export async function boot(env: Record<string, string | undefined>, options: StartOptions = {}) {
  const temp = await makeTempDir();
  cleanups.push(() => temp.cleanup());
  const server = await startServer({ DATA_DIR: temp.dir, ...env }, 20_000, options);
  cleanups.push(() => server.stop());
  return server;
}

export async function expectConfigFailure(env: Record<string, string | undefined>, expected: string[], options: StartOptions = {}) {
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

export async function expectStarted(env: Record<string, string | undefined>, options: StartOptions = {}) {
  const server = await boot(env, options);
  const { stdout, stderr } = server.output();
  expect(server.started, stdout + stderr).toBe(true);
  const started = logLines(stdout).find((line) => line.msg === 'server_started');
  expect(started).toBeDefined();
  return { server, started: started!, lines: () => logLines(server.output().stdout) };
}

/** Argumentos de un script de package.json, con el .env sustituido por uno temporal. */
export async function scriptArgs(name: 'start' | 'dev', envFile: string): Promise<string[]> {
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
