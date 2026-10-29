import { describe, expect, it } from 'vitest';

import type { ProductStore } from '@restaurante/core/catalog';

import { createApp } from '../../src/app.ts';
import { makeConfig, makeRepository } from '../helpers.ts';
import { createUser, login, loginAs, setupAdmin, type Browser } from '../support/admin.ts';
import { listenLocal } from '../support/http.ts';
import { IMAGE, VALID_INPUTS, makeProductsFor } from '../support/products.ts';
import { landingProductsFrom } from '../support/landing-products.ts';

/**
 * API JSON de productos (REQ-F-008, RF-5, RF-7, RF-8, D-18 y D-19): CA-13 a CA-31 por la API.
 */

const API = '/admin/api';
const products = (business: string) => `${API}/${business}/productos`;

/** Sesión iniciada y token CSRF leído de GET /admin/api/sesion. */
async function apiSession(browser: Browser) {
  const res = await browser.get(`${API}/sesion`);
  expect(res.status).toBe(200);
  return res.body.csrfToken as string;
}

async function adminApi(options: Parameters<typeof setupAdmin>[0] = {}) {
  const context = await setupAdmin(options);
  const browser = context.browser();
  expect((await login(browser)).status).toBe(303);
  const csrf = await apiSession(browser);
  const send = (method: 'post' | 'put' | 'delete', path: string, body?: unknown) => {
    const req = browser[method](path).set('X-CSRF-Token', csrf);
    return body === undefined ? req : req.send(body as object);
  };
  /** Total de cambios registrados (para comprobar que algo no escribió). */
  const changeCount = () => context.prisma.productChange.count();
  return { ...context, browser, csrf, send, changeCount };
}

const molotesDrink = { category: 'bebida', ...VALID_INPUTS.molotesBebida };

describe('sesión y CSRF (CA-13, CA-14)', () => {
  it('GET /admin/api/sesion devuelve el usuario y el token; sin sesión, 401', async () => {
    const { browser, request: client } = await adminApi();
    const res = await browser.get(`${API}/sesion`);
    expect(res.body).toEqual({ user: { id: 1, name: 'dueno', role: 'admin', businesses: ['molotes', 'birria'] }, csrfToken: expect.any(String) });
    const anonymous = await client().get(`${API}/sesion`);
    expect(anonymous.status).toBe(401);
    expect(anonymous.body).toEqual({ error: { code: 'UNAUTHENTICATED', message: 'Inicia sesión para usar la API.' } });
  });

  it('CA-13: sin sesión, cualquier operación (también de lectura) responde 401 y no cambia nada', async () => {
    const { request: client, products: repo, changeCount } = await adminApi();
    const [first] = await repo.list('molotes');
    const before = await changeCount();
    const calls = [
      client().get(products('molotes')),
      client().get(`${products('molotes')}/${first!.id}`),
      client().post(products('molotes')).send(molotesDrink),
      client().put(`${products('molotes')}/${first!.id}`).send({ version: 1 }),
      client().delete(`${products('molotes')}/${first!.id}?version=1`),
      client().post(`${products('molotes')}/${first!.id}/recuperar`).send({ version: 1 }),
      client().put(`${products('molotes')}/orden`).send({ category: 'platillo', items: [] }),
      // Sin sesión, un negocio desconocido también es 401 (la sesión va primero, D-19).
      client().get(products('tacos')),
    ];
    for (const [index, res] of (await Promise.all(calls)).entries()) {
      expect(res.status, `llamada ${index}`).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    }
    expect(await changeCount()).toBe(before);
  });

  it('CA-14: con sesión y sin token CSRF (o con uno incorrecto), las escrituras responden 403 y no cambian nada', async () => {
    const { browser, products: repo, changeCount } = await adminApi();
    const [first] = await repo.list('molotes');
    const before = await changeCount();
    const writes = (token?: string) => {
      const withToken = <T extends { set: (name: string, value: string) => T }>(req: T): T => (token ? req.set('X-CSRF-Token', token) : req);
      return [
        withToken(browser.post(products('molotes'))).send(molotesDrink),
        withToken(browser.put(`${products('molotes')}/${first!.id}`)).send({ version: 1 }),
        withToken(browser.delete(`${products('molotes')}/${first!.id}?version=1`)),
        withToken(browser.post(`${products('molotes')}/${first!.id}/recuperar`)).send({ version: 1 }),
        withToken(browser.put(`${products('molotes')}/orden`)).send({ category: 'platillo', items: [] }),
      ];
    };
    for (const res of [...(await Promise.all(writes())), ...(await Promise.all(writes('token-falso')))]) {
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('CSRF_INVALID');
    }
    expect(await changeCount()).toBe(before);
  });

  it('rechaza un Origin ajeno aunque el token sea correcto', async () => {
    const { send } = await adminApi();
    const res = await send('post', products('molotes'), molotesDrink).set('Origin', 'https://otro.example');
    expect(res.status).toBe(403);
  });
});

