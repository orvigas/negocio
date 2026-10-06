import { BUSINESS, BUSINESS_IDS, type BusinessId } from '../config/businesses.ts';
import { diffMenuData, type FieldChange } from '../services/menu-diff.ts';
import type { BirriaItem, MenuDataByBusiness, MolotesDrink, MolotesItem } from '../services/menu-schema.ts';
import {
  MAX_ACTIVE_PRODUCTS,
  changeSnapshot,
  isValidKind,
  validateProductInput,
  type FieldErrors,
  type Product,
  type ProductCategory,
  type ProductFields,
} from '../services/product-schema.ts';
import { uniqueSlug } from '../services/slug.ts';
import { errorProp } from '../utils/errors.ts';
import { silentLogger, type Logger } from '../utils/logger.ts';

/**
 * Repositorio de productos (REQ-F-008, RF-9).
 *
 * Una sola implementación de las reglas (validación, slug, límites, versión, posiciones y
 * registro) sobre un `ProductStore` con dos implementaciones: Prisma/SQLite
 * (prisma-product-store.ts) y memoria (memory-product-store.ts, para las pruebas). Las mismas
 * pruebas de contrato corren contra las dos.
 *
 * - Cada escritura es una transacción del store: el producto, sus variantes, sus chips y la
 *   entrada del registro se guardan juntos o no se guardan (RF-2.3). Las escrituras se
 *   serializan además con un mutex en proceso (una sola instancia, como las sesiones).
 * - Las landings leen `getPublished`, una caché en memoria por negocio que se recarga después
 *   de cada escritura: nunca consultan la base de datos (D-15, RN-7). Si la recarga falla se
 *   conserva la anterior y se reintenta en la siguiente operación.
 * - Orden de las comprobaciones (D-19): existencia (404) -> validación (422) -> versión (409).
 */

export const PRODUCT_ACTIONS = Object.freeze({
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  RESTORE: 'restore',
  REORDER: 'reorder',
  OVERWRITE_AFTER_CONFLICT: 'overwrite_after_conflict',
  IMPORT: 'import',
});
export type ProductAction = (typeof PRODUCT_ACTIONS)[keyof typeof PRODUCT_ACTIONS];

/** Autor de los cambios importados (RF-3.3). */
export const SYSTEM_AUTHOR_NAME = 'sistema';

export interface ProductAuthor {
  id: number;
  name: string;
}

export interface ChangeEntry {
  at: Date;
  business: BusinessId;
  productId: number;
  slug: string;
  action: ProductAction;
  actorId: number | null;
  actorName: string;
  changes: FieldChange[];
}

export interface ChangeSummary {
  at: Date;
  actorId: number | null;
  actorName: string;
}

/** Producto con su último cambio (quién y cuándo). */
export interface ProductView extends Product {
  updatedBy: ChangeSummary | null;
}

export type ImportSourceName = 'current' | 'previous' | 'seed';
export interface ImportSource<Id extends BusinessId = BusinessId> {
  source: ImportSourceName;
  data: MenuDataByBusiness[Id];
}

/** Listas con la forma de los datos de REQ-F-001 que pintan las landings. */
export interface PublishedProducts {
  molotes: { menu: MolotesItem[]; drinks: MolotesDrink[] };
  birria: { menu: BirriaItem[] };
}

// --- Store ---------------------------------------------------------------------

export type NewProduct = Omit<Product, 'id'>;

export interface ProductStoreTx {
  /** Todos los productos del negocio, eliminados incluidos (con variantes y chips en orden). */
  listBusiness(business: BusinessId): Promise<Product[]>;
  insert(product: NewProduct): Promise<Product>;
  /** Reemplaza el producto completo si su versión vigente es `expectedVersion`; si no, false. */
  replace(product: Product, expectedVersion: number): Promise<boolean>;
  addChange(entry: ChangeEntry): Promise<void>;
  isImported(business: BusinessId): Promise<boolean>;
  markImported(business: BusinessId, record: { at: Date; source: ImportSourceName; count: number }): Promise<void>;
}

