import { afterEach, describe, expect, it } from 'vitest';

import { userResponseSchema } from '@restaurante/contracts';

import { USER_PASSWORD, createUser } from '../support/admin.ts';
import { P, REPETITIONS, startStack, ownerSession, errorOf, runCleanups } from '../support/users-api-qa-req-f-040.ts';

/**
 * QA de REQ-F-040 (PR 1): usuarios y cuenta propia de `/api/v1/admin` con el proceso real de la API
 * contra MySQL, en los casos que no cubren `admin-users-api.test.ts` ni `users-api-process.test.ts`:
 *
 * - escalada de privilegios de un editor y sesiones que pierden privilegios a mitad (R-2, CA-1, CA-8);
 * - claves especiales del JSON, tipos inválidos, límites de contraseña y de cuerpo, y métodos no previstos;
 * - edición simultánea: gana la última y cada una queda auditada (RF-9);
 * - D-7 por caminos distintos de dos desactivaciones: degradación mutua y degradarse a sí mismo mientras
 *   el otro administrador se desactiva (CA-6, R-1).
 *
 * Como `users-api-process.test.ts`, arranca la API como proceso hijo (puertos con `freePorts`) sin
 * importar código de `api/`, sobre la base de `setupAdmin()`.
 *
 * REQ-F-041: parte de users-api-qa-req-f-040.test.ts (preparación en
 * tests/support/users-api-qa-req-f-040.ts).
 */

afterEach(runCleanups);

describe('seguridad (R-2, CA-1 y CA-8)', () => {
  it('un editor no se da privilegios: ni por usuarios (403) ni por "Mi cuenta" (422), tampoco con __proto__ o constructor', async () => {
    const stack = await startStack();
    const eli = await createUser(stack.context.users, { username: 'eli' });
    const eliApi = await stack.apiSession('eli');
    const before = await stack.snapshot();

    const promote = await stack.apiCall(`${P}/usuarios/${eli.id}`, eliApi, {
      method: 'PUT',
      body: { username: 'eli', displayName: 'eli', role: 'admin', businesses: [] },
    });
    expect(promote.status).toBe(403);
    expect(await errorOf(promote)).toMatchObject({ code: 'FORBIDDEN_ROLE' });

    const pair = { currentPassword: USER_PASSWORD, password: 'una-nueva-de-12-o-mas', passwordConfirmation: 'una-nueva-de-12-o-mas' };
    for (const extra of [{ role: 'admin' }, { businesses: ['birria'] }, { id: 1 }, { userId: 1 }]) {
      const res = await stack.apiCall(`${P}/cuenta/contrasena`, eliApi, { method: 'POST', body: { ...pair, ...extra } });
      expect(res.status).toBe(422);
      expect((await errorOf(res)).fields).toEqual({ [Object.keys(extra)[0] as string]: 'Campo desconocido.' });
    }
    for (const key of ['__proto__', 'constructor']) {
      const raw = `{"${key}":{"role":"admin"},"currentPassword":"${USER_PASSWORD}","password":"${pair.password}","passwordConfirmation":"${pair.password}"}`;
      const res = await stack.apiCall(`${P}/cuenta/contrasena`, eliApi, { method: 'POST', raw });
      expect(res.status).toBe(422);
      expect((await errorOf(res)).fields).toEqual({ [key]: 'Campo desconocido.' });
    }
    expect(await stack.snapshot()).toEqual(before);
    // Su sesión sigue valiendo (nada cambió) y sigue siendo editor.
    const me = await stack.apiCall(`${P}/sesion`, eliApi);
    expect(me.status).toBe(200);
    expect(JSON.stringify(await me.json())).toContain('"role":"editor"');
  }, 120_000);

  it('una sesión que pierde privilegios a mitad: degradado o desactivado, su Bearer da 401 en usuarios y en "Mi cuenta"', async () => {
    const stack = await startStack();
    const owner = await ownerSession(stack);
    const beto = await createUser(stack.context.users, { username: 'beto', role: 'admin' });
    const eli = await createUser(stack.context.users, { username: 'eli' });
    const [betoApi, eliApi] = await Promise.all([stack.apiSession('beto'), stack.apiSession('eli')]);
    expect((await stack.apiCall(`${P}/usuarios`, betoApi)).status).toBe(200);

    const demoted = await stack.apiCall(`${P}/usuarios/${beto.id}`, owner, {
      method: 'PUT',
      body: { username: 'beto', displayName: 'beto', role: 'editor', businesses: ['molotes'] },
    });
    expect(demoted.status).toBe(200);
    expect((await stack.apiCall(`${P}/usuarios`, betoApi)).status).toBe(401);
    expect((await stack.apiCall(`${P}/usuarios/${eli.id}/desactivar`, betoApi, { method: 'POST', body: {} })).status).toBe(401);

    expect((await stack.apiCall(`${P}/usuarios/${eli.id}/desactivar`, owner, { method: 'POST', body: {} })).status).toBe(200);
    const hashBefore = (await stack.context.prisma.user.findUnique({ where: { id: eli.id } }))?.passwordHash;
    const change = await stack.apiCall(`${P}/cuenta/contrasena`, eliApi, {
      method: 'POST',
      body: { currentPassword: USER_PASSWORD, password: 'otra-contrasena-larga', passwordConfirmation: 'otra-contrasena-larga' },
    });
    expect(change.status).toBe(401);
    expect((await stack.context.prisma.user.findUnique({ where: { id: eli.id } }))?.passwordHash).toBe(hashBefore);
    expect(await stack.context.prisma.userAudit.count({ where: { targetId: eli.id, action: 'password_change' } })).toBe(0);
  }, 120_000);

  it('métodos no previstos y cabeceras: DELETE/PATCH dan 405 sin borrar; HEAD de un editor sin datos; los errores llevan no-store y nosniff', async () => {
    const stack = await startStack();
    const owner = await ownerSession(stack);
    const eli = await createUser(stack.context.users, { username: 'eli' });
    const eliApi = await stack.apiSession('eli');
    const before = await stack.snapshot();

    for (const method of ['DELETE', 'PATCH']) {
      const res = await stack.apiCall(`${P}/usuarios/${eli.id}`, owner, { method, body: {} });
      expect(res.status, method).toBe(405);
      expect(res.headers.get('allow')).toMatch(/GET/);
    }
    const head = await stack.apiCall(`${P}/usuarios`, eliApi, { method: 'HEAD' });
    expect(head.status).toBe(403);
    expect(await head.text()).toBe('');
    expect(await stack.snapshot()).toEqual(before);

    const errors = [
      await fetch(`${stack.api.url}${P}/usuarios`),
      await stack.apiCall(`${P}/usuarios`, eliApi),
      await stack.apiCall(`${P}/usuarios/999`, owner),
      await stack.apiCall(`${P}/usuarios`, owner, { method: 'POST', body: { nope: 1 } }),
      await stack.apiCall(`${P}/usuarios/${eli.id}`, owner, { method: 'DELETE' }),
    ];
    expect(errors.map((res) => res.status)).toEqual([401, 403, 404, 422, 405]);
    for (const res of errors) {
      expect(res.headers.get('cache-control')).toBe('no-store');
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      const text = await res.text();
      expect(text).not.toMatch(/stack|at .*\.ts|prisma|scrypt/i);
      expect(JSON.parse(text)).toHaveProperty('error.code');
    }
  }, 120_000);
});

