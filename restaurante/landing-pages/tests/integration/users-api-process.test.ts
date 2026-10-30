import { afterEach, describe, expect, it } from 'vitest';

import { passwordChangeResponseSchema, userWriteResponseSchema } from '@restaurante/contracts';
import { LAST_ADMIN_MESSAGE } from '@restaurante/core/identity';

import { ADMIN_PASSWORD, ADMIN_USER, USER_PASSWORD, createUser, csrfFrom, login, loginAs, type Browser } from '../support/admin.ts';
import { P, NEW_PASSWORD, type ApiSession, startStack, ownerSession, runCleanups } from '../support/users-api-process.ts';

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

describe('reglas reales del repositorio por la API', () => {
  it('crear: auditoría `create` con el actor y sin hash; repetido con otras mayúsculas y doble envío dan 422; multibyte; último acceso en la zona del negocio', async () => {
    const stack = await startStack();
    const owner = await ownerSession(stack);
    const ownerId = (await stack.context.users.findCredentials(ADMIN_USER))?.user.id;
    const multibyte = 'ñandú-güero!';
    const input = { username: 'Nora', displayName: 'Nora Nueva', role: 'editor', businesses: ['birria'], password: multibyte, passwordConfirmation: multibyte };

    // Doble envío: dos altas iguales a la vez; una sola cuenta.
    const results = await Promise.all([1, 2].map(() => stack.apiCall(`${P}/usuarios`, owner, { method: 'POST', body: input })));
    expect(results.map((res) => res.status).sort()).toEqual([201, 422]);
    const repeated = await stack.apiCall(`${P}/usuarios`, owner, { method: 'POST', body: { ...input, username: 'NORA' } });
    expect(repeated.status).toBe(422);
    expect(Object.keys((await repeated.json()).error.fields)).toEqual(['username']);

    const stored = await stack.context.prisma.user.findMany({ where: { usernameKey: 'nora' } });
    expect(stored).toHaveLength(1);
    const entries = await stack.context.prisma.userAudit.findMany({ where: { action: 'create', targetId: stored[0]?.id } });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ actorKind: 'user', actorId: ownerId });
    expect(entries[0]?.changes).not.toMatch(/scrypt|password|ñandú/);

    // 12 caracteres y más de 12 bytes: la contraseña se aceptó y sirve en los dos admins.
    expect((await stack.apiLogin('nora', multibyte)).status).toBe(201);
    await loginAs(stack.context.browser(), 'nora', multibyte);

    const list = (await (await stack.apiCall(`${P}/usuarios`, owner)).json()) as { users: { username: string; lastLoginAt: string | null }[] };
    const nora = list.users.find((user) => user.username === 'Nora');
    expect(nora?.lastLoginAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-0[56]:00$/);
  }, 120_000);

  it('último administrador: desactivarse o pasarse a editor da 409 y no cambia ni la tabla ni la auditoría', async () => {
    const stack = await startStack();
    const owner = await ownerSession(stack);
    const ownerId = (await stack.context.users.findCredentials(ADMIN_USER))?.user.id as number;
    const before = { users: await stack.context.prisma.user.findMany({ include: { businesses: true } }), audit: await stack.context.prisma.userAudit.count() };
    for (const [method, path, body] of [
      ['POST', `${P}/usuarios/${ownerId}/desactivar`, {}],
      ['PUT', `${P}/usuarios/${ownerId}`, { username: ADMIN_USER, displayName: ADMIN_USER, role: 'editor', businesses: ['molotes'] }],
    ] as const) {
      const res = await stack.apiCall(path, owner, { method, body });
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: { code: 'LAST_ADMIN', message: LAST_ADMIN_MESSAGE } });
    }
    expect({ users: await stack.context.prisma.user.findMany({ include: { businesses: true } }), audit: await stack.context.prisma.userAudit.count() }).toEqual(before);
    expect(await stack.apiStatus(owner)).toBe(200);
  }, 120_000);
});

