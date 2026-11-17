import type { Middleware } from 'koa';

import { BUSINESS, isBusinessId, type BusinessId } from '@restaurante/core/shared';
import {
  getHomeNotice,
  getMolotesNotice,
  parseForcedDay,
  type NoticeByBusiness,
} from '@restaurante/core/schedule';
import type { Renderer } from '@restaurante/web';

import type { Config } from '../config/env.ts';
import { loadSeedMenus, withPage, type LandingPage, type SeedMenus } from '../services/landing-page.ts';
import { withProducts, type LandingProducts } from '../services/landing-products.ts';
import { renderLandingPage } from '../views/landings/index.ts';

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
 * `landingPage`: hero, texto destacado y promociones, de la API propia con su caché (REQ-F-044, RF-5),
 *   sobre la semilla (`seeds`), que pone el resto del documento.
 * `landingProducts`: productos publicados, de la API propia con su caché en memoria (REQ-F-038).
 * Nunca la base de datos, un repositorio ni archivos de datos en disco: las landings solo leen la API.
 */
export function createLandingController({
  config,
  renderer,
  now,
  landingPage,
  landingProducts,
  seeds = loadSeedMenus(),
  businessId: fixedBusinessId,
}: {
  config: Pick<Config, 'timezone' | 'whatsapp' | 'siteUrl' | 'nodeEnv'>;
  renderer: Renderer;
  now: () => Date;
  landingPage: Pick<LandingPage, 'get'>;
  landingProducts: Pick<LandingProducts, 'get'>;
  /** Datos completos de la semilla (por defecto, los de src/content/). */
  seeds?: SeedMenus;
  businessId?: BusinessId | undefined;
}): Middleware {
  if (fixedBusinessId !== undefined && !isBusinessId(fixedBusinessId)) {
    throw new TypeError(`Negocio desconocido: ${String(fixedBusinessId)}`);
  }

  if (typeof landingPage?.get !== 'function') throw new TypeError('createLandingController requiere los datos de página de la API');
  if (typeof landingProducts?.get !== 'function') throw new TypeError('createLandingController requiere los productos de la API');

  return async function renderLanding(ctx) {
    const businessId = fixedBusinessId ?? BUSINESS.BIRRIA;
    const forcedDay = config.nodeEnv === 'development' ? parseForcedDay(ctx.query.dia) : undefined;
    const homeNotice = noticeFor(fixedBusinessId, { now: now(), timeZone: config.timezone, forcedDay });
    // Página y productos de la API con su caché (REQ-F-038 y REQ-F-044): sin E/S mientras están frescos,
    // nunca la base de datos; si la API falla, la última copia buena o la semilla (nunca un 5xx por la API).
    const [page, products] = await Promise.all([landingPage.get(businessId), landingProducts.get(businessId)]);
    const menu = withProducts(businessId, withPage(businessId, seeds[businessId], page), products);
    const html = renderLandingPage({ renderer, config, businessId, menu, homeNotice });

    ctx.type = 'html';
    // El aviso de `/` y de `/molotes` cambia según el día y el contenido depende de la configuración: revalidar siempre.
    ctx.set('Cache-Control', 'no-cache');
    ctx.body = html.toString();
  };
}
