import { describe, expect, it } from 'vitest';

import {
  PAGE_ACTIONS,
  PageConflictError,
  PageNoPreviousError,
  PageUnavailableError,
  PageValidationError,
  createMemoryPageStore,
  createPageRepository,
  versionOf,
  type PageData,
} from '@restaurante/core/catalog';
import { DatabaseUnavailableError, type LogFields } from '@restaurante/core/shared';

import { AT_1, AT_2, MOLOTES_PAGE, seedPages, stored } from '../support/pages.ts';

/** Reglas de los datos de página (REQ-F-044, RF-1, RF-8 y RN-3), con el store en memoria. */

const NOW = new Date('2026-10-26T18:00:00.000Z');
const NOW_TEXT = '2026-10-26T12:00:00-06:00';
const ANA = { id: 7, name: 'Ana' };
const VERSION = versionOf({ revision: 2, updatedAt: AT_2 });
const changed = { ...MOLOTES_PAGE, promo: { ...MOLOTES_PAGE.promo, title: 'Nueva' } };

function setup({ seeded = true } = {}) {
  const store = createMemoryPageStore();
  if (seeded) seedPages(store);
  const logs: { msg: string; fields: LogFields | undefined }[] = [];
  const record = (msg: string, fields?: LogFields) => void logs.push({ msg, fields });
  const logger = { debug: record, info: record, warn: record, error: record };
  return { store, logs, pages: createPageRepository({ store, timeZone: 'America/Mexico_City', now: () => NOW, logger }) };
}

describe('lectura', () => {
  it('devuelve la versión vigente, con quién y cuándo', async () => {
    const { pages } = setup();
    await expect(pages.get('molotes')).resolves.toEqual({ data: MOLOTES_PAGE, version: VERSION, updatedAt: AT_2, updatedBy: 'Ana Admin', hasPrevious: true });
  });

  it('una semilla sin fecha tiene la versión de los JSON', async () => {
    const { pages, store } = setup({ seeded: false });
    store.seed('molotes', { current: stored(0, null, null, MOLOTES_PAGE), previous: null });
    await expect(pages.get('molotes')).resolves.toMatchObject({ version: '0@seed', updatedAt: null, updatedBy: null, hasPrevious: false });
  });

  it('sin filas, "no disponible"', async () => {
    await expect(setup({ seeded: false }).pages.get('birria')).rejects.toBeInstanceOf(PageUnavailableError);
  });

  it('una fila inválida es "no disponible" y se registra sin su contenido', async () => {
    const { pages, store, logs } = setup({ seeded: false });
    store.seed('molotes', { current: { ...stored(1, AT_1, 'Ana', {}), data: '{"secreto":' }, previous: null });
    await expect(pages.get('molotes')).rejects.toBeInstanceOf(PageUnavailableError);
    expect(logs).toEqual([{ msg: 'page_data_invalid', fields: { business: 'molotes', slot: 'current', revision: 1 } }]);
  });

  it('una anterior inválida no impide leer: solo deja de poder restaurarse', async () => {
    const { pages, store } = setup({ seeded: false });
    store.seed('molotes', { current: stored(2, AT_2, 'Ana', MOLOTES_PAGE), previous: stored(1, AT_1, 'Eli', { hero: 'mal' }) });
    await expect(pages.get('molotes')).resolves.toMatchObject({ hasPrevious: false });
  });
});

