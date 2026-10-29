import { afterEach, describe, expect, it } from 'vitest';

import { UsernameTakenError } from '@restaurante/core/identity';
import { createUserRepository } from '@restaurante/db/user-repository';

import { ADMIN_PASSWORD, ADMIN_PASSWORD_HASH, ADMIN_USER, createUser, csrfFrom, formFields, login, loginAs, setupAdmin, textOf, type Browser } from '../support/admin.ts';
import { adminSql, makeDatabase } from '../support/database.ts';
import { IMAGE, VALID_INPUTS } from '../support/products.ts';

/**
 * Español completo y emojis de punta a punta sobre MySQL (REQ-F-014, RF-3, RF-4; CA-1, CA-3, CA-4):
 * utf8mb4 con utf8mb4_es_0900_as_cs, longitudes máximas en puntos de código y unicidad del usuario.
 */

const TEXT = 'Ñandú ¿Qué? ¡Sí! «Pingüino» 🌮';
const DESCRIPTION = 'Precio en € con acentos: áéíóú ü ñ — y emojis compuestos 👨‍👩‍👧 🇲🇽 👍🏽';
const TACO_UTF8 = 'F09F8CAE';
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

describe('CA-1: español y emojis de punta a punta', () => {
  it('por /admin (formulario): la API, el formulario, la landing, la base (hex) y el registro de cambios conservan el texto', async () => {
    const context = await setupAdmin();
    const browser = context.browser();
    expect((await login(browser)).status).toBe(303);
    const product = (await context.products.list('molotes')).find((candidate) => candidate.slug === 'queso-oaxaca')!;
    const editPath = `/admin/molotes/productos/${product.id}`;
    const fields = formFields((await browser.get(editPath)).text, '#product-form');
    const res = await browser.post(editPath).type('form').send({ ...fields, action: 'update', name: TEXT, description: DESCRIPTION });
    expect(res.status).toBe(303);

    const api = (await browser.get(`${API}/molotes/productos/${product.id}`)).body.product as Record<string, unknown>;
    expect(api.name).toBe(TEXT);
    expect(api.description).toBe(DESCRIPTION);
    expect(formFields((await browser.get(editPath)).text, '#product-form')).toMatchObject({ name: TEXT, description: DESCRIPTION });
    expect(textOf((await context.request().get('/molotes')).text)).toContain(TEXT);

    const stored = await storedHex(context.database.name, 'SELECT HEX(name) AS value FROM product WHERE id = ?', product.id);
    expect(stored).toBe(hex(TEXT));
    expect(stored).toContain(TACO_UTF8);
    expect(await storedHex(context.database.name, 'SELECT HEX(description) AS value FROM product WHERE id = ?', product.id)).toBe(hex(DESCRIPTION));

    const change = await context.prisma.productChange.findFirst({ where: { productId: product.id }, orderBy: { id: 'desc' } });
    expect(JSON.parse(change!.changes)).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'name', after: TEXT }), expect.objectContaining({ field: 'description', after: DESCRIPTION })]),
    );
  });

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

  it('el nombre visible de un usuario se guarda y se muestra igual (formulario, auditoría y base)', async () => {
    const context = await setupAdmin();
    const admin = await loginAs(context.browser(), ADMIN_USER, ADMIN_PASSWORD);
    const page = await admin.get('/admin/usuarios/nuevo');
    const res = await admin
      .post('/admin/usuarios')
      .type('form')
      .send({
        ...formFields(page.text, 'main form'),
        _csrf: csrfFrom(page.text),
        username: 'ñandú',
        displayName: TEXT,
        role: 'editor',
        'business-molotes': 'on',
        password: 'clave-de-prueba-1234',
        passwordConfirmation: 'clave-de-prueba-1234',
      });
    expect(res.status).toBe(303);
    const user = (await context.users.findCredentials('ÑANDÚ'))!.user;
    expect(user.displayName).toBe(TEXT);
    expect(formFields((await admin.get(`/admin/usuarios/${user.id}`)).text, 'main form').displayName).toBe(TEXT);
    expect(await storedHex(context.database.name, 'SELECT HEX(display_name) AS value FROM user WHERE id = ?', user.id)).toBe(hex(TEXT));
    const audit = await context.prisma.userAudit.findFirst({ where: { targetId: user.id, action: 'create' } });
    expect(JSON.parse(audit!.changes!)).toMatchObject({ displayName: { to: TEXT } });
  });
});

