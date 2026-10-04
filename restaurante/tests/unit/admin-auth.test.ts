import { describe, expect, it } from 'vitest';

import { SCRYPT_DEFAULTS, createAdminAuthenticator, hashPassword, parsePasswordHash, safeEqualStrings } from '../../src/services/admin-auth.ts';
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

  it('rechaza una contraseña vacía al generar', async () => {
    await expect(hashPassword('')).rejects.toThrow(/vacía/);
  });
});

describe('createAdminAuthenticator', () => {
  const authenticator = createAdminAuthenticator({ user: ADMIN_USER, passwordHash: ADMIN_PASSWORD_HASH });

  it('acepta solo el usuario y la contraseña configurados', async () => {
    expect(await authenticator.verify(ADMIN_USER, ADMIN_PASSWORD)).toBe(true);
    expect(await authenticator.verify(ADMIN_USER, `${ADMIN_PASSWORD}x`)).toBe(false);
    expect(await authenticator.verify('otro', ADMIN_PASSWORD)).toBe(false);
    expect(await authenticator.verify(undefined, undefined)).toBe(false);
  });

  it('falla rápido con credenciales mal formadas', () => {
    expect(() => createAdminAuthenticator({ user: 'x', passwordHash: 'plano' })).toThrow(/inválidas/);
  });

  it('safeEqualStrings compara contenido sin depender de la longitud', () => {
    expect(safeEqualStrings('abc', 'abc')).toBe(true);
    expect(safeEqualStrings('abc', 'abcd')).toBe(false);
  });
});