describe('validación y edición simultánea (RF-4, RF-7 y RF-9)', () => {
  it('tipos inválidos, negocios, longitudes de contraseña y límite del cuerpo de estado', async () => {
    const stack = await startStack();
    const owner = await ownerSession(stack);
    const base = { username: 'nora', displayName: 'Nora', role: 'editor', businesses: ['molotes'], password: 'p'.repeat(12), passwordConfirmation: 'p'.repeat(12) };
    const create = (body: unknown) => stack.apiCall(`${P}/usuarios`, owner, { method: 'POST', body });
    const before = await stack.snapshot();

    for (const [patch, field] of [
      [{ username: 123 }, 'username'],
      [{ username: null }, 'username'],
      [{ displayName: ['x'] }, 'displayName'],
      [{ role: 'superadmin' }, 'role'],
      [{ businesses: 'molotes' }, 'businesses'],
      [{ businesses: ['tacos'] }, 'businesses'],
      [{ businesses: [] }, 'businesses'],
      [{ password: 'p'.repeat(257), passwordConfirmation: 'p'.repeat(257) }, 'password'],
      [{ password: 12_345_678_901_234 }, 'password'],
    ] as const) {
      const res = await create({ ...base, ...patch });
      expect(res.status, JSON.stringify(patch)).toBe(422);
      expect(Object.keys((await errorOf(res)).fields ?? {}), JSON.stringify(patch)).toContain(field);
    }
    expect(await stack.snapshot()).toEqual(before);

    // 256 caracteres y negocios repetidos: se acepta, con el negocio una sola vez.
    const long = 'ü'.repeat(256);
    const created = await create({ ...base, businesses: ['molotes', 'molotes'], password: long, passwordConfirmation: long });
    expect(created.status).toBe(201);
    const { user } = userResponseSchema.parse(await created.json());
    expect(user.businesses).toEqual(['molotes']);
    expect((await stack.apiSession('nora', long)).id).toMatch(/\S/);

    // Desactivar con un cuerpo de más de 4 KiB: 413 y nada cambia.
    const big = `{${' '.repeat(5 * 1024)}}`;
    const res = await stack.apiCall(`${P}/usuarios/${user.id}/desactivar`, owner, { method: 'POST', raw: big });
    expect(res.status).toBe(413);
    expect((await stack.context.prisma.user.findUnique({ where: { id: user.id } }))?.active).toBe(true);

    // Ninguna entrada de auditoría lleva hashes ni contraseñas.
    for (const entry of await stack.context.prisma.userAudit.findMany()) {
      expect(entry.changes ?? '').not.toMatch(/scrypt|password|ü{12}|p{12}/);
    }
  }, 120_000);

  it(`edición simultánea del mismo usuario, ${REPETITIONS} veces: las dos se guardan, gana una de ellas y cada una queda auditada`, async () => {
    const stack = await startStack();
    const owner = await ownerSession(stack);
    const eli = await createUser(stack.context.users, { username: 'eli', displayName: 'Eli' });
    const edit = (displayName: string) =>
      stack.apiCall(`${P}/usuarios/${eli.id}`, owner, { method: 'PUT', body: { username: 'eli', displayName, role: 'editor', businesses: ['molotes'] } });
    for (let round = 0; round < REPETITIONS; round += 1) {
      const auditBefore = await stack.context.prisma.userAudit.count({ where: { targetId: eli.id, action: 'update' } });
      const names = [`Eli A${round}`, `Eli B${round}`];
      const responses = await Promise.all(names.map(edit));
      expect(responses.map((res) => res.status)).toEqual([200, 200]);
      const stored = (await stack.context.prisma.user.findUnique({ where: { id: eli.id } }))?.displayName;
      expect(names).toContain(stored);
      expect(await stack.context.prisma.userAudit.count({ where: { targetId: eli.id, action: 'update' } })).toBe(auditBefore + 2);
    }
  }, 180_000);
});
