import { BUSINESS_IDS, isBusinessId, type BusinessId } from '../config/businesses.ts';
import { loadSeedDocument } from '../content/seeds.ts';
import { diffMenuData, type FieldChange } from '../services/menu-diff.ts';
import {
  AUTHOR_MAX_LENGTH,
  SCHEMA_VERSION,
  textLength,
  validateMenuData,
  validateMenuDocument,
  type MenuData,
  type MenuDocument,
  type ValidationError,
} from '../services/menu-schema.ts';
import { errorProp } from '../utils/errors.ts';
import { silentLogger, type Logger } from '../utils/logger.ts';
import { toZonedIsoString } from '../utils/datetime.ts';

/**
 * Repositorio de los datos editables de cada negocio (REQ-F-001, RF-9).
 *
 * Contrato (todas las operaciones son asíncronas, para poder cambiar a una base de datos):
 *
 *   init()                                   Prepara el almacenamiento: primera ejecución o datos dañados.
 *   getPublished(businessId)                 Documento válido que muestra la landing (en memoria, sin E/S).
 *   getForEdit(businessId)                   { document, version, damaged } para la administración;
 *                                            vuelve a revisar el almacenamiento (RF-8.5).
 *   save(businessId, { data, expectedVersion, author, action })
 *                                            Guarda con control de versión. action: 'save' | 'overwrite_after_conflict'.
 *   restorePrevious(businessId, { author })  Intercambia la versión vigente con la anterior.
 *   restoreSeed(businessId, { author })      Solo con datos dañados: vuelve a la semilla.
 *   getLastChange(businessId)                { at, by } o null.
 *
 * Documento: { schemaVersion, business, revision, updatedAt, updatedBy, data }.
 *
 * Esta implementación concentra las reglas (validación, versión, versión anterior, registro y
 * datos dañados) sobre un `storage` de texto plano; hay uno de archivos y otro en memoria.
 *
 * Storage:
 *   init(): Promise<void>
 *   read(businessId, name): Promise<string|null>     name: 'current' | 'previous' | 'marker'
 *   write(businessId, name, text): Promise<void>     escritura atómica
 *   remove(businessId, name): Promise<void>
 *   isolate(businessId, stamp): Promise<string|null> renombra 'current' a damaged-<stamp>.json
 *   appendChange(line): Promise<void>                registro de cambios (una línea JSON)
 */

/** Nombres de los textos que guarda un storage por negocio. */
export type StorageName = 'current' | 'previous' | 'marker';

export interface MenuStorage {
  init(): Promise<void>;
  read(businessId: BusinessId, name: StorageName): Promise<string | null>;
  write(businessId: BusinessId, name: StorageName, text: string): Promise<void>;
  remove(businessId: BusinessId, name: StorageName): Promise<void>;
  isolate(businessId: BusinessId, stamp: string): Promise<string | null>;
  appendChange(line: string): Promise<void>;
}

export interface DamagedInfo {
  servingFrom: string;
  previousValid: boolean;
}

export interface EditState<Id extends BusinessId = BusinessId> {
  document: MenuDocument<Id>;
  version: string;
  damaged: DamagedInfo | null;
}

export interface SaveRequest {
  data: unknown;
  expectedVersion: unknown;
  author: unknown;
  action?: unknown;
}

/** Contrato del repositorio: cada operación devuelve documentos del negocio pedido. */
export interface MenuRepository {
  init(): Promise<void>;
  getPublished<Id extends BusinessId>(businessId: Id): Promise<MenuDocument<Id>>;
  getForEdit<Id extends BusinessId>(businessId: Id): Promise<EditState<Id>>;
  save<Id extends BusinessId>(businessId: Id, request: SaveRequest): Promise<MenuDocument<Id>>;
  restorePrevious<Id extends BusinessId>(businessId: Id, options: { author: unknown }): Promise<MenuDocument<Id>>;
  restoreSeed<Id extends BusinessId>(businessId: Id, options: { author: unknown }): Promise<MenuDocument<Id>>;
  getLastChange(businessId: BusinessId): Promise<{ at: string; by: string } | null>;
}