describe('permisos por rol y negocio (CA-15, D-19)', () => {
  it('CA-15: un editor de Molotes recibe 403 en cualquier operación sobre Birria (también lectura) y no cambia nada', async () => {
    const context = await setupAdmin();
    await createUser(context.users, { username: 'eva', displayName: 'Eva', businesses: ['molotes'] });
    const browser = await loginAs(context.browser(), 'eva');
    const csrf = await apiSession(browser);
    const [birria] = await context.products.list('birria');
    const before = await context.prisma.productChange.count();
    const calls = [
      browser.get(products('birria')),
      browser.get(`${products('birria')}/${birria!.id}`),
      browser.post(products('birria')).set('X-CSRF-Token', csrf).send({ category: 'platillo', detailsType: 'chips', ...VALID_INPUTS.birriaChips }),
      browser.put(`${products('birria')}/${birria!.id}`).set('X-CSRF-Token', csrf).send({ version: 1 }),
      browser.delete(`${products('birria')}/${birria!.id}?version=1`).set('X-CSRF-Token', csrf),
      browser.post(`${products('birria')}/${birria!.id}/recuperar`).set('X-CSRF-Token', csrf).send({ version: 1 }),
      browser.put(`${products('birria')}/orden`).set('X-CSRF-Token', csrf).send({ category: 'platillo', items: [] }),
      // El permiso va antes que el CSRF (D-19): sin token también es 403 por permiso.
      browser.post(products('birria')).send({}),
    ];
    for (const res of await Promise.all(calls)) {
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_BUSINESS');
    }
    expect(await context.prisma.productChange.count()).toBe(before);
    // En su negocio sí puede operar.
    expect((await browser.post(products('molotes')).set('X-CSRF-Token', csrf).send(molotesDrink)).status).toBe(201);
    expect((await browser.get(`${API}/sesion`)).body.user.businesses).toEqual(['molotes']);
  });

  it('CA-15: el administrador opera en ambos negocios', async () => {
    const { send } = await adminApi();
    expect((await send('post', products('molotes'), molotesDrink)).status).toBe(201);
    expect((await send('post', products('birria'), { category: 'platillo', detailsType: 'variants', ...VALID_INPUTS.birriaVariants })).status).toBe(201);
  });

  it('un negocio desconocido responde 404', async () => {
    const { browser } = await adminApi();
    expect((await browser.get(products('tacos'))).status).toBe(404);
  });
});

