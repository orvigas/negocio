import { describe, expect, it } from 'vitest';

import {
  PAGE_IMPORT_SEED_REFUSED,
  parseChangeLog,
  pickPageData,
  planPageImport,
  type MenuDocument,
  type PageImportCandidates,
} from '@restaurante/core/catalog';

import { seedDocuments } from '../helpers.ts';

/**
 * Importación única de la página (REQ-F-044, PR 3): reglas de origen (RF-3, CA-4, CA-5, D-10 y CA-20)
 * y lectura de `changes.jsonl` (RF-8). Funciones puras de core/catalog/page-import.ts.
 */

const seed = (): MenuDocument<'molotes'> => seedDocuments().molotes;

function edited(revision: number, updatedAt: string, highlight: string): MenuDocument<'molotes'> {
  const document = seed();
  return { ...document, revision, updatedAt, updatedBy: 'Ana', data: { ...document.data, menu: { ...document.data.menu, highlight } } };
}

const CURRENT = edited(3, '2026-11-01T10:00:00-06:00', 'Vigente');
const PREVIOUS = edited(2, '2026-10-30T09:00:00-06:00', 'Anterior');

const candidates = (overrides: Partial<PageImportCandidates<'molotes'>> = {}): PageImportCandidates<'molotes'> => ({
  current: CURRENT,
  previous: PREVIOUS,
  problem: null,
  seeded: false,
  seed: seed(),
  ...overrides,
});

const highlightOf = (data: string): unknown => (JSON.parse(data) as { menu: { highlight: unknown } }).menu.highlight;

describe('planPageImport: origen (RF-3)', () => {
  it('current y previous válidos: se importan los dos con su revisión, fecha y autor, sin las listas congeladas', () => {
    const decision = planPageImport('molotes', candidates(), { existing: true });
    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    const { plan } = decision;
    expect(plan).toMatchObject({ source: 'current', sourceVersion: '3@2026-11-01T10:00:00-06:00', problem: null });
    expect(plan.current).toMatchObject({ revision: 3, updatedAt: '2026-11-01T10:00:00-06:00', updatedBy: 'Ana', updatedById: null });
    expect(JSON.parse(plan.current.data)).toEqual(pickPageData('molotes', CURRENT.data));
    expect(plan.previous).toMatchObject({ revision: 2, updatedAt: '2026-10-30T09:00:00-06:00' });
    expect(highlightOf(plan.previous!.data)).toBe('Anterior');
  });

  it('current válido sin previous válido: anterior vacío', () => {
    const decision = planPageImport('molotes', candidates({ previous: null }), { existing: true });
    expect(decision.ok && decision.plan.previous).toBeNull();
  });

  it('CA-4: current dañado y previous válido -> vigente el previous, anterior vacío', () => {
    const decision = planPageImport('molotes', candidates({ current: null, problem: 'damaged' }), { existing: true });
    expect(decision).toMatchObject({ ok: true, plan: { source: 'previous', sourceVersion: '2@2026-10-30T09:00:00-06:00', problem: 'damaged', previous: null } });
    expect(decision.ok && highlightOf(decision.plan.current.data)).toBe('Anterior');
  });

  it('falta current.json pero previous es válido (instalación existente): vigente el previous', () => {
    const decision = planPageImport('molotes', candidates({ current: null, problem: 'missing' }), { existing: true });
    expect(decision).toMatchObject({ ok: true, plan: { source: 'previous', problem: 'missing' } });
  });

  it('un current que no cabe en las columnas se trata como dañado (D-2): fecha de más de 64 caracteres', () => {
    const tooLong = { ...CURRENT, updatedAt: `2026-11-01T10:00:00-06:00${'x'.repeat(50)}` };
    expect(planPageImport('molotes', candidates({ current: tooLong }), { existing: true })).toMatchObject({ ok: true, plan: { source: 'previous', problem: 'damaged' } });
  });

  it('un current con revisión fuera de INT se trata como dañado', () => {
    expect(planPageImport('molotes', candidates({ current: { ...CURRENT, revision: 2 ** 31 } }), { existing: true })).toMatchObject({ ok: true, plan: { source: 'previous' } });
  });

  it('un current copia de la semilla (updatedAt null) en una instalación existente sí se importa', () => {
    const decision = planPageImport('molotes', candidates({ current: seed(), previous: seed() }), { existing: true });
    expect(decision).toMatchObject({ ok: true, plan: { source: 'current', sourceVersion: '0@seed' } });
  });
});

