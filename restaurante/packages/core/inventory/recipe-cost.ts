import { COST_SCALE, QUANTITY_SCALE, divideRounded, multiplyDecimals } from './decimal.ts';
import type { InventoryItem } from './item-schema.ts';
import { recipeAllowed, type RecipeLine, type RecipeVersion } from './recipe-schema.ts';

/**
 * Costo teórico multinivel (REQ-F-050, RN-T2-4, RF-6): se calcula al consultar, con decimales exactos
 * (bigint) y sin caché entre peticiones (DT-7).
 *
 * - Costo unitario de un artículo, por unidad base y con escala 4:
 *   - no inventariable: su costo de referencia (RN-T2-5);
 *   - Intermedio o Compuesto con receta vigente: el de su receta (DT-7);
 *   - si no: CPP (T3) → costo de referencia → «sin costo» (PT-3: un Intermedio con la receta cerrada
 *     sigue este orden).
 * - Costo de una línea: bruta (escala 3) × costo unitario (escala 4), exacto con escala 7. La suma se
 *   divide entre el rendimiento y se redondea una sola vez a 4 decimales, como el CPP que guardará T3.
 * - Un costo que falta nunca se toma como 0: la receta queda sin costo y lista los artículos hoja
 *   que lo impiden, sin repetir y con la ruta de recetas hasta ellos.
 */

export const COST_SOURCES = Object.freeze(['cpp', 'referencia', 'receta', 'sin_costo'] as const);
export type CostSource = (typeof COST_SOURCES)[number];

export interface MissingCost {
  itemId: number;
  name: string;
  /** Nombres desde el artículo de la receta hasta el que no tiene costo. */
  path: string[];
}

export interface UnitCost {
  /** Escala 4; null: sin costo. */
  cost: bigint | null;
  source: CostSource;
  missing: MissingCost[];
}

export interface RecipeLineCost extends RecipeLine {
  /** Costo unitario del ingrediente (escala 4) o null. */
  unitCost: bigint | null;
  /** Costo de la línea (escala 4) o null. */
  cost: bigint | null;
  source: CostSource;
}

export interface RecipeCost {
  lines: RecipeLineCost[];
  /** Costo total de la receta (escala 4) o null si falta algún costo. */
  total: bigint | null;
  /** Costo por unidad base del artículo producido (escala 4) o null. */
  unitCost: bigint | null;
  missing: MissingCost[];
}

export interface CostCatalog {
  items: ReadonlyMap<number, InventoryItem>;
  /** Versión vigente por artículo producido. */
  recipes: ReadonlyMap<number, RecipeVersion>;
  /** CPP por artículo (escala 4). Hasta T3 (REQ-F-051) no hay CPP. */
  cpp?: ReadonlyMap<number, bigint>;
}

export interface CostCalculator {
  unitCost(itemId: number): UnitCost;
  recipeCost(version: RecipeVersion): RecipeCost;
}

const UNKNOWN_NAME = '(artículo desconocido)';
const SCALE_GAP = 10n ** BigInt(QUANTITY_SCALE);

function mergeMissing(target: MissingCost[], entries: readonly MissingCost[], prefix: string): void {
  for (const entry of entries) {
    if (!target.some((other) => other.itemId === entry.itemId)) target.push({ ...entry, path: [prefix, ...entry.path] });
  }
}

/** Calculadora con memoria de una petición: cada artículo se costea una sola vez. */
export function createCostCalculator(catalog: CostCatalog): CostCalculator {
  const memo = new Map<number, UnitCost>();
  const computing = new Set<number>();

  function recipeCost(version: RecipeVersion): RecipeCost {
    const producer = catalog.items.get(version.itemId)?.name ?? UNKNOWN_NAME;
    const missing: MissingCost[] = [];
    let total7: bigint | null = 0n;
    const lines = version.lines.map((line): RecipeLineCost => {
      const unit = unitCost(line.ingredientId);
      mergeMissing(missing, unit.missing, producer);
      if (unit.cost === null) {
        total7 = null;
        return { ...line, unitCost: null, cost: null, source: unit.source };
      }
      const exact = multiplyDecimals(line.grossBaseQuantity, QUANTITY_SCALE, unit.cost, COST_SCALE, QUANTITY_SCALE + COST_SCALE);
      if (total7 !== null) total7 += exact;
      return { ...line, unitCost: unit.cost, cost: divideRounded(exact, SCALE_GAP), source: unit.source };
    });
    const total: bigint | null = total7;
    if (total === null) return { lines, total: null, unitCost: null, missing };
    return { lines, total: divideRounded(total, SCALE_GAP), unitCost: divideRounded(total, version.yieldQuantity), missing };
  }

  function compute(itemId: number): UnitCost {
    const item = catalog.items.get(itemId);
    if (!item) return { cost: null, source: 'sin_costo', missing: [{ itemId, name: UNKNOWN_NAME, path: [UNKNOWN_NAME] }] };
    const withoutCost: UnitCost = { cost: null, source: 'sin_costo', missing: [{ itemId, name: item.name, path: [item.name] }] };
    if (!item.inventoriable) return item.referenceCost === null ? withoutCost : { cost: item.referenceCost, source: 'referencia', missing: [] };
    const recipe = recipeAllowed(item) ? catalog.recipes.get(itemId) : undefined;
    if (recipe) {
      const result = recipeCost(recipe);
      return result.unitCost === null ? { cost: null, source: 'sin_costo', missing: result.missing } : { cost: result.unitCost, source: 'receta', missing: [] };
    }
    const cpp = catalog.cpp?.get(itemId);
    if (cpp !== undefined) return { cost: cpp, source: 'cpp', missing: [] };
    if (item.referenceCost !== null) return { cost: item.referenceCost, source: 'referencia', missing: [] };
    return withoutCost;
  }

  function unitCost(itemId: number): UnitCost {
    const known = memo.get(itemId);
    if (known) return known;
    // Defensa ante datos corruptos: el guardado ya impide los ciclos (recipe-graph.ts).
    if (computing.has(itemId)) return { cost: null, source: 'sin_costo', missing: [] };
    computing.add(itemId);
    const result = compute(itemId);
    computing.delete(itemId);
    memo.set(itemId, result);
    return result;
  }

  return { unitCost, recipeCost };
}
