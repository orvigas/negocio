/**
 * Utilidades compartidas por los constructores de landing (contenido -> datos de plantilla).
 */

/** Devuelve el valor de un mapa de presentación o falla rápido ante una clave desconocida. */
export function requireOption(map, key, kind) {
  if (!Object.hasOwn(map, key)) throw new Error(`${kind} desconocido: ${key}`);
  return map[key];
}

const PESOS = new Map(
  [0, 2].map((digits) => [digits, new Intl.NumberFormat('es-MX', { minimumFractionDigits: digits, maximumFractionDigits: 2 })]),
);

/**
 * Formatea un importe en centavos como en el diseño: "$45", "$1,500", "$45.50".
 * @param {number} cents
 */
export function formatPesos(cents) {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new TypeError(`Importe inválido: ${cents}`);
  return `$${PESOS.get(cents % 100 === 0 ? 0 : 2).format(cents / 100)}`;
}
