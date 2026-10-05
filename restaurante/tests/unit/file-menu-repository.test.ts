import * as nodeFs from 'node:fs/promises';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { BusinessId } from '../../src/config/businesses.ts';
import { CHANGE_LOG_FILE, createFileMenuRepository, type FileSystem } from '../../src/repositories/file-menu-repository.ts';
import {
  MenuConflictError,
  MenuDamagedError,
  PreviousUnavailableError,
  SeedRestoreNotAllowedError,
  versionOf,
} from '../../src/repositories/menu-repository.ts';
import { makeRecordingLogger, seedData, seedDocuments, type CorruptibleData, type RecordingLogger } from '../helpers.ts';
import { makeClock, type Clock } from '../support/admin.ts';

const TIMEZONE = 'America/Mexico_City';
let dataDir: string;

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'menu-repo-'));
});

afterEach(async () => {
  await rm(dataDir, { recursive: true, force: true });
});

const fileOf = (businessId: string, name: string) => join(dataDir, businessId, name);
const readJson = async (businessId: string, name: string) => JSON.parse(await readFile(fileOf(businessId, name), 'utf8'));
const readChanges = async () =>
  (await readFile(join(dataDir, CHANGE_LOG_FILE), 'utf8'))
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
const listFiles = (businessId: string) => readdir(join(dataDir, businessId));

/** `fs`: doble de prueba (parcial) de node:fs/promises. */
async function makeRepo({ clock = makeClock(), logger = makeRecordingLogger(), fs }: { clock?: Clock; logger?: RecordingLogger; fs?: object } = {}) {
  const repository = createFileMenuRepository({
    dataDir,
    timezone: TIMEZONE,
    now: clock.now,
    logger,
    // Los dobles solo implementan lo que ejercita cada prueba.
    fs: fs as FileSystem | undefined,
    seeds: seedDocuments(),
  });
  await repository.init();
  return { repository, logger, clock };
}

/** Escribe un documento como si lo hubiera guardado una versión anterior de la app. */
async function writeDocument(
  businessId: BusinessId,
  name: string,
  mutate: (data: CorruptibleData) => unknown = () => {},
  overrides: Record<string, unknown> = {},
) {
  const document = { ...seedDocuments()[businessId], ...overrides };
  mutate(document.data);
  await nodeFs.mkdir(join(dataDir, businessId), { recursive: true });
  await writeFile(fileOf(businessId, name), JSON.stringify(document));
  return document;
}

function changedData(businessId: BusinessId, mutate: (data: CorruptibleData) => unknown) {
  const data = seedData(businessId);
  mutate(data);
  return data;
}

describe('primera ejecución (RF-1.5, CA-4)', () => {
  it('crea la versión vigente y la anterior a partir de la semilla y lo registra', async () => {
    const { repository, logger } = await makeRepo();
    for (const businessId of ['molotes', 'birria'] as const) {
      expect(await readJson(businessId, 'current.json')).toEqual(seedDocuments()[businessId]);
      expect(await readJson(businessId, 'previous.json')).toEqual(seedDocuments()[businessId]);
      expect((await repository.getPublished(businessId)).data).toEqual(seedData(businessId));
    }
    expect(logger.lines.filter((line) => line.msg === 'menu_data_seeded')).toHaveLength(2);
    expect(logger.lines.some((line) => line.msg === 'menu_data_damaged')).toBe(false);
    expect(await repository.getLastChange('molotes')).toBeNull();
  });

  it('falla al iniciar si la carpeta de datos no se puede usar', async () => {
    const file = join(dataDir, 'archivo');
    await writeFile(file, 'x');
    const repository = createFileMenuRepository({ dataDir: file, timezone: TIMEZONE, seeds: seedDocuments() });
    await expect(repository.init()).rejects.toThrow();
  });
});

