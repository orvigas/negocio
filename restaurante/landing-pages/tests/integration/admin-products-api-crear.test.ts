import { describe, expect, it } from 'vitest';

import { products, adminApi, molotesDrink } from '../support/admin-products-api.ts';

/**
 * API JSON de productos (REQ-F-008, RF-5, RF-7, RF-8, D-18 y D-19): CA-13 a CA-31 por la API.
 *
 * REQ-F-041: parte de admin-products-api.test.ts (preparación en
 * tests/support/admin-products-api.ts).
 */

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
});
