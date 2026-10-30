import { afterEach, describe, expect, it } from 'vitest';

import { createPrismaClient, type Database } from '@restaurante/db/client';
import { DatabaseUnavailableError } from '@restaurante/core/shared';
import { LastAdminError, type UserRepository } from '@restaurante/core/identity';
import { MAX_ATTEMPTS, createUserRepository } from '@restaurante/db/user-repository';

import { ADMIN_PASSWORD_HASH, ADMIN_USER, createUser, deactivateUser, setupAdmin, loginAs } from '../support/admin.ts';
import { appDatabaseUrl, makeDatabase } from '../support/database.ts';
import { runNode } from '../support/process.ts';

/**
 * RN-1 con concurrencia real sobre MySQL (REQ-F-014, RF-7 y CA-5): ninguna combinación de
 * operaciones simultáneas deja cero administradores activos. Las escrituras de usuarios son
 * SERIALIZABLE: el interbloqueo revierte una de las dos, que se reintenta y ve el estado confirmado.
 * El caso de dos administradores que se desactivan a sí mismos por HTTP está en
 * last-admin-concurrency-http.test.ts (REQ-F-041).
 * Cada caso se repite 50 veces con dos clientes de Prisma (dos pools, como dos procesos).
 */

const REPETITIONS = 50;
const SYSTEM = { kind: 'system' } as const;

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()?.();
});

const admin = (username: string) => ({ username, displayName: username, role: 'admin' as const, businesses: [], passwordHash: ADMIN_PASSWORD_HASH });
const editor = (username: string) => ({ username, displayName: username, role: 'editor' as const, businesses: ['molotes' as const], passwordHash: ADMIN_PASSWORD_HASH });

async function twoClients() {
  const database = await makeDatabase();
  cleanups.push(database.cleanup);
  const other = createPrismaClient(database.config);
  cleanups.push(() => other.$disconnect());
  return { prisma: database.prisma, first: createUserRepository({ prisma: database.prisma }), second: createUserRepository({ prisma: other }) };
}

const activeAdmins = (prisma: Database) => prisma.user.findMany({ where: { role: 'admin', active: true }, select: { username: true }, orderBy: { id: 'asc' } });

