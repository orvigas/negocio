import { afterEach, describe, expect, it } from 'vitest';

import { LastAdminError } from '@restaurante/core/identity';

import { ADMIN_PASSWORD, ADMIN_PASSWORD_HASH, ADMIN_USER, createUser, startApiAdmin } from '../support/admin.ts';
import { appDatabaseUrl } from '../support/database.ts';
import { REPETITIONS, SYSTEM, activeAdmins, admin, editor, runCleanups, twoClients } from '../support/last-admin-concurrency.ts';
import { runNode } from '../support/process.ts';

/**
 * RN-1 con concurrencia real sobre MySQL (REQ-F-014, RF-7 y CA-5): desactivar al único administrador
 * en paralelo con la recuperación por consola nunca deja cero administradores activos, con dos
 * clientes de Prisma (dos pools, como dos procesos) y por HTTP con `npm run admin:recover` real.
 *
 * Parte de last-admin-concurrency.test.ts (preparación en tests/support/last-admin-concurrency.ts);
 * las desactivaciones simultáneas y el interbloqueo sin resolver están en
 * last-admin-concurrency-deactivation.test.ts.
 */

afterEach(runCleanups);

describe('último administrador con concurrencia (CA-5)', () => {
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
});

describe('último administrador con concurrencia por HTTP (CA-5; REQ-F-045, CA-8)', () => {
  it('desactivación por la API de administración en paralelo con `npm run admin:recover` real de la api (5 veces): nunca cero administradores', async () => {
    const context = await startApiAdmin();
    const owner = (await context.users.findCredentials(ADMIN_USER))!.user;
    const helper = await createUser(context.users, { username: 'eva' });

    for (let round = 0; round < 5; round += 1) {
      const session = await context.loginAs(ADMIN_USER, ADMIN_PASSWORD);
      const [res, recovered] = await Promise.all([
        context.deactivateUser(session, owner.id),
        runNode(['../api/scripts/admin-recover.ts', '--usuario', 'eva'], {
          env: { NODE_ENV: 'test', DATABASE_URL: appDatabaseUrl(context.database.name) },
          input: 'clave-recuperada-por-consola\n',
        }),
      ]);
      expect(recovered.code).toBe(0);
      expect([200, 409]).toContain(res.status);
      const admins = await context.prisma.user.findMany({ where: { role: 'admin', active: true }, select: { username: true }, orderBy: { id: 'asc' } });
      expect(admins.map((user) => user.username)).toEqual(res.status === 200 ? ['eva'] : [ADMIN_USER, 'eva']);
      await context.users.setActive(owner.id, true, SYSTEM);
      await context.users.update(helper.id, { username: 'eva', displayName: 'eva', role: 'editor', businesses: ['molotes'] }, SYSTEM);
    }
  }, 180_000);
});
