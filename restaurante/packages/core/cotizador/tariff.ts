/**
 * Tarifa comercial por persona de un paquete (REQ-F-046, RN-9). Es la única función que define la
 * curva: para usar otra basta con sustituirla junto con sus valores esperados en la prueba; el resto
 * del cálculo, la API y la pantalla no cambian.
 *
 * - Entre `minPersonas` y `refPersonas`, recta de a (en el mínimo) a b (en la referencia), como el Excel.
 * - Por encima de `refPersonas`, F + (b − F) · e^(−s · (N − ref) / (b − F)), con s = (a − b) / (ref − min):
 *   continua en valor y en pendiente en la referencia, nunca baja de F y converge a F.
 *
 * Restricciones (las valida el catálogo y los ajustes): F < b ≤ a y min < ref. Con a = b, la tarifa es
 * plana (vale b también por encima de la referencia).
 */

export interface TariffParams {
  /** Tarifa en `minPersonas`. */
  a: number;
  /** Tarifa en `refPersonas`. */
  b: number;
  /** Piso de estabilización. */
  f: number;
  minPersonas: number;
  refPersonas: number;
}

export function commercialTariff({ a, b, f, minPersonas, refPersonas }: TariffParams, n: number): number {
  const span = refPersonas - minPersonas;
  // Multiplica antes de dividir: en los enteros del tramo recto el resultado es exacto (p. ej. 142.5).
  if (n <= refPersonas) return a - ((n - minPersonas) * (a - b)) / span;
  const slope = (a - b) / span;
  return f + (b - f) * Math.exp((-slope * (n - refPersonas)) / (b - f));
}
