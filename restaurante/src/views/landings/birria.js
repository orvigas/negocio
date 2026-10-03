import { formatPesos, priceMxn, renderListOrEmpty, requireOption } from './shared.js';

/**
 * Landing de Birriería El Muñeco: compone src/views/pages/birria.html.
 * Cada platillo tiene un bloque de detalle distinto según el diseño (`details.type`).
 */
const DETAIL_RENDERERS = Object.freeze({
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
  // precio y la descripción de la tarjeta (src/services/visible-menu.js).
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

function renderMenuCards(renderer, view) {
  return renderListOrEmpty(
    renderer,
    view,
    'partials/birria/menu-card',
    view.menu.menu.items.map((item) => {
      const renderDetails = requireOption(DETAIL_RENDERERS, item.detailsType, 'Tipo de detalle');
      return {
        id: item.slug,
        name: item.name,
        tag: item.tag,
        description: item.description,
        price: item.priceUnit ? `${priceMxn(item.priceCents)} ${item.priceUnit}` : priceMxn(item.priceCents),
        image: item.image,
        details: renderDetails(renderer, item),
      };
    }),
  );
}

function renderBranches(renderer, view) {
  const { branches } = view.c.locations;
  return renderer.renderEach(
    'partials/birria/branch',
    branches.items.map((branch, index) => ({
      ...branch,
      // La matriz (primera sucursal) se destaca en el diseño.
      number: renderer.render(index === 0 ? 'partials/birria/branch-number-main' : 'partials/birria/branch-number', {
        number: index + 1,
      }),
      directionsLabel: branches.directionsLabel,
      mapsUrl: view.location.mapsUrl,
      assistiveText: view.location.assistiveText,
    })),
  );
}

/**
 * Combina el contenido estático con los datos editables (showcase del hero y club).
 * @param {import('./index.js').LandingView} view
 */
function withEditableContent(view) {
  const { hero, promo } = view.menu;
  return {
    ...view.c,
    hero: { ...view.c.hero, showcase: { ...hero.showcase, price: priceMxn(hero.showcase.priceCents) } },
    locations: { ...view.c.locations, club: { ...view.c.locations.club, ...promo } },
  };
}

/** @param {import('./index.js').LandingView} view */
export function buildBirriaBody({ renderer, ...view }) {
  return renderer.render('pages/birria', {
    ...view,
    c: withEditableContent(view),
    menuCards: renderMenuCards(renderer, view),
    branches: renderBranches(renderer, view),
  });
}