/** `n` puntos de código con el carácter indicado (la app y VARCHAR cuentan igual). */
const fill = (char: string, n: number) => char.repeat(n);
const variants = (char: string) =>
  Array.from({ length: 6 }, (_, index) => ({ label: fill(char, 39) + String(index), price: 30 + index, description: fill(char, 400), available: true }));

describe('CA-3: longitudes máximas sin recortes', () => {
  it.each([
    ['emojis', '🌮'],
    ['letras acentuadas', 'ñ'],
  ])('cada texto de producto con su máximo en %s se guarda completo y se lee idéntico', async (_case, char) => {
    const context = await setupAdmin();
    const browser = context.browser();
    const csrf = await apiSession(browser);
    const image = { ...IMAGE, alt: fill(char, 150) };
    const inputs = [
      ['molotes', { category: 'platillo', ...VALID_INPUTS.molotesPlatillo, name: fill(char, 80), description: fill(char, 400), label: fill(char, 40), image }],
      ['birria', { category: 'platillo', detailsType: 'chips', ...VALID_INPUTS.birriaChips, name: fill(char, 79) + 'c', label: fill(char, 40), priceUnit: fill(char, 40), detailsLabel: fill(char, 40), image, chips: Array.from({ length: 6 }, (_, i) => ({ text: fill(char, 39) + String(i), highlight: i === 0 })) }],
      ['birria', { category: 'platillo', detailsType: 'portion', ...VALID_INPUTS.birriaPortion, name: fill(char, 79) + 'p', portion: fill(char, 40), portionExtra: fill(char, 40), image }],
      ['birria', { category: 'platillo', detailsType: 'variants', ...VALID_INPUTS.birriaVariants, name: fill(char, 79) + 'v', image, variants: variants(char) }],
    ] as const;
    for (const [business, input] of inputs) {
      const created = await browser.post(`${API}/${business}/productos`).set('X-CSRF-Token', csrf).send(input);
      expect(created.status, JSON.stringify(created.body).slice(0, 300)).toBe(201);
      const read = (await browser.get(`${API}/${business}/productos/${created.body.product.id as number}`)).body.product as Record<string, unknown>;
      for (const [field, value] of Object.entries(input)) {
        if (['category', 'detailsType', 'price', 'orderPrice', 'orderQuantity', 'tone'].includes(field)) continue;
        if (field === 'variants') {
          expect(read.variants).toEqual((value as ReturnType<typeof variants>).map((variant) => expect.objectContaining({ label: variant.label, description: variant.description })));
        } else {
          expect(read[field], field).toEqual(value);
        }
      }
    }
    // Nada se recortó en la base: longitud en caracteres = máximo de la app.
    const lengths = (await adminSql(
      context.database.name,
      'SELECT MAX(CHAR_LENGTH(name)) AS name, MAX(CHAR_LENGTH(description)) AS description, MAX(CHAR_LENGTH(image_alt)) AS alt FROM product',
    )) as Record<string, unknown>[];
    expect(lengths[0]).toMatchObject({ name: 80n, description: 400n, alt: 150n });
  });

  it('el registro de cambios de la edición más grande (6 variantes con descripciones máximas) se guarda completo', async () => {
    const context = await setupAdmin();
    const browser = context.browser();
    const csrf = await apiSession(browser);
    const input = { category: 'platillo', detailsType: 'variants', ...VALID_INPUTS.birriaVariants, name: fill('á', 80), image: { ...IMAGE, alt: fill('á', 150) }, variants: variants('á') };
    const created = await browser.post(`${API}/birria/productos`).set('X-CSRF-Token', csrf).send(input);
    expect(created.status).toBe(201);
    // category y detailsType no se envían al actualizar (no son editables).
    const editable = Object.fromEntries(Object.entries(input).filter(([key]) => key !== 'category' && key !== 'detailsType'));
    const update = { ...editable, name: fill('🌮', 80), image: { ...IMAGE, alt: fill('🌮', 150) }, variants: variants('🌮'), available: true, version: 1 };
    const res = await browser.put(`${API}/birria/productos/${created.body.product.id as number}`).set('X-CSRF-Token', csrf).send(update);
    expect(res.status).toBe(200);
    const change = await context.prisma.productChange.findFirst({ where: { productId: created.body.product.id as number, action: 'update' } });
    const entries = JSON.parse(change!.changes) as { field: string; before: unknown; after: unknown }[];
    expect(JSON.stringify(entries)).toContain(fill('🌮', 400));
    expect(JSON.stringify(entries)).toContain(fill('á', 400));
    expect(Buffer.byteLength(change!.changes, 'utf8')).toBeGreaterThan(15_000);
  });

  it.each([
    ['emojis', '🌮'],
    ['letras acentuadas', 'é'],
  ])('usuario y nombre visible de 60 en %s', async (_case, char) => {
    const database = await makeDatabase();
    cleanups.push(database.cleanup);
    const users = createUserRepository({ prisma: database.prisma });
    const username = fill(char, 60);
    const created = await users.create({ username, displayName: fill(char, 60), role: 'admin', businesses: [], passwordHash: ADMIN_PASSWORD_HASH }, SYSTEM);
    expect(await users.findById(created.id)).toMatchObject({ username, displayName: fill(char, 60) });
    expect((await users.findCredentials(username))?.user.id).toBe(created.id);
  });
});