describe('sesiones entre los dos admins (D-8)', () => {
  it('negocios, nombre, desactivar, reactivar y restablecer desde la API: las sesiones de los dos admins caen cuando deben', async () => {
    const stack = await startStack();
    const owner = await ownerSession(stack);
    const eli = await createUser(stack.context.users, { username: 'eli', displayName: 'Eli' });
    const path = `${P}/usuarios/${eli.id}`;
    const open = async (password = USER_PASSWORD) => ({ api: await stack.apiSession('eli', password), landing: await loginAs(stack.context.browser(), 'eli', password) });
    const expectOpen = async (sessions: { api: ApiSession; landing: Browser }, open: boolean) => {
      expect(await stack.apiStatus(sessions.api)).toBe(open ? 200 : 401);
      expect(await stack.landingStatus(sessions.landing)).toBe(open ? 200 : 303);
    };

    // Solo el nombre visible: no se cierran.
    let sessions = await open();
    const renamed = await stack.apiCall(path, owner, { method: 'PUT', body: { username: 'eli', displayName: 'Eli Renombrada', role: 'editor', businesses: ['molotes'] } });
    expect(userWriteResponseSchema.parse(await renamed.json()).meta.ownSessionClosed).toBe(false);
    await expectOpen(sessions, true);

    // Los negocios: se cierran en los dos.
    expect((await stack.apiCall(path, owner, { method: 'PUT', body: { username: 'eli', displayName: 'Eli Renombrada', role: 'editor', businesses: ['molotes', 'birria'] } })).status).toBe(200);
    await expectOpen(sessions, false);

    // Desactivar: se cierran y no puede entrar en ninguno; reactivar: vuelve a entrar.
    sessions = await open();
    expect((await stack.apiCall(`${path}/desactivar`, owner, { method: 'POST', body: {} })).status).toBe(200);
    await expectOpen(sessions, false);
    expect((await stack.apiLogin('eli', USER_PASSWORD)).status).toBe(401);
    expect((await login(stack.context.browser(), { username: 'eli', password: USER_PASSWORD })).status).not.toBe(303);
    expect((await stack.apiCall(`${path}/reactivar`, owner, { method: 'POST', body: {} })).status).toBe(200);

    // Restablecer: se cierran, la anterior deja de valer y la nueva sirve en los dos.
    sessions = await open();
    expect((await stack.apiCall(`${path}/contrasena`, owner, { method: 'PUT', body: { password: NEW_PASSWORD, passwordConfirmation: NEW_PASSWORD } })).status).toBe(200);
    await expectOpen(sessions, false);
    expect((await stack.apiLogin('eli', USER_PASSWORD)).status).toBe(401);
    await expectOpen(await open(NEW_PASSWORD), true);

    const actions = (await stack.audit()).filter((entry) => entry.targetId === eli.id).map((entry) => [entry.action, entry.changes === null ? null : Object.keys(JSON.parse(entry.changes) as object)]);
    expect(actions).toEqual([
      ['create', ['username', 'displayName', 'role', 'businesses']],
      ['update', ['displayName']],
      ['update', ['businesses']],
      ['deactivate', ['active']],
      ['reactivate', ['active']],
      ['password_reset', null],
    ]);
  }, 120_000);

  it('en sentido inverso: un cambio desde el /admin actual (sin ADMIN_NEW_URL) invalida la sesión de la API', async () => {
    const stack = await startStack();
    const eli = await createUser(stack.context.users, { username: 'eli' });
    const eliApi = await stack.apiSession('eli');
    const owner = await loginAs(stack.context.browser(), ADMIN_USER, ADMIN_PASSWORD);
    const page = await owner.get(`/admin/usuarios/${eli.id}`);
    const res = await owner
      .post(`/admin/usuarios/${eli.id}`)
      .type('form')
      .send({ _csrf: csrfFrom(page.text), username: 'eli', displayName: 'eli', role: 'editor', 'business-birria': 'on' });
    expect(res.status).toBe(303);
    expect(await stack.apiStatus(eliApi)).toBe(401);
  }, 120_000);

  it('"Mi cuenta" por la API: la sesión nueva sirve, las demás (también la del /admin actual) caen y queda `password_change`', async () => {
    const stack = await startStack();
    const eli = await createUser(stack.context.users, { username: 'eli' });
    const eliApi = await stack.apiSession('eli');
    const eliLanding = await loginAs(stack.context.browser(), 'eli');
    const res = await stack.apiCall(`${P}/cuenta/contrasena`, eliApi, {
      method: 'POST',
      body: { currentPassword: USER_PASSWORD, password: NEW_PASSWORD, passwordConfirmation: NEW_PASSWORD },
    });
    expect(res.status).toBe(200);
    const fresh = passwordChangeResponseSchema.parse(await res.json()).session;
    expect(await stack.apiStatus(fresh)).toBe(200);
    expect(await stack.apiStatus(eliApi)).toBe(401);
    expect(await stack.landingStatus(eliLanding)).toBe(303);
    await loginAs(stack.context.browser(), 'eli', NEW_PASSWORD);
    const entries = (await stack.audit()).filter((entry) => entry.targetId === eli.id && entry.action === 'password_change');
    expect(entries).toEqual([expect.objectContaining({ actorKind: 'user', actorId: eli.id, changes: null })]);

    // CA-12: ningún log de la API contiene contraseñas, hashes, ids de sesión ni tokens CSRF.
    await expect.poll(() => stack.api.output().stdout, { timeout: 10_000 }).toContain('"msg":"admin_password_changed"');
    const { stdout, stderr } = stack.api.output();
    for (const secret of [USER_PASSWORD, NEW_PASSWORD, 'scrypt$', eliApi.id, eliApi.csrfToken, fresh.id, fresh.csrfToken]) {
      expect(stdout + stderr).not.toContain(secret);
    }
  }, 120_000);
});
