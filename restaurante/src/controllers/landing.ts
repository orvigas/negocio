import type { Middleware } from 'koa';

import { isBusinessId, type BusinessId } from '../config/businesses.ts';
import type { Config } from '../config/env.ts';
import type { MenuRepository } from '../repositories/menu-repository.ts';
import { getActiveBusinessId } from '../services/business-schedule.ts';
import { renderLandingPage } from '../views/landings/index.ts';
import type { Renderer } from '../views/render.ts';

/**
 * Controlador único de landing.
 * - Con `businessId` fijo (rutas /molotes y /birria) siempre renderiza ese negocio.
 * - Sin él (ruta /) elige el negocio por día de la semana en la zona horaria configurada.
 *
 * `repository`: datos editables (menú, precios, hero y promociones; REQ-F-001).
 */
export function createLandingController({
  config,
  renderer,
  now,
  repository,
  businessId: fixedBusinessId,
}: {
  config: Pick<Config, 'timezone' | 'whatsapp' | 'siteUrl'>;
  renderer: Renderer;
  now: () => Date;
  repository: Pick<MenuRepository, 'getPublished'>;
  businessId?: BusinessId | undefined;
}): Middleware {
  if (fixedBusinessId !== undefined && !isBusinessId(fixedBusinessId)) {
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
