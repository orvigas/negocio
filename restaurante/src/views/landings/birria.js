import { formatPesos, requireOption } from './shared.js';

/**
 * Landing de Birriería El Muñeco: compone src/views/pages/birria.html.
 * Cada platillo tiene un bloque de detalle distinto según el diseño (`details.type`).
 */
const priceMxn = (cents) => `${formatPesos(cents)} MXN`;

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
  // La primera variante es la activa al cargar (coincide con el precio y la descripción del platillo).
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
  return renderer.renderEach(
    'partials/birria/menu-card',
    view.c.menu.items.map((item) => {
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

/** @param {import('./index.js').LandingView} view */
export function buildBirriaBody({ renderer, ...view }) {
  return renderer.render('pages/birria', {
    ...view,
    menuCards: renderMenuCards(renderer, view),
    branches: renderBranches(renderer, view),
  });
}
