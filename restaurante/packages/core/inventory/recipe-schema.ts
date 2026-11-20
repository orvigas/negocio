import { WASTE_SCALE, divideRounded, parseDecimal } from './decimal.ts';
import type { FieldErrors } from './errors.ts';
import type { InventoryItem, ItemType } from './item-schema.ts';
import { readId, readOptionalText } from './text.ts';
import { INVENTORY_UNITS, MAX_QUANTITY, UNIT_CONVERSION_CODES, UnitConversionError, convertToBase, unitKey } from './units.ts';

/**
 * Recetas del inventario (REQ-F-050, T2): forma de una versión y de sus líneas, validación de la
 * entrada y las cuentas de la merma (RN-6, RN-T2-1). Las reglas que dependen de otros datos (versión
 * vigente, ciclos, conflicto) viven en recipe-repository.ts.
 *
 * - Cantidades con escala 3 y merma en % con escala 2, como bigint (decimal.ts).
 * - La cantidad neta es la aprovechable tras la merma: bruta = neta / (1 − merma), redondeada a 3
 *   decimales (mitad hacia arriba). El rendimiento de la receta no vuelve a descontar la merma.
 */

export const RECIPE_LIMITS = Object.freeze({
  LINES_MIN: 1,
  LINES_MAX: 40,
  NOTE_MAX: 400,
  LINE_NOTE_MAX: 200,
  /** RF-5: niveles máximos de recetas anidadas. */
  MAX_DEPTH: 8,
});

/** RN-T2-2: tipos que llevan receta (simples o variantes; nunca un padre). */
export const RECIPE_ITEM_TYPES: readonly ItemType[] = Object.freeze(['intermedio', 'compuesto']);
/** RN-T2-3: tipos que pueden ser ingrediente (activos y que no son padres). Nunca un Compuesto (P-3). */
export const INGREDIENT_TYPES: readonly ItemType[] = Object.freeze(['insumo', 'intermedio', 'reventa']);

/** 100 % con la escala de la merma. */
const WASTE_FULL = 100n * 10n ** BigInt(WASTE_SCALE);

export const recipeAllowed = (item: Pick<InventoryItem, 'kind' | 'type'>): boolean => item.kind !== 'parent' && RECIPE_ITEM_TYPES.includes(item.type);

export interface RecipeLine {
  /** 1..40, en el orden capturado. */
  position: number;
  ingredientId: number;
  /** Neta en `unit` (escala 3). */
  quantity: bigint;
  /** Unidad del sistema o empaque del ingrediente, con el nombre guardado. */
  unit: string;
  /** Neta en la unidad base del ingrediente (escala 3). */
  netBaseQuantity: bigint;
  /** Merma en % (escala 2), en [0, 100). */
  wastePercent: bigint;
  /** Bruta en la unidad base del ingrediente (escala 3). */
  grossBaseQuantity: bigint;
  note: string | null;
}

/** Versión guardada. Inmutable salvo su cierre (validTo). */
export interface RecipeVersion {
  id: number;
  itemId: number;
  number: number;
  /** Rendimiento en la unidad base del artículo producido (escala 3). */
  yieldQuantity: bigint;
  validFrom: Date;
  /** null mientras está vigente. */
  validTo: Date | null;
  note: string | null;
  createdAt: Date;
  /** null: importación o semilla. */
  createdById: number | null;
  createdByName: string;
  lines: RecipeLine[];
}

export type NewRecipeVersion = Omit<RecipeVersion, 'id' | 'validTo'>;

/** Receta vigente que usa un artículo (RF-8). */
export interface RecipeUsage {
  /** Artículo producido. */
  itemId: number;
  itemName: string;
  itemActive: boolean;
  versionId: number;
  versionNumber: number;
}

/** Línea tal como llega (sin validar). Cantidad y merma, como texto decimal («6.000», «40.00»). */
export interface RecipeLineInput {
  ingredientId?: unknown;
  quantity?: unknown;
  unit?: unknown;
  wastePercent?: unknown;
  note?: unknown;
}

export interface RecipeVersionInput {
  /** Versión vigente de la que se partió; null si el artículo no tenía receta (C-4). */
  baseVersionId?: unknown;
  yieldQuantity?: unknown;
  note?: unknown;
  lines?: unknown;
}

export interface ParsedRecipeLine {
  ingredientId: number;
  quantity: bigint;
  unit: string;
  wastePercent: bigint;
  note: string | null;
}