export interface ProductStore {
  listBusiness(business: BusinessId): Promise<Product[]>;
  /** Último cambio de cada producto del negocio. */
  lastChanges(business: BusinessId): Promise<Map<number, ChangeSummary>>;
  lastBusinessChange(business: BusinessId): Promise<ChangeSummary | null>;
  /** Ejecuta `task` de forma atómica: si lanza, no queda nada escrito. */
  transaction<T>(task: (tx: ProductStoreTx) => Promise<T>): Promise<T>;
}

// --- Errores de dominio ----------------------------------------------------------

export class ProductError extends Error {}

export class ProductNotFoundError extends ProductError {
  constructor() {
    super('Producto no encontrado');
    this.name = 'ProductNotFoundError';
  }
}

/** Errores por campo (422). La clave '' es un error general. */
export class ProductValidationError extends ProductError {
  readonly fields: FieldErrors;

  constructor(fields: FieldErrors) {
    super('Datos del producto inválidos');
    this.name = 'ProductValidationError';
    this.fields = fields;
  }
}

export interface ProductConflictInfo {
  productId: number;
  version: number;
  updatedAt: Date;
  updatedBy: string | null;
}

/** La versión enviada ya no es la vigente (RF-8.2). */
export class ProductConflictError extends ProductError {
  readonly current: ProductConflictInfo;

  constructor(current: ProductConflictInfo) {
    super('El producto cambió mientras se editaba');
    this.name = 'ProductConflictError';
    this.current = current;
  }
}

/** El slug ya existe (carrera con otro proceso): el repositorio reintenta una vez. */
export class SlugTakenError extends ProductError {
  constructor() {
    super('El identificador ya existe');
    this.name = 'SlugTakenError';
  }
}

export const LIMIT_MESSAGE = `Ya hay ${MAX_ACTIVE_PRODUCTS} productos activos en este negocio (el máximo). Elimina uno antes.`;

// --- Repositorio ------------------------------------------------------------------

export interface CreateRequest {
  /** Entrada sin validar: `category`, `detailsType` (Birria) y los campos editables. */
  input: unknown;
}

export interface UpdateRequest {
  input: unknown;
  expectedVersion: unknown;
  action?: 'update' | 'overwrite_after_conflict';
}

export interface ReorderItem {
  id: unknown;
  version: unknown;
}

export interface ProductRepository {
  /** Importación única (D-8) y carga de la caché. */
  init(sources: { [Id in BusinessId]: ImportSource<Id> }): Promise<void>;
  /** Productos que pinta la landing (de memoria, sin E/S). */
  getPublished<Id extends BusinessId>(business: Id): PublishedProducts[Id];
  list(business: BusinessId, options?: { includeDeleted?: boolean; category?: ProductCategory }): Promise<ProductView[]>;
  get(business: BusinessId, id: number): Promise<ProductView>;
  create(business: BusinessId, request: CreateRequest, author: ProductAuthor): Promise<ProductView>;
  update(business: BusinessId, id: number, request: UpdateRequest, author: ProductAuthor): Promise<ProductView>;
  remove(business: BusinessId, id: number, expectedVersion: unknown, author: ProductAuthor): Promise<ProductView>;
  restore(business: BusinessId, id: number, expectedVersion: unknown, author: ProductAuthor): Promise<ProductView>;
  /** Reordena todos los productos activos de una categoría (`items` en el orden nuevo). */
  reorder(business: BusinessId, category: unknown, items: unknown, author: ProductAuthor): Promise<ProductView[]>;
  /** Sube o baja un producto una posición (administración HTML). */
  move(business: BusinessId, id: number, direction: 'up' | 'down', expectedVersion: unknown, author: ProductAuthor): Promise<ProductView[]>;
  getLastChange(business: BusinessId): Promise<ChangeSummary | null>;
}

export interface ProductRepositoryOptions {
  store: ProductStore;
  /** Comprueba que la imagen exista en public/img al guardar (RF-7.1). */
  imageExists: (src: string) => Promise<boolean>;
  now?: () => Date;
  logger?: Logger;
}

const isActive = (product: Product): boolean => !product.deleted;
const byPosition = (a: Product, b: Product): number => a.position - b.position || a.id - b.id;

/** Productos activos de una categoría, en orden. */
const activeOf = (products: Product[], category: ProductCategory): Product[] =>
  products.filter((product) => isActive(product) && product.category === category).sort(byPosition);

function versionOf(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1 ? value : null;
}

