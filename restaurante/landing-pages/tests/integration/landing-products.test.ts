import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.ts';
import { makeConfig } from '../helpers.ts';
import { FRIDAY_NOON_MX } from '../support/admin.ts';
import { listenLocal } from '../support/http.ts';
import { fixedLandingPage, makeApiLandingProducts } from '../support/landing-products.ts';
import { startProductsApiDouble } from '../support/products-api-double.ts';
import { ANA, VALID_INPUTS, makeProductRepository } from '../support/products.ts';

/**
 * Cambios de productos en las landings (REQ-F-008, CA-7 a CA-12): el repositorio de productos (el
 * que usa la API de administración) sobre un store en memoria con la semilla, el doble HTTP de la API
 * sobre ese store y la caché real de las landings. Cada escritura invalida su negocio, como el aviso
 * interno de la api (internal-app.ts): la landing la muestra sin reiniciar.
 */

async function start() {
  const { repository: products, store } = await makeProductRepository();
  const api = await startProductsApiDouble({ store });
  const landingProducts = makeApiLandingProducts({ url: api.url });
  await landingProducts.warmUp();
  products.onChange((business) => landingProducts.invalidate(business));
  const client = (await listenLocal(createApp({ config: makeConfig(), landingProducts, landingPage: fixedLandingPage(), now: () => FRIDAY_NOON_MX }))).request();
  return { client, products };
}

const document = (html: string) => new JSDOM(html).window.document;
const molotesCards = (html: string) => [...document(html).querySelectorAll('.menu-card h3')].map((node) => node.textContent.trim());
const birriaCards = (html: string) => [...document(html).querySelectorAll('article.menu-card')].map((node) => node.id);

describe('cambios de productos en las landings (CA-7 a CA-12)', () => {
  async function available(products: Awaited<ReturnType<typeof start>>['products'], business: 'molotes' | 'birria', id: number, input: Record<string, unknown>) {
    const product = await products.get(business, id);
    return products.update(business, id, { input: { ...input, available: true }, expectedVersion: product.version }, ANA);
  }

  it('CA-7 y CA-12: un platillo nuevo disponible en la posición 2 aparece segundo, sin reiniciar', async () => {
    const { client, products } = await start();
    const created = await products.create('molotes', { input: { category: 'platillo', ...VALID_INPUTS.molotesPlatillo } }, ANA);
    // Recién creado: no disponible (D-17), no aparece.
    expect(molotesCards((await client.get('/molotes')).text)).not.toContain('Molote de Frijol');
    await available(products, 'molotes', created.id, VALID_INPUTS.molotesPlatillo);
    for (let index = 0; index < 7; index += 1) {
      const current = await products.get('molotes', created.id);
      await products.move('molotes', created.id, 'up', current.version, ANA);
    }
    const { text } = await client.get('/molotes');
    expect(molotesCards(text).slice(0, 2)).toEqual(['Molotes de Queso Oaxaca', 'Molote de Frijol']);
    const card = [...document(text).querySelectorAll('.menu-card')][1]!;
    expect(card.textContent).toContain('Nuevo');
    expect(card.textContent).toContain('$45 c/u');
    expect(card.textContent).toContain('$130 orden de 3');
    expect(card.innerHTML).toContain('bg-sky-600');
  });

  it('CA-8: una bebida nueva disponible aparece en la sección de bebidas y no en el menú', async () => {
    const { client, products } = await start();
    const created = await products.create('molotes', { input: { category: 'bebida', ...VALID_INPUTS.molotesBebida } }, ANA);
    await available(products, 'molotes', created.id, VALID_INPUTS.molotesBebida);
    const { text } = await client.get('/molotes');
    const drinks = text.slice(text.indexOf('id="bebidas-seccion"'), text.indexOf('<!-- EL RITUAL'));
    expect(drinks).toContain('Café de Olla');
    expect(molotesCards(text)).not.toContain('Café de Olla');
  });

  it('CA-9: un producto eliminado o no disponible no aparece en el HTML', async () => {
    const { client, products } = await start();
    const [first, second] = await products.list('birria');
    await products.remove('birria', first!.id, first!.version, ANA);
    await products.update(
      'birria',
      second!.id,
      {
        input: {
          name: second!.name,
          label: second!.label,
          description: second!.description,
          price: (second!.priceCents! / 100).toFixed(2),
          priceUnit: second!.priceUnit,
          image: second!.image,
          detailsLabel: second!.detailsLabel,
          chips: second!.chips,
          available: false,
        },
        expectedVersion: second!.version,
      },
      ANA,
    );
    const { text } = await client.get('/birria');
    expect(text).not.toContain(first!.name);
    expect(text).not.toContain(second!.name);
    expect(birriaCards(text)).toHaveLength(4);
  });

  it('CA-10: si la primera variante no está disponible, la activa es la siguiente con su precio y descripción', async () => {
    const { client, products } = await start();
    const birriamen = (await products.list('birria')).find((product) => product.slug === 'birriamen')!;
    const [big, small] = birriamen.variants;
    await products.update(
      'birria',
      birriamen.id,
      {
        input: {
          name: birriamen.name,
          label: birriamen.label,
          image: birriamen.image,
          detailsLabel: birriamen.detailsLabel,
          variants: [
            { label: big!.label, price: big!.priceCents / 100, description: big!.description, available: false },
            { label: small!.label, price: small!.priceCents / 100, description: small!.description, available: true },
          ],
          available: true,
        },
        expectedVersion: birriamen.version,
      },
      ANA,
    );
    const card = document((await client.get('/birria')).text).querySelector('#card-birriamen')!;
    expect(card.querySelector('#desc-birriamen')?.textContent).toBe(small!.description);
    expect(card.querySelector('#price-birriamen')?.textContent).toContain(`$${small!.priceCents / 100}`);
    expect(card.querySelectorAll('[data-variant]')).toHaveLength(1);
  });

  it('CA-11: sin platillos, la landing muestra el aviso con el CTA de WhatsApp', async () => {
    const { client, products } = await start();
    for (const product of await products.list('birria')) await products.remove('birria', product.id, product.version, ANA);
    const { text } = await client.get('/birria');
    expect(text).toContain('Por ahora no tenemos productos disponibles en esta sección. Escríbenos por WhatsApp.');
    expect(birriaCards(text)).toHaveLength(0);
  });
});
