import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

import { PROJECT_DIR } from '../../src/config/env.ts';
import { VALID_ENV } from '../helpers.ts';
import { appDatabaseUrl, makeDatabase } from './database.ts';

/**
 * Procesos de Node reales para las pruebas de arranque y del comando de consola (REQ-F-007).
 * Nunca heredan el entorno del desarrollador (ni su .env ni su DATA_DIR).
 */

export interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

/** Entorno mínimo: PATH y HOME del sistema, más las variables indicadas. */
export const baseEnv = (extra: Record<string, string>): Record<string, string> => ({
  PATH: process.env.PATH ?? '',
  HOME: process.env.HOME ?? '',
  ...extra,
});

/** Ejecuta `node <args>` en restaurante/ con `input` por stdin y espera a que termine. */
export function runNode(args: string[], { env, input = '', timeoutMs = 30_000 }: { env: Record<string, string>; input?: string; timeoutMs?: number }): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: PROJECT_DIR, env: baseEnv(env), stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => (stdout += chunk));
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    child.stdin.end(input);
  });
}

/** Puerto TCP libre en 127.0.0.1. */
export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => (typeof address === 'object' && address ? resolve(address.port) : reject(new Error('Sin puerto'))));
    });
  });
}

/**
 * Arranca `node src/server.ts` y espera a `server_started` (o a que termine). Sin DATABASE_URL en
 * `env`, usa una base de pruebas migrada y vacía del trabajador (REQ-F-014), que se libera cuando
 * el proceso termina.
 */
export async function startServer(env: Record<string, string>, timeoutMs = 30_000) {
  const port = await freePort();
  const database = env.DATABASE_URL === undefined ? await makeDatabase() : null;
  const child = spawn(process.execPath, ['src/server.ts'], {
    cwd: PROJECT_DIR,
    env: baseEnv({ ...VALID_ENV, PORT: String(port), ...(database ? { DATABASE_URL: appDatabaseUrl(database.name) } : {}), ...env }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8').on('data', (chunk: string) => (stdout += chunk));
  child.stderr.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk));
  const exited = new Promise<number | null>((resolve) => child.on('close', resolve));
  void exited.then(() => database?.cleanup());
  const started = await new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    const check = () => {
      if (stdout.includes('"msg":"server_started"')) {
        clearTimeout(timer);
        resolve(true);
      }
    };
    child.stdout.on('data', check);
    void exited.then(() => {
      clearTimeout(timer);
      resolve(stdout.includes('"msg":"server_started"'));
    });
  });
  return {
    started,
    url: `http://127.0.0.1:${port}`,
    output: () => ({ stdout, stderr }),
    exited,
    async stop() {
      if (child.exitCode === null) child.kill('SIGTERM');
      return exited;
    },
  };
}
