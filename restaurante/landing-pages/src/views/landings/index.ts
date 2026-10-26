import { BUSINESS, type BusinessId } from '@restaurante/core/shared';
import type { NoticeByBusiness } from '@restaurante/core/schedule';
import {
  buildVisibleMenu,
  type MenuDataByBusiness,
  type VisibleMenuByBusiness,
} from '@restaurante/core/catalog';

import { BUSINESS_PATHS } from '../../config/business-paths.ts';
import type { Config } from '../../config/env.ts';
import { getIconLinks } from '../../content/icons.ts';
import type { ImageDescriptor } from '../../content/images.ts';
import { commonContent, getBusinessContent, type BusinessContentById } from '../../content/index.ts';
import type { Renderer, SafeHtml } from '../render.ts';
import { buildBirriaBody } from './birria.ts';
import { buildMolotesBody } from './molotes.ts';

/**
 * Composición de la página completa de una landing: cuerpo propio de cada negocio
 * (header, secciones y footer del diseño) dentro del layout compartido (SEO, assets).
 *
 * El contenido estático sale de src/content/; los datos editables (menú, precios, hero y
 * promociones) llegan del repositorio de menús en `menu` y aquí se filtran por
 * disponibilidad (RF-4) antes de pintarse.
 */

export interface LandingView<Id extends BusinessId = BusinessId> {
  renderer: Renderer;
  businessId: Id;
  c: BusinessContentById[Id];
  common: typeof commonContent;
  img: Readonly<Record<string, ImageDescriptor>>;
  whatsapp: { href: string; assistiveText: string };
  location: typeof commonContent.location;
  whatsappIcon: SafeHtml;
  menu: VisibleMenuByBusiness[Id];
  /**
   * Aviso del día: el de `/` en Birria (REQ-F-028) o el de `/molotes` (REQ-F-034); null sin aviso
   * (`/birria` siempre).
   */
  homeNotice: NoticeByBusiness[Id] | null;
  /** Enlace del pie a la otra landing (REQ-F-033). */
  crossLink: CrossLink;
}

/** Enlace a otra landing: texto del negocio actual; ruta y logo (decorativo) del destino. */
export interface CrossLink {
  href: string;
  label: string;
  logo: ImageDescriptor;
}

/** Vista sin el renderizador (los constructores de cada landing lo reciben aparte). */
export type LandingViewData<Id extends BusinessId = BusinessId> = Omit<LandingView<Id>, 'renderer'>;

const BODY_BUILDERS: { readonly [Id in BusinessId]: (view: LandingView<Id>) => SafeHtml } = Object.freeze({
  [BUSINESS.MOLOTES]: buildMolotesBody,
  [BUSINESS.BIRRIA]: buildBirriaBody,
});

/**
 * La ruta sale de BUSINESS_PATHS (la misma que usan el router y la URL canónica) y el logo es el
 * `emblem` del destino (alt vacío): el nombre accesible del enlace es solo su texto.
 */
export function buildCrossLink(businessId: BusinessId): CrossLink {
  const { label, business: target } = getBusinessContent(businessId).footer.crossLink;
  return { href: BUSINESS_PATHS[target], label, logo: getBusinessContent(target).images.emblem };
}

/** URL canónica de la ruta dedicada: absoluta si hay SITE_URL, relativa si no. */
export function canonicalUrl(siteUrl: string | undefined, path: string): string {
  return siteUrl ? `${siteUrl}${path}` : path;
}

/** `menu`: datos editables validados del negocio (`document.data` del repositorio). */
export function renderLandingPage<Id extends BusinessId>({
  renderer,
  config,
  businessId,
  menu,
  homeNotice = null,
}: {
  renderer: Renderer;
  config: Pick<Config, 'whatsapp' | 'siteUrl'>;
  businessId: Id;
  menu: MenuDataByBusiness[Id];
  homeNotice?: NoticeByBusiness[Id] | null;
}): SafeHtml {
  if (!menu) throw new TypeError('renderLandingPage requiere los datos editables del menú');
  const content = getBusinessContent(businessId);
  const images: Readonly<Record<string, ImageDescriptor>> & { logo: ImageDescriptor } = {
    ...commonContent.images,
    ...content.images,
  };

  const view: LandingView<Id> = {
    renderer,
    businessId,
    c: content,
    common: commonContent,
    img: images,
    whatsapp: { href: config.whatsapp[businessId].href, assistiveText: commonContent.cta.assistiveText },
    location: commonContent.location,
    whatsappIcon: renderer.render(`partials/icons/whatsapp-${businessId}`),
    menu: buildVisibleMenu(businessId, menu),
    homeNotice,
    crossLink: buildCrossLink(businessId),
  };

  const canonical = canonicalUrl(config.siteUrl, BUSINESS_PATHS[businessId]);
  // og:url y og:image requieren URLs absolutas: solo se emiten si SITE_URL está configurada.
  const seoAbsoluteTags = config.siteUrl
    ? renderer.render('partials/seo-absolute', {
        url: canonical,
        image: `${config.siteUrl}${images.logo.src}`,
        imageAlt: images.logo.alt,
      })
    : renderer.join([]);

  // Favicons, apple-touch-icon, manifest y theme-color del negocio mostrado (REQ-F-002).
  const icons = getIconLinks(businessId);

  return renderer.render('layouts/base', {
    common: commonContent,
    icons,
    faviconLinks: renderer.render('partials/favicon-links', icons),
    seo: { ...content.seo, canonical },
    siteName: content.name,
    fontsHref: content.assets.fontsHref,
    // businessId también selecciona /css/<id>/main.css y /js/<id>/main.js.
    businessId,
    seoAbsoluteTags,
    body: BODY_BUILDERS[businessId](view),
  });
}
