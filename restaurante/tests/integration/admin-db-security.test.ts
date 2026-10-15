import { describe, expect, it } from 'vitest';

import { createUserRepository, type UserRepository } from '../../src/repositories/user-repository.ts';
import {
  ADMIN_PASSWORD,
  ADMIN_PASSWORD_HASH,
  ADMIN_USER,
  USER_PASSWORD,
  createUser,
  csrfFrom,
  formFields,
  login,
  loginAs,
  setupAdmin,
  submitForm,
  type Browser,
} from '../support/admin.ts';
import { adminSql } from '../support/database.ts';

/**
 * REQ-F-007: fallo de la base de datos con el servidor en marcha (R-3, DT-9; CA-5) y ausencia de
 * secretos en logs y respuestas (R-11; CA-17).
 */

describe('la base de datos falla con el servidor en marcha (CA-5)', () => {
  it('acceso y /admin responden 503 con un aviso accesible; las landings siguen en 200', async () => {
    const context = await setupAdmin();
    const session = await loginAs(context.browser(), ADMIN_USER, ADMIN_PASSWORD);
    expect((await session.get('/admin/molotes')).status).toBe(200);

    // Fallo real de MySQL: la tabla de usuarios desaparece (DDL con el usuario admin de pruebas).
    await adminSql(context.database.name, 'DROP TABLE bot_block', 'DROP TABLE bot_audit', 'DROP TABLE bot_control', 'DROP TABLE product_change', 'DROP TABLE user_audit', 'DROP TABLE user_business', 'DROP TABLE user');

    const responses = [
      await session.get('/admin/molotes'),
      await session.get('/admin'),
      await login(context.browser()),
      await context.request().get('/admin/login'),
    ];
    for (const res of responses) {
      expect(res.status).toBe(503);
      expect(res.headers['content-type']).toMatch(/^text\/html/);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.text).toMatch(/role="alert"[^>]*>\s*<p class="admin-notice__title font-bold">No se pudo acceder a los datos de la administración\.<\/p>/);
      // Sin detalles técnicos.
      expect(res.text).not.toMatch(/prisma|mysql|SELECT|doesn't exist|\/src\//i);
    }
    for (const path of ['/', '/molotes', '/birria']) expect((await context.request().get(path)).status).toBe(200);

    const logged = context.logger.lines.filter((line) => line.msg === 'database_unavailable');
    expect(logged.length).toBeGreaterThan(0);
    for (const line of logged) {
      expect(Object.keys(line).sort()).toEqual(['code', 'level', 'msg', 'name', 'originalCode', 'path']);
      expect(JSON.stringify(line)).not.toMatch(/SELECT|INSERT|doesn't exist|\/src\//i);
    }
  });

  it('si la base falla antes de saber si hay usuarios, /admin también responde 503', async () => {
    const context = await setupAdmin({
      wrapUsers: (users: UserRepository): UserRepository => ({
        ...users,
        hasUsers: () => createUserRepository({ prisma: brokenPrisma() }).hasUsers(),
      }),
    });
    const res = await context.request().get('/admin/login');
    expect(res.status).toBe(503);
    expect(res.text).toContain('No se pudo acceder a los datos de la administración.');
    expect((await context.request().get('/')).status).toBe(200);
  });
});

/** Cliente que falla como lo hace Prisma ante un archivo que no es una base de datos. */
function brokenPrisma(): Parameters<typeof createUserRepository>[0]['prisma'] {
  const failure = Object.assign(new Error('Invalid `prisma.user.count()` invocation in /app/src/x.ts: file is not a database'), {
    name: 'PrismaClientKnownRequestError',
    code: 'P2039',
    meta: { driverAdapterError: { cause: { originalCode: '45028' } } },
  });
  // Doble mínimo: solo se usa `user.count`.
  return { user: { count: () => Promise.reject(failure) } } as unknown as Parameters<typeof createUserRepository>[0]['prisma'];
}

describe('sin secretos en logs ni respuestas (CA-17)', () => {
  it('recorrido completo: ninguna línea de log ni página contiene contraseñas, hashes ni ids de sesión; el token CSRF solo en su campo oculto', async () => {
    const context = await setupAdmin();
    const bodies: string[] = [];
    const sessionIds = new Set<string>();
    const csrfTokens = new Set<string>();
    const track = async <T extends { text: string; headers: Record<string, unknown> }>(promise: PromiseLike<T>): Promise<T> => {
      const res = await promise;
      bodies.push(res.text);
      const cookies = res.headers['set-cookie'];
      for (const cookie of Array.isArray(cookies) ? (cookies as string[]) : []) {
        const id = /admin_sid=([^;]+)/.exec(cookie)?.[1];
        if (id) sessionIds.add(id);
      }
      for (const match of res.text.matchAll(/name="_csrf" value="([^"]+)"/g)) csrfTokens.add(match[1]!);
      return res;
    };

    const admin: Browser = context.browser();
    await track(login(admin, { password: 'incorrecta-123456' }));
    await track(login(admin));
    const newPage = await track(admin.get('/admin/usuarios/nuevo'));
    const anaPassword = 'clave-secreta-de-ana';
    await track(
      admin
        .post('/admin/usuarios')
        .type('form')
        .send({ _csrf: csrfFrom(newPage.text), username: 'ana', displayName: 'Ana', role: 'editor', 'business-molotes': 'on', password: anaPassword, passwordConfirmation: anaPassword }),
    );
    // Un error de validación con contraseñas escritas no las devuelve.
    await track(
      admin
        .post('/admin/usuarios')
        .type('form')
        .send({ _csrf: csrfFrom(newPage.text), username: 'ana', displayName: 'Ana', role: 'editor', password: anaPassword, passwordConfirmation: anaPassword }),
    );
    const ana = (await context.users.findCredentials('ana'))!;
    const resetPassword = 'clave-restablecida-123';
    const resetPage = await track(admin.get(`/admin/usuarios/${ana.user.id}/contrasena`));
    await track(
      admin
        .post(`/admin/usuarios/${ana.user.id}/contrasena`)
        .type('form')
        .send({ _csrf: csrfFrom(resetPage.text), password: resetPassword, passwordConfirmation: resetPassword }),
    );
    await track(admin.get('/admin/usuarios'));

    const editor = context.browser();
    await track(login(editor, { username: 'ana', password: resetPassword }));
    const accountPage = await track(editor.get('/admin/cuenta'));
    const ownPassword = 'clave-propia-de-ana-1';
    await track(
      editor
        .post('/admin/cuenta')
        .type('form')
        .send({ _csrf: csrfFrom(accountPage.text), currentPassword: resetPassword, password: ownPassword, passwordConfirmation: ownPassword }),
    );
    const molotes = await track(editor.get('/admin/molotes'));
    await track(submitForm(editor, 'molotes', formFields(molotes.text), { 'menu.highlight': 'Cambio de Ana' }));
    await track(editor.get('/admin/birria'));
    await createUser(context.users, { username: 'beto' });
    await track(login(context.browser(), { username: 'beto', password: USER_PASSWORD }));

    const hashes = (await context.prisma.user.findMany({ select: { passwordHash: true } })).map((user) => user.passwordHash);
    // REQ-F-014 (CA-8): tampoco la contraseña ni el usuario de la base, ni su URL.
    const { password: databasePassword, user: databaseUser } = context.database.config;
    const secrets = [ADMIN_PASSWORD, ADMIN_PASSWORD_HASH, anaPassword, resetPassword, ownPassword, USER_PASSWORD, ...hashes, ...sessionIds, databasePassword, databaseUser, 'mysql://'];
    expect(sessionIds.size).toBeGreaterThan(2);
    expect(csrfTokens.size).toBeGreaterThan(1);

    const logText = JSON.stringify(context.logger.lines);
    for (const secret of [...secrets, ...csrfTokens]) expect(logText).not.toContain(secret);
    // Ninguna pista del hash en logs ni páginas.
    expect(logText).not.toContain('scrypt$');

    for (const body of bodies) {
      for (const secret of secrets) expect(body).not.toContain(secret);
      expect(body).not.toContain('scrypt$');
      // El token CSRF solo aparece en el campo oculto _csrf.
      const outside = body.replace(/name="_csrf" value="[^"]+"/g, '');
      for (const token of csrfTokens) expect(outside).not.toContain(token);
    }
    // El registro de cambios del menú tampoco lleva secretos.
    expect(JSON.stringify(context.repository.storage.changes)).not.toMatch(/scrypt|clave-/);
  });
});
