import { describe, expect, it } from 'vitest';

import {
  SCRYPT_DEFAULTS,
  createUserAuthenticator,
  hashPassword,
  parsePasswordHash,
  safeEqualStrings,
  verifyPassword,
} from '@restaurante/core/identity';

import { ADMIN_PASSWORD, ADMIN_PASSWORD_HASH, ADMIN_USER } from '../support/admin.ts';

describe('hash de contraseña (DT-2)', () => {
  it('genera hashes scrypt con sal aleatoria y formato verificable', async () => {
    const options = { ...SCRYPT_DEFAULTS, N: 2 ** 14 };
    const a = await hashPassword('una-contraseña', options);
    const b = await hashPassword('una-contraseña', options);
    expect(a).toMatch(/^scrypt\$16384\$8\$1\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/);
    expect(a).not.toBe(b);
    expect(a).not.toContain('una-contraseña');
    expect(parsePasswordHash(a)).toMatchObject({ N: 16384, r: 8, p: 1 });
  });

  it.each([
    'texto-plano',
    'scrypt$16384$8$1$sal',
    'bcrypt$16384$8$1$c2FsLXNhbC1zYWwtc2FsLQ$aGFzaA',
    'scrypt$1000$8$1$c2FsLXNhbC1zYWwtc2FsLQ$aGFzaGhhc2hoYXNoaGFzaGhhc2hoYXNoaGFzaGhhc2g',
    'scrypt$16384$8$1$corta$aGFzaGhhc2hoYXNoaGFzaGhhc2hoYXNoaGFzaGhhc2g',
    'scrypt$16384$8$1$c2FsLXNhbC1zYWwtc2FsLQ$corto',
    'scrypt$16384$0$1$c2FsLXNhbC1zYWwtc2FsLQ$aGFzaGhhc2hoYXNoaGFzaGhhc2hoYXNoaGFzaGhhc2g',
  ])('rechaza el formato %s', (value) => {
    expect(parsePasswordHash(value)).toBeNull();
  });

  it('la sal admite de 16 a 64 bytes (REQ-F-014, P-3: el hash cabe en password_hash)', () => {
    const hash = Buffer.alloc(32, 1).toString('base64url');
    const withSalt = (bytes: number) => `scrypt$16384$8$1$${Buffer.alloc(bytes, 2).toString('base64url')}$${hash}`;
    expect(parsePasswordHash(withSalt(64))).not.toBeNull();
    expect(withSalt(64).length).toBeLessThanOrEqual(255);
    expect(parsePasswordHash(withSalt(65))).toBeNull();
  });

  it('rechaza una contraseña vacía al generar', async () => {
    await expect(hashPassword('')).rejects.toThrow(/vacía/);
  });
});

describe('verifyPassword', () => {
  it('acepta solo la contraseña del hash', async () => {
    expect(await verifyPassword(ADMIN_PASSWORD, ADMIN_PASSWORD_HASH)).toBe(true);
    expect(await verifyPassword(`${ADMIN_PASSWORD}x`, ADMIN_PASSWORD_HASH)).toBe(false);
    expect(await verifyPassword(undefined, ADMIN_PASSWORD_HASH)).toBe(false);
  });

  it('un hash mal formado nunca coincide', async () => {
    expect(await verifyPassword('plano', 'plano')).toBe(false);
  });

  it('safeEqualStrings compara contenido sin depender de la longitud', () => {
    expect(safeEqualStrings('abc', 'abc')).toBe(true);
    expect(safeEqualStrings('abc', 'abcd')).toBe(false);
  });
});

describe('createUserAuthenticator (REQ-F-007, R-6 y DT-10)', () => {
  const user = (active: boolean) => ({ id: 1, sessionVersion: 0, active });
  const source = (active: boolean, calls: string[] = []) => ({
    async findCredentials(username: string) {
      calls.push(username);
      return username.toLowerCase() === ADMIN_USER ? { user: user(active), passwordHash: ADMIN_PASSWORD_HASH } : null;
    },
  });
  const hashParams = { ...SCRYPT_DEFAULTS, N: 2 ** 14 };

  it('devuelve el usuario con la contraseña correcta', async () => {
    const authenticator = createUserAuthenticator({ users: source(true), hashParams });
    expect(await authenticator.authenticate(ADMIN_USER, ADMIN_PASSWORD)).toEqual(user(true));
    expect(await authenticator.authenticate(ADMIN_USER.toUpperCase(), ADMIN_PASSWORD)).toEqual(user(true));
  });

  it('cuenta inexistente, contraseña incorrecta, cuenta desactivada o datos vacíos -> null', async () => {
    const active = createUserAuthenticator({ users: source(true), hashParams });
    const inactive = createUserAuthenticator({ users: source(false), hashParams });
    expect(await active.authenticate('otro', ADMIN_PASSWORD)).toBeNull();
    expect(await active.authenticate(ADMIN_USER, `${ADMIN_PASSWORD}x`)).toBeNull();
    expect(await inactive.authenticate(ADMIN_USER, ADMIN_PASSWORD)).toBeNull();
    expect(await active.authenticate(undefined, undefined)).toBeNull();
  });

  it('calcula el hash ficticio al crearse (al arrancar), una sola vez, y no en el primer acceso (DEF-002, DT-10)', async () => {
    const calls: unknown[] = [];
    const hash: typeof hashPassword = (password, params) => {
      calls.push(params);
      return hashPassword(password, params);
    };
    const authenticator = createUserAuthenticator({ users: source(true), hashParams, hash });
    // Antes de cualquier acceso ya se pidió el hash ficticio, con el costo configurado.
    expect(calls).toEqual([hashParams]);
    expect(await authenticator.authenticate('nadie', ADMIN_PASSWORD)).toBeNull();
    expect(await authenticator.authenticate('otra-persona', ADMIN_PASSWORD)).toBeNull();
    expect(calls).toHaveLength(1);
  });

  it('no consulta la base de datos con un usuario vacío', async () => {
    const calls: string[] = [];
    const authenticator = createUserAuthenticator({ users: source(true, calls), hashParams });
    expect(await authenticator.authenticate('   ', ADMIN_PASSWORD)).toBeNull();
    expect(calls).toEqual([]);
  });
});
