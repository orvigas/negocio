import { afterEach, describe, expect, it } from 'vitest';

import { UsernameTakenError } from '@restaurante/core/identity';
import { createUserRepository } from '@restaurante/db/user-repository';

import { ADMIN_PASSWORD, ADMIN_PASSWORD_HASH, ADMIN_USER, createUser, csrfFrom, formFields, login, loginAs, setupAdmin, type Browser } from '../support/admin.ts';
import { adminSql, makeDatabase } from '../support/database.ts';
import { VALID_INPUTS } from '../support/products.ts';

/**
 * Español sobre MySQL (REQ-F-014, RF-3 y RF-4): un texto con ñ y acentos se guarda y se devuelve
 * idéntico, y "jose" y "josé" son usuarios distintos.
 */

const TEXT = 'Ñandú ¿Qué? ¡Sí! «Pingüino» 🌮';
const DESCRIPTION = 'Precio en € con acentos: áéíóú ü ñ — y emojis compuestos 👨‍👩‍👧 🇲🇽 👍🏽';
const API = '/admin/api';
const SYSTEM = { kind: 'system' } as const;

const hex = (value: string) => Buffer.from(value, 'utf8').toString('hex').toUpperCase();

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()?.();
});

async function storedHex(database: string, sql: string, id: number): Promise<string> {
  const rows = (await adminSql(database, { sql, values: [id] })) as { value: string }[];
  return rows[0]!.value;
}

async function apiSession(browser: Browser) {
  expect((await login(browser)).status).toBe(303);
  return (await browser.get(`${API}/sesion`)).body.csrfToken as string;
}

describe('texto en español', () => {
  it('por la API: crear y leer devuelven exactamente la misma cadena', async () => {
    const context = await setupAdmin();
    const browser = context.browser();
    const csrf = await apiSession(browser);
    const created = await browser
      .post(`${API}/molotes/productos`)
      .set('X-CSRF-Token', csrf)
      .send({ category: 'bebida', ...VALID_INPUTS.molotesBebida, name: TEXT, description: DESCRIPTION });
    expect(created.status).toBe(201);
    const id = created.body.product.id as number;
    expect((await browser.get(`${API}/molotes/productos/${id}`)).body.product).toMatchObject({ name: TEXT, description: DESCRIPTION });
    expect(await storedHex(context.database.name, 'SELECT HEX(name) AS value FROM product WHERE id = ?', id)).toBe(hex(TEXT));
    const change = await context.prisma.productChange.findFirst({ where: { productId: id } });
    expect(change!.changes).toContain(TEXT);
  });
});

describe('usuario único sin distinguir mayúsculas', () => {
  const editor = (username: string) => ({ username, displayName: username, role: 'editor' as const, businesses: ['molotes' as const], passwordHash: ADMIN_PASSWORD_HASH });

  const createByForm = async (admin: Browser, username: string) => {
    const page = await admin.get('/admin/usuarios/nuevo');
    return admin
      .post('/admin/usuarios')
      .type('form')
      .send({
        ...formFields(page.text, 'main form'),
        _csrf: csrfFrom(page.text),
        username,
        displayName: 'Otro',
        role: 'editor',
        'business-molotes': 'on',
        password: 'clave-de-prueba-1234',
        passwordConfirmation: 'clave-de-prueba-1234',
      });
  };

  it('"jose" y "josé" son usuarios distintos; Jose, "  JOSE  " y José en NFD chocan con los existentes', async () => {
    const database = await makeDatabase();
    cleanups.push(database.cleanup);
    const users = createUserRepository({ prisma: database.prisma });
    await users.create(editor('jose'), SYSTEM);
    await users.create(editor('josé'), SYSTEM);
    for (const repeated of ['Jose', '  JOSE  '.trim(), 'José'.normalize('NFD'), 'JOSÉ']) {
      await expect(users.create(editor(repeated.normalize('NFC')), SYSTEM)).rejects.toBeInstanceOf(UsernameTakenError);
    }
    expect(await database.prisma.user.count()).toBe(2);
  });

  it('por el formulario: José en NFD cuando ya existe "josé" -> 422 sin guardar nada', async () => {
    const context = await setupAdmin();
    await context.users.create(editor('josé'), SYSTEM);
    const admin = await loginAs(context.browser(), ADMIN_USER, ADMIN_PASSWORD);
    const before = await context.prisma.user.count();
    const res = await createByForm(admin, '  José  '.normalize('NFD'));
    expect(res.status).toBe(422);
    expect(await context.prisma.user.count()).toBe(before);
  });

  it('por el formulario: "Jose" y "  JOSE  " (sin recortar) cuando ya existe "jose" -> 422 sin guardar nada', async () => {
    const context = await setupAdmin();
    await context.users.create(editor('jose'), SYSTEM);
    const admin = await loginAs(context.browser(), ADMIN_USER, ADMIN_PASSWORD);
    const before = await context.prisma.user.count();
    for (const username of ['Jose', '  JOSE  ']) {
      const res = await createByForm(admin, username);
      expect(res.status, username).toBe(422);
    }
    expect(await context.prisma.user.count()).toBe(before);
    // "josé" sí se crea (distinto de "jose").
    expect((await createByForm(admin, 'josé')).status).toBe(303);
    expect(await context.prisma.user.count()).toBe(before + 1);
  });

  it('"jose" y "josé" inician sesión cada uno con su contraseña (la búsqueda usa la colación de la columna)', async () => {
    const context = await setupAdmin();
    await createUser(context.users, { username: 'jose', password: 'clave-de-jose-12345' });
    await createUser(context.users, { username: 'josé', password: 'clave-de-josé-12345' });
    expect((await login(context.browser(), { username: 'jose', password: 'clave-de-jose-12345' })).status).toBe(303);
    expect((await login(context.browser(), { username: 'josé', password: 'clave-de-josé-12345' })).status).toBe(303);
    expect((await login(context.browser(), { username: 'jose', password: 'clave-de-josé-12345' })).status).not.toBe(303);
    expect((await login(context.browser(), { username: 'josé', password: 'clave-de-jose-12345' })).status).not.toBe(303);
  });
});
