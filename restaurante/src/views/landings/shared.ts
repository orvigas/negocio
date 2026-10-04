import type { Renderer, SafeHtml, TemplateData } from '../render.ts';
import type { LandingViewData } from './index.ts';

/**
 * Utilidades compartidas por los constructores de landing (contenido -> datos de plantilla).
 */

/** Devuelve el valor de un mapa de presentación o falla rápido ante una clave desconocida. */
export function requireOption<M extends object>(map: M, key: string, kind: string): M[keyof M] {
  if (!Object.hasOwn(map, key)) throw new Error(`${kind} desconocido: ${key}`);
  // Clave propia de `map`: comprobado con Object.hasOwn.
  return map[key as keyof M];
}

const PESOS = new Map(
  [0, 2].map((digits) => [digits, new Intl.NumberFormat('es-MX', { minimumFractionDigits: digits, maximumFractionDigits: 2 })]),
);

/** Formatea un importe en centavos como en el diseño: "$45", "$1,500", "$45.50". */
export function formatPesos(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new TypeError(`Importe inválido: ${cents}`);
  // PESOS tiene formateadores para 0 y 2 decimales, las dos únicas claves posibles.
  const formatter = PESOS.get(cents % 100 === 0 ? 0 : 2) as Intl.NumberFormat;
  return `$${formatter.format(cents / 100)}`;
}

/** Importe con sufijo de moneda, como en el diseño: "$155 MXN". */
export const priceMxn = (cents: number): string => `${formatPesos(cents)} MXN`;

/**
 * Aviso de sección sin productos disponibles (RF-4.5) con el CTA de WhatsApp.
 * Se pinta dentro del mismo contenedor de la lista, así el encabezado de la sección se conserva.
 */
export function renderEmptySection(renderer: Renderer, view: LandingViewData): SafeHtml {
  return renderer.render(`partials/${view.businessId}/section-empty`, {
    text: view.common.emptySection,
    ctaLabel: view.c.cta.label,
    whatsapp: view.whatsapp,
    businessId: view.businessId,
    whatsappIcon: view.whatsappIcon,
  });
}

/** Renderiza la lista o, si está vacía, el aviso de sección vacía. */
export function renderListOrEmpty(
  renderer: Renderer,
  view: LandingViewData,
  template: string,
  items: readonly TemplateData[],
): SafeHtml {
  return items.length > 0 ? renderer.renderEach(template, items) : renderEmptySection(renderer, view);
}