function requireVersion(value: unknown): number {
  const version = versionOf(value);
  if (version === null) throw new ProductValidationError({ version: 'Falta la versión o no es un entero positivo.' });
  return version;
}

function normalizeAuthor(author: ProductAuthor): ProductAuthor {
  const name = typeof author?.name === 'string' ? author.name.trim() : '';
  if (!Number.isSafeInteger(author?.id) || author.id <= 0 || name === '') throw new TypeError('Autor inválido');
  return { id: author.id, name };
}

// --- Conversión entre productos y las listas de REQ-F-001 ------------------------------

function molotesItem(product: Product): MolotesItem {
  // Platillo de Molotes validado: los campos de su combinación siempre tienen valor.
  return {
    id: product.slug,
    name: product.name,
    description: product.description ?? '',
    badge: product.label ?? '',
    tone: product.tone ?? '',
    unitPriceCents: product.priceCents ?? 0,
    orderPriceCents: product.orderPriceCents ?? 0,
    orderQuantity: product.orderQuantity ?? 0,
    available: product.available,
    image: product.image ?? { src: '', alt: '', width: 0, height: 0 },
  };
}

function molotesDrink(product: Product): MolotesDrink {
  return {
    id: product.slug,
    name: product.name,
    description: product.description ?? '',
    icon: product.icon ?? '',
    tone: product.tone ?? '',
    priceCents: product.priceCents ?? 0,
    available: product.available,
  };
}

function birriaItem(product: Product): BirriaItem {
  const base = {
    slug: product.slug,
    name: product.name,
    tag: product.label ?? '',
    available: product.available,
    image: product.image ?? { src: '', alt: '', width: 0, height: 0 },
    detailsLabel: product.detailsLabel ?? '',
  };
  if (product.detailsType === 'variants') {
    return { ...base, detailsType: 'variants', variants: product.variants.map((variant) => ({ ...variant })) };
  }
  const own = { description: product.description ?? '', priceCents: product.priceCents ?? 0, priceUnit: product.priceUnit ?? '' };
  if (product.detailsType === 'chips') return { ...base, ...own, detailsType: 'chips', chips: product.chips.map((chip) => ({ ...chip })) };
  return { ...base, ...own, detailsType: 'portion', portion: product.portion ?? '', portionExtra: product.portionExtra ?? '' };
}

/** Productos guardados -> listas que pinta la landing (sin los eliminados, por posición). */
export function toPublished<Id extends BusinessId>(business: Id, products: Product[]): PublishedProducts[Id] {
  if (business === BUSINESS.MOLOTES) {
    const molotes: PublishedProducts['molotes'] = {
      menu: activeOf(products, 'platillo').map(molotesItem),
      drinks: activeOf(products, 'bebida').map(molotesDrink),
    };
    // El negocio es Molotes: su forma es la de PublishedProducts['molotes'].
    return molotes as PublishedProducts[Id];
  }
  const birria: PublishedProducts['birria'] = { menu: activeOf(products, 'platillo').map(birriaItem) };
  return birria as PublishedProducts[Id];
}

/**
 * Datos de la landing: hero, destacado y promociones del JSON (REQ-F-001) con las listas de
 * productos de la base de datos (Q-3 A: las listas del JSON ya no se usan).
 */
export function withProducts<Id extends BusinessId>(business: Id, data: MenuDataByBusiness[Id], products: PublishedProducts[Id]): MenuDataByBusiness[Id] {
  if (business === BUSINESS.MOLOTES) {
    // Negocio Molotes: datos y listas tienen la forma de Molotes.
    const molotes = data as MenuDataByBusiness['molotes'];
    const lists = products as PublishedProducts['molotes'];
    const merged: MenuDataByBusiness['molotes'] = { ...molotes, menu: { ...molotes.menu, items: lists.menu }, drinks: { ...molotes.drinks, items: lists.drinks } };
    return merged as MenuDataByBusiness[Id];
  }
  const birria = data as MenuDataByBusiness['birria'];
  const merged: MenuDataByBusiness['birria'] = { ...birria, menu: { ...birria.menu, items: (products as PublishedProducts['birria']).menu } };
  return merged as MenuDataByBusiness[Id];
}

