/**
 * Tolerancia de ortografía (REQ-F-013, D-12): distancia de Damerau-Levenshtein restringida
 * (transposición de letras vecinas = 1 edición), calculada con un tope. Funciones puras.
 */

/** Ediciones permitidas según la longitud de la palabra del cliente: 0 (≤ 3), 1 (4 a 7) o 2 (≥ 8). */
export const allowedEdits = (length: number): number => (length >= 8 ? 2 : length >= 4 ? 1 : 0);

/** Distancia entre `a` y `b`, o `max + 1` si supera `max` (corta en cuanto lo sabe). */
export function boundedDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (a === b) return 0;
  const rows = a.length + 1;
  const cols = b.length + 1;
  // Tres filas bastan: la actual, la anterior y la de antes (para la transposición).
  let before = new Array<number>(cols).fill(0);
  let previous = Array.from({ length: cols }, (_, j) => j);
  for (let i = 1; i < rows; i += 1) {
    const current = new Array<number>(cols).fill(0);
    current[0] = i;
    let rowMin = current[0];
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min((previous[j] ?? 0) + 1, (current[j - 1] ?? 0) + 1, (previous[j - 1] ?? 0) + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) value = Math.min(value, (before[j - 2] ?? 0) + 1);
      current[j] = value;
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > max) return max + 1;
    before = previous;
    previous = current;
  }
  const distance = previous[cols - 1] ?? max + 1;
  return distance > max ? max + 1 : distance;
}
