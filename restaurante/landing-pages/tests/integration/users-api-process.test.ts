import { afterEach, describe, expect, it } from 'vitest';

import { ADMIN_USER, loginAs } from '../support/admin.ts';
import { P, startStack, ownerSession, runCleanups } from '../support/users-api-process.ts';

/**
 * Alta de usuarios de `/api/v1/admin` con el proceso real de la API contra MySQL (REQ-F-040): la
 * unicidad del usuario ante dos altas simultáneas la decide la base, no el doble de `api/tests`.
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
});
