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

/** Importe con sufijo de moneda, como en el diseño: "$155 MXN". */
export const priceMxn = (cents) => `${formatPesos(cents)} MXN`;

/**
 * Aviso de sección sin productos disponibles (RF-4.5) con el CTA de WhatsApp.
 * Se pinta dentro del mismo contenedor de la lista, así el encabezado de la sección se conserva.
 * @param {{ render: Function }} renderer
 * @param {import('./index.js').LandingView} view
 */
export function renderEmptySection(renderer, view) {
  return renderer.render(`partials/${view.businessId}/section-empty`, {
    text: view.common.emptySection,
    ctaLabel: view.c.cta.label,
    whatsapp: view.whatsapp,
    businessId: view.businessId,
    whatsappIcon: view.whatsappIcon,
  });
}

/** Renderiza la lista o, si está vacía, el aviso de sección vacía. */
export function renderListOrEmpty(renderer, view, template, items) {
  return items.length > 0 ? renderer.renderEach(template, items) : renderEmptySection(renderer, view);
}
