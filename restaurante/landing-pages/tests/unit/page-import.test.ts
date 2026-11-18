import { describe, expect, it } from 'vitest';

import { createMemoryPageStore, pickPageData, seedPages } from '@restaurante/core/catalog';

import { makeRecordingLogger, seedDocuments } from '../helpers.ts';

/**
 * Página de una instalación nueva (REQ-F-044, CA-5; REQ-F-045, RF-4): `seedPages` de
 * core/catalog/page-import.ts, sobre el store en memoria. La idempotencia sobre MySQL (un segundo
 * arranque no vuelve a sembrar) la cubre server-startup-base.test.ts.
 */

describe('seedPages: instalación nueva (CA-5)', () => {
  it('siembra la semilla como vigente y anterior, sin las listas congeladas, con la marca seed', async () => {
    const store = createMemoryPageStore();
    const logger = makeRecordingLogger();
    const seeds = seedDocuments();
    const importedAt = new Date('2026-11-17T12:00:00Z');

    expect(await seedPages({ store, seeds, logger, now: () => importedAt })).toEqual(['molotes', 'birria']);

    for (const business of ['molotes', 'birria'] as const) {
      const pages = store.state.pages.get(business);
      expect(pages?.current).toEqual({ revision: 0, updatedAt: null, updatedBy: null, updatedById: null, data: expect.any(String) });
      expect(pages?.previous).toEqual(pages?.current);
      // Solo los datos de página: ni platillos ni bebidas (las listas congeladas).
      expect(JSON.parse(pages!.current!.data)).toEqual(pickPageData(business, seeds[business].data));
      expect(store.state.imports.get(business)).toEqual({ business, importedAt, source: 'seed', sourceVersion: '0@seed', historyCount: 0, skippedLines: 0 });
    }
    expect(logger.lines.filter((line) => line.msg === 'page_seeded')).toEqual([
      expect.objectContaining({ business: 'molotes', source: 'seed' }),
      expect.objectContaining({ business: 'birria', source: 'seed' }),
    ]);
  });
});