describe('planPageImport: semilla (CA-5, D-10 y CA-20)', () => {
  it('CA-5: instalación nueva sin JSON -> la semilla como vigente y anterior', () => {
    const decision = planPageImport('molotes', candidates({ current: seed(), previous: seed(), seeded: true }), { existing: false });
    expect(decision).toMatchObject({ ok: true, plan: { source: 'seed', sourceVersion: '0@seed' } });
    if (!decision.ok) return;
    expect(decision.plan.previous).toEqual(decision.plan.current);
    expect(JSON.parse(decision.plan.current.data)).toEqual(pickPageData('molotes', seed().data));
  });

  it('instalación nueva con current dañado y sin previous: la semilla, anterior vacío', () => {
    const decision = planPageImport('molotes', candidates({ current: null, previous: null, problem: 'damaged' }), { existing: false });
    expect(decision).toMatchObject({ ok: true, plan: { source: 'seed', problem: 'damaged', previous: null } });
  });

  it.each([
    ['faltan los JSON', 'missing'],
    ['current y previous dañados', 'damaged'],
  ] as const)('CA-20: instalación existente y %s -> se niega con PAGE_IMPORT_SEED_REFUSED', (_label, problem) => {
    expect(planPageImport('molotes', candidates({ current: null, previous: null, problem }), { existing: true })).toEqual({
      ok: false,
      code: PAGE_IMPORT_SEED_REFUSED,
      business: 'molotes',
      reason: problem,
    });
  });

  it('CA-20: current que no cabe y sin previous en una instalación existente también se niega (dañado)', () => {
    const tooLong = { ...CURRENT, revision: 2 ** 31 };
    expect(planPageImport('molotes', candidates({ current: tooLong, previous: null }), { existing: true })).toMatchObject({ ok: false, reason: 'damaged' });
  });
});

describe('parseChangeLog (RF-8)', () => {
  const line = (entry: Record<string, unknown>): string => JSON.stringify(entry);
  const VALID = { at: '2026-10-01T10:00:00-06:00', author: 'Ana', authorId: 4, business: 'molotes', action: 'save', changes: [{ field: 'promo.title', before: 'A', after: 'B' }] };

  it('reparte por negocio en el orden del archivo; sin authorId se importa solo con el nombre', () => {
    const text = [
      line(VALID),
      line({ ...VALID, business: 'birria', action: 'restore_seed', changes: [] }),
      line({ ...VALID, authorId: undefined, author: '  Beto  ', action: 'overwrite_after_conflict' }),
      '',
    ].join('\n');
    const { entries, skipped } = parseChangeLog(text);
    expect(skipped).toEqual([]);
    expect(entries.molotes).toEqual([
      { at: VALID.at, business: 'molotes', author: 'Ana', authorId: 4, action: 'save', changes: VALID.changes },
      { at: VALID.at, business: 'molotes', author: 'Beto', authorId: null, action: 'overwrite_after_conflict', changes: VALID.changes },
    ]);
    expect(entries.birria).toEqual([{ at: VALID.at, business: 'birria', author: 'Ana', authorId: 4, action: 'restore_seed', changes: [] }]);
  });

  it('las líneas ilegibles se cuentan por su número y se omiten, sin detener la lectura', () => {
    const text = [
      line(VALID), // 1
      '{ roto', // 2
      line({ ...VALID, business: 'tacos' }), // 3
      line({ ...VALID, action: 'borrar' }), // 4
      line({ ...VALID, author: '   ' }), // 5
      line({ ...VALID, author: 'x'.repeat(61) }), // 6
      line({ ...VALID, at: 'ayer' }), // 7
      line({ ...VALID, authorId: -3 }), // 8
      line({ ...VALID, changes: 'nada' }), // 9
      '[]', // 10
      '', // 11 (vacía: se ignora)
      line(VALID).slice(0, 20), // 12: línea final cortada
    ].join('\n');
    const { entries, skipped } = parseChangeLog(text);
    expect(skipped).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 12]);
    expect(entries.molotes).toHaveLength(1);
    expect(entries.birria).toEqual([]);
  });

  it('sin archivo: historial vacío', () => {
    expect(parseChangeLog(null)).toEqual({ entries: { molotes: [], birria: [] }, skipped: [] });
  });
});
