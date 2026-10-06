import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.ts';
import { hashPassword } from '../../src/services/admin-auth.ts';
import { makeConfig, makeRecordingLogger } from '../helpers.ts';
import { ADMIN_PASSWORD, ADMIN_USER, TEST_HASH_PARAMS, login, setupAdmin } from '../support/admin.ts';
import { listenLocal } from '../support/http.ts';

/** Acceso con cuentas personales (REQ-F-007, R-4, R-6, D-4, D-8, D-13 y DT-7 a DT-11). */

const NO_BOOTSTRAP = Object.freeze({ ADMIN_USER: '', ADMIN_PASSWORD_HASH: '' });

describe('primer administrador (CA-1)', () => {
  it('entra con la contraseña de siempre y queda registrado su último acceso', async () => {
    const { browser, users, clock } = await setupAdmin();
    const res = await login(browser());
    expect(res.status).toBe(303);
    const found = await users.findCredentials(ADMIN_USER);
    expect(found?.user.lastLoginAt?.getTime()).toBe(clock.now().getTime());
  });

  it('el usuario no distingue mayúsculas ni espacios alrededor', async () => {
    const { browser } = await setupAdmin();
    expect((await login(browser(), { username: `  ${ADMIN_USER.toUpperCase()} ` })).status).toBe(303);
  });
});

describe('credenciales del entorno con usuarios existentes (CA-2)', () => {
  it('no crean ni cambian usuarios, no permiten entrar y dejan el aviso sin valores', async () => {
    const first = await setupAdmin();
    const before = await first.prisma.user.findMany();

    const otherPassword = 'otra-clave-del-entorno-123';
    const otherHash = await hashPassword(otherPassword, TEST_HASH_PARAMS);
    const logger = makeRecordingLogger();
    const { bootstrapAdmin } = await import('../../src/services/admin-bootstrap.ts');
    const config = makeConfig({ ADMIN_USER: 'intruso', ADMIN_PASSWORD_HASH: otherHash });
    await bootstrapAdmin({ users: first.users, bootstrap: config.adminBootstrap, logger });
    const app = createApp({ config, repository: first.repository, users: first.users, hashParams: TEST_HASH_PARAMS, logger });

    expect(await first.prisma.user.findMany()).toEqual(before);
    const res = await login((await listenLocal(app)).browser(), { username: 'intruso', password: otherPassword });
    expect(res.status).toBe(401);
    expect(logger.lines.find((line) => line.msg === 'admin_bootstrap_ignored')).toEqual({
      level: 'warn',
      msg: 'admin_bootstrap_ignored',
      reason: 'users_exist',
    });
    const logged = JSON.stringify(logger.lines);
    expect(logged).not.toContain('intruso');
    expect(logged).not.toContain(otherHash);
    expect(logged).not.toContain(otherPassword);
  });
});

describe('sin usuarios ni variables (CA-3 y DT-11)', () => {
  it('/admin responde 503 y las landings 200', async () => {
    const { request: client } = await setupAdmin({ env: NO_BOOTSTRAP });
    for (const path of ['/admin', '/admin/login', '/admin/molotes']) {
      const res = await client().get(path);
      expect(res.status).toBe(503);
      expect(res.body).toEqual({ error: { code: 'ADMIN_UNAVAILABLE', message: 'Administración no disponible' } });
    }
    for (const path of ['/', '/molotes', '/birria']) expect((await client().get(path)).status).toBe(200);
  });

  it('se habilita sin reiniciar cuando el comando de recuperación crea el primer usuario', async () => {
    const { request: client, users, browser } = await setupAdmin({ env: NO_BOOTSTRAP });
    expect((await client().get('/admin/login')).status).toBe(503);
    const passwordHash = await hashPassword('clave-recuperada-123', TEST_HASH_PARAMS);
    await users.recover({ username: 'dueno', passwordHash });
    expect((await client().get('/admin/login')).status).toBe(200);
    expect((await login(browser(), { username: 'dueno', password: 'clave-recuperada-123' })).status).toBe(303);
  });
});

describe('cuentas desactivadas y sesiones revocadas (R-6, D-8)', () => {
  it('una cuenta desactivada ve el mismo mensaje que con credenciales incorrectas (CA-12)', async () => {
    const { browser, users } = await setupAdmin();
    const password = 'clave-de-ana-12345';
    await users.create(
      { username: 'ana', displayName: 'Ana', role: 'editor', businesses: ['molotes'], passwordHash: await hashPassword(password, TEST_HASH_PARAMS) },
      { kind: 'system' },
    );
    const ana = await users.findCredentials('ana');
    await users.setActive(ana!.user.id, false, { kind: 'system' });

    const disabled = await login(browser(), { username: 'ana', password });
    const wrong = await login(browser(), { username: 'ana', password: 'otra-clave-123456' });
    const unknown = await login(browser(), { username: 'nadie', password });
    for (const res of [disabled, wrong, unknown]) {
      expect(res.status).toBe(401);
      expect(res.text).toContain('Usuario o contraseña incorrectos.');
    }
    // Misma página, byte a byte: no revela si la cuenta existe o está desactivada.
    expect(disabled.text).toBe(wrong.text);
    expect(unknown.text).toBe(wrong.text);

    await users.setActive(ana!.user.id, true, { kind: 'system' });
    expect((await login(browser(), { username: 'ana', password })).status).toBe(303);
  });

  it('si cambia la sessionVersion del usuario, su siguiente petición pide acceso de nuevo (DT-7)', async () => {
    const { browser, users } = await setupAdmin();
    const client = browser();
    await login(client);
    expect((await client.get('/admin/molotes')).status).toBe(200);

    const owner = await users.findCredentials(ADMIN_USER);
    await users.setPassword(owner!.user.id, owner!.passwordHash, { kind: 'console' }, 'password_reset');
    const res = await client.get('/admin/molotes');
    expect(res.status).toBe(303);
    expect(res.headers.location).toMatch(/^\/admin\/login/);
    // La sesión vieja ya no existe: aunque se vuelva a intentar, sigue pidiendo acceso.
    expect((await client.get('/admin/molotes')).status).toBe(303);
    // Con la contraseña (sin cambios en esta prueba) puede volver a entrar.
    expect((await login(client, { password: ADMIN_PASSWORD })).status).toBe(303);
    expect((await client.get('/admin/molotes')).status).toBe(200);
  });
});