const emptyFields = (): Omit<ProductFields, 'name'> => ({
  description: null,
  label: null,
  priceCents: null,
  priceUnit: null,
  image: null,
  tone: null,
  orderPriceCents: null,
  orderQuantity: null,
  icon: null,
  detailsLabel: null,
  portion: null,
  portionExtra: null,
  chips: [],
  variants: [],
});

/** Listas de un documento de REQ-F-001 (ya validado) -> productos nuevos (RF-3.2). */
export function productsFromMenuData(business: BusinessId, data: MenuDataByBusiness[BusinessId], at: Date): NewProduct[] {
  const common = (position: number, slug: string, name: string, available: boolean) => ({
    business,
    slug,
    name,
    available,
    position,
    version: 1,
    createdAt: at,
    updatedAt: at,
    deleted: false,
    deletedAt: null,
  });
  if (business === BUSINESS.MOLOTES) {
    // Documento de Molotes (validado por el repositorio de menús).
    const molotes = data as MenuDataByBusiness['molotes'];
    return [
      ...molotes.menu.items.map((item, index) => ({
        ...emptyFields(),
        ...common(index + 1, item.id, item.name, item.available),
        category: 'platillo' as const,
        detailsType: null,
        description: item.description,
        label: item.badge,
        tone: item.tone,
        priceCents: item.unitPriceCents,
        orderPriceCents: item.orderPriceCents,
        orderQuantity: item.orderQuantity,
        image: { ...item.image },
      })),
      ...molotes.drinks.items.map((drink, index) => ({
        ...emptyFields(),
        ...common(index + 1, drink.id, drink.name, drink.available),
        category: 'bebida' as const,
        detailsType: null,
        description: drink.description,
        icon: drink.icon,
        tone: drink.tone,
        priceCents: drink.priceCents,
      })),
    ];
  }
  const birria = data as MenuDataByBusiness['birria'];
  return birria.menu.items.map((item, index) => {
    const product: NewProduct = {
      ...emptyFields(),
      ...common(index + 1, item.slug, item.name, item.available),
      category: 'platillo',
      detailsType: item.detailsType,
      label: item.tag,
      image: { ...item.image },
      detailsLabel: item.detailsLabel,
    };
    if (item.detailsType === 'variants') return { ...product, variants: item.variants.map((variant) => ({ ...variant })) };
    const own = { description: item.description, priceCents: item.priceCents, priceUnit: item.priceUnit === '' ? null : item.priceUnit };
    if (item.detailsType === 'chips') return { ...product, ...own, chips: item.chips.map((chip) => ({ ...chip })) };
    return { ...product, ...own, portion: item.portion, portionExtra: item.portionExtra };
  });
}

