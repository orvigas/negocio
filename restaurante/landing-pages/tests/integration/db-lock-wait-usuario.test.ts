import { afterEach, describe, expect, it } from 'vitest';

import { ADMIN_USER, USER_PASSWORD, createUser, csrfFrom, loginAs, setupAdmin } from '../support/admin.ts';
import { HOLD_MS, expectLockWaitBelowHold, holdLock, wait } from '../support/lock-wait.ts';

/**
 * Espera de bloqueo prolongada (REQ-F-014; ver tests/support/lock-wait.ts). Se comprueba lo que
 * exige el ticket: ninguna operación queda a medias (503 sin cambios, o éxito completo con su
 * registro), el resto de la app sigue atendiendo y todo vuelve a funcionar al liberar el bloqueo.
 * REQ-F-041: uno de los tres casos de db-lock-wait.test.ts, ahora en su propio archivo.
 */

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()?.();
});

describe('espera de bloqueo prolongada (REQ-F-014, desviación del cliente)', () => {
  it('desactivar un usuario con su fila bloqueada: nada a medias y la app se recupera', async () => {
    const context = await setupAdmin();
    await expectLockWaitBelowHold(context.database.config);
    const owner = (await context.users.findCredentials(ADMIN_USER))!.user;
    await createUser(context.users, { username: 'beto', role: 'admin' });
    const session = await loginAs(context.browser(), 'beto', USER_PASSWORD);
    const page = await session.get('/admin/usuarios');
    const auditBefore = await context.prisma.userAudit.count();

    const release = await holdLock(cleanups, context.database.config, 'SELECT id FROM `user` WHERE id = ? FOR UPDATE', owner.id);
    const pending = session.post(`/admin/usuarios/${owner.id}/desactivar`).type('form').send({ _csrf: csrfFrom(page.text) });
    await wait(HOLD_MS);
    await release();
    const res = await pending;
    await wait(1000);
    const stored = await context.prisma.user.findUniqueOrThrow({ where: { id: owner.id } });
    const audit = await context.prisma.userAudit.count();
    if (res.status === 303) {
      expect(stored.active).toBe(false);
      expect(audit).toBe(auditBefore + 1);
      return;
    }
    expect(res.status).toBe(503);
    expect(stored.active).toBe(true);
    expect(audit).toBe(auditBefore);

    const again = await session.get('/admin/usuarios');
    const ok = await session.post(`/admin/usuarios/${owner.id}/desactivar`).type('form').send({ _csrf: csrfFrom(again.text) });
    expect(ok.status).toBe(303);
    expect((await context.prisma.user.findUniqueOrThrow({ where: { id: owner.id } })).active).toBe(false);
  }, 60_000);

});
