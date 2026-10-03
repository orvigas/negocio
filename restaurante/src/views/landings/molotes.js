import { formatPesos, priceMxn, renderListOrEmpty, requireOption } from './shared.js';

/**
 * Landing de Moloteando: compone src/views/pages/molotes.html.
 * Los tonos semánticos del contenido se traducen aquí a utilidades de Tailwind
 * (este archivo está dentro de @source, así que las clases se incluyen en el CSS).
 */
const BADGE_TONES = Object.freeze({
  secondary: 'bg-secondary-container text-on-secondary-container',
  primary: 'bg-primary-container text-on-primary',
  tertiary: 'bg-tertiary-container text-on-tertiary-container',
  sky: 'bg-sky-600 text-white',
  amber: 'bg-amber-500 text-slate-900',
  red: 'bg-red-600 text-white',
  gold: 'bg-secondary text-on-secondary',
});

/** Tonos del icono de las bebidas: [fondo del círculo, color del icono]. */
const DRINK_TONES = Object.freeze({
  amber: Object.freeze({ iconBgClass: 'bg-secondary-container/20', iconClass: 'text-[#d97706]' }),
  red: Object.freeze({ iconBgClass: 'bg-[#fee2e2]', iconClass: 'text-[#dc2626]' }),
});

/**
 * Combina el contenido estático con los datos editables ya filtrados por disponibilidad.
 * @param {import('./index.js').LandingView} view
 */
function withEditableContent(view) {
  const { hero, menu, promo } = view.menu;
  return {
    ...view.c,
    hero: { ...view.c.hero, showcase: { ...hero.showcase, price: priceMxn(hero.showcase.priceCents) } },
    menu: { ...view.c.menu, highlight: menu.highlight },
    promo: { ...view.c.promo, ...promo },
  };
}

/** @param {import('./index.js').LandingView} view */
export function buildMolotesBody({ renderer, ...view }) {
  const menuCards = renderListOrEmpty(
    renderer,
    view,
    'partials/molotes/menu-card',
    view.menu.menu.items.map((item) => ({
      name: item.name,
      description: item.description,
      badge: item.badge,
      unitPrice: `${formatPesos(item.unitPriceCents)} c/u`,
      orderPrice: `${formatPesos(item.orderPriceCents)} orden de ${item.orderQuantity}`,
      image: item.image,
      badgeClass: requireOption(BADGE_TONES, item.tone, 'Tono'),
    })),
  );

  const drinkItems = renderListOrEmpty(
    renderer,
    view,
    'partials/molotes/drink-item',
    view.menu.drinks.items.map((drink) => ({
      icon: drink.icon,
      name: drink.name,
      description: drink.description,
      price: priceMxn(drink.priceCents),
      ...requireOption(DRINK_TONES, drink.tone, 'Tono de bebida'),
    })),
  );

  return renderer.render('pages/molotes', { ...view, c: withEditableContent(view), menuCards, drinkItems });
}
