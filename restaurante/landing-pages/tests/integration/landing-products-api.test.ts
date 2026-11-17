import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.ts';
import { makeConfig, makeRecordingLogger } from '../helpers.ts';
import { listenLocal } from '../support/http.ts';
import { fixedLandingPage, makeApiLandingProducts } from '../support/landing-products.ts';
import { startProductsApiDouble } from '../support/products-api-double.ts';
import { ANA, makeProductRepository, VALID_INPUTS } from '../support/products.ts';

/**
 * Landings con los productos de la API (REQ-F-038): el cliente real de contracts y la caché real de
 * las landings contra el doble HTTP de la API, que lee el mismo store que el repositorio de productos.
 * La invalidación tras cada escritura (el aviso interno de la api; internal-app.ts) se simula
 * suscribiendo la caché a las escrituras del repositorio.
 *
 * - CA-5, CA-6 y CA-7: con la API caída, lenta, con un cuerpo inválido o con 503, las landings
 *   responden 200 con la última copia buena o la semilla, lo registran y se recuperan sin reiniciar.
 */

/** App de landings con el doble de la API sobre un store en memoria importado de la semilla. */
async function landingsWithApi({ retryMs = 20, startDown = false }: { retryMs?: number; startDown?: boolean } = {}) {
  const logger = makeRecordingLogger();
  const { repository: products, store } = await makeProductRepository();
  const api = await startProductsApiDouble({ store });
  api.slowMs = 600;
  if (startDown) api.setMode('down');
  const landingProducts = makeApiLandingProducts({ url: api.url, logger, timeoutMs: 200, retryMs });
  await landingProducts.warmUp();
  // El aviso interno de la api tras cada escritura (internal-app.ts) invalida el negocio.
  products.onChange((business) => landingProducts.invalidate(business));
  const app = createApp({ config: makeConfig(), landingProducts, landingPage: fixedLandingPage(), logger });
  const client = (await listenLocal(app)).request();
  const get = async (path: string) => {
    const res = await client.get(path);
    // CA-7: nunca un 5xx por la API.
    expect(res.status, path).toBe(200);
    return res.text;
  };
  /** Renombra un platillo con chips de Birria, disponible (una escritura: invalida la caché). */
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
