import { readFile } from 'node:fs/promises';

import { QuoteNotFoundError, QuoteUnavailableError, parseQuoteCatalog, type QuoteCatalog, type QuoteCatalogIssue, type QuoteCatalogSource } from '@restaurante/core/cotizador';
import { BUSINESS_IDS, errorProp, type BusinessId, type Logger } from '@restaurante/core/shared';

/**
 * Catálogo del cotizador desde el JSON versionado en `api` (REQ-F-046, RF-10). Se lee y se valida una
 * vez al arrancar (`init`). Un JSON inválido o ilegible no impide arrancar (decisión P-2 del usuario):
 * se registra `quote_catalog_invalid` con la ruta y el mensaje de cada problema (son datos del repo,
 * nunca ajustes de la pantalla) y el cotizador de ese negocio queda "no disponible" (503). La barrera
 * real es la prueba del JSON en el CI. Un negocio sin JSON (Molotes) no tiene cotizador (404).
 */

export const QUOTE_CATALOG_FILES: Readonly<Partial<Record<BusinessId, URL>>> = Object.freeze({
  birria: new URL('./catalogs/birria.json', import.meta.url),
});

export interface FileQuoteCatalogSource extends QuoteCatalogSource {
  /** Lee y valida los JSON. Nunca lanza. */
  init(): Promise<void>;
}

type Entry = { ok: true; catalog: QuoteCatalog } | { ok: false };

export function createFileQuoteCatalogSource({ files = QUOTE_CATALOG_FILES, logger }: { files?: Readonly<Partial<Record<BusinessId, URL>>>; logger: Logger }): FileQuoteCatalogSource {
  const entries = new Map<BusinessId, Entry>();

  async function read(business: BusinessId, file: URL): Promise<Entry> {
    let raw: unknown;
    try {
      raw = JSON.parse(await readFile(file, 'utf8'));
    } catch (err) {
      logger.error('quote_catalog_invalid', { business, reason: 'unreadable', name: errorProp(err, 'name'), code: errorProp(err, 'code') });
      return { ok: false };
    }
    const parsed = parseQuoteCatalog(raw);
    const issues: QuoteCatalogIssue[] = parsed.ok ? [] : parsed.issues;
    if (parsed.ok && parsed.catalog.negocio !== business) issues.push({ path: '$.negocio', message: `Debe ser "${business}".` });
    if (!parsed.ok || issues.length > 0) {
      logger.error('quote_catalog_invalid', { business, reason: 'invalid', issues });
      return { ok: false };
    }
    return parsed;
  }

  return Object.freeze<FileQuoteCatalogSource>({
    async init() {
      for (const business of BUSINESS_IDS) {
        const file = files[business];
        if (file) entries.set(business, await read(business, file));
      }
    },

    async load(business) {
      if (!files[business]) throw new QuoteNotFoundError();
      const entry = entries.get(business);
      if (!entry?.ok) throw new QuoteUnavailableError();
      return entry.catalog;
    },
  });
}