describe('guardar (RF-6, CA-27)', () => {
  it('escribe los datos nuevos, conserva la versión anterior y registra el cambio', async () => {
    const { repository } = await makeRepo();
    const { version } = await repository.getForEdit('molotes');
    const data = changedData('molotes', (d: CorruptibleData) => {
      d.menu.items[0].unitPriceCents = 5000;
      d.promo.title = 'Martes 2x1';
    });

    const saved = await repository.save('molotes', { data, expectedVersion: version, author: { id: 1, name: '  Ana  ' } });

    expect(saved).toMatchObject({ revision: 1, updatedBy: 'Ana', updatedAt: '2026-10-09T12:00:00-06:00' });
    expect(await readJson('molotes', 'current.json')).toEqual(saved);
    expect(await readJson('molotes', 'previous.json')).toEqual(seedDocuments().molotes);
    expect((await repository.getPublished('molotes')).data).toEqual(data);
    expect(await repository.getLastChange('molotes')).toEqual({ at: '2026-10-09T12:00:00-06:00', by: 'Ana' });

    expect(await readChanges()).toEqual([
      {
        at: '2026-10-09T12:00:00-06:00',
        author: 'Ana', authorId: 1,
        business: 'molotes',
        action: 'save',
        changes: [
          { field: 'menu.items.0.unitPriceCents', before: 4500, after: 5000 },
          { field: 'promo.title', before: 'Jueves de Molotes 2x1', after: 'Martes 2x1' },
        ],
      },
    ]);
    expect((await listFiles('molotes')).filter((name) => name.endsWith('.tmp'))).toEqual([]);
  });

  it('CA-32: con una versión que ya no es la vigente no escribe nada y reporta quién y cuándo', async () => {
    const { repository, clock } = await makeRepo();
    const { version } = await repository.getForEdit('birria');
    clock.advance(60_000);
    await repository.save('birria', { data: seedData('birria'), expectedVersion: version, author: { id: 1, name: 'Ana' } });
    const before = await readFile(fileOf('birria', 'current.json'), 'utf8');

    const attempt = repository.save('birria', { data: seedData('birria'), expectedVersion: version, author: { id: 1, name: 'Beto' } });
    await expect(attempt).rejects.toBeInstanceOf(MenuConflictError);
    await attempt.catch((err) => {
      expect(err.current).toMatchObject({ updatedBy: 'Ana', updatedAt: '2026-10-09T12:01:00-06:00' });
    });
    expect(await readFile(fileOf('birria', 'current.json'), 'utf8')).toBe(before);
  });

  it('CA-33: sobrescribir tras conflicto deja la versión ajena como anterior y lo registra', async () => {
    const { repository } = await makeRepo();
    const initial = (await repository.getForEdit('birria')).version;
    const a = await repository.save('birria', {
      data: changedData('birria', (d: CorruptibleData) => (d.promo.title = 'De Ana')),
      expectedVersion: initial,
      author: { id: 1, name: 'Ana' },
    });
    const conflictVersion = versionOf(a);
    await repository.save('birria', {
      data: changedData('birria', (d: CorruptibleData) => (d.promo.title = 'De Beto')),
      expectedVersion: conflictVersion,
      author: { id: 1, name: 'Beto' },
      action: 'overwrite_after_conflict',
    });
    expect((await readJson('birria', 'current.json')).data.promo.title).toBe('De Beto');
    expect((await readJson('birria', 'previous.json')).data.promo.title).toBe('De Ana');
    expect((await readChanges()).at(-1)).toMatchObject({ author: 'Beto', authorId: 1, action: 'overwrite_after_conflict' });
  });

  it('serializa guardados simultáneos: solo el primero gana con la misma versión', async () => {
    const { repository } = await makeRepo();
    const { version } = await repository.getForEdit('molotes');
    const results = await Promise.allSettled([
      repository.save('molotes', { data: seedData('molotes'), expectedVersion: version, author: { id: 1, name: 'A' } }),
      repository.save('molotes', { data: seedData('molotes'), expectedVersion: version, author: { id: 1, name: 'B' } }),
    ]);
    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'rejected']);
    expect((results[1] as PromiseRejectedResult).reason).toBeInstanceOf(MenuConflictError);
  });

  it('rechaza datos que cambian la estructura o autor vacío sin escribir', async () => {
    const { repository } = await makeRepo();
    const { version } = await repository.getForEdit('birria');
    const before = await readFile(fileOf('birria', 'current.json'), 'utf8');
    await expect(
      repository.save('birria', { data: changedData('birria', (d: CorruptibleData) => d.menu.items.pop()), expectedVersion: version, author: { id: 1, name: 'Ana' } }),
    ).rejects.toThrow(/inválidos/);
    await expect(repository.save('birria', { data: seedData('birria'), expectedVersion: version, author: { id: 1, name: '  ' } })).rejects.toThrow(
      /inválidos/,
    );
    // El autor verificado exige un identificador de usuario (REQ-F-007, D-11).
    for (const author of ['Ana', { name: 'Ana' }, { id: 0, name: 'Ana' }, { id: '1', name: 'Ana' }]) {
      await expect(repository.save('birria', { data: seedData('birria'), expectedVersion: version, author })).rejects.toThrow(/inválidos/);
    }
    expect(await readFile(fileOf('birria', 'current.json'), 'utf8')).toBe(before);
  });

  it('CA-29: si la escritura falla a mitad, el archivo conserva la versión previa completa y válida', async () => {
    const { repository: setup } = await makeRepo();
    const { version } = await setup.getForEdit('molotes');
    const before = await readFile(fileOf('molotes', 'current.json'), 'utf8');

    const failingFs = {
      ...nodeFs,
      async rename(from: string, to: string) {
        if (to.endsWith('current.json')) throw Object.assign(new Error('disco lleno'), { code: 'ENOSPC' });
        return nodeFs.rename(from, to);
      },
    };
    const { repository } = await makeRepo({ fs: failingFs });
    await expect(
      repository.save('molotes', {
        data: changedData('molotes', (d: CorruptibleData) => (d.menu.items[0].name = 'Nuevo')),
        expectedVersion: version,
        author: { id: 1, name: 'Ana' },
      }),
    ).rejects.toThrow(/disco lleno/);

    expect(await readFile(fileOf('molotes', 'current.json'), 'utf8')).toBe(before);
    expect((await repository.getPublished('molotes')).data).toEqual(seedData('molotes'));
    expect((await listFiles('molotes')).filter((name) => name.endsWith('.tmp'))).toEqual([]);
  });

  it('CA-29: si falla la escritura del contenido, no queda ningún archivo temporal', async () => {
    const failingFs = {
      ...nodeFs,
      async open(path: string, flags?: string, mode?: number) {
        const handle = await nodeFs.open(path, flags, mode);
        if (String(path).endsWith('.tmp')) {
          return {
            writeFile: async () => {
              throw Object.assign(new Error('fallo de E/S'), { code: 'EIO' });
            },
            sync: () => handle.sync(),
            close: () => handle.close(),
          };
        }
        return handle;
      },
    };
    const { repository: setup } = await makeRepo();
    const { version } = await setup.getForEdit('birria');
    const { repository } = await makeRepo({ fs: failingFs });
    await expect(repository.save('birria', { data: seedData('birria'), expectedVersion: version, author: { id: 1, name: 'Ana' } })).rejects.toThrow(
      /fallo de E\/S/,
    );
    expect(await readJson('birria', 'current.json')).toEqual(seedDocuments().birria);
    expect((await listFiles('birria')).filter((name) => name.endsWith('.tmp'))).toEqual([]);
  });

  it('si falla el registro de cambios, el guardado se mantiene y se registra el fallo', async () => {
    const failingFs = {
      ...nodeFs,
      async open(path: string, flags?: string, mode?: number) {
        if (String(path).endsWith(CHANGE_LOG_FILE)) throw Object.assign(new Error('sin permiso'), { code: 'EACCES' });
        return nodeFs.open(path, flags, mode);
      },
    };
    const { repository, logger } = await makeRepo({ fs: failingFs });
    const { version } = await repository.getForEdit('molotes');
    await repository.save('molotes', { data: seedData('molotes'), expectedVersion: version, author: { id: 1, name: 'Ana' } });
    expect((await readJson('molotes', 'current.json')).revision).toBe(1);
    expect(logger.lines).toContainEqual(expect.objectContaining({ msg: 'change_log_write_failed', code: 'EACCES' }));
  });

  it('una edición manual válida hecha con el servidor en marcha pasa a ser la versión anterior (RT-4)', async () => {
    const { repository } = await makeRepo();
    const { version } = await repository.getForEdit('molotes');
    await writeDocument('molotes', 'current.json', (d: CorruptibleData) => (d.promo.title = 'Editado a mano'));
    expect((await repository.getPublished('molotes')).data.promo.title).toBe('Jueves de Molotes 2x1');

    await repository.save('molotes', { data: seedData('molotes'), expectedVersion: version, author: { id: 1, name: 'Ana' } });
    expect((await readJson('molotes', 'previous.json')).data.promo.title).toBe('Editado a mano');
  });
});

