import { describe, expect, it } from 'vitest';

import type { BusinessId } from '@restaurante/core/shared';

import { createApp } from '../../src/app.ts';
import { makeConfig, makeRecordingLogger, makeRepository } from '../helpers.ts';
import { formFields, login, setupAdmin, type Browser } from '../support/admin.ts';
import { listenLocal } from '../support/http.ts';
import { makeApiLandingProducts } from '../support/landing-products.ts';
import { startProductsApiDouble, type ProductsApiDouble } from '../support/products-api-double.ts';
import { ANA, makeProductRepository, VALID_INPUTS } from '../support/products.ts';

/**
 * Landings con los productos de la API (REQ-F-038): el cliente real de contracts y la caché real de
 * las landings contra el doble HTTP de la API, que lee el mismo store que /admin.
 *
 * - CA-4: cada escritura de /admin (HTML y /admin/api) se ve en la siguiente visita de la landing de
 *   ese negocio (una petición nueva a la API); la del otro negocio no cambia ni pide nada. Sin la
 *   invalidación, la caché fresca (60 s) seguiría sirviendo lo anterior.
 * - CA-5, CA-6 y CA-7: con la API caída, lenta, con un cuerpo inválido o con 503, las landings
 *   responden 200 con la última copia buena o la semilla, lo registran y se recuperan sin reiniciar.
 */

const API = '/admin/api';
const productsPath = (business: string) => `${API}/${business}/productos`;
const editPath = (business: string, id: number) => `/admin/${business}/productos/${id}`;

/** /admin con la caché real de las landings contra el doble de la API sobre el store de MySQL. */
async function adminWithApi() {
  let api: ProductsApiDouble | undefined;
  const context = await setupAdmin({
    landingProducts: async ({ store }) => {
      api = await startProductsApiDouble({ store });
      const landing = makeApiLandingProducts({ url: api.url });
      await landing.warmUp();
      return landing;
    },
  });
  const browser = context.browser();
  expect((await login(browser)).status).toBe(303);
  // setupAdmin llamó a la fábrica antes de crear la app.
  const double = api!;
  const landing = async (business: BusinessId) => {
    const res = await context.request().get(`/${business}`);
    expect(res.status).toBe(200);
    return res.text;
  };
  /**
   * Ejecuta una escritura y comprueba CA-4: la siguiente visita del negocio pide a la API una vez y
   * devuelve el HTML nuevo; la del otro negocio no pide nada.
   */
  async function afterWrite(business: BusinessId, write: () => Promise<{ status: number }>, expectedStatus: number): Promise<string> {
    const other: BusinessId = business === 'molotes' ? 'birria' : 'molotes';
    await landing(other);
    const before = { ...double.hits };
    expect((await write()).status).toBe(expectedStatus);
    const html = await landing(business);
    await landing(other);
    expect(double.hits[business], `peticiones de ${business}`).toBe(before[business] + 1);
    expect(double.hits[other], `peticiones de ${other}`).toBe(before[other]);
    return html;
  }
  return { ...context, browser, double, landing, afterWrite };
}

async function apiToken(browser: Browser): Promise<string> {
  return (await browser.get(`${API}/sesion`)).body.csrfToken as string;
}

