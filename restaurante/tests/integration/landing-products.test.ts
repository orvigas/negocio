import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it } from 'vitest';

import { DEFAULT_PUBLIC_DIR, createApp } from '../../src/app.ts';
import { loadSeedDocument } from '../../src/content/seeds.ts';
import { openDatabase } from '../../src/db/client.ts';
import { createFileMenuRepository } from '../../src/repositories/file-menu-repository.ts';
import { createPrismaProductStore } from '../../src/repositories/prisma-product-store.ts';
import { createProductRepository, type ProductStore } from '../../src/repositories/product-repository.ts';
import { createImageChecker } from '../../src/services/admin-form.ts';
import type { MenuDocument } from '../../src/services/menu-schema.ts';
import { makeConfig, makeRecordingLogger } from '../helpers.ts';
import { FRIDAY_NOON_MX } from '../support/admin.ts';
import { makeTempDir } from '../support/database.ts';
import { listenLocal } from '../support/http.ts';
import { ANA, VALID_INPUTS } from '../support/products.ts';

/**
 * Landings con los productos de la base de datos (REQ-F-008, RF-3 y RF-4): DATA_DIR temporal con
 * los JSON reales (repositorio de archivos) y SQLite, igual que en src/server.ts.
 */

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()?.();
});

async function newDataDir(): Promise<string> {
  const { dir, cleanup } = await makeTempDir('landing-products-');
  cleanups.push(cleanup);
  return dir;
}

/** Arranca como src/server.ts: menús (JSON) -> base de datos -> importación de productos -> app. */
async function start(dataDir: string, { wrapStore = (store: ProductStore) => store } = {}) {
  const logger = makeRecordingLogger();
  const menus = createFileMenuRepository({ dataDir, timezone: 'America/Mexico_City' });
  await menus.init();
  const { prisma } = await openDatabase({ dataDir });
  cleanups.push(() => prisma.$disconnect());
  if ((await prisma.user.count({ where: { id: ANA.id } })) === 0) {
    await prisma.user.create({ data: { id: ANA.id, username: 'ana', usernameKey: 'ana', displayName: 'Ana', role: 'admin', passwordHash: 'x', updatedAt: new Date() } });
  }
  const products = createProductRepository({
    store: wrapStore(createPrismaProductStore({ prisma })),
    imageExists: createImageChecker(DEFAULT_PUBLIC_DIR),
    logger,
  });
  await products.init({ molotes: await menus.getStartupSource('molotes'), birria: await menus.getStartupSource('birria') });
  const client = (await listenLocal(createApp({ config: makeConfig(), repository: menus, products, logger, now: () => FRIDAY_NOON_MX }))).request();
  return { client, products, prisma, logger };
}

const document = (html: string) => new JSDOM(html).window.document;
const molotesCards = (html: string) => [...document(html).querySelectorAll('.menu-card h3')].map((node) => node.textContent.trim());
const birriaCards = (html: string) => [...document(html).querySelectorAll('article.menu-card')].map((node) => node.id);