describe('restaurar versión anterior (RF-6.5, CA-30)', () => {
  it('intercambia la versión vigente con la anterior con una versión nueva y lo registra', async () => {
    const { repository, clock } = await makeRepo();
    const { version } = await repository.getForEdit('molotes');
    const saved = await repository.save('molotes', {
      data: changedData('molotes', (d: CorruptibleData) => (d.menu.highlight = 'Nuevo destacado')),
      expectedVersion: version,
      author: { id: 1, name: 'Ana' },
    });
    clock.advance(5 * 60_000);

    const restored = await repository.restorePrevious('molotes', { author: { id: 1, name: 'Beto' } });

    expect(restored.data).toEqual(seedData('molotes'));
    expect(restored).toMatchObject({ revision: 2, updatedBy: 'Beto' });
    expect(versionOf(restored)).not.toBe(versionOf(saved));
    expect((await repository.getPublished('molotes')).data.menu.highlight).toBe(seedData('molotes').menu.highlight);
    expect((await readJson('molotes', 'previous.json')).data.menu.highlight).toBe('Nuevo destacado');
    expect((await readChanges()).at(-1)).toMatchObject({
      author: 'Beto', authorId: 1,
      action: 'restore_previous',
      changes: [{ field: 'menu.highlight', before: 'Nuevo destacado', after: seedData('molotes').menu.highlight }],
    });

    // Restaurar otra vez deshace la restauración.
    await repository.restorePrevious('molotes', { author: { id: 1, name: 'Beto' } });
    expect((await repository.getPublished('molotes')).data.menu.highlight).toBe('Nuevo destacado');
  });

  it('una restauración provoca conflicto en quien tenía el formulario abierto', async () => {
    const { repository } = await makeRepo();
    const { version } = await repository.getForEdit('molotes');
    await repository.restorePrevious('molotes', { author: { id: 1, name: 'Beto' } });
    await expect(repository.save('molotes', { data: seedData('molotes'), expectedVersion: version, author: { id: 1, name: 'Ana' } })).rejects.toBeInstanceOf(
      MenuConflictError,
    );
  });

  it('sin una versión anterior válida no cambia nada', async () => {
    const { repository: setup } = await makeRepo();
    await setup.getForEdit('molotes');
    await writeFile(fileOf('molotes', 'previous.json'), '{ roto');
    const { repository } = await makeRepo();
    await expect(repository.restorePrevious('molotes', { author: { id: 1, name: 'Ana' } })).rejects.toBeInstanceOf(PreviousUnavailableError);
    expect(await readJson('molotes', 'current.json')).toEqual(seedDocuments().molotes);
  });

  it('restaurar la semilla sin datos dañados no está permitido (DT-8)', async () => {
    const { repository } = await makeRepo();
    await expect(repository.restoreSeed('molotes', { author: { id: 1, name: 'Ana' } })).rejects.toBeInstanceOf(SeedRestoreNotAllowedError);
  });
});