describe('CA-4: los cambios de /admin se ven al instante en la landing', () => {
  it('desde /admin/api: crear, editar, ocultar, eliminar, recuperar y reordenar (Birria)', async () => {
    const { browser, afterWrite, landing } = await adminWithApi();
    const csrf = await apiToken(browser);
    const send = (method: 'post' | 'put' | 'delete', path: string, body?: object) => {
      const req = browser[method](path).set('X-CSRF-Token', csrf);
      return body === undefined ? req : req.send(body);
    };
    const list = async () => (await browser.get(`${productsPath('birria')}?categoria=platillo`)).body.products as Record<string, unknown>[];
    const editable = (product: Record<string, unknown>) =>
      Object.fromEntries(Object.entries(product).filter(([key]) => ['name', 'label', 'description', 'price', 'priceUnit', 'image', 'detailsLabel', 'chips', 'available', 'version'].includes(key)));

    // Crear: queda no disponible (D-17), así que la landing no lo muestra, pero sí pidió los datos nuevos.
    const created = await afterWrite('birria', () => send('post', productsPath('birria'), { category: 'platillo', detailsType: 'variants', ...VALID_INPUTS.birriaVariants, name: 'Agua REQ038' }), 201);
    expect(created).not.toContain('Agua REQ038');

    const [first, second] = await list();
    const edited = await afterWrite('birria', () => send('put', `${productsPath('birria')}/${String(first!.id)}`, { ...editable(first!), name: 'Taco Editado REQ038' }), 200);
    expect(edited).toContain('Taco Editado REQ038');

    const [afterEdit] = await list();
    const hidden = await afterWrite('birria', () => send('put', `${productsPath('birria')}/${String(first!.id)}`, { ...editable(afterEdit!), available: false }), 200);
    expect(hidden).not.toContain('Taco Editado REQ038');

    const secondName = String(second!.name);
    expect(await landing('birria')).toContain(secondName);
    const removed = await afterWrite('birria', () => send('delete', `${productsPath('birria')}/${String(second!.id)}?version=${String(second!.version)}`), 200);
    expect(removed).not.toContain(secondName);

    // Recuperar: vuelve no disponible; la landing pidió los datos nuevos.
    const deleted = (await browser.get(`${productsPath('birria')}?eliminados=1`)).body.products as Record<string, unknown>[];
    const { version } = deleted.find((product) => product.id === second!.id)!;
    await afterWrite('birria', () => send('post', `${productsPath('birria')}/${String(second!.id)}/recuperar`, { version }), 200);

    const current = await list();
    const [a, b, c, ...rest] = current.filter((product) => product.available === true);
    const hiddenOnes = current.filter((product) => product.available !== true);
    const order = [a!, c!, b!, ...rest, ...hiddenOnes].map(({ id, version: v }) => ({ id, version: v }));
    const reordered = await afterWrite('birria', () => send('put', `${productsPath('birria')}/orden`, { category: 'platillo', items: order }), 200);
    expect(reordered.indexOf(`id="card-${String(c!.slug)}"`)).toBeLessThan(reordered.indexOf(`id="card-${String(b!.slug)}"`));
  });

  it('desde /admin HTML: crear, editar, ocultar, eliminar, recuperar y subir (Molotes)', async () => {
    const { browser, products, afterWrite } = await adminWithApi();
    const idOf = async (slug: string) => (await products.list('molotes', { includeDeleted: true })).find((product) => product.slug === slug)!.id;
    const editForm = async (id: number) => formFields((await browser.get(editPath('molotes', id))).text, '#product-form');

    const newPage = await browser.get('/admin/molotes/productos/nuevo?categoria=platillo');
    const created = await afterWrite(
      'molotes',
      () =>
        browser
          .post('/admin/molotes/productos')
          .type('form')
          .send({
            ...formFields(newPage.text, '#product-form'),
            action: 'create',
            name: 'Molote REQ038',
            description: 'Nuevo.',
            label: 'Nuevo',
            tone: 'sky',
            price: '45',
            orderPrice: '130',
            orderQuantity: '3',
            'image.src': '/img/molotes/molotes-queso-oaxaca.jpg',
            'image.alt': 'Molote',
            'image.width': '800',
            'image.height': '600',
          }),
      303,
    );
    expect(created).not.toContain('Molote REQ038');

    const queso = await idOf('queso-oaxaca');
    const edited = await afterWrite('molotes', async () => browser.post(editPath('molotes', queso)).type('form').send({ ...(await editForm(queso)), action: 'update', price: '50.00' }), 303);
    const card = edited.slice(edited.indexOf('>Molotes de Queso Oaxaca<'));
    expect(card.slice(0, 800)).toContain('$50 c/u');

    const huitlacoche = await idOf('huitlacoche-epazote');
    const hidden = await afterWrite(
      'molotes',
      async () => {
        const fields: Record<string, string | undefined> = { ...(await editForm(huitlacoche)), action: 'update' };
        delete fields.available;
        return browser.post(editPath('molotes', huitlacoche)).type('form').send(fields);
      },
      303,
    );
    expect(hidden).not.toContain('Molotes de Huitlacoche con Epazote');

    const removed = await afterWrite(
      'molotes',
      async () => {
        const confirm = await browser.get(`${editPath('molotes', queso)}/eliminar`);
        return browser.post(`${editPath('molotes', queso)}/eliminar`).type('form').send({ ...formFields(confirm.text, 'form.mt-4'), action: 'delete' });
      },
      303,
    );
    expect(removed).not.toContain('Molotes de Queso Oaxaca');

    await afterWrite(
      'molotes',
      async () => {
        const page = await browser.get('/admin/molotes/productos/eliminados');
        return browser.post(`${editPath('molotes', queso)}/recuperar`).type('form').send(formFields(page.text, 'form.admin-products__restore'));
      },
      303,
    );

    const [, second, third] = await products.list('molotes', { category: 'platillo' });
    const moved = await afterWrite(
      'molotes',
      async () => {
        const page = await browser.get('/admin/molotes');
        const selector = `form[action="${editPath('molotes', third!.id)}/subir"]`;
        return browser.post(`${editPath('molotes', third!.id)}/subir`).type('form').send(formFields(page.text, selector));
      },
      303,
    );
    expect(moved.indexOf(`>${third!.name}<`)).toBeLessThan(moved.indexOf(`>${second!.name}<`));
  });
});

