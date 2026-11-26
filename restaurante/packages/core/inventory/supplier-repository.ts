import { InventoryValidationError, SupplierConflictError, SupplierNameTakenError, SupplierNotFoundError, type FieldErrors } from './errors.ts';
import { HISTORY_LIMIT, QUERY_MAX, historyChanges, normalizeAuthor, type InventoryAuthor } from './inventory-repository.ts';
import { INVENTORY_ACTIONS, ITEM_STATUSES, type InventoryAction, type InventoryStore, type InventoryStoreTx, type ItemStatus, type StoredInventoryChange } from './inventory-store.ts';
import { validateSupplierFields, type Supplier, type SupplierFieldsInput } from './supplier-schema.ts';
import { readId, searchKey } from './text.ts';

/**
 * Proveedores del inventario (REQ-F-051, RF-1): alta, edición con control de versión, inactivación y
 * reactivación, lista con estado y búsqueda, y ficha con su historial (PV-T3-9).
 *
 * - Nombre único entre los activos sin distinguir mayúsculas: comprobación previa (error por campo) y
 *   la clave única del store (`active_name_key`) como garantía ante carreras.
 * - Un proveedor inactivo no se ofrece en compras nuevas, pero sigue en la historia.
 * - Cada escritura deja su entrada en `inventory_change` (entity 'supplier') en la misma transacción.
 * - Nunca registra el contacto en los logs: core no escribe logs; la `api` solo registra ids.
 */

export const SUPPLIER_PAGE_SIZE = 50;

export interface SupplierListFilterInput {
  status?: unknown;
  q?: unknown;
  page?: unknown;
}

export interface SupplierPage {
  suppliers: Supplier[];
  page: { number: number; size: number; total: number };
}

export interface SupplierDetail {
  supplier: Supplier;
  history: StoredInventoryChange[];
}

export interface UpdateSupplierInput extends SupplierFieldsInput {
  version: unknown;
  /** "Guardar encima" tras un conflicto. */
  overwrite?: boolean;
}

export interface SupplierRepository {
  listSuppliers(filter?: SupplierListFilterInput): Promise<SupplierPage>;
  getSupplier(id: number): Promise<SupplierDetail>;
  createSupplier(input: SupplierFieldsInput, author: InventoryAuthor): Promise<Supplier>;
  updateSupplier(id: number, input: UpdateSupplierInput, author: InventoryAuthor): Promise<Supplier>;
  deactivateSupplier(id: number, input: { version: unknown }, author: InventoryAuthor): Promise<Supplier>;
  reactivateSupplier(id: number, input: { version: unknown }, author: InventoryAuthor): Promise<Supplier>;
}

const NAME_TAKEN = 'Ya hay un proveedor activo con ese nombre.';

const snapshot = (supplier: Supplier): Record<string, unknown> => ({ name: supplier.name, contact: supplier.contact, active: supplier.active });

const conflictOf = (supplier: Supplier): SupplierConflictError =>
  new SupplierConflictError({ id: supplier.id, version: supplier.version, updatedAt: supplier.updatedAt, updatedBy: supplier.updatedByName });

function requireVersion(value: unknown): number {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 1) return value;
  throw new InventoryValidationError({ version: 'Falta la versión o no es un entero positivo.' });
}

function readFilter(filter: SupplierListFilterInput): { status: ItemStatus; q: string | null; page: number } {
  const errors: FieldErrors = {};
  const status = filter.status ?? 'active';
  if (!(ITEM_STATUSES as readonly unknown[]).includes(status)) errors.status = 'Elige activos, inactivos o todos.';
  let q: string | null = null;
  if (filter.q !== undefined && filter.q !== null) {
    if (typeof filter.q !== 'string') errors.q = 'Debe ser texto.';
    else {
      q = searchKey(filter.q) || null;
      if (q !== null && [...q].length > QUERY_MAX) errors.q = `Máximo ${QUERY_MAX} caracteres.`;
    }
  }
  const page = filter.page === undefined || filter.page === null ? 1 : readId(filter.page);
  if (page === null) errors.page = 'La página debe ser un entero positivo.';
  if (Object.keys(errors).length > 0) throw new InventoryValidationError(errors);
  // Validados arriba.
  return { status: status as ItemStatus, q, page: page as number };
}

/** Traduce el choque con la clave única del nombre a un error por campo. */
async function asFieldErrors<T>(task: () => Promise<T>): Promise<T> {
  try {
    return await task();
  } catch (err) {
    if (err instanceof SupplierNameTakenError) throw new InventoryValidationError({ name: NAME_TAKEN });
    throw err;
  }
}

