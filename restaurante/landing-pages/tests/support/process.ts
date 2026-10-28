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

/** Quita las variables con valor undefined (una prueba puede así eliminar una de VALID_ENV). */
const definedOnly = (env: Record<string, string | undefined>): Record<string, string> =>
  Object.fromEntries(Object.entries(env).filter((entry): entry is [string, string] => entry[1] !== undefined));

export interface StartOptions {
  /** Argumentos de `node` (por defecto `src/server.ts`; p. ej. los de un script de package.json). */
  args?: string[];
}

/**
 * Arranca `node src/server.ts` (u otros `args`) y espera a `server_started` (o a que termine). Sin
 * DATABASE_URL en `env`, usa una base de pruebas migrada y vacía del trabajador (REQ-F-014), que se
 * libera cuando el proceso termina. Un valor undefined en `env` quita esa variable (REQ-F-015).
 * El proceso va en su propio grupo y `stop()` detiene el grupo entero (p. ej. `node --watch` y su hijo).
 */
export async function startServer(env: Record<string, string | undefined>, timeoutMs = 30_000, { args = ['src/server.ts'] }: StartOptions = {}) {
  const port = await freePort();
  // Puerto interno del aviso de la API (REQ-F-039): libre por proceso, para no chocar con otros.
  const internalPort = await freePort();
  const database = env.DATABASE_URL === undefined && !('DATABASE_URL' in env) ? await makeDatabase() : null;
  const child = spawn(process.execPath, args, {
    cwd: PROJECT_DIR,
    env: baseEnv(definedOnly({ ...VALID_ENV, PORT: String(port), INTERNAL_PORT: String(internalPort), ...(database ? { DATABASE_URL: appDatabaseUrl(database.name) } : {}), ...env })),
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
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
    port,
    internalPort,
    url: `http://127.0.0.1:${port}`,
    internalUrl: `http://127.0.0.1:${internalPort}`,
    output: () => ({ stdout, stderr }),
    exited,
    async stop() {
      if (child.exitCode === null && child.pid !== undefined) {
        try {
          process.kill(-child.pid, 'SIGTERM');
        } catch {
          // El grupo ya terminó.
        }
      }
      return exited;
    },
  };
}
