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

// --- Recetas (REQ-F-050, T2) -----------------------------------------------------------------

/** RN-T2-2: solo un Intermedio o un Compuesto que no es padre lleva receta (409 RECIPE_NOT_ALLOWED). */
export class RecipeNotAllowedError extends InventoryError {
  constructor() {
    super('Solo un artículo Intermedio o Compuesto (que no sea padre) lleva receta.');
    this.name = 'RecipeNotAllowedError';
  }
}

/** Un artículo inactivo no admite versiones nuevas de su receta (409 RECIPE_ITEM_INACTIVE); sí se puede cerrar. */
export class RecipeItemInactiveError extends InventoryError {
  constructor() {
    super('El artículo está inactivo: no admite versiones nuevas de su receta.');
    this.name = 'RecipeItemInactiveError';
  }
}

export class RecipeVersionNotFoundError extends InventoryError {
  constructor() {
    super('Versión de receta no encontrada');
    this.name = 'RecipeVersionNotFoundError';
  }
}

export interface RecipeVersionInfo {
  id: number;
  number: number;
  validFrom: Date;
  createdByName: string;
}

/**
 * C-4, RF-9: la versión de partida ya no es la vigente (409 RECIPE_VERSION_CONFLICT). `current` es la
 * vigente (null si el artículo ya no tiene receta vigente o si no se pudo leer tras un choque).
 */
export class RecipeVersionConflictError extends InventoryError {
  readonly current: RecipeVersionInfo | null;

  constructor(current: RecipeVersionInfo | null) {
    super('La receta cambió mientras se editaba');
    this.name = 'RecipeVersionConflictError';
    this.current = current;
  }
}

/** RN-5, RF-5: la receta se contendría a sí misma (422 RECIPE_CYCLE). `path`: nombres, del artículo a sí mismo. */
export class RecipeCycleError extends InventoryError {
  readonly path: string[];

  constructor(path: string[]) {
    super(`La receta se contendría a sí misma: ${path.join(' → ')}.`);
    this.name = 'RecipeCycleError';
    this.path = path;
  }
}

/**
 * RF-5: más niveles de recetas anidadas de los permitidos (422 RECIPE_TOO_DEEP). Con la cadena más
 * larga, por nombre (REQ-F-054, RF-2): `path` desde el artículo hacia abajo (como el ciclo) y `usedBy`
 * desde quien lo usa directamente hacia arriba.
 */
export class RecipeTooDeepError extends InventoryError {
  readonly depth: number;
  readonly max: number;
  readonly path: string[];
  readonly usedBy: string[];

  constructor(depth: number, max: number, path: string[], usedBy: string[]) {
    super(`Las recetas quedarían anidadas en ${depth} niveles; el máximo es ${max}.`);
    this.name = 'RecipeTooDeepError';
    this.depth = depth;
    this.max = max;
    this.path = path;
    this.usedBy = usedBy;
  }
}

/** RF-7, CA-10: inactivar un artículo usado en recetas vigentes exige confirmarlo (409 ITEM_IN_ACTIVE_RECIPES). */
export class ItemInActiveRecipesError extends InventoryError {
  readonly recipes: { itemId: number; name: string }[];

  constructor(recipes: { itemId: number; name: string }[]) {
    super(`Se usa en ${recipes.length === 1 ? '1 receta vigente' : `${recipes.length} recetas vigentes`}: confirma que se inactiva igualmente.`);
    this.name = 'ItemInActiveRecipesError';
    this.recipes = recipes;
  }
}

/** Otra escritura del inventario retiene el candado más de lo que se espera (503 INVENTORY_BUSY). */
export class InventoryBusyError extends InventoryError {
  constructor() {
    super('El inventario está ocupado con otra escritura: inténtalo de nuevo.');
    this.name = 'InventoryBusyError';
  }
}