describe('crear, consultar y validar (CA-16 a CA-22)', () => {
  it('CA-16: crea con 201, slug del nombre, versión 1, al final, no disponible y con el autor de la sesión', async () => {
    const { send, browser, prisma } = await adminApi();
    const res = await send('post', products('molotes'), { ...molotesDrink, available: true });
    expect(res.status).toBe(201);
    const { product } = res.body;
    expect(res.headers.location).toBe(`${products('molotes')}/${product.id}`);
    expect(product).toMatchObject({
      business: 'molotes',
      category: 'bebida',
      detailsType: null,
      slug: 'cafe-de-olla',
      name: 'Café de Olla',
      price: '30.00',
      priceCents: 3000,
      version: 1,
      position: 3,
      available: false,
      deleted: false,
      deletedAt: null,
      updatedBy: { id: 1, name: 'dueno' },
    });
    expect(product.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-06:00$/);
    expect(Object.keys(product)).not.toContain('image');
    expect((await browser.get(`${products('molotes')}/${product.id}`)).body.product).toEqual(product);
    const change = await prisma.productChange.findFirst({ where: { productId: product.id } });
    expect(change).toMatchObject({ action: 'create', actorId: 1, actorName: 'dueno', business: 'molotes', slug: 'cafe-de-olla' });
  });

  it('lista activos por orden; con ?eliminados=1 incluye los eliminados; filtra por categoría', async () => {
    const { send, browser } = await adminApi();
    const list = (await browser.get(products('molotes'))).body.products as { id: number; category: string; version: number }[];
    expect(list).toHaveLength(10);
    expect(list.map((item) => item.category)).toEqual([...Array(2).fill('bebida'), ...Array(8).fill('platillo')]);
    const drink = list[0]!;
    expect((await send('delete', `${products('molotes')}/${drink.id}?version=${drink.version}`)).status).toBe(200);
    expect((await browser.get(products('molotes'))).body.products).toHaveLength(9);
    const all = (await browser.get(`${products('molotes')}?eliminados=1`)).body.products;
    expect(all).toHaveLength(10);
    expect(all.at(-1)).toMatchObject({ id: drink.id, deleted: true });
    expect((await browser.get(`${products('molotes')}?categoria=bebida`)).body.products).toHaveLength(1);
    expect((await browser.get(`${products('molotes')}?categoria=postre`)).status).toBe(422);
  });

  it('Birria: precios de variantes en pesos y en centavos; chips y porción', async () => {
    const { browser } = await adminApi();
    const list = (await browser.get(products('birria'))).body.products;
    expect(list.find((item: { slug: string }) => item.slug === 'consome-chico')).toMatchObject({
      detailsType: 'variants',
      variants: [{ label: 'Con Carne', price: '80.00', priceCents: 8000, available: true }, { label: 'Sin Carne', price: '45.00', priceCents: 4500 }],
    });
    expect(list.find((item: { slug: string }) => item.slug === 'consome-grande')).toMatchObject({ portion: '500ml caldo + 150g carne', priceUnit: null });
  });

  it('CA-17: con el mismo nombre, el slug termina en -2', async () => {
    const { send } = await adminApi();
    const input = { ...molotesDrink, name: 'Molotes de Queso Oaxaca' };
    expect((await send('post', products('molotes'), input)).body.product.slug).toBe('molotes-de-queso-oaxaca');
    expect((await send('post', products('molotes'), input)).body.product.slug).toBe('molotes-de-queso-oaxaca-2');
  });

  it.each([
    ['un slug distinto', { slug: 'otro' }, 'slug'],
    ['una categoría distinta', { category: 'bebida' }, 'category'],
    ['un tipo de detalle distinto', { detailsType: 'portion' }, 'detailsType'],
    ['un campo desconocido', { secreto: 'x' }, 'secreto'],
    ['un campo de otra categoría', { icon: 'water_full' }, 'icon'],
    ['un campo author (D-18)', { author: 'Otra persona' }, 'author'],
  ])('CA-18: actualizar con %s responde 422 y no cambia nada', async (_label, extra, field) => {
    const { send, browser, changeCount } = await adminApi();
    const product = (await browser.get(products('birria'))).body.products[0];
    const before = await changeCount();
    const { id, slug, category, detailsType, version, ...rest } = product;
    const editable = Object.fromEntries(
      Object.entries(rest).filter(([key]) => ['name', 'label', 'description', 'price', 'priceUnit', 'image', 'detailsLabel', 'chips', 'available'].includes(key)),
    );
    const ok = await send('put', `${products('birria')}/${id}`, { ...editable, slug, category, detailsType, version });
    expect(ok.status).toBe(200);
    const res = await send('put', `${products('birria')}/${id}`, { ...editable, version: version + 1, ...extra });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.fields).toHaveProperty([field]);
    expect(await changeCount()).toBe(before + 1);
    expect((await browser.get(`${products('birria')}/${id}`)).body.product.version).toBe(version + 1);
  });

  it.each([0, 5000.01, 45.505, -10, 'abc'])('CA-19: un precio de %s responde 422 con el error en el campo', async (price) => {
    const { send } = await adminApi();
    const res = await send('post', products('molotes'), { ...molotesDrink, price });
    expect(res.status).toBe(422);
    expect(Object.keys(res.body.error.fields)).toEqual(['price']);
  });

  it.each([0.01, 5000.0, '5000.00'])('CA-19: un precio de %s se acepta', async (price) => {
    const { send } = await adminApi();
    expect((await send('post', products('molotes'), { ...molotesDrink, price })).status).toBe(201);
  });

  it.each([
    ['inexistente', { ...IMAGE, src: '/img/molotes/no-existe.jpg' }, 'image.src'],
    ['sin alt', { ...IMAGE, alt: '' }, 'image.alt'],
    ['con ..', { ...IMAGE, src: '/img/../package.json' }, 'image.src'],
    ['con extensión no permitida', { ...IMAGE, src: '/img/molotes/logo-molotes.svg' }, 'image.src'],
  ])('CA-20: una imagen %s responde 422', async (_label, image, field) => {
    const { send } = await adminApi();
    const res = await send('post', products('molotes'), { category: 'platillo', ...VALID_INPUTS.molotesPlatillo, image });
    expect(res.status).toBe(422);
    expect(res.body.error.fields).toHaveProperty([field]);
  });

  it('CA-21: con 50 productos activos, crear o recuperar responde 422', async () => {
    const { send, products: repo } = await adminApi();
    const input = { category: 'platillo', detailsType: 'portion', ...VALID_INPUTS.birriaPortion };
    for (let count = (await repo.list('birria')).length; count < 50; count += 1) expect((await send('post', products('birria'), input)).status).toBe(201);
    const res = await send('post', products('birria'), input);
    expect(res.status).toBe(422);
    expect(res.body.error.fields['']).toMatch(/50 productos activos/);
    // Con uno eliminado se puede crear otro; después, recuperar el eliminado excede el límite.
    const [first] = await repo.list('birria');
    await send('delete', `${products('birria')}/${first!.id}?version=${first!.version}`);
    expect((await send('post', products('birria'), input)).status).toBe(201);
    const restore = await send('post', `${products('birria')}/${first!.id}/recuperar`, { version: first!.version + 1 });
    expect(restore.status).toBe(422);
  });

  it.each([0, 7])('CA-21: %i variantes o chips responden 422', async (count) => {
    const { send } = await adminApi();
    const variants = Array.from({ length: count }, () => ({ label: 'A', price: 10, description: 'd', available: true }));
    const chips = Array.from({ length: count }, () => ({ text: 'x', highlight: false }));
    const withVariants = await send('post', products('birria'), { category: 'platillo', detailsType: 'variants', ...VALID_INPUTS.birriaVariants, variants });
    const withChips = await send('post', products('birria'), { category: 'platillo', detailsType: 'chips', ...VALID_INPUTS.birriaChips, chips });
    expect([withVariants.status, withChips.status]).toEqual([422, 422]);
    expect(withVariants.body.error.fields).toHaveProperty('variants');
    expect(withChips.body.error.fields).toHaveProperty('chips');
  });

  it('CA-22: un id inexistente o de otro negocio responde 404 al consultar, actualizar o eliminar', async () => {
    const { send, browser, products: repo } = await adminApi();
    const [birria] = await repo.list('birria');
    for (const path of [`${products('molotes')}/999999`, `${products('molotes')}/${birria!.id}`, `${products('molotes')}/abc`]) {
      expect((await browser.get(path)).status, path).toBe(404);
      // 404 antes que la validación (D-19): el cuerpo inválido no llega a leerse.
      expect((await send('put', path, { author: 'x' })).status, path).toBe(404);
      expect((await send('delete', `${path}?version=1`)).status, path).toBe(404);
    }
    expect((await browser.get(`${products('molotes')}/999999`)).body.error.code).toBe('PRODUCT_NOT_FOUND');
  });

  it('413, 415 y JSON inválido', async () => {
    const { send, browser, csrf } = await adminApi();
    const big = await send('post', products('molotes'), { ...molotesDrink, description: 'a'.repeat(40 * 1024) });
    expect(big.status).toBe(413);
    const form = await browser.post(products('molotes')).set('X-CSRF-Token', csrf).type('form').send({ name: 'x' });
    expect(form.status).toBe(415);
    const broken = await browser.post(products('molotes')).set('X-CSRF-Token', csrf).set('Content-Type', 'application/json').send('{ roto');
    expect(broken.status).toBe(400);
    expect(broken.body.error.code).toBe('INVALID_JSON');
  });
});

