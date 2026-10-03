import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { createFileMenuRepository } from '../../src/repositories/file-menu-repository.js';
import { REPOSITORY_METHODS, assertMenuRepository } from '../../src/repositories/menu-repository.js';
import { createMemoryMenuRepository } from '../../src/repositories/memory-menu-repository.js';
import { makeConfig, seedDocuments } from '../helpers.js';

describe('contrato del repositorio de menús (RF-9)', () => {
  it.each([
    ['archivos', () => createFileMenuRepository({ dataDir: '/no/se/usa', timezone: 'UTC', seeds: seedDocuments() })],
    ['memoria', () => createMemoryMenuRepository({ seeds: seedDocuments() })],
  ])('la implementación de %s cumple el contrato', (_label, create) => {
    const repository = create();
    expect(assertMenuRepository(repository)).toBe(repository);
    for (const method of REPOSITORY_METHODS) expect(typeof repository[method]).toBe('function');
  });

  it('createApp rechaza un repositorio que no cumple el contrato', () => {
    expect(() => createApp({ config: makeConfig(), repository: { getPublished() {} } })).toThrow(/no implementa: init/);
    expect(() => createApp({ config: makeConfig() })).toThrow(/no implementa/);
  });

  it('CA-38: el repositorio en memoria trabaja sin archivos de datos', async () => {
    const repository = createMemoryMenuRepository({ seeds: seedDocuments() });
    await repository.init();
    expect([...repository.storage.files.keys()].sort()).toEqual(['birria/current', 'birria/previous', 'molotes/current', 'molotes/previous']);
    expect((await repository.getForEdit('molotes')).damaged).toBeNull();
  });

  it('las operaciones fallan rápido antes de init o con un negocio desconocido', async () => {
    const repository = createMemoryMenuRepository({ seeds: seedDocuments() });
    await expect(repository.getPublished('molotes')).rejects.toThrow(/init/);
    await repository.init();
    await expect(repository.getPublished('tacos')).rejects.toThrow(/Negocio desconocido/);
  });

  it('rechaza semillas que no cumplen el esquema', () => {
    const seeds = seedDocuments();
    seeds.molotes.data.menu.items[0].unitPriceCents = 0;
    expect(() => createMemoryMenuRepository({ seeds })).toThrow(/inválidos/);
  });
});
