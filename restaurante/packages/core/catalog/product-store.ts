import type { BusinessId } from '../shared/index.ts';
import type { FieldChange } from './menu-diff.ts';
import type { FieldErrors, Product } from './product-schema.ts';

/**
 * Store de productos (REQ-F-008, RF-9): acciones del registro, contrato del store que implementan
 * Prisma/MySQL (packages/db) y la memoria (memory-product-store.ts) y errores de dominio.
 * Extraído de product-repository.ts (REQ-F-037).
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

export type ImportSourceName = 'current' | 'previous' | 'seed';

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
