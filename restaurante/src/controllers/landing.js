import { BUSINESS_IDS } from '../config/businesses.js';
import { getActiveBusinessId } from '../services/business-schedule.js';
import { renderLandingPage } from '../views/landings/index.js';

/**
 * Controlador único de landing.
 * - Con `businessId` fijo (rutas /molotes y /birria) siempre renderiza ese negocio.
 * - Sin él (ruta /) elige el negocio por día de la semana en la zona horaria configurada.
 *
 * @param {{
 *   config: object,
 *   renderer: object,
 *   now: () => Date,
 *   repository: { getPublished: (businessId: string) => Promise<{ data: object }> },
 *   businessId?: 'molotes'|'birria',
 * }} deps `repository`: datos editables (menú, precios, hero y promociones; REQ-F-001).
 */
export function createLandingController({ config, renderer, now, repository, businessId: fixedBusinessId }) {
  if (fixedBusinessId !== undefined && !BUSINESS_IDS.includes(fixedBusinessId)) {
    throw new TypeError(`Negocio desconocido: ${fixedBusinessId}`);
  }

  if (typeof repository?.getPublished !== 'function') throw new TypeError('createLandingController requiere el repositorio de menús');

  return async function renderLanding(ctx) {
    const businessId = fixedBusinessId ?? getActiveBusinessId({ now: now(), timeZone: config.timezone });
    // La landing usa siempre la última versión válida en memoria (RN-7): sin E/S por petición.
    const { data } = await repository.getPublished(businessId);
    const html = renderLandingPage({ renderer, config, businessId, menu: data });

    ctx.type = 'html';
    // `/` cambia según el día y el contenido depende de la configuración: revalidar siempre.
    ctx.set('Cache-Control', 'no-cache');
    ctx.body = html.toString();
  };
}