describe('guardar', () => {
  it('publica una revisión nueva, conserva la vigente como anterior y registra el cambio con autor', async () => {
    const { pages, store } = setup();
    const saved = await pages.save('molotes', { data: changed, expectedVersion: VERSION, author: ANA });
    expect(saved).toEqual({ data: changed, version: `3@${NOW_TEXT}`, updatedAt: NOW_TEXT, updatedBy: 'Ana', hasPrevious: true });
    const entry = store.state.pages.get('molotes');
    expect(entry?.current).toMatchObject({ revision: 3, updatedById: 7 });
    expect(entry?.previous).toEqual(stored(2, AT_2, 'Ana Admin', MOLOTES_PAGE));
    expect(store.state.changes).toEqual([
      { at: NOW_TEXT, business: 'molotes', author: 'Ana', authorId: 7, action: 'save', changes: [{ field: 'promo.title', before: 'Dos por uno', after: 'Nueva' }] },
    ]);
  });

  it('una versión que ya no es la vigente: conflicto con quién y cuándo, sin escribir', async () => {
    const { pages, store } = setup();
    const before = structuredClone(store.state);
    const error = await pages.save('molotes', { data: changed, expectedVersion: '1@otra', author: ANA }).catch((err: unknown) => err);
    expect(error).toBeInstanceOf(PageConflictError);
    expect((error as PageConflictError).current).toEqual({ version: VERSION, updatedAt: AT_2, updatedBy: 'Ana Admin' });
    expect(store.state).toEqual(before);
  });

  it('dos guardados a la vez con la misma versión: uno gana y el otro recibe conflicto', async () => {
    const { pages, store } = setup();
    const results = await Promise.allSettled([
      pages.save('molotes', { data: changed, expectedVersion: VERSION, author: ANA }),
      pages.save('molotes', { data: MOLOTES_PAGE, expectedVersion: VERSION, author: { id: 8, name: 'Eli' } }),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual(['fulfilled', 'rejected']);
    expect(results.find((result) => result.status === 'rejected')).toMatchObject({ reason: expect.any(PageConflictError) });
    expect(store.state.changes).toHaveLength(1);
    expect(store.state.pages.get('molotes')?.current?.revision).toBe(3);
  });

  it('registra la sobrescritura tras un conflicto con su propia acción', async () => {
    const { pages, store } = setup();
    await pages.save('molotes', { data: changed, expectedVersion: VERSION, author: ANA, action: PAGE_ACTIONS.OVERWRITE_AFTER_CONFLICT });
    expect(store.state.changes[0]?.action).toBe('overwrite_after_conflict');
  });

  it('datos inválidos: no escribe nada', async () => {
    const { pages, store } = setup();
    const before = structuredClone(store.state);
    await expect(pages.save('molotes', { data: { hero: 1 }, expectedVersion: VERSION, author: ANA })).rejects.toBeInstanceOf(PageValidationError);
    expect(store.state).toEqual(before);
  });

  it('sin datos importados no crea nada', async () => {
    const { pages, store } = setup({ seeded: false });
    await expect(pages.save('molotes', { data: changed, expectedVersion: '0@seed', author: ANA })).rejects.toBeInstanceOf(PageUnavailableError);
    expect(store.state.pages.size).toBe(0);
  });

  it('un negocio no toca al otro', async () => {
    const { pages, store } = setup();
    const birria = structuredClone(store.state.pages.get('birria'));
    await pages.save('molotes', { data: changed, expectedVersion: VERSION, author: ANA });
    expect(store.state.pages.get('birria')).toEqual(birria);
  });

  it('un fallo de la base se propaga y no deja nada a medias', async () => {
    const { pages, store } = setup();
    store.failNext(2);
    await expect(pages.get('molotes')).rejects.toBeInstanceOf(DatabaseUnavailableError);
    await expect(pages.get('molotes')).rejects.toBeInstanceOf(DatabaseUnavailableError);
    await expect(pages.save('molotes', { data: changed, expectedVersion: VERSION, author: ANA })).resolves.toBeDefined();
    expect(store.state.changes).toHaveLength(1);
  });
});

describe('restaurar la versión anterior (RN-3)', () => {
  it('intercambia vigente y anterior, y repetirlo lo deshace', async () => {
    const { pages, store } = setup();
    const title = (data: PageData) => data.promo.title;
    const first = await pages.restorePrevious('molotes', { expectedVersion: VERSION, author: ANA });
    expect(title(first.data)).toBe('Promo anterior');
    expect(first).toMatchObject({ updatedBy: 'Ana', hasPrevious: true });
    expect(JSON.parse(store.state.pages.get('molotes')?.previous?.data ?? '{}')).toEqual(MOLOTES_PAGE);
    const second = await pages.restorePrevious('molotes', { expectedVersion: first.version, author: ANA });
    expect(second.data).toEqual(MOLOTES_PAGE);
    expect(store.state.changes.map((change) => change.action)).toEqual(['restore_previous', 'restore_previous']);
  });

  it('la revisión siempre crece, aunque la anterior tenga una mayor', async () => {
    const { pages, store } = setup({ seeded: false });
    store.seed('molotes', { current: stored(2, AT_2, 'Ana', MOLOTES_PAGE), previous: stored(9, AT_1, 'Eli', changed) });
    await expect(pages.restorePrevious('molotes', { expectedVersion: VERSION, author: ANA })).resolves.toMatchObject({ version: `10@${NOW_TEXT}` });
  });

  it('la revisión nunca baja: con una anterior de revisión menor sigue a la vigente', async () => {
    const { pages, store } = setup({ seeded: false });
    store.seed('molotes', { current: stored(9, AT_2, 'Ana', MOLOTES_PAGE), previous: stored(2, AT_1, 'Eli', changed) });
    const restored = await pages.restorePrevious('molotes', { expectedVersion: versionOf({ revision: 9, updatedAt: AT_2 }), author: ANA });
    expect(restored.version).toBe(`10@${NOW_TEXT}`);
    expect(store.state.pages.get('molotes')?.current?.revision).toBe(10);
  });

  it('repetir con la versión de antes (escritura sin confirmar) no la deshace', async () => {
    const { pages, store } = setup();
    await pages.restorePrevious('molotes', { expectedVersion: VERSION, author: ANA });
    await expect(pages.restorePrevious('molotes', { expectedVersion: VERSION, author: ANA })).rejects.toBeInstanceOf(PageConflictError);
    expect(store.state.changes).toHaveLength(1);
  });

  it.each([
    ['sin anterior', null],
    ['con una anterior inválida', stored(1, AT_1, 'Eli', { hero: 'mal' })],
  ])('%s responde sin versión anterior, sin cambios', async (_, previous) => {
    const { pages, store } = setup({ seeded: false });
    store.seed('molotes', { current: stored(2, AT_2, 'Ana', MOLOTES_PAGE), previous });
    await expect(pages.restorePrevious('molotes', { expectedVersion: VERSION, author: ANA })).rejects.toBeInstanceOf(PageNoPreviousError);
    expect(store.state.changes).toEqual([]);
    expect(store.state.pages.get('molotes')?.current?.revision).toBe(2);
  });
});
