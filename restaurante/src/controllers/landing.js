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
 *   businessId?: 'molotes'|'birria',
 * }} deps
 */
export function createLandingController({ config, renderer, now, businessId: fixedBusinessId }) {
  if (fixedBusinessId !== undefined && !BUSINESS_IDS.includes(fixedBusinessId)) {
    throw new TypeError(`Negocio desconocido: ${fixedBusinessId}`);
  }

  return function renderLanding(ctx) {
    const businessId = fixedBusinessId ?? getActiveBusinessId({ now: now(), timeZone: config.timezone });
    const html = renderLandingPage({ renderer, config, businessId });

    ctx.type = 'html';
    // `/` cambia según el día y el contenido depende de la configuración: revalidar siempre.
    ctx.set('Cache-Control', 'no-cache');
    ctx.body = html.toString();
  };
}
