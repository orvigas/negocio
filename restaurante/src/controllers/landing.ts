import type { Middleware } from 'koa';

import { isBusinessId, type BusinessId } from '../config/businesses.ts';
import type { Config } from '../config/env.ts';
import type { MenuRepository } from '../repositories/menu-repository.ts';
import { withProducts, type ProductRepository } from '../repositories/product-repository.ts';
import { getActiveBusinessId } from '../services/business-schedule.ts';
import { renderLandingPage } from '../views/landings/index.ts';
import type { Renderer } from '../views/render.ts';

/**
 * Controlador único de landing.
 * - Con `businessId` fijo (rutas /molotes y /birria) siempre renderiza ese negocio.
 * - Sin él (ruta /) elige el negocio por día de la semana en la zona horaria configurada.
 *
 * `repository`: hero, texto destacado y promociones (JSON; REQ-F-001).
 * `products`: productos de la base de datos (REQ-F-008), leídos de su caché en memoria.
 */
export function createLandingController({
  config,
  renderer,
  now,
  repository,
  products,
  businessId: fixedBusinessId,
}: {
  config: Pick<Config, 'timezone' | 'whatsapp' | 'siteUrl'>;
  renderer: Renderer;
  now: () => Date;
  repository: Pick<MenuRepository, 'getPublished'>;
  products: Pick<ProductRepository, 'getPublished'>;
  businessId?: BusinessId | undefined;
}): Middleware {
  if (fixedBusinessId !== undefined && !isBusinessId(fixedBusinessId)) {
    throw new TypeError(`Negocio desconocido: ${String(fixedBusinessId)}`);
  }

  if (typeof repository?.getPublished !== 'function') throw new TypeError('createLandingController requiere el repositorio de menús');
  if (typeof products?.getPublished !== 'function') throw new TypeError('createLandingController requiere el repositorio de productos');

  return async function renderLanding(ctx) {
    const businessId = fixedBusinessId ?? getActiveBusinessId({ now: now(), timeZone: config.timezone });
    // La landing usa siempre la última versión válida en memoria (RN-7): sin E/S por petición,
    // tampoco a la base de datos (REQ-F-008, D-15).
    const { data } = await repository.getPublished(businessId);
    const menu = withProducts(businessId, data, products.getPublished(businessId));
    const html = renderLandingPage({ renderer, config, businessId, menu });

    ctx.type = 'html';
    // `/` cambia según el día y el contenido depende de la configuración: revalidar siempre.
    ctx.set('Cache-Control', 'no-cache');
    ctx.body = html.toString();
  };
}
