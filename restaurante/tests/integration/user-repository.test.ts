import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Database } from '../../src/db/client.ts';
import { DatabaseUnavailableError } from '../../src/db/errors.ts';
import {
  LastAdminError,
  UserNotFoundError,
  UsernameTakenError,
  createUserRepository,
  type UserRepository,
} from '../../src/repositories/user-repository.ts';
import { allowedBusinesses } from '../../src/services/authorization.ts';
import { ADMIN_PASSWORD_HASH } from '../support/admin.ts';
import { makeDatabase } from '../support/database.ts';

/** Reglas de los usuarios sobre SQLite real (REQ-F-007, D-6 a D-8, D-12, DT-7, DT-8 y DT-16). */

let prisma: Database;
let users: UserRepository;
let cleanup: () => Promise<void>;
const SYSTEM = { kind: 'system' } as const;

beforeEach(async () => {
  ({ prisma, cleanup } = await makeDatabase());
  users = createUserRepository({ prisma });
});
afterEach(() => cleanup());

const editor = (username: string, businesses: ('molotes' | 'birria')[] = ['molotes']) => ({
  username,
  displayName: username,
  role: 'editor' as const,
  businesses,
  passwordHash: ADMIN_PASSWORD_HASH,
});
const admin = (username: string) => ({ ...editor(username, []), role: 'admin' as const });

async function auditRows() {
  return prisma.userAudit.findMany({ orderBy: { id: 'asc' } });
}

describe('creación y búsqueda', () => {
  it('bootstrap solo crea el primer administrador si no hay usuarios (D-4)', async () => {
    expect(await users.hasUsers()).toBe(false);
    const first = await users.bootstrap({ username: 'Dueno', passwordHash: ADMIN_PASSWORD_HASH });
    expect(first).toMatchObject({ username: 'Dueno', displayName: 'Dueno', role: 'admin', active: true, businesses: [] });
    expect(await users.bootstrap({ username: 'otro', passwordHash: ADMIN_PASSWORD_HASH })).toBeNull();
    expect(await users.list()).toHaveLength(1);
    expect((await auditRows()).map((row) => [row.action, row.actorKind])).toEqual([['bootstrap', 'system']]);
  });

  it('el usuario es único sin distinguir mayúsculas (CA-9)', async () => {
    await users.create(editor('Ana'), SYSTEM);
    await expect(users.create(editor('ANA'), SYSTEM)).rejects.toBeInstanceOf(UsernameTakenError);
    expect(await users.findCredentials('  aNa ')).toMatchObject({ user: { username: 'Ana' }, passwordHash: ADMIN_PASSWORD_HASH });
  });

  it('allowedBusinesses: el administrador todos, el editor los suyos', async () => {
    const boss = await users.create(admin('jefa'), SYSTEM);
    const ana = await users.create(editor('ana', ['birria']), SYSTEM);
    expect(allowedBusinesses(boss)).toEqual(['molotes', 'birria']);
    expect(allowedBusinesses(ana)).toEqual(['birria']);
  });

  it('la auditoría registra la creación sin contraseñas ni hashes (D-12)', async () => {
    const actor = await users.create(admin('jefa'), SYSTEM);
    await users.create(editor('ana'), { kind: 'user', id: actor.id });
    const rows = await auditRows();
    expect(rows.at(-1)).toMatchObject({ action: 'create', actorId: actor.id, actorKind: 'user' });
    expect(JSON.parse(rows.at(-1)?.changes ?? '{}')).toEqual({
      username: { from: null, to: 'ana' },
      displayName: { from: null, to: 'ana' },
      role: { from: null, to: 'editor' },
      businesses: { from: null, to: ['molotes'] },
    });
    expect(JSON.stringify(rows)).not.toContain('scrypt$');
  });
});

describe('D-7: siempre queda un administrador activo', () => {
  it('rechaza desactivar o degradar al último administrador, también a sí mismo (CA-10)', async () => {
    const boss = await users.create(admin('jefa'), SYSTEM);
    const self = { kind: 'user', id: boss.id } as const;
    await expect(users.setActive(boss.id, false, self)).rejects.toBeInstanceOf(LastAdminError);
    await expect(users.update(boss.id, { ...editor('jefa'), displayName: 'Jefa' }, self)).rejects.toBeInstanceOf(LastAdminError);
    // Nada cambió: ni el usuario, ni sus negocios, ni la auditoría.
    expect(await users.findById(boss.id)).toMatchObject({ role: 'admin', active: true, sessionVersion: 0, businesses: [], displayName: 'jefa' });
    expect((await auditRows()).map((row) => row.action)).toEqual(['create']);
  });

  it('un administrador que no es el último sí puede desactivarse a sí mismo', async () => {
    const a = await users.create(admin('a'), SYSTEM);
    await users.create(admin('b'), SYSTEM);
    expect(await users.setActive(a.id, false, { kind: 'user', id: a.id })).toMatchObject({ active: false, sessionVersion: 1 });
  });

  it('dos desactivaciones simultáneas de los dos únicos administradores: solo una se aplica', async () => {
    const a = await users.create(admin('a'), SYSTEM);
    const b = await users.create(admin('b'), SYSTEM);
    const results = await Promise.allSettled([users.setActive(a.id, false, SYSTEM), users.setActive(b.id, false, SYSTEM)]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected').map((result) => result.reason)).toEqual([
      expect.any(LastAdminError),
    ]);
    expect(await prisma.user.count({ where: { role: 'admin', active: true } })).toBe(1);
  });
});

