import { startServer } from './process.ts';
import { API_ENTRY } from './server-startup.ts';

export { API_ENTRY, logLines } from './server-startup.ts';

/**
 * El proceso real de la API (`node ../api/src/server.ts`) contra MySQL (REQ-F-038), arrancado como
 * proceso hijo, sin importar código de `api/` (landing-pages nunca importa la API). Preparación compartida
 * por los archivos en que se partió api-process.test.ts (api-process-products.test.ts y
 * api-process-startup.test.ts), sin cambios.
 */

export const cleanups: (() => Promise<void>)[] = [];
/** Limpieza de la prueba (procesos, bases, proxies): cada archivo la registra con afterEach. */
export async function runCleanups(): Promise<void> {
  while (cleanups.length > 0) await cleanups.pop()?.();
}

/** La API sin aviso interno (REQ-F-039): VALID_ENV trae INTERNAL_NOTIFY_TOKEN, que va con LANDING_INTERNAL_URL. */
export const API_ENV = { INTERNAL_NOTIFY_TOKEN: undefined };

export async function startApi(env: Record<string, string>) {
  const api = await startServer({ ...env, ...API_ENV }, 30_000, { args: [API_ENTRY] });
  cleanups.push(async () => void (await api.stop()));
  return api;
}
