import { afterEach, describe, expect, it } from 'vitest';

import { createProductRepository } from '@restaurante/core/catalog';
import { UsernameTakenError, createUserAuthenticator, validateUserData, type UserRepository } from '@restaurante/core/identity';
import { createPrismaProductStore } from '@restaurante/db/prisma-product-store';
import { createUserRepository } from '@restaurante/db/user-repository';

import { ADMIN_PASSWORD_HASH, TEST_HASH_PARAMS, createUser } from '../support/admin.ts';
import { adminSql, makeDatabase } from '../support/database.ts';
import { VALID_INPUTS, seedSources } from '../support/products.ts';

/**
 * Español sobre MySQL (REQ-F-014, RF-3 y RF-4): un texto con ñ y acentos se guarda y se devuelve
 * idéntico, y "jose" y "josé" son usuarios distintos. Desde REQ-F-045 se prueba sobre los
 * repositorios y el autenticador de core (los que usa la API de administración), sin el /admin retirado.
 */

const TEXT = 'Ñandú ¿Qué? ¡Sí! «Pingüino» 🌮';
const DESCRIPTION = 'Precio en € con acentos: áéíóú ü ñ — y emojis compuestos 👨‍👩‍👧 🇲🇽 👍🏽';
const SYSTEM = { kind: 'system' } as const;

const hex = (value: string) => Buffer.from(value, 'utf8').toString('hex').toUpperCase();

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()?.();
});

async function database() {
  const created = await makeDatabase();
  cleanups.push(created.cleanup);
  return { ...created, users: createUserRepository({ prisma: created.prisma }) };
}

async function storedHex(name: string, sql: string, id: number): Promise<string> {
  const rows = (await adminSql(name, { sql, values: [id] })) as { value: string }[];
  return rows[0]!.value;
}

describe('texto en español', () => {
  it('por el repositorio de productos: crear y leer devuelven exactamente la misma cadena', async () => {
    const { prisma, name, users } = await database();
    const owner = await createUser(users, { username: 'dueno', role: 'admin' });
    const products = createProductRepository({ store: createPrismaProductStore({ prisma }), imageExists: async () => true });
    await products.init(seedSources());

    const created = await products.create('molotes', { input: { category: 'bebida', ...VALID_INPUTS.molotesBebida, name: TEXT, description: DESCRIPTION } }, { id: owner.id, name: owner.displayName });
    expect(await products.get('molotes', created.id)).toMatchObject({ name: TEXT, description: DESCRIPTION });
    expect(await storedHex(name, 'SELECT HEX(name) AS value FROM product WHERE id = ?', created.id)).toBe(hex(TEXT));
    const change = await prisma.productChange.findFirst({ where: { productId: created.id } });
    expect(change!.changes).toContain(TEXT);
  });
});

describe('usuario único sin distinguir mayúsculas', () => {
  const editor = (username: string) => ({ username, displayName: username, role: 'editor' as const, businesses: ['molotes' as const], passwordHash: ADMIN_PASSWORD_HASH });

  /** Alta como la valida la gestión de usuarios (core): normaliza el usuario antes de guardarlo. */
  const createValidated = async (users: UserRepository, username: string) => {
    const { data } = validateUserData({ username, displayName: 'Otro', role: 'editor', businesses: ['molotes'] });
    if (!data) throw new Error(`Usuario inválido: ${username}`);
    return users.create({ ...data, passwordHash: ADMIN_PASSWORD_HASH }, SYSTEM);
  };

  it('"jose" y "josé" son usuarios distintos; Jose, "  JOSE  " y José en NFD chocan con los existentes', async () => {
    const { prisma, users } = await database();
    await users.create(editor('jose'), SYSTEM);
    await users.create(editor('josé'), SYSTEM);
    for (const repeated of ['Jose', '  JOSE  '.trim(), 'José'.normalize('NFD'), 'JOSÉ']) {
      await expect(users.create(editor(repeated.normalize('NFC')), SYSTEM)).rejects.toBeInstanceOf(UsernameTakenError);
    }
    expect(await prisma.user.count()).toBe(2);
  });

  it('validado como en la gestión de usuarios: José en NFD cuando ya existe "josé" -> choca sin guardar nada', async () => {
    const { prisma, users } = await database();
    await users.create(editor('josé'), SYSTEM);
    const before = await prisma.user.count();
    await expect(createValidated(users, '  José  '.normalize('NFD'))).rejects.toBeInstanceOf(UsernameTakenError);
    expect(await prisma.user.count()).toBe(before);
  });

  it('validado como en la gestión de usuarios: "Jose" y "  JOSE  " (sin recortar) cuando ya existe "jose" -> chocan; "josé" sí se crea', async () => {
    const { prisma, users } = await database();
    await users.create(editor('jose'), SYSTEM);
    const before = await prisma.user.count();
    for (const username of ['Jose', '  JOSE  ']) {
      await expect(createValidated(users, username), username).rejects.toBeInstanceOf(UsernameTakenError);
    }
    expect(await prisma.user.count()).toBe(before);
    await createValidated(users, 'josé');
    expect(await prisma.user.count()).toBe(before + 1);
  });

  it('"jose" y "josé" inician sesión cada uno con su contraseña (la búsqueda usa la colación de la columna)', async () => {
    const { users } = await database();
    await createUser(users, { username: 'jose', password: 'clave-de-jose-12345' });
    await createUser(users, { username: 'josé', password: 'clave-de-josé-12345' });
    const authenticator = createUserAuthenticator({ users, hashParams: TEST_HASH_PARAMS });
    expect(await authenticator.authenticate('jose', 'clave-de-jose-12345')).toMatchObject({ username: 'jose' });
    expect(await authenticator.authenticate('josé', 'clave-de-josé-12345')).toMatchObject({ username: 'josé' });
    expect(await authenticator.authenticate('jose', 'clave-de-josé-12345')).toBeNull();
    expect(await authenticator.authenticate('josé', 'clave-de-jose-12345')).toBeNull();
  });
});
