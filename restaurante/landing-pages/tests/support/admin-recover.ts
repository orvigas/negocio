import { appDatabaseUrl } from './database.ts';
import { runNode } from './process.ts';

/**
 * npm run admin:recover con MySQL real (REQ-F-007 y REQ-F-014) en los archivos
 * admin-recover*.test.ts. REQ-F-041: preparación compartida por los archivos en que se partió
 * admin-recover.test.ts, sin cambios.
 */

export const NEW_PASSWORD = 'clave-recuperada-por-consola';
export const recover = (env: Record<string, string>, args: string[], input = `${NEW_PASSWORD}\n`) =>
  runNode(['scripts/admin-recover.ts', ...args], { env: { NODE_ENV: 'test', ...env }, input });
export const withDatabase = (name: string) => ({ DATABASE_URL: appDatabaseUrl(name) });

export const cleanups: (() => Promise<void>)[] = [];
/** Limpieza de la prueba (procesos, bases, proxies): cada archivo la registra con afterEach. */
export async function runCleanups(): Promise<void> {
  while (cleanups.length > 0) await cleanups.pop()?.();
}
