import { describe, expect, it } from 'vitest';

import { IMAGE, VALID_INPUTS } from '../support/products.ts';
import { products, adminApi, molotesDrink } from '../support/admin-products-api.ts';

/**
 * API JSON de productos (REQ-F-008, RF-5, RF-7, RF-8, D-18 y D-19): CA-13 a CA-31 por la API.
 *
 * REQ-F-041: parte de admin-products-api.test.ts (preparación en
 * tests/support/admin-products-api.ts).
 */

describe('crear, consultar y validar (CA-16 a CA-22)', () => {
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
