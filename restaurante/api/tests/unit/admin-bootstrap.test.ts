import { describe, expect, it } from 'vitest';

import { createMemoryPageStore, createMemoryProductStore, createProductRepository } from '@restaurante/core/catalog';
import type { UserRecord, UserRepository } from '@restaurante/core/identity';

import { bootstrapAdmin } from '../../src/install/admin-bootstrap.ts';
import { InstallationError, prepareInstallation } from '../../src/install/index.ts';
import { makeRecordingLogger } from '../helpers.ts';

/**
 * Primer administrador (REQ-F-007, D-4, D-13, R-4; CA-1 a CA-3) y preparación de una instalación
 * existente (REQ-F-045, CA-7). En la api desde REQ-F-045, con un doble en memoria: la transacción real de
 * `bootstrap` la cubre user-repository.test.ts (MySQL) en landing-pages.
 */

const ADMIN_USER = 'dueno';
const ADMIN_PASSWORD_HASH = 'scrypt$16384$8$1$c2FsLXNhbC1zYWwtc2FsLQ$aGFzaGhhc2hoYXNoaGFzaGhhc2hoYXNoaGFzaGhhc2g';
const bootstrap = Object.freeze({ user: ADMIN_USER, passwordHash: ADMIN_PASSWORD_HASH });

/** Doble de `hasUsers` y `bootstrap`: crea el administrador solo si no hay usuarios. */
function fakeUsers() {
  const created: { username: string; passwordHash: string }[] = [];
  const users: Pick<UserRepository, 'hasUsers' | 'bootstrap'> = {
    hasUsers: async () => created.length > 0,
    async bootstrap(data) {
      if (created.length > 0) return null;
      created.push(data);
      const at = new Date('2026-11-16T18:00:00Z');
      return { id: created.length, username: data.username, displayName: data.username, role: 'admin', active: true, sessionVersion: 1, businesses: [], createdAt: at, updatedAt: at, lastLoginAt: null } satisfies UserRecord;
    },
  };
  return { users, created };
}

describe('bootstrapAdmin', () => {
  it('sin usuarios y con variables crea el administrador y lo registra (CA-1)', async () => {
    const { users, created } = fakeUsers();
    const logger = makeRecordingLogger();
    expect(await bootstrapAdmin({ users, bootstrap, logger })).toBe('created');
    expect(created).toEqual([{ username: ADMIN_USER, passwordHash: ADMIN_PASSWORD_HASH }]);
    expect(logger.lines.map((line) => line.msg)).toEqual(['admin_bootstrap_created']);
  });

  it('con usuarios, otras variables se ignoran con un aviso sin valores (CA-2, D-13)', async () => {
    const { users, created } = fakeUsers();
    await bootstrapAdmin({ users, bootstrap, logger: makeRecordingLogger() });
    const logger = makeRecordingLogger();
    const other = { user: 'intruso', passwordHash: ADMIN_PASSWORD_HASH.replace('c2Fs', 'b3Ry') };
    expect(await bootstrapAdmin({ users, bootstrap: other, logger })).toBe('ignored');
    expect(created).toHaveLength(1);
    expect(logger.lines).toEqual([{ level: 'warn', msg: 'admin_bootstrap_ignored', reason: 'users_exist' }]);
    expect(JSON.stringify(logger.lines)).not.toContain('intruso');
    expect(JSON.stringify(logger.lines)).not.toContain('scrypt');
  });

  it('sin usuarios ni variables, nadie puede entrar hasta usar admin:recover (CA-3)', async () => {
    const { users } = fakeUsers();
    const logger = makeRecordingLogger();
    expect(await bootstrapAdmin({ users, bootstrap: null, logger })).toBe('disabled');
    expect(await users.hasUsers()).toBe(false);
    expect(logger.lines).toEqual([{ level: 'warn', msg: 'admin_disabled', reason: 'no_users' }]);
  });

  it('con usuarios y sin variables no hace nada', async () => {
    const { users } = fakeUsers();
    await bootstrapAdmin({ users, bootstrap, logger: makeRecordingLogger() });
    const logger = makeRecordingLogger();
    expect(await bootstrapAdmin({ users, bootstrap: null, logger })).toBe('existing');
    expect(logger.lines).toEqual([]);
  });
});

describe('prepareInstallation en una instalación existente (REQ-F-045, CA-7)', () => {
  it('no importa la semilla, no crea la página que falta ni usuarios: solo carga la caché', async () => {
    const productStore = createMemoryProductStore();
    const pageStore = createMemoryPageStore();
    // `product_import` con filas al arrancar (D-10), sin filas de página ni usuarios nuevos.
    pageStore.state.productImports = true;
    const { users, created } = fakeUsers();
    await bootstrapAdmin({ users, bootstrap, logger: makeRecordingLogger() });
    const products = createProductRepository({ store: productStore, imageExists: async () => true });
    const logger = makeRecordingLogger();

    expect(await prepareInstallation({ users, products, pageStore, bootstrap, logger })).toEqual({ existing: true, admin: 'ignored' });
    expect(productStore.state.products).toEqual([]);
    expect(productStore.state.imports.size).toBe(0);
    expect(pageStore.state.pages.size).toBe(0);
    expect(pageStore.state.imports.size).toBe(0);
    expect(created).toHaveLength(1);
    expect(products.getPublished('birria').menu).toEqual([]);
    expect(logger.lines.map((line) => line.msg)).toEqual(['admin_bootstrap_ignored']);
  });
});

describe('prepareInstallation con la semilla ilegible (REQ-F-045, DEF-002)', () => {
  it('termina como un paso más: InstallationError con solo códigos, sin la ruta ni el mensaje original', async () => {
    const pageStore = createMemoryPageStore();
    const products = createProductRepository({ store: createMemoryProductStore(), imageExists: async () => true });
    const unreadable = (): never => {
      throw Object.assign(new Error('ENOENT: no such file, open /app/packages/core/catalog/seeds/molotes.json'), { code: 'ENOENT' });
    };

    const error = await prepareInstallation({ users: fakeUsers().users, products, pageStore, bootstrap, logger: makeRecordingLogger(), seeds: unreadable }).catch((err: unknown) => err);
    expect(error).toBeInstanceOf(InstallationError);
    expect(error).toMatchObject({ step: 'seed', event: 'install_seed_invalid', fields: { name: 'Error', code: 'ENOENT' } });
    expect(JSON.stringify((error as InstallationError).fields) + (error as InstallationError).message).not.toMatch(/seeds\/|no such file/);
    expect(pageStore.state.imports.size).toBe(0);
  });
});