/** Misma forma sin correlacionar el negocio con el tipo de sus datos (implementación). */
interface UntypedMenuRepository {
  init(): Promise<void>;
  getPublished(businessId: BusinessId): Promise<MenuDocument>;
  getForEdit(businessId: BusinessId): Promise<EditState>;
  save(businessId: BusinessId, request: SaveRequest): Promise<MenuDocument>;
  restorePrevious(businessId: BusinessId, options: { author: unknown }): Promise<MenuDocument>;
  restoreSeed(businessId: BusinessId, options: { author: unknown }): Promise<MenuDocument>;
  getLastChange(businessId: BusinessId): Promise<{ at: string; by: string } | null>;
}

export interface ConflictInfo {
  version: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

export const REPOSITORY_METHODS = Object.freeze([
  'init',
  'getPublished',
  'getForEdit',
  'save',
  'restorePrevious',
  'restoreSeed',
  'getLastChange',
]);

export const CHANGE_ACTIONS = Object.freeze({
  SAVE: 'save',
  OVERWRITE_AFTER_CONFLICT: 'overwrite_after_conflict',
  RESTORE_PREVIOUS: 'restore_previous',
  RESTORE_SEED: 'restore_seed',
});

export type ChangeAction = (typeof CHANGE_ACTIONS)[keyof typeof CHANGE_ACTIONS];

/** Guardado con una versión que ya no es la vigente (RF-7). */
export class MenuConflictError extends Error {
  readonly current: ConflictInfo;

  constructor(current: ConflictInfo) {
    super('Los datos cambiaron mientras se editaban');
    this.name = 'MenuConflictError';
    this.current = current;
  }
}

/** Los datos guardados están dañados: la edición está bloqueada (RF-8.4). */
export class MenuDamagedError extends Error {
  constructor() {
    super('Los datos guardados están dañados');
    this.name = 'MenuDamagedError';
  }
}

/** No hay una versión anterior válida que restaurar. */
export class PreviousUnavailableError extends Error {
  constructor() {
    super('No hay una versión anterior válida');
    this.name = 'PreviousUnavailableError';
  }
}

/** Restaurar la semilla solo está permitido con datos dañados (DT-8). */
export class SeedRestoreNotAllowedError extends Error {
  constructor() {
    super('Solo se puede restaurar la semilla cuando los datos están dañados');
    this.name = 'SeedRestoreNotAllowedError';
  }
}

/** Datos o autor inválidos recibidos por el repositorio (defensa en profundidad). */
export class MenuDataError extends Error {
  readonly issues: ValidationError[];