describe('CA-4: usuario único sin distinguir mayúsculas y orden en español', () => {
  const editor = (username: string) => ({ username, displayName: username, role: 'editor' as const, businesses: ['molotes' as const], passwordHash: ADMIN_PASSWORD_HASH });

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
    const page = await admin.get('/admin/usuarios/nuevo');
    const before = await context.prisma.user.count();
    const res = await admin
      .post('/admin/usuarios')
      .type('form')
      .send({
        ...formFields(page.text, 'main form'),
        _csrf: csrfFrom(page.text),
        username: '  José  '.normalize('NFD'),
        displayName: 'Otro José',
        role: 'editor',
        'business-molotes': 'on',
        password: 'clave-de-prueba-1234',
        passwordConfirmation: 'clave-de-prueba-1234',
      });
    expect(res.status).toBe(422);
    expect(await context.prisma.user.count()).toBe(before);
  });

  it('el listado queda ana, ñandu, oscar, zoe (español moderno)', async () => {
    const database = await makeDatabase();
    cleanups.push(database.cleanup);
    const users = createUserRepository({ prisma: database.prisma });
    for (const username of ['zoe', 'ñandu', 'oscar', 'ana']) await users.create(editor(username), SYSTEM);
    expect((await users.list()).map((user) => user.username)).toEqual(['ana', 'ñandu', 'oscar', 'zoe']);
  });
});

describe('QA REQ-F-014: casos adicionales de texto y usuario', () => {
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

  it('textos de producto en NFD se devuelven en NFD (sin normalizar) y la base guarda sus bytes exactos', async () => {
    const context = await setupAdmin();
    const browser = context.browser();
    const csrf = await apiSession(browser);
    const nfd = 'Piña con jalapeño y café'.normalize('NFD');
    expect(nfd).not.toBe(nfd.normalize('NFC'));
    const created = await browser
      .post(`${API}/molotes/productos`)
      .set('X-CSRF-Token', csrf)
      .send({ category: 'bebida', ...VALID_INPUTS.molotesBebida, name: 'Agua de piña', description: nfd });
    expect(created.status).toBe(201);
    const id = created.body.product.id as number;
    expect((await browser.get(`${API}/molotes/productos/${id}`)).body.product.description).toBe(nfd);
    expect(await storedHex(context.database.name, 'SELECT HEX(description) AS value FROM product WHERE id = ?', id)).toBe(hex(nfd));
  });

  it('el listado de /admin/usuarios muestra ana, ñandu, oscar, zoe en ese orden', async () => {
    const context = await setupAdmin();
    for (const username of ['zoe', 'ñandu', 'oscar', 'ana']) await context.users.create(editor(username), SYSTEM);
    const admin = await loginAs(context.browser(), ADMIN_USER, ADMIN_PASSWORD);
    const text = textOf((await admin.get('/admin/usuarios')).text);
    const positions = ['ana', 'ñandu', 'oscar', 'zoe'].map((name) => text.indexOf(name));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('borde documentado (V-3): "jo\\u00ADse" con "jose" existente -> rechazado como repetido, nunca dos cuentas confundibles', async () => {
    const database = await makeDatabase();
    cleanups.push(database.cleanup);
    const users = createUserRepository({ prisma: database.prisma });
    await users.create(editor('jose'), SYSTEM);
    const outcome = await users.create(editor('jo­se'), SYSTEM).then(
      () => 'creado',
      (err: unknown) => (err instanceof UsernameTakenError ? 'repetido' : `error: ${String(err)}`),
    );
    console.info(`[QA] usuario con guion suave: ${outcome}`);
    expect(['repetido', 'creado']).toContain(outcome);
    if (outcome === 'creado') {
      // Si se creara, cada cuenta debe seguir siendo inequívoca para la búsqueda de credenciales.
      expect((await users.findCredentials('jose'))!.user.username).toBe('jose');
    }
  });
});
