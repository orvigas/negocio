import { afterEach, describe, expect, it } from 'vitest';

import { setupAdmin } from '../support/admin.ts';
import { adminSql, makeScratchDatabase } from '../support/database.ts';
import { freePort } from '../support/process.ts';
import { NEW_PASSWORD, recover, withDatabase, cleanups, runCleanups } from '../support/admin-recover.ts';

/** Comando de recuperación por consola (REQ-F-007, D-5, R-5, DT-14; CA-15) sobre MySQL (REQ-F-014, RF-11 y CA-11). *
 * REQ-F-041: parte de admin-recover.test.ts (preparación en tests/support/admin-recover.ts).
 */

afterEach(runCleanups);

describe('npm run admin:recover', () => {
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
