import { BUSINESS, BUSINESS_PATHS } from '../../config/businesses.js';
import { commonContent, getBusinessContent } from '../../content/index.js';
import { buildBirriaBody } from './birria.js';
import { buildMolotesBody } from './molotes.js';

/**
 * Composición de la página completa de una landing: cuerpo propio de cada negocio
 * (header, secciones y footer del diseño) dentro del layout compartido (SEO, assets).
 *
 * @typedef {{
 *   renderer: { render: Function, renderEach: Function, join: Function },
 *   businessId: 'molotes'|'birria',
 *   c: object,
 *   common: object,
 *   img: Record<string, { src: string, alt: string, width: number, height: number }>,
 *   whatsapp: { href: string, assistiveText: string },
 *   location: { mapsUrl: string, label: string, assistiveText: string },
 *   whatsappIcon: import('../render.js').SafeHtml,
 * }} LandingView
 */

const BODY_BUILDERS = Object.freeze({
  [BUSINESS.MOLOTES]: buildMolotesBody,
  [BUSINESS.BIRRIA]: buildBirriaBody,
});

/**
 * URL canónica de la ruta dedicada: absoluta si hay SITE_URL, relativa si no.
 * @param {string|undefined} siteUrl
 * @param {string} path
 */
export function canonicalUrl(siteUrl, path) {
  return siteUrl ? `${siteUrl}${path}` : path;
}

/**
 * @param {{
 *   renderer: LandingView['renderer'],
 *   config: object,
 *   businessId: 'molotes'|'birria',
 * }} options
 * @returns {import('../render.js').SafeHtml}
 */
export function renderLandingPage({ renderer, config, businessId }) {
  const content = getBusinessContent(businessId);
  const images = { ...commonContent.images, ...content.images };

  /** @type {LandingView} */
  const view = {
    renderer,
    businessId,
    c: content,
    common: commonContent,
    img: images,
    whatsapp: { href: config.whatsapp[businessId].href, assistiveText: commonContent.cta.assistiveText },
    location: commonContent.location,
    whatsappIcon: renderer.render(`partials/icons/whatsapp-${businessId}`),
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

  return renderer.render('layouts/base', {
    common: commonContent,
    seo: { ...content.seo, canonical },
    siteName: content.name,
    fontsHref: content.assets.fontsHref,
    // businessId también selecciona /css/<id>/main.css y /js/<id>/main.js.
    businessId,
    seoAbsoluteTags,
    body: BODY_BUILDERS[businessId](view),
  });
}
