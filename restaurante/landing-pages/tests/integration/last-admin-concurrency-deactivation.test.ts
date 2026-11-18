import { afterEach, describe, expect, it } from 'vitest';

import { DatabaseUnavailableError } from '@restaurante/core/shared';
import { LastAdminError, type UserRepository } from '@restaurante/core/identity';
import { MAX_ATTEMPTS, createUserRepository } from '@restaurante/db/user-repository';

import { makeDatabase } from '../support/database.ts';
import { REPETITIONS, SYSTEM, activeAdmins, admin, cleanups, runCleanups, twoClients } from '../support/last-admin-concurrency.ts';

/**
 * RN-1 con concurrencia real sobre MySQL (REQ-F-014, RF-7 y CA-5): ninguna combinación de
 * operaciones simultáneas deja cero administradores activos. Las escrituras de usuarios son
 * SERIALIZABLE: el interbloqueo revierte una de las dos, que se reintenta y ve el estado confirmado.
 * Cada caso se repite 50 veces con dos clientes de Prisma (dos pools, como dos procesos).
 *
 * Parte de last-admin-concurrency.test.ts (preparación en tests/support/last-admin-concurrency.ts):
 * desactivaciones simultáneas e interbloqueo sin resolver. La recuperación por consola en paralelo
 * está en last-admin-concurrency-recovery.test.ts.
 */

afterEach(runCleanups);

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
