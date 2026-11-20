import type { RecipeVersion } from './recipe-schema.ts';

/**
 * Grafo de las recetas vigentes (REQ-F-050, RN-5 y RF-5): artículo producido -> ingredientes de su
 * versión vigente. Se arma en memoria con una sola consulta y se recorre en O(V+E), sin recursión en SQL.
 */

export type RecipeAdjacency = ReadonlyMap<number, readonly number[]>;

/** Adyacencia de las vigentes, con la receta de `proposed.itemId` sustituida por la propuesta. */
export function buildAdjacency(current: readonly Pick<RecipeVersion, 'itemId' | 'lines'>[], proposed?: { itemId: number; ingredientIds: readonly number[] }): Map<number, number[]> {
  const adjacency = new Map<number, number[]>(current.map((version) => [version.itemId, version.lines.map((line) => line.ingredientId)]));
  if (proposed) adjacency.set(proposed.itemId, [...proposed.ingredientIds]);
  return adjacency;
}

/**
 * Ruta de un ciclo que pasa por `itemId` ([itemId, …, itemId]) o null si no lo hay. Una receta que se
 * usa a sí misma da [itemId, itemId].
 */
export function findCycle(adjacency: RecipeAdjacency, itemId: number): number[] | null {
  const visited = new Set<number>();
  const visit = (node: number, path: number[]): number[] | null => {
    for (const next of adjacency.get(node) ?? []) {
      if (next === itemId) return [...path, next];
      if (visited.has(next)) continue;
      visited.add(next);
      const found = visit(next, [...path, next]);
      if (found) return found;
    }
    return null;
  };
  return visit(itemId, [itemId]);
}

/**
 * Niveles de la cadena de recetas más larga que pasa por `itemId`: su altura (1 si sus ingredientes no
 * llevan receta) más los niveles de las recetas que lo usan, directa o indirectamente. Supone un grafo
 * sin ciclos (findCycle va antes).
 */
export function recipeDepth(adjacency: RecipeAdjacency, itemId: number): number {
  const users = new Map<number, number[]>();
  for (const [producer, ingredients] of adjacency) {
    for (const ingredient of ingredients) users.set(ingredient, [...(users.get(ingredient) ?? []), producer]);
  }
  const heights = new Map<number, number>();
  const height = (node: number): number => {
    const ingredients = adjacency.get(node);
    if (!ingredients) return 0;
    const known = heights.get(node);
    if (known !== undefined) return known;
    heights.set(node, 1);
    const value = 1 + Math.max(0, ...ingredients.map(height));
    heights.set(node, value);
    return value;
  };
  const ups = new Map<number, number>();
  const up = (node: number): number => {
    const known = ups.get(node);
    if (known !== undefined) return known;
    ups.set(node, 0);
    const value = Math.max(0, ...(users.get(node) ?? []).map((producer) => 1 + up(producer)));
    ups.set(node, value);
    return value;
  };
  return height(itemId) + up(itemId);
}