export function createProductRepository({ store, imageExists, now = () => new Date(), logger = silentLogger }: ProductRepositoryOptions): ProductRepository {
  if (!store) throw new TypeError('createProductRepository requiere un store');
  if (typeof imageExists !== 'function') throw new TypeError('createProductRepository requiere imageExists');

  const published = new Map<BusinessId, PublishedProducts[BusinessId]>();
  const stale = new Set<BusinessId>();
  let lock: Promise<unknown> = Promise.resolve();
  let initialized = false;

  /** Serializa las escrituras (una sola instancia: basta un mutex en proceso). */
  function exclusive<T>(task: () => Promise<T>): Promise<T> {
    const run = lock.then(task, task);
    lock = run.catch(() => {});
    return run;
  }

  function ensureReady(): void {
    if (!initialized) throw new Error('El repositorio de productos no se ha inicializado (init)');
  }

  async function refresh(business: BusinessId): Promise<void> {
    try {
      published.set(business, toPublished(business, await store.listBusiness(business)));
      stale.delete(business);
    } catch (err) {
      // La landing conserva la última versión válida (D-15).
      stale.add(business);
      logger.error('products_cache_refresh_failed', { business, name: errorProp(err, 'name'), code: errorProp(err, 'code') });
    }
  }

  async function retryStale(business: BusinessId): Promise<void> {
    if (stale.has(business)) await refresh(business);
  }

  async function views(business: BusinessId, products: Product[]): Promise<ProductView[]> {
    const changes = await store.lastChanges(business);
    return products.map((product) => ({ ...product, updatedBy: changes.get(product.id) ?? null }));
  }

  async function view(business: BusinessId, product: Product): Promise<ProductView> {
    const [result] = await views(business, [product]);
    // views devuelve un elemento por producto.
    return result as ProductView;
  }

  function find(products: Product[], id: number): Product {
    const product = products.find((candidate) => candidate.id === id);
    if (!product) throw new ProductNotFoundError();
    return product;
  }

  async function conflict(business: BusinessId, product: Product): Promise<ProductConflictError> {
    const last = (await store.lastChanges(business)).get(product.id);
    return new ProductConflictError({ productId: product.id, version: product.version, updatedAt: product.updatedAt, updatedBy: last?.actorName ?? null });
  }

  async function checkImage(fields: ProductFields): Promise<void> {
    if (fields.image && !(await imageExists(fields.image.src))) {
      throw new ProductValidationError({ 'image.src': 'La imagen no existe en public/img/.' });
    }
  }

  const entry = (product: Product, action: ProductAction, author: ProductAuthor, changes: FieldChange[]): ChangeEntry => ({
    at: product.updatedAt,
    business: product.business,
    productId: product.id,
    slug: product.slug,
    action,
    actorId: author.id,
    actorName: author.name,
    changes,
  });

  const diff = (before: Product | null, after: Product): FieldChange[] => diffMenuData(before ? changeSnapshot(before) : {}, changeSnapshot(after));

  /** Escritura: transacción del store, caché y log. */
  async function write<T>(business: BusinessId, action: ProductAction, task: (tx: ProductStoreTx) => Promise<T>): Promise<T> {
    ensureReady();
    return exclusive(async () => {
      const result = await store.transaction(task);
      await refresh(business);
      logger.info('product_saved', { business, action });
      return result;
    });
  }

  /** Productos activos tras un cambio de posiciones: guarda los que se movieron y los registra. */
  async function applyOrder(tx: ProductStoreTx, ordered: Product[], author: ProductAuthor, at: Date): Promise<void> {
    for (const [index, product] of ordered.entries()) {
      const position = index + 1;
      if (product.position === position) continue;
      const next = { ...product, position, version: product.version + 1, updatedAt: at };
      if (!(await tx.replace(next, product.version))) throw new ProductConflictError({ productId: product.id, version: product.version, updatedAt: product.updatedAt, updatedBy: null });
      await tx.addChange(entry(next, PRODUCT_ACTIONS.REORDER, author, diff(product, next)));
    }
  }

  async function importBusiness(business: BusinessId, source: ImportSource): Promise<void> {
    const at = now();
    const imported = await store.transaction(async (tx) => {
      if (await tx.isImported(business)) return null;
      if ((await tx.listBusiness(business)).length > 0) {
        logger.warn('products_import_skipped', { business, reason: 'products_exist' });
        return null;
      }
      const products = productsFromMenuData(business, source.data, at);
      for (const product of products) {
        const saved = await tx.insert(product);
        await tx.addChange({
          at,
          business,
          productId: saved.id,
          slug: saved.slug,
          action: PRODUCT_ACTIONS.IMPORT,
          actorId: null,
          actorName: SYSTEM_AUTHOR_NAME,
          changes: diff(null, saved),
        });
      }
      await tx.markImported(business, { at, source: source.source, count: products.length });
      return products.length;
    });
    if (imported !== null) logger.info('products_imported', { business, source: source.source, count: imported });
  }

  async function list(business: BusinessId, { includeDeleted = false, category }: { includeDeleted?: boolean; category?: ProductCategory } = {}): Promise<ProductView[]> {
    ensureReady();
    await retryStale(business);
    const products = (await store.listBusiness(business))
      .filter((product) => (includeDeleted ? true : isActive(product)) && (category === undefined || product.category === category))
      .sort((a, b) => Number(a.deleted) - Number(b.deleted) || a.category.localeCompare(b.category) || byPosition(a, b));
    return views(business, products);
  }

  return Object.freeze<ProductRepository>({
    async init(sources) {
      for (const business of BUSINESS_IDS) {
        await importBusiness(business, sources[business]);
        // Al arrancar, un fallo de la base de datos impide arrancar (D-15).
        published.set(business, toPublished(business, await store.listBusiness(business)));
      }
      initialized = true;
    },

    getPublished(business) {
      ensureReady();
      const lists = published.get(business);
      if (!lists) throw new Error(`Negocio desconocido: ${String(business)}`);
      // Cada negocio guarda su propia forma (toPublished).
      return lists as PublishedProducts[typeof business];
    },

    list,

    async get(business, id) {
      ensureReady();
      await retryStale(business);
      return view(business, find(await store.listBusiness(business), id));
    },

    async create(business, { input }, rawAuthor) {
      const author = normalizeAuthor(rawAuthor);
      const category = errorProp(input, 'category');
      const detailsType = errorProp(input, 'detailsType') ?? null;
      const kind = { business, category, detailsType };
      if (!isValidKind(kind)) {
        const fields: FieldErrors = {};
        if (category !== 'platillo' && !(business === BUSINESS.MOLOTES && category === 'bebida')) fields.category = 'Elige una categoría válida para este negocio.';
        else fields.detailsType = business === BUSINESS.MOLOTES ? 'Este negocio no usa tipo de detalle.' : 'Elige un tipo de detalle: chips, portion o variants.';
        throw new ProductValidationError(fields);
      }
      const result = validateProductInput(kind, input, { mode: 'create' });
      if (!result.ok) throw new ProductValidationError(result.errors);
      await checkImage(result.value.fields);

      const attempt = () =>
        write(business, PRODUCT_ACTIONS.CREATE, async (tx) => {
          const products = await tx.listBusiness(business);
          if (products.filter(isActive).length >= MAX_ACTIVE_PRODUCTS) throw new ProductValidationError({ '': LIMIT_MESSAGE });
          const at = now();
          const last = activeOf(products, kind.category).at(-1);
          const saved = await tx.insert({
            ...kind,
            ...result.value.fields,
            slug: uniqueSlug(result.value.fields.name, new Set(products.map((product) => product.slug))),
            // D-17: al final de su categoría y no disponible.
            available: false,
            position: (last?.position ?? 0) + 1,
            version: 1,
            createdAt: at,
            updatedAt: at,
            deleted: false,
            deletedAt: null,
          });
          await tx.addChange(entry(saved, PRODUCT_ACTIONS.CREATE, author, diff(null, saved)));
          return saved;
        });
      let saved: Product;
      try {
        saved = await attempt();
      } catch (err) {
        if (!(err instanceof SlugTakenError)) throw err;
        saved = await attempt();
      }
      return view(business, saved);
    },

    async update(business, id, { input, expectedVersion, action = PRODUCT_ACTIONS.UPDATE }, rawAuthor) {
      const author = normalizeAuthor(rawAuthor);
      if (action !== PRODUCT_ACTIONS.UPDATE && action !== PRODUCT_ACTIONS.OVERWRITE_AFTER_CONFLICT) throw new TypeError(`Acción desconocida: ${String(action)}`);
      ensureReady();
      const saved = await write(business, action, async (tx) => {
        const current = find(await tx.listBusiness(business), id);
        if (current.deleted) throw new ProductValidationError({ '': 'El producto está eliminado: recupéralo antes de editarlo.' });
        const result = validateProductInput(current, input, { mode: 'update', current });
        if (!result.ok) throw new ProductValidationError(result.errors);
        const version = requireVersion(expectedVersion);
        await checkImage(result.value.fields);
        if (version !== current.version) throw await conflict(business, current);
        const next: Product = {
          ...current,
          ...result.value.fields,
          available: result.value.available ?? current.available,
          version: current.version + 1,
          updatedAt: now(),
        };
        if (!(await tx.replace(next, current.version))) throw await conflict(business, current);
        await tx.addChange(entry(next, action, author, diff(current, next)));
        return next;
      });
      return view(business, saved);
    },

    async remove(business, id, expectedVersion, rawAuthor) {
      const author = normalizeAuthor(rawAuthor);
      ensureReady();
      const saved = await write(business, PRODUCT_ACTIONS.DELETE, async (tx) => {
        const current = find(await tx.listBusiness(business), id);
        if (current.deleted) throw new ProductValidationError({ '': 'El producto ya está eliminado.' });
        const version = requireVersion(expectedVersion);
        if (version !== current.version) throw await conflict(business, current);
        const at = now();
        const next: Product = { ...current, deleted: true, deletedAt: at, version: current.version + 1, updatedAt: at };
        if (!(await tx.replace(next, current.version))) throw await conflict(business, current);
        await tx.addChange(entry(next, PRODUCT_ACTIONS.DELETE, author, diff(current, next)));
        return next;
      });
      return view(business, saved);
    },

    async restore(business, id, expectedVersion, rawAuthor) {
      const author = normalizeAuthor(rawAuthor);
      ensureReady();
      const saved = await write(business, PRODUCT_ACTIONS.RESTORE, async (tx) => {
        const products = await tx.listBusiness(business);
        const current = find(products, id);
        if (!current.deleted) throw new ProductValidationError({ '': 'El producto no está eliminado.' });
        if (products.filter(isActive).length >= MAX_ACTIVE_PRODUCTS) throw new ProductValidationError({ '': LIMIT_MESSAGE });
        const version = requireVersion(expectedVersion);
        if (version !== current.version) throw await conflict(business, current);
        const at = now();
        const last = activeOf(products, current.category).at(-1);
        // D-12: vuelve al final del orden y no disponible, con el mismo slug.
        const next: Product = {
          ...current,
          deleted: false,
          deletedAt: null,
          available: false,
          position: (last?.position ?? 0) + 1,
          version: current.version + 1,
          updatedAt: at,
        };
        if (!(await tx.replace(next, current.version))) throw await conflict(business, current);
        await tx.addChange(entry(next, PRODUCT_ACTIONS.RESTORE, author, diff(current, next)));
        return next;
      });
      return view(business, saved);
    },

    async reorder(business, category, items, rawAuthor) {
      const author = normalizeAuthor(rawAuthor);
      ensureReady();
      await write(business, PRODUCT_ACTIONS.REORDER, async (tx) => {
        const products = await tx.listBusiness(business);
        if (category !== 'platillo' && category !== 'bebida') throw new ProductValidationError({ category: 'Elige una categoría válida para este negocio.' });
        const active = activeOf(products, category);
        if (business === BUSINESS.BIRRIA && category === 'bebida') throw new ProductValidationError({ category: 'Elige una categoría válida para este negocio.' });
        if (!Array.isArray(items)) throw new ProductValidationError({ items: 'Debe ser una lista.' });
        const requested = items.map((item: unknown) => ({ id: versionOf(errorProp(item, 'id')), version: versionOf(errorProp(item, 'version')) }));
        const ids = requested.map((item) => item.id);
        const expected = new Set(active.map((product) => product.id));
        const complete =
          requested.every((item) => item.id !== null && item.version !== null) && new Set(ids).size === ids.length && ids.length === expected.size && ids.every((itemId) => itemId !== null && expected.has(itemId));
        if (!complete) throw new ProductValidationError({ items: 'Envía exactamente los productos activos de la categoría, cada uno con su id y su versión, sin repetir.' });
        const ordered = requested.map((item) => find(active, item.id as number));
        for (const [index, product] of ordered.entries()) {
          if (product.version !== requested[index]?.version) throw await conflict(business, product);
        }
        await applyOrder(tx, ordered, author, now());
      });
      // La categoría se validó dentro de la transacción.
      return list(business, { category: category as ProductCategory });
    },

    async move(business, id, direction, expectedVersion, rawAuthor) {
      const author = normalizeAuthor(rawAuthor);
      ensureReady();
      let category: ProductCategory = 'platillo';
      await write(business, PRODUCT_ACTIONS.REORDER, async (tx) => {
        const products = await tx.listBusiness(business);
        const current = find(products, id);
        if (current.deleted) throw new ProductNotFoundError();
        category = current.category;
        const version = requireVersion(expectedVersion);
        if (version !== current.version) throw await conflict(business, current);
        const ordered = activeOf(products, current.category);
        const index = ordered.findIndex((product) => product.id === id);
        const target = direction === 'up' ? index - 1 : index + 1;
        if (target < 0 || target >= ordered.length) return;
        // El índice existe (findIndex) y el destino está dentro de la lista (comprobado arriba).
        [ordered[index], ordered[target]] = [ordered[target] as Product, ordered[index] as Product];
        await applyOrder(tx, ordered, author, now());
      });
      return list(business, { category });
    },

    async getLastChange(business) {
      ensureReady();
      return store.lastBusinessChange(business);
    },
  });
}