  constructor(issues: ValidationError[]) {
    super('Datos del menú inválidos');
    this.name = 'MenuDataError';
    this.issues = issues;
  }
}

/** Identificador de versión: cambia con cada escritura, incluidas las restauraciones. */
export const versionOf = (document: Pick<MenuDocument, 'revision' | 'updatedAt'>): string => `${document.revision}@${document.updatedAt ?? 'seed'}`;

/** Comprueba que un objeto cumple el contrato (falla rápido al construir la app). */
export function assertMenuRepository(repository: unknown): MenuRepository {
  const missing = REPOSITORY_METHODS.filter((name) => typeof errorProp(repository, name) !== 'function');
  if (missing.length > 0) throw new TypeError(`El repositorio de menús no implementa: ${missing.join(', ')}`);
  // Tiene todos los métodos del contrato (comprobado arriba).
  return repository as MenuRepository;
}

const serialize = (document: unknown): string => `${JSON.stringify(document, null, 2)}\n`;

function assertBusiness(businessId: unknown): asserts businessId is BusinessId {
  if (!isBusinessId(businessId)) throw new TypeError(`Negocio desconocido: ${String(businessId)}`);
}

function normalizeAuthor(author: unknown): string {
  const value = typeof author === 'string' ? author.trim() : '';
  if (value === '' || textLength(value) > AUTHOR_MAX_LENGTH) {
    throw new MenuDataError([{ path: 'author', message: 'Autor inválido.' }]);
  }
  return value;
}

/** Marca de archivo segura para nombres de archivo: 2026-10-02T19-45-10-123Z. */
const fileStamp = (date: Date): string => date.toISOString().replace(/[:.]/g, '-');

export interface MenuRepositoryOptions {
  storage: MenuStorage;
  timezone: string;
  now?: () => Date;
  logger?: Logger;
  /** Documentos semilla por negocio (por defecto, los de src/content/). Se validan al crear el repositorio. */
  seeds?: Partial<Record<BusinessId, unknown>> | undefined;
}

interface BusinessState {
  published: MenuDocument;
  damaged: null | { servingFrom: string };
}

type ReadResult =
  | { status: 'missing'; reason?: undefined; issues?: undefined }
  | { status: 'invalid'; reason: 'invalid_json' | 'invalid_schema'; issues: ValidationError[] }
  | { status: 'ok'; document: MenuDocument };

export function createMenuRepository({
  storage,
  timezone,
  now = () => new Date(),
  logger = silentLogger,
  seeds,
}: MenuRepositoryOptions): MenuRepository {
  if (!storage) throw new TypeError('createMenuRepository requiere un storage');
  if (!timezone) throw new TypeError('createMenuRepository requiere la zona horaria');

  // Se validan justo debajo; si alguna semilla no cumple el esquema, falla al crear el repositorio.
  const seedDocuments = Object.fromEntries(
    BUSINESS_IDS.map((businessId) => [businessId, structuredClone(seeds?.[businessId] ?? loadSeedDocument(businessId))]),
  ) as Record<BusinessId, MenuDocument>;
  for (const businessId of BUSINESS_IDS) {
    const seed = seedDocuments[businessId];
    const issues = validateMenuDocument(businessId, seed, seed.data);
    if (issues.length > 0) throw new MenuDataError(issues);
  }

  // Se completa en init() para todos los negocios; ensureReady impide leerlo antes.
  const state = {} as Record<BusinessId, BusinessState>;
  const locks = new Map<BusinessId, Promise<unknown>>();
  let initialized = false;

  const seedOf = (businessId: BusinessId): MenuDocument => structuredClone(seedDocuments[businessId]);

  /** Serializa las operaciones de un negocio (una sola instancia: basta un mutex en proceso). */
  function withLock<T>(businessId: BusinessId, task: () => Promise<T>): Promise<T> {
    const previous = locks.get(businessId) ?? Promise.resolve();
    const run = previous.then(task, task);
    locks.set(businessId, run.catch(() => {}));
    return run;
  }

  function ensureReady(businessId: BusinessId): void {
    assertBusiness(businessId);
    if (!initialized) throw new Error('El repositorio de menús no se ha inicializado (init)');
  }

  /** Lee y valida un documento guardado. */
  async function readDocument(businessId: BusinessId, name: StorageName): Promise<ReadResult> {
    const text = await storage.read(businessId, name);
    if (text === null) return { status: 'missing' };
    let document: unknown;
    try {
      document = JSON.parse(text);
    } catch {
      return { status: 'invalid', reason: 'invalid_json', issues: [] };
    }
    const issues = validateMenuDocument(businessId, document, seedDocuments[businessId].data);
    if (issues.length > 0) return { status: 'invalid', reason: 'invalid_schema', issues };
    // validateMenuDocument no encontró problemas: tiene la forma de MenuDocument.
    return { status: 'ok', document: document as MenuDocument };
  }

  async function readValidPrevious(businessId: BusinessId): Promise<MenuDocument | null> {
    const previous = await readDocument(businessId, 'previous');
    return previous.status === 'ok' ? previous.document : null;
  }

  async function appendChange(entry: {
    at: string | null;
    author: string;
    business: BusinessId;
    action: ChangeAction;
    changes: FieldChange[];
  }): Promise<void> {
    try {
      await storage.appendChange(JSON.stringify(entry));
    } catch (err) {
      // El guardado ya está hecho; solo falla el registro.
      logger.error('change_log_write_failed', { business: entry.business, action: entry.action, code: errorProp(err, 'code') });
    }
  }

  /**
   * Pasa un negocio al estado "dañado": aísla el archivo, deja el marcador persistente y
   * elige qué publica la landing (RF-8.1, RF-8.5).
   */
  async function markDamaged(
    businessId: BusinessId,
    { reason, issues = [], atStartup }: { reason: string; issues?: ValidationError[] | undefined; atStartup: boolean },
  ): Promise<void> {
    const date = now();
    const damagedFile = await storage.isolate(businessId, fileStamp(date));
    await storage.write(businessId, 'marker', serialize({ since: date.toISOString(), damagedFile, reason }));

    let servingFrom: string;
    if (atStartup) {
      const previous = await readValidPrevious(businessId);
      state[businessId] = {
        published: previous ?? seedOf(businessId),
        damaged: null,
      };
      servingFrom = previous ? 'previous' : 'seed';
    } else {
      // Con el servidor en marcha, la landing conserva la última versión válida en memoria.
      servingFrom = 'memory';
    }
    state[businessId].damaged = { servingFrom };
    logger.error('menu_data_damaged', {
      business: businessId,
      reason,
      issues: issues.slice(0, 5).map((issue) => issue.path),
      servingFrom,
      isolated: damagedFile !== null,
    });
  }

  async function loadBusiness(businessId: BusinessId): Promise<void> {
    const marker = await storage.read(businessId, 'marker');
    if (marker !== null) {
      // El estado "dañado" sobrevive al reinicio hasta que alguien elige una opción (RF-8.4).
      const previous = await readValidPrevious(businessId);
      state[businessId] = {
        published: previous ?? seedOf(businessId),
        damaged: { servingFrom: previous ? 'previous' : 'seed' },
      };
      logger.warn('menu_data_damaged_pending', { business: businessId, servingFrom: previous ? 'previous' : 'seed' });
      return;
    }

    const current = await readDocument(businessId, 'current');
    if (current.status === 'ok') {
      state[businessId] = { published: current.document, damaged: null };
      return;
    }
    if (current.status === 'missing') {
      // Primera ejecución: la semilla pasa a ser la versión vigente y la anterior (RF-1.5).
      const seed = seedOf(businessId);
      await storage.write(businessId, 'previous', serialize(seed));
      await storage.write(businessId, 'current', serialize(seed));
      state[businessId] = { published: seed, damaged: null };
      logger.info('menu_data_seeded', { business: businessId });
      return;
    }
    // markDamaged (atStartup) asigna el estado del negocio antes de leerlo.
    await markDamaged(businessId, { reason: current.reason, issues: current.issues, atStartup: true });
  }

  /** Revisa el almacenamiento con el servidor en marcha. Devuelve el documento vigente o null si está dañado. */
  async function checkStorage(businessId: BusinessId): Promise<MenuDocument | null> {
    if (state[businessId].damaged) return null;
    const current = await readDocument(businessId, 'current');
    if (current.status === 'ok') return current.document;
    await markDamaged(businessId, {
      reason: current.status === 'missing' ? 'missing' : current.reason,
      issues: current.issues,
      atStartup: false,
    });
    return null;
  }

  async function damagedInfo(businessId: BusinessId, damaged: { servingFrom: string }): Promise<DamagedInfo> {
    const previous = await readValidPrevious(businessId);
    return { servingFrom: damaged.servingFrom, previousValid: previous !== null };
  }

  function buildDocument(businessId: BusinessId, base: number, data: MenuData, author: string): MenuDocument {
    const date = now();
    return {
      schemaVersion: SCHEMA_VERSION,
      business: businessId,
      revision: base + 1,
      updatedAt: toZonedIsoString(date, timezone),
      updatedBy: author,
      data: structuredClone(data),
    };
  }

  /** Publica un documento nuevo, sale del estado dañado si aplica y deja el cambio en el registro. */
  async function commit(
    businessId: BusinessId,
    {
      next,
      previous,
      before,
      action,
      author,
    }: { next: MenuDocument; previous: MenuDocument | null; before: MenuDocument; action: ChangeAction; author: string },
  ): Promise<MenuDocument> {
    if (previous) await storage.write(businessId, 'previous', serialize(previous));
    await storage.write(businessId, 'current', serialize(next));
    const wasDamaged = state[businessId].damaged !== null;
    if (wasDamaged) await storage.remove(businessId, 'marker');
    state[businessId] = { published: next, damaged: null };

    await appendChange({
      at: next.updatedAt,
      author,
      business: businessId,
      action,
      changes: diffMenuData(before.data, next.data),
    });
    logger.info('menu_saved', { business: businessId, action, revision: next.revision, recoveredFromDamage: wasDamaged });
    return structuredClone(next);
  }

  // Cada negocio solo guarda y devuelve documentos propios: validateMenuDocument exige
  // `business === businessId` y buildDocument lo fija; por eso el contrato puede correlacionarlos.
  return Object.freeze<UntypedMenuRepository>({
    async init() {
      await storage.init();
      for (const businessId of BUSINESS_IDS) await loadBusiness(businessId);
      initialized = true;
    },

    async getPublished(businessId) {
      ensureReady(businessId);
      return state[businessId].published;
    },

    async getForEdit(businessId) {
      ensureReady(businessId);
      return withLock(businessId, async () => {
        await checkStorage(businessId);
        const document = structuredClone(state[businessId].published);
        const { damaged: damagedState } = state[businessId];
        const damaged = damagedState ? await damagedInfo(businessId, damagedState) : null;
        return { document, version: versionOf(document), damaged };
      });
    },

    async save(businessId, { data, expectedVersion, author, action = CHANGE_ACTIONS.SAVE }) {
      ensureReady(businessId);
      const by = normalizeAuthor(author);
      if (action !== CHANGE_ACTIONS.SAVE && action !== CHANGE_ACTIONS.OVERWRITE_AFTER_CONFLICT) {
        throw new TypeError(`Acción de guardado desconocida: ${String(action)}`);
      }
      return withLock(businessId, async () => {
        const current = await checkStorage(businessId);
        if (!current) throw new MenuDamagedError();
        if (expectedVersion !== versionOf(current)) {
          throw new MenuConflictError({ version: versionOf(current), updatedAt: current.updatedAt, updatedBy: current.updatedBy });
        }
        const issues = validateMenuData(businessId, data, seedDocuments[businessId].data);
        if (issues.length > 0) throw new MenuDataError(issues);

        // Lo que hay en disco (incluida una edición manual) pasa a ser la versión anterior (RF-6.1).
        // validateMenuData no encontró problemas: `data` tiene la forma de los datos del negocio.
        const next = buildDocument(businessId, current.revision, data as MenuData, by);
        return commit(businessId, { next, previous: current, before: current, action, author: by });
      });
    },

    async restorePrevious(businessId, { author }) {
      ensureReady(businessId);
      const by = normalizeAuthor(author);
      return withLock(businessId, async () => {
        const current = await checkStorage(businessId);
        const previous = await readValidPrevious(businessId);
        if (!previous) throw new PreviousUnavailableError();

        const base = Math.max(previous.revision, state[businessId].published.revision, current?.revision ?? 0);
        const next = buildDocument(businessId, base, previous.data, by);
        // Sin datos dañados es un intercambio; con datos dañados no hay versión vigente que conservar.
        return commit(businessId, {
          next,
          previous: current,
          before: current ?? state[businessId].published,
          action: CHANGE_ACTIONS.RESTORE_PREVIOUS,
          author: by,
        });
      });
    },

    async restoreSeed(businessId, { author }) {
      ensureReady(businessId);
      const by = normalizeAuthor(author);
      return withLock(businessId, async () => {
        await checkStorage(businessId);
        if (!state[businessId].damaged) throw new SeedRestoreNotAllowedError();
        const seed = seedOf(businessId);
        const base = Math.max(seed.revision, state[businessId].published.revision);
        const next = buildDocument(businessId, base, seed.data, by);
        return commit(businessId, {
          next,
          previous: null,
          before: state[businessId].published,
          action: CHANGE_ACTIONS.RESTORE_SEED,
          author: by,
        });
      });
    },

    async getLastChange(businessId) {
      ensureReady(businessId);
      const { updatedAt, updatedBy } = state[businessId].published;
      return updatedAt && updatedBy ? { at: updatedAt, by: updatedBy } : null;
    },
  }) as MenuRepository;
}