export interface ParsedRecipe {
  baseVersionId: number | null;
  yieldQuantity: bigint;
  note: string | null;
  lines: ParsedRecipeLine[];
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** RN-6: bruta = neta / (1 − merma), con escala 3 y redondeo de la mitad hacia arriba. */
export function grossFromNet(net: bigint, wastePercent: bigint): bigint {
  if (wastePercent < 0n || wastePercent >= WASTE_FULL) throw new RangeError('La merma debe estar en [0, 100)');
  return divideRounded(net * WASTE_FULL, WASTE_FULL - wastePercent);
}

/** Ayuda inversa (solo informativa): neta = bruta × (1 − merma). */
export function netFromGross(gross: bigint, wastePercent: bigint): bigint {
  if (wastePercent < 0n || wastePercent >= WASTE_FULL) throw new RangeError('La merma debe estar en [0, 100)');
  return divideRounded(gross * (WASTE_FULL - wastePercent), WASTE_FULL);
}

/** Cantidad > 0 con escala 3. */
function readQuantity(raw: unknown, label: string): { value: bigint } | { error: string } {
  const parsed = parseDecimal(raw);
  if (!parsed.ok) return { error: raw === undefined || raw === null || raw === '' ? `Escribe ${label}.` : parsed.error };
  if (parsed.value <= 0n) return { error: `${label[0]?.toUpperCase() ?? ''}${label.slice(1)} debe ser mayor que 0.` };
  return { value: parsed.value };
}

/** Merma en %: vacía es 0; si no, de 0 a 99.99 con 2 decimales como máximo. */
function readWaste(raw: unknown): { value: bigint } | { error: string } {
  if (raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')) return { value: 0n };
  const parsed = parseDecimal(raw, { scale: WASTE_SCALE, integerDigits: 3 });
  if (!parsed.ok) return { error: parsed.error };
  if (parsed.value >= WASTE_FULL) return { error: 'La merma debe ser menor que 100 %.' };
  return { value: parsed.value };
}

/**
 * Valida la forma de la entrada de una versión (sin consultar otros datos): versión de partida,
 * rendimiento > 0, nota, de 1 a 40 líneas con artículo, cantidad neta > 0, unidad, merma en [0, 100)
 * y nota. Los errores van por campo: `yieldQuantity`, `lines`, `lines.N.ingredient`, `lines.N.quantity`…
 */
export function readRecipeInput(input: RecipeVersionInput): { ok: true; value: ParsedRecipe } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  let baseVersionId: number | null = null;
  if (input.baseVersionId === undefined) errors.baseVersionId = 'Falta la versión de partida (null si no hay receta).';
  else if (input.baseVersionId !== null) {
    baseVersionId = readId(input.baseVersionId);
    if (baseVersionId === null) errors.baseVersionId = 'Versión de partida inválida.';
  }
  const yieldQuantity = readQuantity(input.yieldQuantity, 'el rendimiento');
  if ('error' in yieldQuantity) errors.yieldQuantity = yieldQuantity.error;
  const note = readOptionalText(input.note, RECIPE_LIMITS.NOTE_MAX);
  if ('error' in note) errors.note = note.error;

  const lines: ParsedRecipeLine[] = [];
  if (!Array.isArray(input.lines)) errors.lines = 'Agrega al menos un ingrediente.';
  else {
    // Array.isArray lo tipa como any[]: sus elementos aún no están validados.
    const rows = input.lines as unknown[];
    if (rows.length < RECIPE_LIMITS.LINES_MIN) errors.lines = 'Agrega al menos un ingrediente.';
    else if (rows.length > RECIPE_LIMITS.LINES_MAX) errors.lines = `Máximo ${RECIPE_LIMITS.LINES_MAX} ingredientes.`;
    else {
      const seen = new Set<number>();
      for (const [index, row] of rows.entries()) {
        const path = `lines.${index}`;
        if (!isRecord(row)) {
          errors[path] = 'Debe ser un objeto.';
          continue;
        }
        const ingredientId = readId(row.ingredientId);
        if (ingredientId === null) errors[`${path}.ingredient`] = 'Elige el ingrediente.';
        else if (seen.has(ingredientId)) errors[`${path}.ingredient`] = 'Ingrediente repetido: júntalo en una sola línea.';
        else seen.add(ingredientId);
        const quantity = readQuantity(row.quantity, 'la cantidad neta');
        if ('error' in quantity) errors[`${path}.quantity`] = quantity.error;
        const unit = typeof row.unit === 'string' ? row.unit.trim().normalize('NFC') : '';
        if (unit === '') errors[`${path}.unit`] = 'Elige la unidad.';
        const waste = readWaste(row.wastePercent);
        if ('error' in waste) errors[`${path}.wastePercent`] = waste.error;
        const lineNote = readOptionalText(row.note, RECIPE_LIMITS.LINE_NOTE_MAX);
        if ('error' in lineNote) errors[`${path}.note`] = lineNote.error;
        if (ingredientId !== null && 'value' in quantity && unit !== '' && 'value' in waste && 'value' in lineNote) {
          lines.push({ ingredientId, quantity: quantity.value, unit, wastePercent: waste.value, note: lineNote.value });
        }
      }
    }
  }
  if (Object.keys(errors).length > 0 || 'error' in yieldQuantity || 'error' in note) return { ok: false, errors };
  return { ok: true, value: { baseVersionId, yieldQuantity: yieldQuantity.value, note: note.value, lines } };
}

/** Nombre guardado de la unidad: el de la unidad del sistema o el del empaque del ingrediente. */
function canonicalUnit(unit: string, ingredient: InventoryItem): string {
  const key = unitKey(unit);
  return INVENTORY_UNITS.find((name) => name.toLowerCase() === key) ?? ingredient.units.find((packaging) => unitKey(packaging.name) === key)?.name ?? unit;
}

/** Motivo por el que el artículo no puede ser ingrediente (RN-T2-3, RF-7), o null. */
export function ingredientProblem(ingredient: InventoryItem | undefined): string | null {
  if (!ingredient) return 'El ingrediente no existe.';
  if (ingredient.kind === 'parent') return 'Un artículo padre no es ingrediente: elige una de sus variantes.';
  if (!INGREDIENT_TYPES.includes(ingredient.type)) return 'Un Compuesto no puede ser ingrediente de otra receta.';
  if (!ingredient.active) return 'El ingrediente está inactivo: elige otro.';
  return null;
}

/**
 * Completa las líneas con los ingredientes: tipo y estado permitidos, conversión de la neta a la base
 * del ingrediente (sin factor, error de la unidad) y bruta. Los errores se agregan a `errors`.
 */
export function resolveRecipeLines(lines: readonly ParsedRecipeLine[], ingredients: ReadonlyMap<number, InventoryItem>, errors: FieldErrors): RecipeLine[] {
  const resolved: RecipeLine[] = [];
  for (const [index, line] of lines.entries()) {
    const path = `lines.${index}`;
    const ingredient = ingredients.get(line.ingredientId);
    const problem = ingredientProblem(ingredient);
    if (problem !== null || !ingredient) {
      errors[`${path}.ingredient`] = problem ?? 'El ingrediente no existe.';
      continue;
    }
    let netBaseQuantity: bigint;
    try {
      netBaseQuantity = convertToBase(line.quantity, line.unit, ingredient);
    } catch (err) {
      if (!(err instanceof UnitConversionError)) throw err;
      const field = err.code === UNIT_CONVERSION_CODES.TOO_SMALL || err.code === UNIT_CONVERSION_CODES.TOO_LARGE ? 'quantity' : 'unit';
      errors[`${path}.${field}`] = err.message;
      continue;
    }
    const grossBaseQuantity = grossFromNet(netBaseQuantity, line.wastePercent);
    if (grossBaseQuantity > MAX_QUANTITY) {
      errors[`${path}.quantity`] = 'La cantidad bruta supera el máximo que se puede guardar.';
      continue;
    }
    resolved.push({
      position: index + 1,
      ingredientId: line.ingredientId,
      quantity: line.quantity,
      unit: canonicalUnit(line.unit, ingredient),
      netBaseQuantity,
      wastePercent: line.wastePercent,
      grossBaseQuantity,
      note: line.note,
    });
  }
  return resolved;
}

/** ¿La versión guardada tiene exactamente este contenido? (guardar sin cambios no crea versión). */
export function sameRecipeContent(version: Pick<RecipeVersion, 'yieldQuantity' | 'note' | 'lines'>, yieldQuantity: bigint, note: string | null, lines: readonly RecipeLine[]): boolean {
  if (version.yieldQuantity !== yieldQuantity || version.note !== note || version.lines.length !== lines.length) return false;
  return version.lines.every((line, index) => {
    const other = lines[index];
    return (
      other !== undefined &&
      line.ingredientId === other.ingredientId &&
      line.quantity === other.quantity &&
      line.unit === other.unit &&
      line.wastePercent === other.wastePercent &&
      line.note === other.note
    );
  });
}
