import { createPrismaClient } from '@restaurante/db/client';
import { DatabaseInitError, probeOf, queryOf, verifyDatabase } from '@restaurante/db/verify';

import { makeScratchDatabase } from './database.ts';

/**
 * verifyDatabase sobre MySQL real (REQ-F-014) en los archivos db-verify*.test.ts. REQ-F-041:
 * preparación compartida por los archivos en que se partió db-verify.test.ts, sin cambios.
 */

export const cleanups: (() => Promise<void>)[] = [];
/** Limpieza de la prueba (procesos, bases, proxies): cada archivo la registra con afterEach. */
export async function runCleanups(): Promise<void> {
  while (cleanups.length > 0) await cleanups.pop()?.();
}

export async function scratch(migrated = true) {
  const database = await makeScratchDatabase({ migrated });
  cleanups.push(database.cleanup);
  const prisma = createPrismaClient(database.config);
  cleanups.push(() => prisma.$disconnect());
  const verify = (options: { allowNewerSchema?: boolean; logger?: { info: () => void; warn: (msg: string, fields?: object) => void } } = {}) =>
    verifyDatabase({ probe: probeOf(database.config), query: queryOf(prisma), windowMs: 5000, ...options });
  return { ...database, prisma, verify };
}

export const failure = (promise: Promise<unknown>) => promise.then(() => null, (error: unknown) => error as DatabaseInitError);
