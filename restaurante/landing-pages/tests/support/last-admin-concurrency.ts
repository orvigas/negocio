import { createPrismaClient, type Database } from '@restaurante/db/client';
import { createUserRepository } from '@restaurante/db/user-repository';

import { ADMIN_PASSWORD_HASH } from './admin.ts';
import { makeDatabase } from './database.ts';

/**
 * RN-1 con concurrencia real sobre MySQL (REQ-F-014, RF-7 y CA-5). Preparación compartida por los
 * archivos en que se partió last-admin-concurrency.test.ts (last-admin-concurrency-deactivation.test.ts
 * y last-admin-concurrency-recovery.test.ts), sin cambios.
 */

export const REPETITIONS = 50;
export const SYSTEM = { kind: 'system' } as const;

export const cleanups: (() => Promise<void>)[] = [];
/** Limpieza de la prueba (bases y clientes de Prisma): cada archivo la registra con afterEach. */
export async function runCleanups(): Promise<void> {
  while (cleanups.length > 0) await cleanups.pop()?.();
}

export const admin = (username: string) => ({ username, displayName: username, role: 'admin' as const, businesses: [], passwordHash: ADMIN_PASSWORD_HASH });
export const editor = (username: string) => ({ username, displayName: username, role: 'editor' as const, businesses: ['molotes' as const], passwordHash: ADMIN_PASSWORD_HASH });

/** Dos clientes de Prisma (dos pools, como dos procesos) sobre la misma base. */
export async function twoClients() {
  const database = await makeDatabase();
  cleanups.push(database.cleanup);
  const other = createPrismaClient(database.config);
  cleanups.push(() => other.$disconnect());
  return { prisma: database.prisma, first: createUserRepository({ prisma: database.prisma }), second: createUserRepository({ prisma: other }) };
}

export const activeAdmins = (prisma: Database) => prisma.user.findMany({ where: { role: 'admin', active: true }, select: { username: true }, orderBy: { id: 'asc' } });
