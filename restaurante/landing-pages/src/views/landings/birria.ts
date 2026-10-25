import type { VisibleBirriaItem } from '../../services/visible-menu.ts';
import type { Renderer, SafeHtml } from '../render.ts';
import type { LandingView, LandingViewData } from './index.ts';
import { formatPesos, priceMxn, renderListOrEmpty, requireOption, withNoticeHref } from './shared.ts';

type DetailsType = VisibleBirriaItem['detailsType'];
type DetailRenderer<T extends DetailsType> = (
  renderer: Renderer,
  item: Extract<VisibleBirriaItem, { detailsType: T }>,
) => SafeHtml;

/**
 * Landing de Birria El Muñeco: compone src/views/pages/birria.html.
 * Cada platillo tiene un bloque de detalle distinto según el diseño (`details.type`).
 */
const DETAIL_RENDERERS: { readonly [T in DetailsType]: DetailRenderer<T> } = Object.freeze({
  chips: (renderer, item) =>
    renderer.render('partials/birria/details-chips', {
      label: item.detailsLabel,
      chips: renderer.join(
        item.chips.map((chip) =>
          renderer.render(chip.highlight ? 'partials/birria/chip-highlight' : 'partials/birria/chip', chip),
        ),
      ),
    }),
  portion: (renderer, item) =>
    renderer.render('partials/birria/details-portion', {
      label: item.detailsLabel,
      portion: item.portion,
      extra: item.portionExtra,
    }),
  // Solo llegan variantes disponibles: la primera es la activa al cargar y de ella salen el
  // precio y la descripción de la tarjeta (src/services/visible-menu.ts).
  variants: (renderer, item) =>
    renderer.render('partials/birria/details-variants', {
      id: item.slug,
      label: item.detailsLabel,
      options: renderer.join(
        item.variants.map((variant, index) =>
          renderer.render('partials/birria/variant-button', {
            label: `${variant.label} (${formatPesos(variant.priceCents)})`,
            price: priceMxn(variant.priceCents),
            description: variant.description,
            pressed: String(index === 0),
          }),
        ),
      ),
    }),
});

function renderMenuCards(renderer: Renderer, view: LandingViewData<'birria'>): SafeHtml {
  return renderListOrEmpty(
    renderer,
    view,
    'partials/birria/menu-card',
    view.menu.menu.items.map((item) => {
      // El renderizador elegido corresponde al `detailsType` del propio item.
      const renderDetails = requireOption(DETAIL_RENDERERS, item.detailsType, 'Tipo de detalle') as (
        renderer: Renderer,
        item: VisibleBirriaItem,
      ) => SafeHtml;
      // Los productos con variantes no tienen unidad de precio.
      const priceUnit = 'priceUnit' in item ? item.priceUnit : undefined;
      return {
        id: item.slug,
        name: item.name,
        tag: item.tag,
        description: item.description,
        price: priceUnit ? `${priceMxn(item.priceCents)} ${priceUnit}` : priceMxn(item.priceCents),
        image: item.image,
        details: renderDetails(renderer, item),
      };
    }),
  );
}

function renderBranches(renderer: Renderer, view: LandingViewData<'birria'>): SafeHtml {
  const { branches } = view.c.locations;
  return renderer.renderEach(
    'partials/birria/branch',
    branches.items.map((branch, index) => ({
      ...branch,
      // La primera sucursal se destaca en el diseño (hoy hay una sola; REQ-F-032, R-5).
      number: renderer.render(index === 0 ? 'partials/birria/branch-number-main' : 'partials/birria/branch-number', {
        number: index + 1,
      }),
      directionsLabel: view.location.label,
      mapsUrl: view.location.mapsUrl,
      assistiveText: view.location.assistiveText,
    })),
  );
}

/**
 * Aviso de la página de inicio (REQ-F-028): un `<dialog>` cerrado que abre public/js/modules/home-notice.js.
 * Sin aviso (fin de semana, /birria) no se pinta nada.
 */
function renderHomeNotice(renderer: Renderer, view: LandingViewData<'birria'>): SafeHtml {
  const { homeNotice } = view;
  if (homeNotice === null) return renderer.join([]);
  const notice = withNoticeHref(view.c.homeNotices[homeNotice]);
  return renderer.render('partials/birria/home-notice', {
    variant: homeNotice,
    notice,
    action: renderer.render(`partials/birria/home-notice-${homeNotice}-action`, { notice }),
  });
}

/** Combina el contenido estático con los datos editables (showcase del hero y club). */
function withEditableContent(view: LandingViewData<'birria'>) {
  const { hero, promo } = view.menu;
  return {
    ...view.c,
    hero: { ...view.c.hero, showcase: { ...hero.showcase, price: priceMxn(hero.showcase.priceCents) } },
    locations: { ...view.c.locations, club: { ...view.c.locations.club, ...promo } },
  };
}

export function buildBirriaBody({ renderer, ...view }: LandingView<'birria'>): SafeHtml {
  return renderer.render('pages/birria', {
    ...view,
    c: withEditableContent(view),
    menuCards: renderMenuCards(renderer, view),
    branches: renderBranches(renderer, view),
    homeNotice: renderHomeNotice(renderer, view),
  });
}
