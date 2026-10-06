import { afterEach, describe, expect, it } from 'vitest';

import { databaseFile } from '../../src/db/paths.ts';
import { ADMIN_USER, USER_PASSWORD, createUser, login, loginAs, setupAdmin } from '../support/admin.ts';
import { makeTempDir } from '../support/database.ts';
import { runNode } from '../support/process.ts';

/** Comando de recuperación por consola (REQ-F-007, D-5, R-5, DT-14; CA-15). */

const NEW_PASSWORD = 'clave-recuperada-por-consola';
const recover = (dataDir: string, args: string[], input = `${NEW_PASSWORD}\n`) =>
  runNode(['scripts/admin-recover.ts', ...args], { env: { NODE_ENV: 'test', DATA_DIR: dataDir }, input });

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()?.();
});

describe('npm run admin:recover', () => {
  it('con el servidor en marcha: recupera al último administrador, cierra su sesión y queda en la auditoría (CA-15)', async () => {
    const context = await setupAdmin();
    const session = await loginAs(context.browser(), ADMIN_USER, 'clave-de-prueba-SECRETA-123');
    expect((await session.get('/admin/molotes')).status).toBe(200);

    const result = await recover(context.dataDir, ['--usuario', ADMIN_USER.toUpperCase()]);
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
  }, 30_000);

  it('reactiva y promueve a un editor desactivado', async () => {
    const context = await setupAdmin();
    const ana = await createUser(context.users, { username: 'ana', businesses: ['birria'] });
    await context.users.setActive(ana.id, false, { kind: 'system' });

    const result = await recover(context.dataDir, ['--usuario', 'ana']);
    expect(result.code).toBe(0);
    expect(await context.users.findById(ana.id)).toMatchObject({ active: true, role: 'admin', businesses: [] });
    expect((await login(context.browser(), { username: 'ana', password: USER_PASSWORD })).status).toBe(401);
    expect((await login(context.browser(), { username: 'ana', password: NEW_PASSWORD })).status).toBe(303);
  }, 30_000);

  it('con el servidor parado y sin .db: lo crea, migra y crea el administrador', async () => {
    const temp = await makeTempDir();
    cleanups.push(temp.cleanup);
    const result = await recover(temp.dir, ['--usuario', 'Dueña']);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Se creó el administrador "Dueña"');

    const { default: Database } = await import('better-sqlite3');
    const db = new Database(databaseFile(temp.dir), { readonly: true });
    expect(db.prepare('SELECT username, role, active FROM user').all()).toEqual([{ username: 'Dueña', role: 'admin', active: 1 }]);
    expect(db.prepare('SELECT password_hash FROM user').pluck().get()).toMatch(/^scrypt\$/);
    db.close();
  }, 30_000);

  it.each([
    ['sin --usuario', [], `${NEW_PASSWORD}\n`, /Uso: npm run admin:recover/],
    ['argumento desconocido', ['--user', 'x'], `${NEW_PASSWORD}\n`, /Uso: npm run admin:recover/],
    ['contraseña corta', ['--usuario', 'dueno'], 'corta\n', /al menos 12 caracteres/],
  ])('%s -> código 1 sin cambios', async (_case, args, input, message) => {
    const context = await setupAdmin();
    const before = await context.prisma.user.findMany();
    const result = await recover(context.dataDir, args, input);
    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(message);
    expect(await context.prisma.user.findMany()).toEqual(before);
  }, 30_000);

  it('DATA_DIR inexistente -> código 1 con un mensaje controlado', async () => {
    const temp = await makeTempDir();
    cleanups.push(temp.cleanup);
    const result = await recover(`${temp.dir}/no-existe`, ['--usuario', 'dueno']);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('No se pudo preparar la base de datos en DATA_DIR (DATA_DIR_MISSING)');
    expect(result.stderr).not.toMatch(/\n\s+at /);
  }, 30_000);
});
