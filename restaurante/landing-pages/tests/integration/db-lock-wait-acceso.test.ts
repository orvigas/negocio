import { afterEach, describe, expect, it } from 'vitest';

import { ADMIN_PASSWORD, ADMIN_USER, USER_PASSWORD, createUser, login, loginAs, setupAdmin } from '../support/admin.ts';
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
  it('iniciar sesión con la fila del usuario bloqueada: no se cuelga y el resto de la app sigue atendiendo', async () => {
    const context = await setupAdmin();
    await expectLockWaitBelowHold(context.database.config);
    await createUser(context.users, { username: 'beto', role: 'admin' });
    const owner = (await context.users.findCredentials(ADMIN_USER))!.user;
    const other = await loginAs(context.browser(), 'beto', USER_PASSWORD);

    const release = await holdLock(cleanups, context.database.config, 'SELECT id FROM `user` WHERE id = ? FOR UPDATE', owner.id);
    const pending = login(context.browser(), { username: ADMIN_USER, password: ADMIN_PASSWORD });

    // Mientras el acceso espera, el resto del admin y las landings responden (el pool no se agota).
    await wait(1500);
    expect((await other.get('/admin/usuarios')).status).toBe(200);
    expect((await context.request().get('/molotes')).status).toBe(200);

    await wait(HOLD_MS - 1500);
    await release();
    expect([303, 503]).toContain((await pending).status);

    // Al liberar, el acceso vuelve a funcionar al momento.
    const started = Date.now();
    expect((await login(context.browser(), { username: ADMIN_USER, password: ADMIN_PASSWORD })).status).toBe(303);
    expect(Date.now() - started).toBeLessThan(5000);
  }, 60_000);
});