describe('archivo dañado (RF-8)', () => {
  it('CA-34: con JSON inválido al arrancar publica la versión anterior válida y aísla el archivo', async () => {
    await writeDocument('molotes', 'previous.json', (d: CorruptibleData) => (d.menu.highlight = 'Versión anterior'), { revision: 4 });
    await nodeFs.writeFile(fileOf('molotes', 'current.json'), '{ "esto": no es json');

    const { repository, logger } = await makeRepo();

    expect((await repository.getPublished('molotes')).data.menu.highlight).toBe('Versión anterior');
    const files = await listFiles('molotes');
    const damaged = files.find((name) => /^damaged-.*\.json$/.test(name) && name !== 'damaged.marker.json');
    expect(damaged).toBeDefined();
    expect(await readFile(fileOf('molotes', damaged!), 'utf8')).toBe('{ "esto": no es json');
    expect(files).toContain('damaged.marker.json');
    expect(files).not.toContain('current.json');
    expect(logger.lines).toContainEqual(
      expect.objectContaining({ level: 'error', msg: 'menu_data_damaged', business: 'molotes', reason: 'invalid_json', servingFrom: 'previous' }),
    );
    // El log no incluye el contenido ni rutas absolutas.
    expect(JSON.stringify(logger.lines)).not.toContain(dataDir);
    expect(JSON.stringify(logger.lines)).not.toContain('no es json');

    // Birria no se ve afectada.
    expect((await repository.getForEdit('birria')).damaged).toBeNull();
  });

  it('CA-35: sin una versión anterior válida publica la semilla', async () => {
    await nodeFs.mkdir(join(dataDir, 'molotes'), { recursive: true });
    await nodeFs.writeFile(fileOf('molotes', 'current.json'), 'basura');
    await nodeFs.writeFile(fileOf('molotes', 'previous.json'), 'basura');
    const { repository } = await makeRepo();
    expect((await repository.getPublished('molotes')).data).toEqual(seedData('molotes'));
    expect((await repository.getForEdit('molotes')).damaged).toEqual({ servingFrom: 'seed', previousValid: false });
  });

  it('CA-37: un JSON válido que no cumple el esquema (precio de 6000.00) se trata como dañado', async () => {
    await writeDocument('molotes', 'current.json', (d: CorruptibleData) => (d.menu.items[0].unitPriceCents = 600_000));
    const { repository, logger } = await makeRepo();
    expect((await repository.getForEdit('molotes')).damaged).toEqual({ servingFrom: 'seed', previousValid: false });
    expect(logger.lines).toContainEqual(
      expect.objectContaining({ msg: 'menu_data_damaged', reason: 'invalid_schema', issues: ['menu.items.0.unitPriceCents'] }),
    );
  });

  it('CA-36: la edición queda bloqueada, el estado sobrevive a un reinicio y elegir una opción lo desbloquea', async () => {
    await writeDocument('molotes', 'previous.json', (d: CorruptibleData) => (d.menu.highlight = 'Anterior'), { revision: 3 });
    await nodeFs.writeFile(fileOf('molotes', 'current.json'), '{');
    const first = await makeRepo();
    const edit = await first.repository.getForEdit('molotes');
    expect(edit.damaged).toEqual({ servingFrom: 'previous', previousValid: true });
    await expect(
      first.repository.save('molotes', { data: seedData('molotes'), expectedVersion: edit.version, author: { id: 1, name: 'Ana' } }),
    ).rejects.toBeInstanceOf(MenuDamagedError);

    // Reinicio: sin current.json pero con el marcador, no se trata como primera ejecución.
    const second = await makeRepo();
    expect((await second.repository.getForEdit('molotes')).damaged).toEqual({ servingFrom: 'previous', previousValid: true });

    const restored = await second.repository.restorePrevious('molotes', { author: { id: 1, name: 'Ana' } });
    expect(restored.data.menu.highlight).toBe('Anterior');
    expect(restored.revision).toBeGreaterThan(3);
    expect(await listFiles('molotes')).not.toContain('damaged.marker.json');
    expect((await second.repository.getForEdit('molotes')).damaged).toBeNull();
    expect((await readChanges()).at(-1)).toMatchObject({ author: 'Ana', authorId: 1, action: 'restore_previous', business: 'molotes' });

    const third = await makeRepo();
    expect((await third.repository.getForEdit('molotes')).damaged).toBeNull();
    expect((await third.repository.getPublished('molotes')).data.menu.highlight).toBe('Anterior');
  });

  it('CA-36: restaurar la semilla desbloquea la edición y queda en el registro', async () => {
    await nodeFs.mkdir(join(dataDir, 'birria'), { recursive: true });
    await nodeFs.writeFile(fileOf('birria', 'current.json'), '[]');
    const { repository } = await makeRepo();
    const restored = await repository.restoreSeed('birria', { author: { id: 1, name: 'Ana' } });
    expect(restored.data).toEqual(seedData('birria'));
    expect(await readJson('birria', 'current.json')).toEqual(restored);
    expect((await repository.getForEdit('birria')).damaged).toBeNull();
    expect((await readChanges()).at(-1)).toMatchObject({ author: 'Ana', authorId: 1, action: 'restore_seed', business: 'birria' });
  });

  it('RF-8.5: si se daña con el servidor en marcha, la landing conserva la versión en memoria', async () => {
    const { repository } = await makeRepo();
    const { version } = await repository.getForEdit('molotes');
    const saved = await repository.save('molotes', {
      data: changedData('molotes', (d: CorruptibleData) => (d.menu.highlight = 'Último válido')),
      expectedVersion: version,
      author: { id: 1, name: 'Ana' },
    });
    await nodeFs.writeFile(fileOf('molotes', 'current.json'), 'roto');

    const edit = await repository.getForEdit('molotes');
    expect(edit.damaged).toEqual({ servingFrom: 'memory', previousValid: true });
    expect(edit.document).toEqual(saved);
    expect((await repository.getPublished('molotes')).data.menu.highlight).toBe('Último válido');
    expect(await listFiles('molotes')).toContain('damaged.marker.json');
  });
});