describe('eliminar, recuperar, ordenar y concurrencia (CA-25 a CA-31)', () => {
  it('CA-25 y CA-26: eliminar (lógico) y recuperar al final, no disponible y con el mismo slug', async () => {
    const { send, browser, request: client, prisma } = await adminApi();
    const [first] = (await browser.get(`${products('birria')}?categoria=platillo`)).body.products;
    const removed = await send('delete', `${products('birria')}/${first.id}?version=${first.version}`);
    expect(removed.body.product).toMatchObject({ deleted: true, version: 2, deletedAt: expect.stringMatching(/-06:00$/) });
    expect((await client().get('/birria')).text).not.toContain(first.name);
    expect(await prisma.product.findUnique({ where: { id: first.id } })).toMatchObject({ deleted: true });

    const restored = await send('post', `${products('birria')}/${first.id}/recuperar`, { version: 2 });
    expect(restored.status).toBe(200);
    expect(restored.body.product).toMatchObject({ deleted: false, available: false, slug: first.slug, version: 3, position: 7 });
    const list = (await browser.get(products('birria'))).body.products;
    expect(list.at(-1).id).toBe(first.id);
  });

  it('CA-27: reordenar deja A, C, B en la API y en la landing', async () => {
    const { send, browser, request: client } = await adminApi();
    const list = (await browser.get(`${products('birria')}?categoria=platillo`)).body.products as { id: number; version: number; slug: string }[];
    const [a, b, c, ...rest] = list;
    const order = [a!, c!, b!, ...rest].map(({ id, version }) => ({ id, version }));
    const res = await send('put', `${products('birria')}/orden`, { category: 'platillo', items: order });
    expect(res.status).toBe(200);
    expect(res.body.products.map((item: { id: number }) => item.id)).toEqual(order.map((item) => item.id));
    const landing = (await client().get('/birria')).text;
    expect(landing.indexOf(`id="card-${c!.slug}"`)).toBeLessThan(landing.indexOf(`id="card-${b!.slug}"`));
    expect(landing.indexOf(`id="card-${a!.slug}"`)).toBeLessThan(landing.indexOf(`id="card-${c!.slug}"`));
    // Lista incompleta o con campos de más: 422.
    expect((await send('put', `${products('birria')}/orden`, { category: 'platillo', items: order.slice(1) })).status).toBe(422);
    expect((await send('put', `${products('birria')}/orden`, { category: 'platillo', items: [], extra: 1 })).status).toBe(422);
    // Versiones viejas: 409.
    expect((await send('put', `${products('birria')}/orden`, { category: 'platillo', items: order })).status).toBe(409);
  });

  it('CA-28: si Ana guarda primero, Luis recibe 409 con quién y cuándo al guardar o eliminar, y no cambia nada', async () => {
    const context = await setupAdmin();
    await createUser(context.users, { username: 'ana', displayName: 'Ana', businesses: ['molotes'] });
    await createUser(context.users, { username: 'luis', displayName: 'Luis', businesses: ['molotes'] });
    const ana = await loginAs(context.browser(), 'ana');
    const luis = await loginAs(context.browser(), 'luis');
    const [anaToken, luisToken] = [await apiSession(ana), await apiSession(luis)];
    const drink = (await ana.get(`${products('molotes')}?categoria=bebida`)).body.products[0];
    const body = { name: drink.name, description: drink.description, icon: drink.icon, tone: drink.tone, price: drink.price, available: true, version: drink.version };

    context.clock.advance(3 * 60_000);
    expect((await ana.put(`${products('molotes')}/${drink.id}`).set('X-CSRF-Token', anaToken).send({ ...body, name: 'De Ana' })).status).toBe(200);
    const before = await context.prisma.productChange.count();
    const update = await luis.put(`${products('molotes')}/${drink.id}`).set('X-CSRF-Token', luisToken).send({ ...body, name: 'De Luis' });
    const remove = await luis.delete(`${products('molotes')}/${drink.id}?version=${drink.version}`).set('X-CSRF-Token', luisToken);
    for (const res of [update, remove]) {
      expect(res.status).toBe(409);
      expect(res.body.error).toMatchObject({
        code: 'VERSION_CONFLICT',
        current: { id: drink.id, version: 2, updatedBy: 'Ana', updatedAt: '2026-10-09T12:03:00-06:00' },
      });
    }
    expect(await context.prisma.productChange.count()).toBe(before);
    expect((await ana.get(`${products('molotes')}/${drink.id}`)).body.product.name).toBe('De Ana');
    // 422 va antes que 409 (D-19): con datos inválidos y versión vieja, 422.
    expect((await luis.put(`${products('molotes')}/${drink.id}`).set('X-CSRF-Token', luisToken).send({ ...body, price: 0 })).status).toBe(422);
  });

  it('CA-30: dos usuarios que editan productos distintos guardan sin conflicto', async () => {
    const { send, browser } = await adminApi();
    const [a, b] = (await browser.get(`${products('molotes')}?categoria=bebida`)).body.products;
    const body = (item: Record<string, unknown>, name: string) => ({
      name,
      description: item.description,
      icon: item.icon,
      tone: item.tone,
      price: item.price,
      available: true,
      version: item.version,
    });
    const results = await Promise.all([send('put', `${products('molotes')}/${a.id}`, body(a, 'A')), send('put', `${products('molotes')}/${b.id}`, body(b, 'B'))]);
    expect(results.map((res) => res.status)).toEqual([200, 200]);
  });

  it('CA-31: cada escritura deja fecha, usuario, negocio, slug, acción y campos (antes y después)', async () => {
    const { send, browser, prisma } = await adminApi();
    const drink = (await browser.get(`${products('molotes')}?categoria=bebida`)).body.products[0];
    await send('put', `${products('molotes')}/${drink.id}`, {
      name: drink.name,
      description: drink.description,
      icon: drink.icon,
      tone: drink.tone,
      price: '36.50',
      available: true,
      version: drink.version,
    });
    const entry = await prisma.productChange.findFirst({ where: { productId: drink.id, action: 'update' } });
    expect(entry).toMatchObject({ business: 'molotes', slug: drink.slug, actorId: 1, actorName: 'dueno' });
    expect(entry!.at).toBeInstanceOf(Date);
    expect(JSON.parse(entry!.changes)).toEqual([{ field: 'priceCents', before: 3500, after: 3650 }]);
  });
});

