import { afterEach, describe, expect, it } from 'vitest';

import { ADMIN_USER, createUser, csrfFrom, loginAs } from '../support/admin.ts';
import { P, REPETITIONS, startStack, type Stack, ownerSession, runCleanups } from '../support/users-api-process.ts';

/**
 * Usuarios y cuenta propia de `/api/v1/admin` con el proceso real de la API contra MySQL (REQ-F-040).
 * Se arranca como proceso hijo, sin importar código de `api/` (landing-pages nunca importa la API),
 * sobre la misma base que el `/admin` actual de `setupAdmin()` (sin ADMIN_NEW_URL: los dos escriben,
 * como en desarrollo):
 *
 * - reglas reales del repositorio: auditoría, usuario repetido sin distinguir mayúsculas, doble envío,
 *   contraseñas multibyte y último acceso en la zona del negocio (CA-2, CA-3, CA-7 y CA-8);
 * - D-8 entre los dos admins, en los dos sentidos (CA-4, CA-5, CA-7 y CA-8);
 * - D-7 con concurrencia: dos peticiones a la API y una en cada admin (CA-6, R-1);
 * - logs de la API sin secretos (CA-12).
 *
 * REQ-F-041: parte de users-api-process.test.ts (preparación en
 * tests/support/users-api-process.ts).
 */

afterEach(runCleanups);

describe('último administrador con peticiones simultáneas (D-7, CA-6)', () => {
  /** Admin "beto" además del dueño: los dos únicos administradores activos. */
  async function twoAdmins(stack: Stack) {
    const owner = (await stack.context.users.findCredentials(ADMIN_USER))?.user;
    if (!owner) throw new Error('Falta el primer administrador');
    const beto = await createUser(stack.context.users, { username: 'beto', role: 'admin' });
    const reactivateBoth = async () => {
      for (const id of [owner.id, beto.id]) await stack.context.users.setActive(id, true, { kind: 'system' });
    };
    return { owner, beto, reactivateBoth };
  }

  it(`dos administradores se desactivan entre sí con dos peticiones a la API, ${REPETITIONS} veces: siempre queda uno`, async () => {
    const stack = await startStack();
    const { owner, beto, reactivateBoth } = await twoAdmins(stack);
    for (let round = 0; round < REPETITIONS; round += 1) {
      const [ownerApi, betoApi] = await Promise.all([ownerSession(stack), stack.apiSession('beto')]);
      const responses = await Promise.all([
        stack.apiCall(`${P}/usuarios/${beto.id}/desactivar`, ownerApi, { method: 'POST', body: {} }),
        stack.apiCall(`${P}/usuarios/${owner.id}/desactivar`, betoApi, { method: 'POST', body: {} }),
      ]);
      const statuses = responses.map((res) => res.status);
      // La que pierde recibe el aviso (409), 401 si su propia sesión ya cayó, o 503 sin cambios.
      expect(statuses.filter((status) => status === 200).length, String(statuses)).toBeLessThanOrEqual(1);
      for (const status of statuses) expect([200, 401, 409, 503]).toContain(status);
      expect(await stack.activeAdmins()).toHaveLength(1);
      await reactivateBoth();
    }
  }, 180_000);

  it(`uno en cada admin (la API y el /admin actual sin ADMIN_NEW_URL), ${REPETITIONS} veces: siempre queda al menos uno`, async () => {
    const stack = await startStack();
    const { owner, beto, reactivateBoth } = await twoAdmins(stack);
    for (let round = 0; round < REPETITIONS; round += 1) {
      const ownerApi = await ownerSession(stack);
      const betoLanding = await loginAs(stack.context.browser(), 'beto');
      const csrf = csrfFrom((await betoLanding.get('/admin/usuarios')).text);
      await Promise.all([
        stack.apiCall(`${P}/usuarios/${beto.id}/desactivar`, ownerApi, { method: 'POST', body: {} }),
        betoLanding.post(`/admin/usuarios/${owner.id}/desactivar`).type('form').send({ _csrf: csrf }),
      ]);
      const admins = await stack.activeAdmins();
      expect(admins.length).toBeGreaterThanOrEqual(1);
      expect(admins.length).toBeLessThanOrEqual(2);
      await reactivateBoth();
    }
  }, 180_000);
});
