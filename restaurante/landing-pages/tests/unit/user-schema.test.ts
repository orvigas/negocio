import { describe, expect, it } from 'vitest';

import { BUSINESS_IDS } from '@restaurante/core/shared';
import { Business, Role } from '@restaurante/db/generated/enums.ts';
import {
  ROLES,
  businessField,
  passwordError,
  readUserForm,
  usernameKey,
  validatePasswordPair,
  validateUserData,
} from '@restaurante/core/identity';

/** Datos de usuario (REQ-F-007, D-10, DT-15 y CA-9). */

const valid = { username: 'ana', displayName: 'Ana', role: 'editor', businesses: ['molotes' as const] };

describe('validateUserData', () => {
  it('acepta un editor con un negocio y normaliza espacios', () => {
    const { data, errors } = validateUserData({ ...valid, username: '  Ana.Lopez ', displayName: ' Ana López ' });
    expect(errors).toEqual({});
    expect(data).toEqual({ username: 'Ana.Lopez', displayName: 'Ana López', role: 'editor', businesses: ['molotes'] });
  });

  it('el administrador no guarda negocios (los tiene todos de forma implícita)', () => {
    expect(validateUserData({ ...valid, role: 'admin', businesses: ['birria'] }).data?.businesses).toEqual([]);
    expect(validateUserData({ ...valid, role: 'admin', businesses: [] }).errors).toEqual({});
  });

  it('editor sin negocios -> error en el campo businesses (CA-9)', () => {
    const { data, errors } = validateUserData({ ...valid, businesses: [] });
    expect(data).toBeNull();
    expect(errors.businesses).toMatch(/al menos un negocio/);
  });

  it.each([
    ['username', '', /Escribe el usuario/],
    ['username', '   ', /Escribe el usuario/],
    ['username', 'x'.repeat(61), /Máximo 60/],
    ['username', 'a\u0000b', /caracteres de control/],
    ['displayName', '', /Escribe el nombre/],
    ['displayName', 'n'.repeat(61), /Máximo 60/],
    ['role', 'root', /Elige un rol/],
  ])('%s = %j -> error', (field, value, message) => {
    const { data, errors } = validateUserData({ ...valid, [field]: value });
    expect(data).toBeNull();
    expect(errors[field as keyof typeof errors]).toMatch(message);
  });

  it('acepta exactamente 60 caracteres (contados como caracteres, no unidades UTF-16)', () => {
    expect(validateUserData({ ...valid, username: 'ñ'.repeat(60), displayName: '😀'.repeat(60) }).errors).toEqual({});
  });
});

describe('contraseñas (D-10: al menos 12 caracteres)', () => {
  it.each([
    ['x'.repeat(11), /al menos 12/],
    ['x'.repeat(257), /no puede superar 256/],
    [undefined, /al menos 12/],
  ])('%j -> error', (password, message) => {
    expect(passwordError(password)).toMatch(message);
  });

  it.each(['x'.repeat(12), 'x'.repeat(256), 'ñ'.repeat(12)])('acepta una contraseña de %#', (password) => {
    expect(passwordError(password)).toBeNull();
  });

  it('las dos contraseñas deben coincidir', () => {
    expect(validatePasswordPair('una-clave-larga', 'otra-clave-larga')).toEqual({ passwordConfirmation: 'Las contraseñas no coinciden.' });
    expect(validatePasswordPair('corta', 'corta').password).toMatch(/al menos 12/);
    expect(validatePasswordPair('una-clave-larga', 'una-clave-larga')).toEqual({});
  });
});

describe('usernameKey y formulario', () => {
  it('no distingue mayúsculas ni espacios alrededor', () => {
    expect(usernameKey('  ANA ')).toBe(usernameKey('ana'));
    expect(usernameKey('Peña')).toBe(usernameKey('PEÑA'));
  });

  it('lee las casillas de negocios con nombres propios (el body no admite campos repetidos)', () => {
    const fields = new Map([
      ['username', 'ana'],
      ['displayName', 'Ana'],
      ['role', 'editor'],
      [businessField('birria'), 'on'],
    ]);
    expect(readUserForm(fields)).toEqual({ username: 'ana', displayName: 'Ana', role: 'editor', businesses: ['birria'] });
  });

  it('los enums de Prisma coinciden con los negocios y roles de la app', () => {
    expect(Object.values(Business)).toEqual([...BUSINESS_IDS]);
    expect(Object.values(Role)).toEqual([...ROLES]);
  });
});
