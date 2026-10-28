import { BUSINESS, BUSINESS_IDS, errorProp, silentLogger, type BusinessId, type Logger } from '../shared/index.ts';
import { diffMenuData, type FieldChange } from './menu-diff.ts';
import type { MenuDataByBusiness } from './menu-schema.ts';
import {
  MAX_ACTIVE_PRODUCTS,
  changeSnapshot,
  isValidKind,
  validateProductInput,
  type FieldErrors,
  type Product,
  type ProductCategory,
  type ProductFields,
} from './product-schema.ts';
import {
  PRODUCT_ACTIONS,
  ProductConflictError,
  ProductNotFoundError,
  ProductValidationError,
  SlugTakenError,
  type ChangeEntry,
  type ChangeSummary,
  type ImportSourceName,
  type NewProduct,
  type ProductAction,
  type ProductStore,
  type ProductStoreTx,
} from './product-store.ts';
import { activeOf, byPosition, toPublished, type PublishedProducts } from './published.ts';
import { uniqueSlug } from './slug.ts';


/**
 * Repositorio de productos (REQ-F-008, RF-9). En core desde REQ-F-039: es el caso de uso que comparten
 * `api` (la única que escribe, con `ADMIN_NEW_URL` en landing-pages) y `landing-pages` (caché del bot
 * y vistas de solo lectura de /admin).
 *
 * Una sola implementación de las reglas (validación, slug, límites, versión, posiciones y
 * registro) sobre un `ProductStore` con dos implementaciones: Prisma/MySQL
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

/** Autor de los cambios importados (RF-3.3). */
export const SYSTEM_AUTHOR_NAME = 'sistema';

export interface ProductAuthor {
  id: number;
  name: string;
}

/** Producto con su último cambio (quién y cuándo). */
export interface ProductView extends Product {
  updatedBy: ChangeSummary | null;
}

export interface ImportSource<Id extends BusinessId = BusinessId> {
  source: ImportSourceName;
  data: MenuDataByBusiness[Id];
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
  /**
   * Importación única (D-8) y carga de la caché. Sin fuentes solo carga la caché, sin importar
   * nada (la API: la importación es solo de landing-pages, O-1 de REQ-F-037).
   */
  init(sources?: { [Id in BusinessId]: ImportSource<Id> }): Promise<void>;
  /**
   * Vuelve a leer los productos publicados de un negocio (REQ-F-039, RF-12 y RF-13: aviso interno y
   * recarga periódica del catálogo del bot). true si pudo; si falla conserva la caché anterior.
   */
  reload(business: BusinessId): Promise<boolean>;
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
  /**
   * Avisa de cada escritura confirmada de un negocio (REQ-F-038, RF-6): la caché de la API de las
   * landings se invalida con él. Devuelve la función que cancela la suscripción.
   */
  onChange(listener: ProductChangeListener): () => void;
}

export type ProductChangeListener = (business: BusinessId) => void;

export interface ProductRepositoryOptions {
  store: ProductStore;
  /** Comprueba que la imagen exista en public/img al guardar (RF-7.1). */
  imageExists: (src: string) => Promise<boolean>;
  now?: () => Date;
  logger?: Logger;
}

const isActive = (product: Product): boolean => !product.deleted;
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
  const listeners = new Set<ProductChangeListener>();
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

  async function refresh(business: BusinessId): Promise<boolean> {
    try {
      published.set(business, toPublished(business, await store.listBusiness(business)));
      stale.delete(business);
      return true;
    } catch (err) {
      // La landing conserva la última versión válida (D-15).
      stale.add(business);
      logger.error('products_cache_refresh_failed', { business, name: errorProp(err, 'name'), code: errorProp(err, 'code') });
      return false;
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

  /** Tras el commit: un suscriptor que falla se registra y nunca afecta a la escritura. */
  function notify(business: BusinessId): void {
    for (const listener of listeners) {
      try {
        listener(business);
      } catch (err) {
        logger.error('products_change_listener_failed', { business, name: errorProp(err, 'name') });
      }
    }
  }

  /** Escritura: transacción del store, caché, aviso a los suscriptores y log. */
  async function write<T>(business: BusinessId, action: ProductAction, task: (tx: ProductStoreTx) => Promise<T>): Promise<T> {
    ensureReady();
    return exclusive(async () => {
      const result = await store.transaction(task);
      await refresh(business);
      // Confirmada la transacción (aunque la recarga de esta caché falle): RF-6 de REQ-F-038.
      notify(business);
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
        if (sources) await importBusiness(business, sources[business]);
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

    async reload(business) {
      ensureReady();
      return refresh(business);
    },

    onChange(listener) {
      if (typeof listener !== 'function') throw new TypeError('onChange requiere una función');
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

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