describe('último administrador con concurrencia (CA-5)', () => {
  it(`dos desactivaciones simultáneas de los dos únicos administradores, ${REPETITIONS} veces: siempre queda exactamente uno`, async () => {
    const { prisma, first, second } = await twoClients();
    const a = await first.create(admin('ana'), SYSTEM);
    const b = await first.create(admin('beto'), SYSTEM);

    for (let round = 0; round < REPETITIONS; round += 1) {
      const auditBefore = await prisma.userAudit.count({ where: { action: 'deactivate' } });
      const results = await Promise.allSettled([first.setActive(a.id, false, SYSTEM), second.setActive(b.id, false, SYSTEM)]);
      const fulfilled = results.filter((result) => result.status === 'fulfilled');
      const reasons = results.flatMap((result) => (result.status === 'rejected' ? [result.reason as unknown] : []));
      expect(fulfilled).toHaveLength(1);
      // La rechazada recibe el aviso de siempre (409) o, si no se resolvió, 503 sin cambios.
      for (const reason of reasons) expect(reason instanceof LastAdminError || reason instanceof DatabaseUnavailableError).toBe(true);
      expect(await activeAdmins(prisma)).toHaveLength(1);
      expect(await prisma.userAudit.count({ where: { action: 'deactivate' } })).toBe(auditBefore + 1);
      // Se reactiva al desactivado para la siguiente vuelta.
      for (const id of [a.id, b.id]) await first.setActive(id, true, SYSTEM);
    }
  }, 120_000);

  it(`desactivar al único administrador en paralelo con la recuperación por consola, ${REPETITIONS} veces: equivale a una ejecución en serie (P-2)`, async () => {
    const { prisma, first, second } = await twoClients();
    const owner = await first.create(admin('dueno'), SYSTEM);
    const helper = await first.create(editor('eva'), SYSTEM);

    for (let round = 0; round < REPETITIONS; round += 1) {
      const auditBefore = await prisma.userAudit.count();
      const [deactivation, recovery] = await Promise.allSettled([
        first.setActive(owner.id, false, SYSTEM),
        second.recover({ username: 'eva', passwordHash: ADMIN_PASSWORD_HASH }),
      ]);
      expect(recovery.status).toBe('fulfilled');
      const admins = (await activeAdmins(prisma)).map((user) => user.username);
      expect(admins.length).toBeGreaterThanOrEqual(1);
      if (deactivation.status === 'fulfilled') {
        // Primero la recuperación, después la desactivación: queda solo eva.
        expect(admins).toEqual(['eva']);
        expect(await prisma.userAudit.count()).toBe(auditBefore + 2);
      } else {
        // Primero la desactivación (rechazada: era el último), después la recuperación.
        expect(deactivation.reason).toBeInstanceOf(LastAdminError);
        expect(admins).toEqual(['dueno', 'eva']);
        expect(await prisma.userAudit.count()).toBe(auditBefore + 1);
      }
      // La auditoría registra exactamente lo aplicado.
      expect(await prisma.userAudit.count({ where: { action: 'console_recovery' } })).toBe(round + 1);
      await first.setActive(owner.id, true, SYSTEM);
      await first.update(helper.id, { username: 'eva', displayName: 'eva', role: 'editor', businesses: ['molotes'] }, SYSTEM);
    }
  }, 120_000);

  it('si el interbloqueo no se resuelve tras los reintentos: 503 sin cambios', async () => {
    const database = await makeDatabase();
    cleanups.push(database.cleanup);
    let calls = 0;
    const conflict = Object.assign(new Error('Transaction failed due to a write conflict or a deadlock'), { name: 'PrismaClientKnownRequestError', code: 'P2034' });
    const prisma = new Proxy(database.prisma, {
      get(target, property, receiver) {
        if (property === '$transaction') {
          return () => {
            calls += 1;
            return Promise.reject(conflict);
          };
        }
        return Reflect.get(target, property, receiver) as unknown;
      },
    });
    const users: UserRepository = createUserRepository({ prisma });
    await expect(users.setActive(1, false, SYSTEM)).rejects.toBeInstanceOf(DatabaseUnavailableError);
    expect(calls).toBe(MAX_ATTEMPTS);
  });
});

describe('último administrador con concurrencia por HTTP (CA-5)', () => {
  it('desactivación por HTTP en paralelo con `npm run admin:recover` real (5 veces): nunca cero administradores', async () => {
    const context = await setupAdmin();
    const owner = (await context.users.findCredentials(ADMIN_USER))!.user;
    const helper = await createUser(context.users, { username: 'eva' });

    for (let round = 0; round < 5; round += 1) {
      const session = await loginAs(context.browser(), ADMIN_USER, 'clave-de-prueba-SECRETA-123');
      const [res, recovered] = await Promise.all([
        deactivateUser(session, owner.id),
        runNode(['scripts/admin-recover.ts', '--usuario', 'eva'], {
          env: { NODE_ENV: 'test', DATABASE_URL: appDatabaseUrl(context.database.name) },
          input: 'clave-recuperada-por-consola\n',
        }),
      ]);
      expect(recovered.code).toBe(0);
      expect([303, 409]).toContain(res.status);
      const admins = await context.prisma.user.findMany({ where: { role: 'admin', active: true }, select: { username: true }, orderBy: { id: 'asc' } });
      expect(admins.map((user) => user.username)).toEqual(res.status === 303 ? ['eva'] : [ADMIN_USER, 'eva']);
      await context.users.setActive(owner.id, true, SYSTEM);
      await context.users.update(helper.id, { username: 'eva', displayName: 'eva', role: 'editor', businesses: ['molotes'] }, SYSTEM);
    }
  }, 180_000);
});
