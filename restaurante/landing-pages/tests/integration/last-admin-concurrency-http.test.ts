import { describe, expect, it } from 'vitest';

import { ADMIN_USER, USER_PASSWORD, createUser, deactivateUser, loginAs, setupAdmin } from '../support/admin.ts';

/**
 * RN-1 con concurrencia real sobre MySQL por HTTP (REQ-F-014, RF-7 y CA-5); el resto de los casos
 * están en last-admin-concurrency.test.ts (REQ-F-041: antes, un solo archivo). Se repite 50 veces.
 */

const REPETITIONS = 50;
const SYSTEM = { kind: 'system' } as const;

describe('último administrador con concurrencia por HTTP (CA-5)', () => {
  it(`dos administradores se desactivan a sí mismos a la vez, ${REPETITIONS} veces: uno recibe el éxito y el otro el 409`, async () => {
    const context = await setupAdmin();
    const owner = (await context.users.findCredentials(ADMIN_USER))!.user;
    const other = await createUser(context.users, { username: 'beto', role: 'admin' });

    for (let round = 0; round < REPETITIONS; round += 1) {
      const sessions = [await loginAs(context.browser(), ADMIN_USER, 'clave-de-prueba-SECRETA-123'), await loginAs(context.browser(), 'beto', USER_PASSWORD)];
      const responses = await Promise.all([deactivateUser(sessions[0]!, owner.id), deactivateUser(sessions[1]!, other.id)]);
      const statuses = responses.map((res) => res.status).sort();
      expect([[303, 409], [303, 503]]).toContainEqual(statuses);
      const conflict = responses.find((res) => res.status === 409);
      if (conflict) expect(conflict.text).toContain('Debe quedar al menos un administrador activo');
      expect(await context.prisma.user.count({ where: { role: 'admin', active: true } })).toBe(1);
      for (const id of [owner.id, other.id]) await context.users.setActive(id, true, SYSTEM);
    }
  }, 180_000);
});
