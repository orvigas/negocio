import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Database } from '@restaurante/db/client';
import { createUserRepository } from '@restaurante/db/user-repository';
import type { UserRepository } from '@restaurante/core/identity';

import { bootstrapAdmin } from '../../src/services/admin-bootstrap.ts';
import { makeRecordingLogger } from '../helpers.ts';
import { ADMIN_PASSWORD_HASH, ADMIN_USER } from '../support/admin.ts';
import { makeDatabase } from '../support/database.ts';

/** Primer administrador (REQ-F-007, D-4, D-13, R-4; CA-1 a CA-3). */

let prisma: Database;
let users: UserRepository;
let cleanup: () => Promise<void>;
const bootstrap = Object.freeze({ user: ADMIN_USER, passwordHash: ADMIN_PASSWORD_HASH });

beforeEach(async () => {
  ({ prisma, cleanup } = await makeDatabase());
  users = createUserRepository({ prisma });
});
afterEach(() => cleanup());

describe('bootstrapAdmin', () => {
  it('sin usuarios y con variables crea el administrador y lo registra (CA-1)', async () => {
    const logger = makeRecordingLogger();
    expect(await bootstrapAdmin({ users, bootstrap, logger })).toBe('created');
    const found = await users.findCredentials(ADMIN_USER);
    expect(found).toMatchObject({ user: { username: ADMIN_USER, displayName: ADMIN_USER, role: 'admin', active: true }, passwordHash: ADMIN_PASSWORD_HASH });
    expect(await prisma.userAudit.findMany({ select: { action: true, actorKind: true } })).toEqual([{ action: 'bootstrap', actorKind: 'system' }]);
    expect(logger.lines.map((line) => line.msg)).toEqual(['admin_bootstrap_created']);
  });

  it('con usuarios, otras variables se ignoran con un aviso sin valores (CA-2, D-13)', async () => {
    await bootstrapAdmin({ users, bootstrap, logger: makeRecordingLogger() });
    const before = await prisma.user.findMany();
    const logger = makeRecordingLogger();
    const other = { user: 'intruso', passwordHash: 'scrypt$16384$8$1$c2FsLXNhbC1zYWwtc2FsLQ$aGFzaGhhc2hoYXNoaGFzaGhhc2hoYXNoaGFzaGhhc2g' };
    expect(await bootstrapAdmin({ users, bootstrap: other, logger })).toBe('ignored');
    expect(await prisma.user.findMany()).toEqual(before);
    expect(logger.lines).toEqual([{ level: 'warn', msg: 'admin_bootstrap_ignored', reason: 'users_exist' }]);
    expect(JSON.stringify(logger.lines)).not.toContain('intruso');
    expect(JSON.stringify(logger.lines)).not.toContain('scrypt');
  });

  it('sin usuarios ni variables, la administración queda deshabilitada (CA-3)', async () => {
    const logger = makeRecordingLogger();
    expect(await bootstrapAdmin({ users, bootstrap: null, logger })).toBe('disabled');
    expect(await users.hasUsers()).toBe(false);
    expect(logger.lines).toEqual([{ level: 'warn', msg: 'admin_disabled', reason: 'no_users' }]);
  });

  it('con usuarios y sin variables no hace nada', async () => {
    await bootstrapAdmin({ users, bootstrap, logger: makeRecordingLogger() });
    const logger = makeRecordingLogger();
    expect(await bootstrapAdmin({ users, bootstrap: null, logger })).toBe('existing');
    expect(logger.lines).toEqual([]);
  });
});
