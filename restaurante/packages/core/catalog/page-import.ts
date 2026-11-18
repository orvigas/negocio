import { BUSINESS_IDS, confirmedByOther, isWriteConflict, silentLogger, type BusinessId, type Logger } from '../shared/index.ts';
import { pickPageData, type MenuDocument } from './menu-schema.ts';
import { versionOf, type PageImportMark, type PageStore, type StoredPage } from './page-store.ts';

/**
 * Datos de página de una instalación nueva (REQ-F-044, D-10; REQ-F-045, RF-4): la `api` siembra con la
 * semilla de cada negocio la versión vigente y la anterior, y deja la marca `page_import` con origen
 * `seed`. La importación desde los JSON (orígenes `current` y `previous`) se retiró en REQ-F-045; esas
 * marcas históricas se siguen leyendo (`PageImportMark`).
 */

/** Siembra de un negocio. */
export interface PageImportPlan {
  business: BusinessId;
  source: PageImportMark['source'];
  /** `revision@updatedAt` de la semilla (marca `page_import.source_version`). */
  sourceVersion: string;
  current: StoredPage;
  previous: StoredPage;
}

/** Versión guardada con solo los datos de página del documento (las listas congeladas no se guardan). */
function toStored<Id extends BusinessId>(business: Id, document: MenuDocument<Id>): StoredPage {
  return {
    revision: document.revision,
    updatedAt: document.updatedAt,
    updatedBy: document.updatedBy,
    // La semilla no lleva el id del autor.
    updatedById: null,
    data: JSON.stringify(pickPageData(business, document.data)),
  };
}

/** La semilla como versión vigente y anterior (como hacían los JSON en la primera ejecución, CA-5). */
function seedPlan<Id extends BusinessId>(business: Id, seed: MenuDocument<Id>): PageImportPlan {
  const current = toStored(business, seed);
  return { business, source: 'seed', sourceVersion: versionOf(seed), current, previous: current };
}

/** Todos los negocios de `plans` tienen ya su marca de importación. */
export async function allMarked(store: Pick<PageStore, 'readImports'>, plans: readonly Pick<PageImportPlan, 'business'>[]): Promise<boolean> {
  const marked = new Set((await store.readImports()).map((mark) => mark.business));
  return plans.every((plan) => marked.has(plan.business));
}

export interface SeedPagesOptions {
  store: Pick<PageStore, 'readImports' | 'transaction'>;
  /** Semilla de cada negocio, ya validada. */
  seeds: { [Id in BusinessId]: MenuDocument<Id> };
  logger?: Logger;
  now?: () => Date;
}

/**
 * Página de una instalación nueva (REQ-F-045, RF-4): crea con la semilla la versión vigente, la anterior
 * y la marca de cada negocio sin marca, en una sola transacción. Quien la llama decide que la
 * instalación es nueva (D-10: en una existente nunca se publica la semilla). Idempotente: un negocio con
 * marca no se toca. Si otro proceso sembró a la vez (la transacción choca con las claves o con un
 * interbloqueo y se revierte), se vuelven a leer las marcas: con todas presentes se registra
 * `page_seed_skipped` y se continúa; si falta alguna, el error es real. Devuelve los negocios sembrados.
 */
export async function seedPages({ store, seeds, logger = silentLogger, now = () => new Date() }: SeedPagesOptions): Promise<BusinessId[]> {
  const marked = new Set((await store.readImports()).map((mark) => mark.business));
  const plans: PageImportPlan[] = [];
  for (const business of BUSINESS_IDS) {
    if (marked.has(business)) continue;
    plans.push(seedPlan(business, seeds[business]));
  }
  if (plans.length === 0) return [];

  const importedAt = now();
  try {
    await store.transaction(async (tx) => {
      for (const plan of plans) {
        await tx.putCurrent(plan.business, plan.current);
        await tx.putPrevious(plan.business, plan.previous);
        await tx.markImported({ business: plan.business, importedAt, source: plan.source, sourceVersion: plan.sourceVersion, historyCount: 0, skippedLines: 0 });
      }
    });
  } catch (err) {
    if (!isWriteConflict(err) || !(await confirmedByOther(() => allMarked(store, plans)))) throw err;
    for (const plan of plans) logger.warn('page_seed_skipped', { business: plan.business, reason: 'concurrent' });
    return [];
  }
  for (const plan of plans) logger.info('page_seeded', { business: plan.business, source: plan.source });
  return plans.map((plan) => plan.business);
}