describe('importación y landings (RF-3, RF-4)', () => {
  it('CA-1: en un DATA_DIR sin productos importa la semilla y las landings no cambian (snapshots)', async () => {
    const dataDir = await newDataDir();
    const { client, prisma, logger } = await start(dataDir);
    expect(await prisma.productImport.findMany({ orderBy: { business: 'asc' } })).toMatchObject([
      { business: 'birria', source: 'seed', count: 6 },
      { business: 'molotes', source: 'seed', count: 10 },
    ]);
    expect(logger.lines.filter((line) => line.msg === 'products_imported')).toHaveLength(2);
    await expect((await client.get('/molotes')).text).toMatchFileSnapshot('../snapshots/landing-molotes.html');
    await expect((await client.get('/birria')).text).toMatchFileSnapshot('../snapshots/landing-birria.html');
  });

  it('CA-2: importa desde current.json (Queso Oaxaca a 50.00 y Huitlacoche no disponible)', async () => {
    const dataDir = await newDataDir();
    const current = loadSeedDocument('molotes') as MenuDocument<'molotes'>;
    current.data.menu.items[0]!.unitPriceCents = 5000;
    current.data.menu.items[7]!.available = false;
    await mkdir(join(dataDir, 'molotes'), { recursive: true });
    await writeFile(join(dataDir, 'molotes', 'current.json'), JSON.stringify(current));
    const { client, logger } = await start(dataDir);
    const { text } = await client.get('/molotes');
    const card = text.slice(text.indexOf('>Molotes de Queso Oaxaca<'));
    expect(card.slice(0, 800)).toContain('$50 c/u');
    expect(text).not.toContain('Huitlacoche');
    expect(logger.lines.find((line) => line.msg === 'products_imported' && line.business === 'molotes')).toMatchObject({ source: 'current' });
  });

  it('CA-3: después de importar, un reinicio no reimporta y conserva los cambios', async () => {
    const dataDir = await newDataDir();
    const first = await start(dataDir);
    const created = await first.products.create('molotes', { input: { category: 'bebida', ...VALID_INPUTS.molotesBebida } }, ANA);
    const second = await start(dataDir);
    expect(second.logger.lines.some((line) => line.msg === 'products_imported')).toBe(false);
    expect(await second.prisma.productChange.count({ where: { action: 'import' } })).toBe(16);
    expect((await second.products.get('molotes', created.id)).name).toBe('Café de Olla');
  });

  it('CA-5: con current.json dañado y previous.json válido, importa desde previous.json y el log indica la fuente', async () => {
    const dataDir = await newDataDir();
    const previous = loadSeedDocument('birria') as MenuDocument<'birria'>;
    previous.data.menu.items[0]!.name = 'Quesabirria de la versión anterior';
    await mkdir(join(dataDir, 'birria'), { recursive: true });
    await writeFile(join(dataDir, 'birria', 'previous.json'), JSON.stringify(previous));
    await writeFile(join(dataDir, 'birria', 'current.json'), '{ roto');
    const { client, logger } = await start(dataDir);
    expect(logger.lines.find((line) => line.msg === 'products_imported' && line.business === 'birria')).toMatchObject({ source: 'previous' });
    expect((await client.get('/birria')).text).toContain('Quesabirria de la versión anterior');
  });

  it('con current.json y previous.json dañados, importa desde la semilla', async () => {
    const dataDir = await newDataDir();
    await mkdir(join(dataDir, 'birria'), { recursive: true });
    await writeFile(join(dataDir, 'birria', 'previous.json'), '{ roto');
    await writeFile(join(dataDir, 'birria', 'current.json'), '{ roto');
    const { logger } = await start(dataDir);
    expect(logger.lines.find((line) => line.msg === 'products_imported' && line.business === 'birria')).toMatchObject({ source: 'seed' });
  });
});

describe('cambios de productos en las landings (CA-7 a CA-12)', () => {
  async function available(products: Awaited<ReturnType<typeof start>>['products'], business: 'molotes' | 'birria', id: number, input: Record<string, unknown>) {
    const product = await products.get(business, id);
    return products.update(business, id, { input: { ...input, available: true }, expectedVersion: product.version }, ANA);
  }

  it('CA-7 y CA-12: un platillo nuevo disponible en la posición 2 aparece segundo, sin reiniciar', async () => {
    const { client, products } = await start(await newDataDir());
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
    const { client, products } = await start(await newDataDir());
    const created = await products.create('molotes', { input: { category: 'bebida', ...VALID_INPUTS.molotesBebida } }, ANA);
    await available(products, 'molotes', created.id, VALID_INPUTS.molotesBebida);
    const { text } = await client.get('/molotes');
    const drinks = text.slice(text.indexOf('id="bebidas-seccion"'), text.indexOf('<!-- EL RITUAL'));
    expect(drinks).toContain('Café de Olla');
    expect(molotesCards(text)).not.toContain('Café de Olla');
  });

  it('CA-9: un producto eliminado o no disponible no aparece en el HTML', async () => {
    const { client, products } = await start(await newDataDir());
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
    const { client, products } = await start(await newDataDir());
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
    const { client, products } = await start(await newDataDir());
    for (const product of await products.list('birria')) await products.remove('birria', product.id, product.version, ANA);
    const { text } = await client.get('/birria');
    expect(text).toContain('Por ahora no tenemos productos disponibles en esta sección. Escríbenos por WhatsApp.');
    expect(birriaCards(text)).toHaveLength(0);
  });
});

describe('fallo de la base de datos con el servidor en marcha (CA-35, D-15)', () => {
  it('la landing responde 200 con los últimos productos válidos', async () => {
    let failing = false;
    const { client, products } = await start(await newDataDir(), {
      wrapStore: (store) => ({
        listBusiness: (business) => (failing ? Promise.reject(new Error('SQLITE_IOERR')) : store.listBusiness(business)),
        lastChanges: (business) => store.lastChanges(business),
        lastBusinessChange: (business) => store.lastBusinessChange(business),
        transaction: (task) => store.transaction(task),
      }),
    });
    const before = (await client.get('/molotes')).text;
    failing = true;
    await expect(products.list('molotes')).rejects.toThrow();
    const res = await client.get('/molotes');
    expect(res.status).toBe(200);
    expect(res.text).toBe(before);
  });
});