describe('D-8: sessionVersion', () => {
  it('cambia al desactivar, cambiar rol o negocios y cambiar la contraseña; no al cambiar el nombre', async () => {
    await users.create(admin('jefa'), SYSTEM);
    const ana = await users.create(editor('ana'), SYSTEM);
    const version = async () => (await users.findById(ana.id))?.sessionVersion;

    await users.update(ana.id, { username: 'ana', displayName: 'Ana L.', role: 'editor', businesses: ['molotes'] }, SYSTEM);
    expect(await version()).toBe(0);
    await users.update(ana.id, { username: 'ana', displayName: 'Ana L.', role: 'editor', businesses: ['molotes', 'birria'] }, SYSTEM);
    expect(await version()).toBe(1);
    await users.update(ana.id, { username: 'ana', displayName: 'Ana L.', role: 'admin', businesses: [] }, SYSTEM);
    expect(await version()).toBe(2);
    await users.setPassword(ana.id, ADMIN_PASSWORD_HASH, SYSTEM, 'password_reset');
    expect(await version()).toBe(3);
    await users.setActive(ana.id, false, SYSTEM);
    expect(await version()).toBe(4);

    const actions = (await auditRows()).map((row) => row.action);
    expect(actions).toEqual(['create', 'create', 'update', 'update', 'update', 'password_reset', 'deactivate']);
  });

  it('cambiar negocios guarda solo los nuevos', async () => {
    await users.create(admin('jefa'), SYSTEM);
    const ana = await users.create(editor('ana', ['molotes']), SYSTEM);
    const updated = await users.update(ana.id, { username: 'ana', displayName: 'ana', role: 'editor', businesses: ['birria'] }, SYSTEM);
    expect(updated.businesses).toEqual(['birria']);
    expect(await prisma.userBusiness.findMany({ select: { business: true } })).toEqual([{ business: 'birria' }]);
  });
});

describe('recuperación por consola (D-5)', () => {
  it('crea un administrador si el usuario no existe', async () => {
    const { user, created } = await users.recover({ username: 'nuevo', passwordHash: ADMIN_PASSWORD_HASH });
    expect(created).toBe(true);
    expect(user).toMatchObject({ role: 'admin', active: true });
    expect((await auditRows()).map((row) => [row.action, row.actorKind, row.actorId])).toEqual([['console_recovery', 'console', null]]);
  });

  it('reactiva, promueve y cambia la contraseña de un usuario existente', async () => {
    await users.create(admin('jefa'), SYSTEM);
    const ana = await users.create(editor('ana', ['birria']), SYSTEM);
    await users.setActive(ana.id, false, SYSTEM);
    const { user, created } = await users.recover({ username: 'ANA', passwordHash: 'scrypt$otro' });
    expect(created).toBe(false);
    expect(user).toMatchObject({ id: ana.id, role: 'admin', active: true, businesses: [], sessionVersion: 2 });
    expect(await users.findPasswordHash(ana.id)).toBe('scrypt$otro');
    const last = (await auditRows()).at(-1);
    expect(last?.action).toBe('console_recovery');
    expect(JSON.parse(last?.changes ?? '{}')).toEqual({
      role: { from: 'editor', to: 'admin' },
      businesses: { from: ['birria'], to: [] },
      active: { from: false, to: true },
    });
  });
});

describe('errores', () => {
  it('usuario inexistente -> UserNotFoundError', async () => {
    await expect(users.setActive(999, false, SYSTEM)).rejects.toBeInstanceOf(UserNotFoundError);
  });

  it('base de datos caída -> DatabaseUnavailableError sin mensaje técnico (DT-9)', async () => {
    await prisma.$executeRawUnsafe('DROP TABLE "user_audit"');
    const err: unknown = await users.create(editor('ana'), SYSTEM).catch((error: unknown) => error);
    expect(err).toBeInstanceOf(DatabaseUnavailableError);
    const unavailable = err as DatabaseUnavailableError;
    expect(unavailable.message).toBe('Base de datos no disponible');
    expect(unavailable.details.name).toBe('PrismaClientKnownRequestError');
    expect(JSON.stringify(unavailable.details)).not.toMatch(/\/|INSERT|SELECT/);
    // La transacción se revirtió: el usuario no quedó creado sin su auditoría.
    expect(await users.findCredentials('ana')).toBeNull();
  });
});
