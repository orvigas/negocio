import { afterEach, describe, expect, it } from 'vitest';

import { ADMIN_USER, USER_PASSWORD, createUser, login, loginAs, setupAdmin } from '../support/admin.ts';
import { adminSql, makeScratchDatabase } from '../support/database.ts';
import { NEW_PASSWORD, recover, withDatabase, cleanups, runCleanups } from '../support/admin-recover.ts';

/** Comando de recuperación por consola (REQ-F-007, D-5, R-5, DT-14; CA-15) sobre MySQL (REQ-F-014, RF-11 y CA-11). *
 * REQ-F-041: parte de admin-recover.test.ts (preparación en tests/support/admin-recover.ts).
 */

afterEach(runCleanups);

describe('npm run admin:recover', () => {
  it('con el servidor en marcha: recupera al último administrador, cierra su sesión y queda en la auditoría (CA-15)', async () => {
    const context = await setupAdmin();
    const session = await loginAs(context.browser(), ADMIN_USER, 'clave-de-prueba-SECRETA-123');
    expect((await session.get('/admin/molotes')).status).toBe(200);

    const result = await recover(withDatabase(context.database.name), ['--usuario', ADMIN_USER.toUpperCase()]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain(`Se recuperó el acceso de "${ADMIN_USER}"`);
    expect(result.stdout + result.stderr).not.toContain(NEW_PASSWORD);

    // La sesión abierta deja de valer (otro proceso cambió su sessionVersion).
    expect((await session.get('/admin/molotes')).status).toBe(303);
    expect((await login(context.browser(), { password: 'clave-de-prueba-SECRETA-123' })).status).toBe(401);
    expect((await login(context.browser(), { password: NEW_PASSWORD })).status).toBe(303);

    const audit = await context.prisma.userAudit.findMany({ where: { action: 'console_recovery' } });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actorKind: 'console', actorId: null });
  });

  it('reactiva y promueve a un editor desactivado', async () => {
    const context = await setupAdmin();
    const ana = await createUser(context.users, { username: 'ana', businesses: ['birria'] });
    await context.users.setActive(ana.id, false, { kind: 'system' });

    const result = await recover(withDatabase(context.database.name), ['--usuario', 'ana']);
    expect(result.code).toBe(0);
    expect(await context.users.findById(ana.id)).toMatchObject({ active: true, role: 'admin', businesses: [] });
    expect((await login(context.browser(), { username: 'ana', password: USER_PASSWORD })).status).toBe(401);
    expect((await login(context.browser(), { username: 'ana', password: NEW_PASSWORD })).status).toBe(303);
  });

  it('con el servidor parado y la base migrada y vacía: crea el administrador (CA-11)', async () => {
    const scratch = await makeScratchDatabase({ migrated: true });
    cleanups.push(scratch.cleanup);
    const result = await recover(withDatabase(scratch.name), ['--usuario', 'Dueña']);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Se creó el administrador "Dueña"');

    const rows = (await adminSql(scratch.name, 'SELECT username, role, active, password_hash AS hash FROM user')) as Record<string, unknown>[];
    expect(rows).toEqual([{ username: 'Dueña', role: 'admin', active: 1, hash: expect.stringMatching(/^scrypt\$/) }]);
  });
});