describe('DEF-003: el aviso de /admin al guardar un producto depende de la API', () => {
  it('con la API disponible dice que la landing ya lo muestra; caída, que lo mostrará cuando vuelva', async () => {
    const { browser, products, double, landing } = await adminWithApi();
    const id = (await products.list('molotes')).find((product) => product.slug === 'queso-oaxaca')!.id;
    const save = async (price: string) => {
      const fields = formFields((await browser.get(editPath('molotes', id))).text, '#product-form');
      const res = await browser.post(editPath('molotes', id)).type('form').send({ ...fields, action: 'update', price });
      expect(res.status).toBe(303);
      const page = await browser.get(res.headers.location!);
      expect(page.status).toBe(200);
      return { location: res.headers.location!, text: page.text };
    };

    const ok = await save('50.00');
    expect(ok.location).toBe('/admin/molotes?ok=product_saved');
    expect(ok.text).toContain('La landing ya muestra los datos nuevos.');
    expect(await landing('molotes')).toContain('$50 c/u');

    double.setMode('down');
    const pending = await save('55.00');
    expect(pending.location).toBe('/admin/molotes?ok=product_saved_pending');
    expect(pending.text).not.toContain('La landing ya muestra los datos nuevos.');
    expect(pending.text).toContain('La landing lo mostrará en cuanto la API de productos vuelva a responder');
    // La landing sigue con su última copia buena (y responde 200).
    const html = await landing('molotes');
    expect(html).toContain('$50 c/u');
    expect(html).not.toContain('$55 c/u');
  });
});

/** App de landings con el doble de la API sobre un store en memoria importado de la semilla. */
async function landingsWithApi({ retryMs = 20, startDown = false }: { retryMs?: number; startDown?: boolean } = {}) {
  const logger = makeRecordingLogger();
  const { repository: products, store } = await makeProductRepository();
  const api = await startProductsApiDouble({ store });
  api.slowMs = 600;
  if (startDown) api.setMode('down');
  const landingProducts = makeApiLandingProducts({ url: api.url, logger, timeoutMs: 200, retryMs });
  await landingProducts.warmUp();
  const app = createApp({ config: makeConfig(), repository: await makeRepository(), products, landingProducts, logger });
  const client = (await listenLocal(app)).request();
  const get = async (path: string) => {
    const res = await client.get(path);
    // CA-7: nunca un 5xx por la API.
    expect(res.status, path).toBe(200);
    return res.text;
  };
  /** Renombra un platillo con chips de Birria, disponible (escritura de /admin: invalida la caché). */
  const rename = async (name: string) => {
    const chips = (await products.list('birria')).find((product) => product.detailsType === 'chips');
    await products.update('birria', chips!.id, { input: { ...VALID_INPUTS.birriaChips, name, available: true }, expectedVersion: chips!.version }, ANA);
  };
  const fallbacks = () => logger.lines.filter((line) => line.msg === 'landing_products_fallback');
  return { api, logger, products, store, get, rename, fallbacks };
}

/** Repite la visita hasta que cumpla `predicate` (los reintentos van en segundo plano). */
async function eventually(get: () => Promise<string>, predicate: (html: string) => boolean): Promise<string> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const html = await get();
    if (predicate(html)) return html;
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  throw new Error('La landing no llegó al estado esperado');
}

describe('CA-5 y CA-7: API caída en funcionamiento', () => {
  it.each(['down', 'slow', 'invalid', 'http503'] as const)('%s: 200 con la última copia buena, evento registrado y recuperación sin reiniciar', async (mode) => {
    const { api, get, rename, fallbacks } = await landingsWithApi();
    await rename('Primera Copia REQ038');
    expect(await get('/birria')).toContain('Primera Copia REQ038');

    api.setMode(mode);
    await rename('Segunda Copia REQ038');
    for (const path of ['/', '/birria', '/molotes']) await get(path);
    const html = await get('/birria');
    expect(html).toContain('Primera Copia REQ038');
    expect(html).not.toContain('Segunda Copia REQ038');
    const reasons = { down: 'network', slow: 'timeout', invalid: 'invalid_body', http503: 'http_status' };
    expect(fallbacks().at(-1)).toMatchObject({ business: 'birria', reason: reasons[mode], source: 'last_good' });

    api.setMode('ok');
    await eventually(() => get('/birria'), (page) => page.includes('Segunda Copia REQ038'));
  });
});

describe('CA-6 y CA-7: arranque sin API', () => {
  it('sirve la semilla, lo registra y pasa a los datos de la API al levantarla, sin reiniciar', async () => {
    const { api, get, rename, fallbacks } = await landingsWithApi({ startDown: true });
    // warmUp carga los dos negocios en paralelo: el orden de los avisos no está garantizado (DEF-003 de
    // REQ-F-039). Se exige exactamente un aviso por negocio, sin depender del orden.
    const seen = fallbacks().map((line) => [line.business, line.source]);
    expect(seen).toHaveLength(2);
    expect(seen).toEqual(expect.arrayContaining([
      ['molotes', 'seed'],
      ['birria', 'seed'],
    ]));
    await rename('Desde La API REQ038');
    for (const path of ['/', '/birria', '/molotes']) expect(await get(path)).not.toContain('Desde La API REQ038');

    api.setMode('ok');
    await eventually(() => get('/birria'), (page) => page.includes('Desde La API REQ038'));
  });
});