describe('disponibilidad (CA-23, CA-24, M-1, M-6)', () => {
  it('CA-23: con la administración deshabilitada la API responde 503 y las landings funcionan', async () => {
    const repository = await makeRepository();
    const productRepository = await makeProductsFor(repository);
    const client = (await listenLocal(createApp({ config: makeConfig(), repository, products: productRepository, landingProducts: landingProductsFrom(productRepository) }))).request();
    for (const path of [`${API}/sesion`, products('molotes')]) {
      const res = await client.get(path);
      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('ADMIN_UNAVAILABLE');
    }
    expect((await client.get('/molotes')).status).toBe(200);
  });

  it('M-1 (Q-5 A): por HTTP en producción la API responde 503 como el resto de /admin', async () => {
    const { request: client } = await setupAdmin({ env: { NODE_ENV: 'production', DATA_DIR: '/var/lib/restaurante', TRUST_PROXY: 'true' } });
    const res = await client().get(products('molotes'));
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('ADMIN_UNAVAILABLE');
  });

  it('CA-24 y CA-35: si la base de datos falla, responde 503 en JSON sin SQL, rutas ni stack, y lo registra', async () => {
    let failing = false;
    const wrapProductStore = (store: ProductStore): ProductStore => ({
      ...store,
      listBusiness: async (business) => {
        if (failing) {
          const { DatabaseUnavailableError } = await import('@restaurante/core/shared');
          throw new DatabaseUnavailableError({ name: 'PrismaClientKnownRequestError', code: 'P2039', originalCode: '1205' });
        }
        return store.listBusiness(business);
      },
    });
    const { browser, request: client, logger } = await adminApi({ env: { NODE_ENV: 'development' }, wrapProductStore });
    failing = true;
    const res = await browser.get(products('molotes'));
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: { code: 'DATABASE_UNAVAILABLE', message: 'Base de datos no disponible' } });
    expect(JSON.stringify(res.body)).not.toMatch(/1205|mysql|prisma|stack|\//i);
    expect(logger.lines).toContainEqual(expect.objectContaining({ msg: 'database_unavailable', originalCode: '1205' }));
    // La landing sigue respondiendo con la caché.
    expect((await client().get('/molotes')).status).toBe(200);
  });
});
