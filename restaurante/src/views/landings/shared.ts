import { formatPesos } from '../../services/price.ts';
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

// Vive en src/services/price.ts (también la usa el bot de WhatsApp, REQ-F-009).
export { formatPesos };

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
