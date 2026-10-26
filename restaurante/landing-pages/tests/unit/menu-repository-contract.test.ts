import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.ts';
import { createFileMenuRepository } from '../../src/repositories/file-menu-repository.ts';
import { REPOSITORY_METHODS, assertMenuRepository } from '../../src/repositories/menu-repository.ts';
import { createMemoryMenuRepository } from '../../src/repositories/memory-menu-repository.ts';
import { makeConfig, seedDocuments } from '../helpers.ts';

describe('contrato del repositorio de menús (RF-9)', () => {
  it.each([
    ['archivos', () => createFileMenuRepository({ dataDir: '/no/se/usa', timezone: 'UTC', seeds: seedDocuments() })],
    ['memoria', () => createMemoryMenuRepository({ seeds: seedDocuments() })],
  ])('la implementación de %s cumple el contrato', (_label, create) => {
    const repository = create();
    expect(assertMenuRepository(repository)).toBe(repository);
    for (const method of REPOSITORY_METHODS) expect(typeof repository[method as keyof typeof repository]).toBe('function');
  });

  it('createApp rechaza un repositorio que no cumple el contrato', () => {
    expect(() => createApp({ config: makeConfig(), repository: { getPublished() {} }, products: { getPublished() {} } as never })).toThrow(/no implementa: init/);
    // @ts-expect-error: sin repositorio, a propósito.
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
    // @ts-expect-error: negocio desconocido, a propósito.
    await expect(repository.getPublished('tacos')).rejects.toThrow(/Negocio desconocido/);
  });

  it('rechaza semillas que no cumplen el esquema', () => {
    const seeds = seedDocuments();
    seeds.molotes.data.menu.items[0]!.unitPriceCents = 0;
    expect(() => createMemoryMenuRepository({ seeds })).toThrow(/inválidos/);
  });
});
