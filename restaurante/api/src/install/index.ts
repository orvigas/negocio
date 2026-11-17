import { BUSINESS, errorProp, type BusinessId, type Logger } from '@restaurante/core/shared';
import { loadSeedDocument, seedPages, validateMenuDocument, type MenuDocument, type PageStore, type ProductRepository } from '@restaurante/core/catalog';
import type { UserRepository } from '@restaurante/core/identity';

import type { AdminBootstrapConfig } from '../config.ts';
import { bootstrapAdmin, type BootstrapResult } from './admin-bootstrap.ts';

/**
 * Preparación de la instalación al arrancar la `api` (REQ-F-045, RF-4 y RN-2), tras verificar la base:
 *
 * 1. ¿Instalación existente? `product_import` con filas al empezar (D-10 de REQ-F-044). Se lee antes de
 *    importar nada, porque en una instalación nueva este mismo arranque crea esas filas.
 * 2. Instalación nueva: la página de cada negocio con la semilla (`page_import` con origen `seed`) y
 *    después los productos de la semilla. La página va primero: si el arranque se corta entre las dos, el
 *    siguiente sigue viendo una instalación nueva y completa lo que falte (cada paso es idempotente).
 * 3. Instalación existente: nunca publica la semilla. Solo carga la caché de productos; si faltan las
 *    filas de página, la página responde "no disponible" (CA-7).
 * 4. Primer administrador con ADMIN_USER/ADMIN_PASSWORD_HASH, solo si no hay usuarios.
 *
 * Seguro en paralelo con otro arranque de la api sobre la misma base: el que pierde la carrera
 * encuentra las marcas y continúa (seedPages e importBusiness de core).
 */

/** Paso que falló: el evento del log y el mensaje sin detalles para stderr. */
export const INSTALL_FAILURES = Object.freeze({
  state: { event: 'database_init_failed', message: 'No se pudo leer el estado de la instalación en la base de datos.' },
  seed: { event: 'install_seed_invalid', message: 'La semilla de los negocios no es válida: no se preparó la instalación.' },
  pages: { event: 'page_seed_failed', message: 'No se pudo preparar la página de los negocios en la base de datos.' },
  products: { event: 'products_init_failed', message: 'No se pudieron preparar los productos en la base de datos.' },
  admin: { event: 'admin_bootstrap_failed', message: 'No se pudo preparar el primer administrador en la base de datos.' },
});
export type InstallStep = keyof typeof INSTALL_FAILURES;

/** Un paso de la preparación falló: el arranque debe terminar con 1. Sin el mensaje de la causa. */
export class InstallationError extends Error {
  readonly step: InstallStep;
  /** Evento del log del paso. */
  readonly event: string;
  /** Solo códigos (nombre y código de la causa, o la ruta del problema de la semilla). */
  readonly fields: Record<string, unknown>;

  constructor(step: InstallStep, fields: Record<string, unknown>) {
    super(INSTALL_FAILURES[step].message);
    this.name = 'InstallationError';
    this.step = step;
    this.event = INSTALL_FAILURES[step].event;
    this.fields = fields;
  }
}

export type SeedDocuments = { [Id in BusinessId]: MenuDocument<Id> };

/** Semilla de cada negocio de core/catalog, validada (fallo rápido). */
export function loadSeeds(load: (business: BusinessId) => unknown = loadSeedDocument): SeedDocuments {
  const documentOf = <Id extends BusinessId>(business: Id): MenuDocument<Id> => {
    const document = load(business);
    const issues = validateMenuDocument(business, document, (document as { data?: unknown } | null)?.data);
    if (issues.length > 0) throw new InstallationError('seed', { business, path: issues[0]?.path ?? '' });
    // validateMenuDocument no encontró problemas: es un documento del negocio.
    return document as MenuDocument<Id>;
  };
  return { molotes: documentOf(BUSINESS.MOLOTES), birria: documentOf(BUSINESS.BIRRIA) };
}

const causeFields = (err: unknown): Record<string, unknown> => ({
  name: errorProp(err, 'name'),
  code: errorProp(errorProp(err, 'details'), 'code') ?? errorProp(err, 'code'),
});

async function step<T>(name: InstallStep, task: () => Promise<T>): Promise<T> {
  try {
    return await task();
  } catch (err) {
    if (err instanceof InstallationError) throw err;
    throw new InstallationError(name, causeFields(err));
  }
}

export interface PrepareInstallationOptions {
  users: Pick<UserRepository, 'hasUsers' | 'bootstrap'>;
  products: Pick<ProductRepository, 'init'>;
  pageStore: Pick<PageStore, 'hasProductImports' | 'readImports' | 'transaction'>;
  bootstrap: AdminBootstrapConfig;
  logger: Logger;
  /** Semilla validada (inyectable en las pruebas). */
  seeds?: () => SeedDocuments;
}

/** @throws {InstallationError} */
export async function prepareInstallation({ users, products, pageStore, bootstrap, logger, seeds = loadSeeds }: PrepareInstallationOptions): Promise<{ existing: boolean; admin: BootstrapResult }> {
  const existing = await step('state', () => pageStore.hasProductImports());
  if (existing) {
    // Sin fuentes: solo carga la caché (D-15: un fallo de la base impide arrancar).
    await step('products', () => products.init());
  } else {
    // Un archivo ilegible o un JSON roto termina como los demás pasos: evento con códigos, mensaje fijo y 1.
    const documents = await step('seed', async () => seeds());
    await step('pages', () => seedPages({ store: pageStore, seeds: documents, logger }));
    await step('products', () =>
      products.init({
        molotes: { source: 'seed', data: documents.molotes.data },
        birria: { source: 'seed', data: documents.birria.data },
      }),
    );
  }
  const admin = await step('admin', () => bootstrapAdmin({ users, bootstrap, logger }));
  return { existing, admin };
}
