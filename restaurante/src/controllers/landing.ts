import type { Middleware } from 'koa';

import { BUSINESS, isBusinessId, type BusinessId } from '../config/businesses.ts';
import type { Config } from '../config/env.ts';
import type { MenuRepository } from '../repositories/menu-repository.ts';
import { withProducts, type ProductRepository } from '../repositories/product-repository.ts';
import { getHomeNotice, getMolotesNotice, parseForcedDay, type NoticeByBusiness } from '../services/business-schedule.ts';
import { renderLandingPage } from '../views/landings/index.ts';
import type { Renderer } from '../views/render.ts';

type NoticeOptions = Parameters<typeof getHomeNotice>[0];

/** Aviso de la ruta: `/` (sin negocio fijo), `/molotes` o ninguno (`/birria`). */
function noticeFor(fixedBusinessId: BusinessId | undefined, options: NoticeOptions): NoticeByBusiness[BusinessId] | null {
  if (fixedBusinessId === undefined) return getHomeNotice(options);
  if (fixedBusinessId === BUSINESS.MOLOTES) return getMolotesNotice(options);
  return null;
}

/**
 * Controlador único de landing.
 * - Con `businessId` fijo (rutas /molotes y /birria) siempre renderiza ese negocio.
 * - Sin él (ruta /) muestra siempre Birria y, según el día en la zona horaria del negocio, el
 *   aviso de inicio (REQ-F-028): lunes descanso, de martes a viernes Molotes.
 * - En /molotes, el aviso de Molotes (REQ-F-034): lunes descanso, sábado y domingo "hoy toca
 *   birria". /birria nunca lleva aviso.
 * En desarrollo, `?dia=lunes|...|domingo` fuerza el día en / y en /molotes (RF-11); en test y
 * producción se ignora.
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
  config: Pick<Config, 'timezone' | 'whatsapp' | 'siteUrl' | 'nodeEnv'>;
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
    const businessId = fixedBusinessId ?? BUSINESS.BIRRIA;
    const forcedDay = config.nodeEnv === 'development' ? parseForcedDay(ctx.query.dia) : undefined;
    const homeNotice = noticeFor(fixedBusinessId, { now: now(), timeZone: config.timezone, forcedDay });
    // La landing usa siempre la última versión válida en memoria (RN-7): sin E/S por petición,
    // tampoco a la base de datos (REQ-F-008, D-15).
    const { data } = await repository.getPublished(businessId);
    const menu = withProducts(businessId, data, products.getPublished(businessId));
    const html = renderLandingPage({ renderer, config, businessId, menu, homeNotice });

    ctx.type = 'html';
    // El aviso de `/` y de `/molotes` cambia según el día y el contenido depende de la configuración: revalidar siempre.
    ctx.set('Cache-Control', 'no-cache');
    ctx.body = html.toString();
  };
}
