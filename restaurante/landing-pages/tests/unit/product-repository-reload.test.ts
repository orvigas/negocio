import { describe, expect, it } from 'vitest';

import { createMemoryProductStore, createProductRepository, type ProductStore } from '@restaurante/core/catalog';

import { ANA, VALID_INPUTS, seedSources } from '../support/products.ts';

/**
 * Repositorio de productos con dos procesos (REQ-F-039): la API escribe y landing-pages lee su caché.
 * - `init()` sin fuentes solo carga la caché, sin importar semillas (O-1: la API nunca importa).
 * - `reload(business)` vuelve a leer lo publicado (aviso interno y recarga de 60 s del bot, RF-12/13).
 */

const imageExists = async () => true;

async function twoProcesses() {
  const store = createMemoryProductStore();
  const landing = createProductRepository({ store, imageExists });
  await landing.init(seedSources());
  const api = createProductRepository({ store, imageExists });
  await api.init();
  return { store, landing, api };
}

describe('init sin fuentes y reload', () => {
  it('init() sin fuentes no importa nada: con la base vacía, la caché queda vacía y no se marca la importación', async () => {
    const store = createMemoryProductStore();
    const api = createProductRepository({ store, imageExists });
    await api.init();
    expect(api.getPublished('molotes')).toEqual({ menu: [], drinks: [] });
    expect(await store.listBusiness('molotes')).toEqual([]);
    expect(await store.transaction((tx) => tx.isImported('molotes'))).toBe(false);
  });

  it('una escritura de otro proceso no cambia la caché hasta reload; reload la actualiza y devuelve true', async () => {
    const { landing, api } = await twoProcesses();
    const before = landing.getPublished('molotes').drinks.length;
    const created = await api.create('molotes', { input: { ...VALID_INPUTS.molotesBebida, category: 'bebida', name: 'Agua de Jamaica' } }, ANA);
    await api.update('molotes', created.id, { input: { ...VALID_INPUTS.molotesBebida, name: 'Agua de Jamaica', available: true }, expectedVersion: 1 }, ANA);
    expect(landing.getPublished('molotes').drinks).toHaveLength(before);
    expect(await landing.reload('molotes')).toBe(true);
    expect(landing.getPublished('molotes').drinks.map((drink) => drink.name)).toContain('Agua de Jamaica');
  });

  it('si la base falla, reload devuelve false y conserva la copia anterior', async () => {
    const store = createMemoryProductStore();
    let failing = false;
    const flaky: ProductStore = {
      ...store,
      listBusiness: (business) => (failing ? Promise.reject(new Error('caída')) : store.listBusiness(business)),
      lastChanges: (business) => store.lastChanges(business),
      lastBusinessChange: (business) => store.lastBusinessChange(business),
      transaction: (task) => store.transaction(task),
    };
    const landing = createProductRepository({ store: flaky, imageExists });
    await landing.init(seedSources());
    const published = landing.getPublished('birria');
    failing = true;
    expect(await landing.reload('birria')).toBe(false);
    expect(landing.getPublished('birria')).toEqual(published);
  });
});
