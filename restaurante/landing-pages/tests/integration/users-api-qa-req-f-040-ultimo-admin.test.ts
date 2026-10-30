import { afterEach, describe, expect, it } from 'vitest';

import { ADMIN_USER, createUser } from '../support/admin.ts';
import { P, REPETITIONS, type ApiSession, startStack, type Stack, ownerSession, runCleanups } from '../support/users-api-qa-req-f-040.ts';

/**
 * QA de REQ-F-040 (PR 1): usuarios y cuenta propia de `/api/v1/admin` con el proceso real de la API
 * contra MySQL, en los casos que no cubren `admin-users-api.test.ts` ni `users-api-process.test.ts`:
 *
 * - escalada de privilegios de un editor y sesiones que pierden privilegios a mitad (R-2, CA-1, CA-8);
 * - claves especiales del JSON, tipos inválidos, límites de contraseña y de cuerpo, y métodos no previstos;
 * - edición simultánea: gana la última y cada una queda auditada (RF-9);
 * - D-7 por caminos distintos de dos desactivaciones: degradación mutua y degradarse a sí mismo mientras
 *   el otro administrador se desactiva (CA-6, R-1).
 *
 * Como `users-api-process.test.ts`, arranca la API como proceso hijo (puertos con `freePorts`) sin
 * importar código de `api/`, sobre la base de `setupAdmin()`.
 *
 * REQ-F-041: parte de users-api-qa-req-f-040.test.ts (preparación en
 * tests/support/users-api-qa-req-f-040.ts).
 */

afterEach(runCleanups);

describe('último administrador por caminos distintos de dos desactivaciones (D-7, CA-6)', () => {
  async function twoAdmins(stack: Stack) {
    const owner = (await stack.context.users.findCredentials(ADMIN_USER))?.user;
    if (!owner) throw new Error('Falta el primer administrador');
    const beto = await createUser(stack.context.users, { username: 'beto', role: 'admin' });
    const restore = async () => {
      for (const user of [owner, beto]) {
        await stack.context.users.update(user.id, { username: user.username, displayName: user.displayName, role: 'admin', businesses: [] }, { kind: 'system' });
        await stack.context.users.setActive(user.id, true, { kind: 'system' });
      }
    };
    const demote = (target: { id: number; username: string; displayName: string }, auth: ApiSession) =>
      stack.apiCall(`${P}/usuarios/${target.id}`, auth, {
        method: 'PUT',
        body: { username: target.username, displayName: target.displayName, role: 'editor', businesses: ['molotes'] },
      });
    return { owner, beto, restore, demote };
  }

  /** Como mucho una gana; las demás reciben 409, 401 (su sesión cayó) o 503 sin cambios. */
  async function expectOneAdminLeft(stack: Stack, responses: Response[]) {
    const statuses = responses.map((res) => res.status);
    for (const status of statuses) expect([200, 401, 409, 503], String(statuses)).toContain(status);
    const wins = statuses.filter((status) => status === 200).length;
    expect(wins, String(statuses)).toBeLessThanOrEqual(1);
    const admins = await stack.activeAdmins();
    expect(admins.length, String(statuses)).toBeGreaterThanOrEqual(1);
    expect(admins.length, String(statuses)).toBe(2 - wins);
    return statuses;
  }

  it(`dos administradores se degradan entre sí a la vez, ${REPETITIONS} veces: siempre queda uno`, async () => {
    const stack = await startStack();
    const { owner, beto, restore, demote } = await twoAdmins(stack);
    for (let round = 0; round < REPETITIONS; round += 1) {
      const [ownerApi, betoApi] = await Promise.all([ownerSession(stack), stack.apiSession('beto')]);
      await expectOneAdminLeft(stack, await Promise.all([demote(beto, ownerApi), demote(owner, betoApi)]));
      await restore();
    }
  }, 180_000);

  it(`uno se degrada a sí mismo mientras el otro se desactiva a sí mismo, ${REPETITIONS} veces: siempre queda uno`, async () => {
    const stack = await startStack();
    const { owner, beto, restore, demote } = await twoAdmins(stack);
    for (let round = 0; round < REPETITIONS; round += 1) {
      const [ownerApi, betoApi] = await Promise.all([ownerSession(stack), stack.apiSession('beto')]);
      await expectOneAdminLeft(
        stack,
        await Promise.all([demote(owner, ownerApi), stack.apiCall(`${P}/usuarios/${beto.id}/desactivar`, betoApi, { method: 'POST', body: {} })]),
      );
      await restore();
    }
  }, 180_000);
});
