import { afterEach, describe, expect, it } from 'vitest';

import { ADMIN_USER, USER_PASSWORD, createUser, login, loginAs, setupAdmin } from '../support/admin.ts';
import { adminSql, appDatabaseUrl, makeScratchDatabase } from '../support/database.ts';
import { freePort, runNode } from '../support/process.ts';

/** Comando de recuperación por consola (REQ-F-007, D-5, R-5, DT-14; CA-15) sobre MySQL (REQ-F-014, RF-11 y CA-11). */

const NEW_PASSWORD = 'clave-recuperada-por-consola';
const recover = (env: Record<string, string>, args: string[], input = `${NEW_PASSWORD}\n`) =>
  runNode(['scripts/admin-recover.ts', ...args], { env: { NODE_ENV: 'test', ...env }, input });
const withDatabase = (name: string) => ({ DATABASE_URL: appDatabaseUrl(name) });

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()?.();
});

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

  it.each([
    ['sin --usuario', [], `${NEW_PASSWORD}\n`, /Uso: npm run admin:recover/],
    ['argumento desconocido', ['--user', 'x'], `${NEW_PASSWORD}\n`, /Uso: npm run admin:recover/],
    ['contraseña corta', ['--usuario', 'dueno'], 'corta\n', /al menos 12 caracteres/],
  ])('%s -> código 1 sin cambios', async (_case, args, input, message) => {
    const context = await setupAdmin();
    const before = await context.prisma.user.findMany();
    const result = await recover(withDatabase(context.database.name), args, input);
    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(message);
    expect(await context.prisma.user.findMany()).toEqual(before);
  });

  it('base sin migrar -> código 1 con un mensaje controlado y sin migrarla (CA-11, RN-4)', async () => {
    const scratch = await makeScratchDatabase();
    cleanups.push(scratch.cleanup);
    const result = await recover(withDatabase(scratch.name), ['--usuario', 'dueno']);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('No se pudo usar la base de datos (MIGRATIONS_PENDING)');
    expect(result.stderr).not.toMatch(/\n\s+at /);
    expect(await adminSql(scratch.name, 'SHOW TABLES')).toEqual([]);
  });

  it('MySQL inalcanzable -> código 1 con un mensaje controlado', async () => {
    const port = await freePort();
    const result = await recover({ DATABASE_URL: `mysql://restaurante_test_app:x@127.0.0.1:${port}/restaurante_test_x` }, ['--usuario', 'dueno']);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('No se pudo usar la base de datos (DATABASE_UNREACHABLE)');
    expect(result.stderr).not.toMatch(/\n\s+at /);
  });

  it.each([
    ['sin DATABASE_URL', {}, 'DATABASE_URL es obligatoria'],
    ['DATABASE_URL de otro motor', { DATABASE_URL: 'postgres://u:clave-secreta@127.0.0.1/restaurante' }, 'DATABASE_URL no es válida'],
  ])('%s -> código 1 sin mostrar el valor (CA-8)', async (_case, env, message) => {
    const result = await recover(env, ['--usuario', 'dueno']);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain(message);
    expect(result.stderr).not.toContain('clave-secreta');
  });
});