export function createSupplierRepository({ store, now = () => new Date() }: { store: InventoryStore; now?: () => Date }): SupplierRepository {
  if (!store) throw new TypeError('createSupplierRepository requiere un store');

  async function checkName(tx: InventoryStoreTx, nameKey: string, selfId: number | null): Promise<void> {
    const owner = await tx.activeSupplierIdByNameKey(nameKey);
    if (owner !== null && owner !== selfId) throw new InventoryValidationError({ name: NAME_TAKEN });
  }

  async function load(tx: InventoryStoreTx, id: number, version: number): Promise<Supplier> {
    const current = await tx.getSupplier(id);
    if (!current) throw new SupplierNotFoundError();
    if (current.version !== version) throw conflictOf(current);
    return current;
  }

  /** Guarda `next` (versión + 1, autor y fecha) y su entrada de historial; sin cambios, devuelve el vigente. */
  async function save(tx: InventoryStoreTx, current: Supplier, next: Supplier, action: InventoryAction, author: InventoryAuthor, at: Date): Promise<Supplier> {
    const changes = historyChanges(snapshot(current), snapshot(next));
    if (changes.length === 0) return current;
    const saved: Supplier = { ...next, version: current.version + 1, updatedAt: at, updatedById: author.id, updatedByName: author.name };
    if (!(await tx.replaceSupplier(saved, current.version))) {
      const latest = await tx.getSupplier(current.id);
      throw latest ? conflictOf(latest) : new SupplierNotFoundError();
    }
    await tx.addChange({ at, entity: 'supplier', entityId: current.id, action, actorId: author.id, actorName: author.name, changes });
    return saved;
  }

  return Object.freeze<SupplierRepository>({
    async listSuppliers(filter = {}) {
      const query = readFilter(filter);
      const all = await store.read((reader) => reader.listSuppliers(query.status));
      const matching = query.q === null ? all : all.filter((supplier) => searchKey(supplier.name).includes(query.q as string));
      const start = (query.page - 1) * SUPPLIER_PAGE_SIZE;
      return { suppliers: matching.slice(start, start + SUPPLIER_PAGE_SIZE), page: { number: query.page, size: SUPPLIER_PAGE_SIZE, total: matching.length } };
    },

    getSupplier(id) {
      return store.read(async (reader) => {
        const supplier = await reader.getSupplier(id);
        if (!supplier) throw new SupplierNotFoundError();
        return { supplier, history: await reader.history('supplier', id, HISTORY_LIMIT) };
      });
    },

    async createSupplier(input, rawAuthor) {
      const author = normalizeAuthor(rawAuthor);
      const fields = validateSupplierFields(input);
      if (!fields.ok) throw new InventoryValidationError(fields.errors);
      return store.transaction((tx) =>
        asFieldErrors(async () => {
          const at = now();
          await checkName(tx, fields.value.nameKey, null);
          const supplier = await tx.insertSupplier({ ...fields.value, active: true, version: 1, createdAt: at, updatedAt: at, updatedById: author.id, updatedByName: author.name });
          await tx.addChange({ at, entity: 'supplier', entityId: supplier.id, action: INVENTORY_ACTIONS.CREATE, actorId: author.id, actorName: author.name, changes: historyChanges(null, snapshot(supplier)) });
          return supplier;
        }),
      );
    },

    async updateSupplier(id, input, rawAuthor) {
      const author = normalizeAuthor(rawAuthor);
      const version = requireVersion(input.version);
      const fields = validateSupplierFields(input);
      return store.transaction((tx) =>
        asFieldErrors(async () => {
          const at = now();
          const current = await tx.getSupplier(id);
          if (!current) throw new SupplierNotFoundError();
          if (!fields.ok) throw new InventoryValidationError(fields.errors);
          if (current.version !== version) throw conflictOf(current);
          if (current.active && fields.value.nameKey !== current.nameKey) await checkName(tx, fields.value.nameKey, id);
          const action = input.overwrite === true ? INVENTORY_ACTIONS.OVERWRITE_AFTER_CONFLICT : INVENTORY_ACTIONS.UPDATE;
          return save(tx, current, { ...current, ...fields.value }, action, author, at);
        }),
      );
    },

    async deactivateSupplier(id, input, rawAuthor) {
      const author = normalizeAuthor(rawAuthor);
      const version = requireVersion(input.version);
      return store.transaction(async (tx) => {
        const current = await load(tx, id, version);
        if (!current.active) return current;
        return save(tx, current, { ...current, active: false }, INVENTORY_ACTIONS.DEACTIVATE, author, now());
      });
    },

    async reactivateSupplier(id, input, rawAuthor) {
      const author = normalizeAuthor(rawAuthor);
      const version = requireVersion(input.version);
      return store.transaction((tx) =>
        asFieldErrors(async () => {
          const current = await load(tx, id, version);
          if (current.active) return current;
          // CA-22: reactivar un proveedor cuyo nombre ya usa otro activo se rechaza.
          await checkName(tx, current.nameKey, id);
          return save(tx, current, { ...current, active: true }, INVENTORY_ACTIONS.REACTIVATE, author, now());
        }),
      );
    },
  });
}
