/**
 * Errores de dominio del inventario (REQ-F-049). La `api` los traduce a 404, 409 y 422; cualquier
 * otro error de la base de datos llega como DatabaseUnavailableError (503).
 */

/** Errores por campo (422). La clave '' es un error general. */
export type FieldErrors = Record<string, string>;

export class InventoryError extends Error {}

export class InventoryValidationError extends InventoryError {
  readonly fields: FieldErrors;

  constructor(fields: FieldErrors) {
    super('Datos del inventario inválidos');
    this.name = 'InventoryValidationError';
    this.fields = fields;
  }
}

export class ItemNotFoundError extends InventoryError {
  constructor() {
    super('Artículo no encontrado');
    this.name = 'ItemNotFoundError';
  }
}

export class CategoryNotFoundError extends InventoryError {
  constructor() {
    super('Categoría no encontrada');
    this.name = 'CategoryNotFoundError';
  }
}

export interface InventoryConflictInfo {
  id: number;
  version: number;
  updatedAt: Date;
  updatedBy: string | null;
}

/** La versión enviada ya no es la vigente (RF-8, CA-9). */
export class InventoryConflictError extends InventoryError {
  readonly current: InventoryConflictInfo;

  constructor(current: InventoryConflictInfo) {
    super('El artículo cambió mientras se editaba');
    this.name = 'InventoryConflictError';
    this.current = current;
  }
}

/** Otro artículo activo ya usa el nombre (carrera en el alta, o reactivación). */
export class ItemNameTakenError extends InventoryError {
  constructor() {
    super('Ya hay un artículo activo con ese nombre.');
    this.name = 'ItemNameTakenError';
  }
}

/** El SKU ya se asignó alguna vez a otro artículo (PV-14, DT-3). */
export class SkuTakenError extends InventoryError {
  constructor() {
    super('Ese SKU ya se usó en otro artículo.');
    this.name = 'SkuTakenError';
  }
}

/** Otra categoría activa ya usa el nombre. */
export class CategoryNameTakenError extends InventoryError {
  constructor() {
    super('Ya hay una categoría activa con ese nombre.');
    this.name = 'CategoryNameTakenError';
  }
}

/** RN-4: la unidad base y los empaques no cambian si el artículo está en una receta o un movimiento. */
export class ItemLockedError extends InventoryError {
  constructor() {
    super('El artículo ya se usa en recetas o movimientos: su unidad base y sus empaques no se pueden cambiar. Inactívalo y crea otro.');
    this.name = 'ItemLockedError';
  }
}

/** RF-5: inactivar un padre con variantes activas exige confirmarlo. */
export class ItemHasActiveVariantsError extends InventoryError {
  readonly count: number;

  constructor(count: number) {
    super(`El artículo tiene ${count} ${count === 1 ? 'variante activa' : 'variantes activas'}: confirma que también se inactivan.`);
    this.name = 'ItemHasActiveVariantsError';
    this.count = count;
  }
}

/** No se crea ni se reactiva una variante de un padre inactivo. */
export class ParentInactiveError extends InventoryError {
  constructor() {
    super('El artículo padre está inactivo: reactívalo primero.');
    this.name = 'ParentInactiveError';
  }
}

/** No se asigna una categoría inactiva ni se reactiva un artículo con su categoría inactiva. */
export class CategoryInactiveError extends InventoryError {
  constructor() {
    super('La categoría está inactiva: reactívala o elige otra.');
    this.name = 'CategoryInactiveError';
  }
}

/** RF-6, CA-13: no se inactiva una categoría que usan artículos activos. */
export class CategoryInUseError extends InventoryError {
  readonly count: number;

  constructor(count: number) {
    super(`La ${count === 1 ? 'usa 1 artículo activo' : `usan ${count} artículos activos`}.`);
    this.name = 'CategoryInUseError';
    this.count = count;
  }
}
