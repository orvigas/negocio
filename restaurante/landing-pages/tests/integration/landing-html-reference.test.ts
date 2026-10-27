import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { PROJECT_DIR } from '../../src/config/env.ts';
import { createApp } from '../../src/app.ts';
import { makeConfig, makeRepository } from '../helpers.ts';
import { listenLocal } from '../support/http.ts';
import { makeApiLandingProducts } from '../support/landing-products.ts';
import { startProductsApiDouble } from '../support/products-api-double.ts';
import { makeProductRepository } from '../support/products.ts';

/**
 * CA-1 de REQ-F-038 (HTML idéntico): con los mismos datos (la semilla importada), el HTML de `/`,
 * `/molotes` y `/birria` forzando cada uno de los 7 días en desarrollo (`?dia=`) es byte a byte el
 * que daba el código anterior al cambio, cuando las landings leían el repositorio de productos.
 *
 * La referencia (tests/snapshots/landing-html/) se generó con el commit 769ad8b de
 * epic/arquitectura; manifest.json guarda la ruta, el día, el archivo y su SHA-256. Esta prueba nunca
 * la reescribe: ahora los productos llegan por HTTP (cliente real de contracts contra el doble de la
 * API sobre el mismo store) y solo se compara.
 */

const REFERENCE_DIR = join(PROJECT_DIR, 'tests', 'snapshots', 'landing-html');

interface Entry {
  route: string;
  day: string;
  file: string;
  sha256: string;
}

const manifest = JSON.parse(await readFile(join(REFERENCE_DIR, 'manifest.json'), 'utf8')) as { entries: Entry[] };

describe('CA-1: HTML idéntico al previo a REQ-F-038', () => {
  it('la referencia cubre las 3 rutas × 7 días', () => {
    expect(manifest.entries).toHaveLength(21);
    expect(new Set(manifest.entries.map((entry) => entry.route))).toEqual(new Set(['/', '/molotes', '/birria']));
  });

  it('las 21 respuestas coinciden byte a byte', async () => {
    const repository = await makeRepository();
    const { repository: products, store } = await makeProductRepository();
    const api = await startProductsApiDouble({ store });
    const landingProducts = makeApiLandingProducts({ url: api.url });
    await landingProducts.warmUp();
    const app = createApp({ config: makeConfig({ NODE_ENV: 'development' }), repository, products, landingProducts, now: () => new Date('2026-10-23T18:00:00Z') });
    const client = (await listenLocal(app)).request();

    for (const entry of manifest.entries) {
      const reference = await readFile(join(REFERENCE_DIR, entry.file), 'utf8');
      expect(createHash('sha256').update(reference).digest('hex'), `referencia ${entry.file}`).toBe(entry.sha256);
      const res = await client.get(`${entry.route}?dia=${entry.day}`);
      expect(res.status).toBe(200);
      expect(res.text === reference, `${entry.route} ${entry.day}`).toBe(true);
    }
    // Los productos vinieron de la API (una petición por negocio en la carga inicial).
    expect(api.hits).toEqual({ molotes: 1, birria: 1 });
  });
});
