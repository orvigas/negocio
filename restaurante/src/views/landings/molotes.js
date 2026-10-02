import { formatPesos, requireOption } from './shared.js';

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

/** @param {import('./index.js').LandingView} view */
export function buildMolotesBody({ renderer, ...view }) {
  const menuCards = renderer.renderEach(
    'partials/molotes/menu-card',
    view.c.menu.items.map((item) => ({
      name: item.name,
      description: item.description,
      badge: item.badge,
      unitPrice: `${formatPesos(item.unitPriceCents)} c/u`,
      orderPrice: `${formatPesos(item.orderPriceCents)} orden de ${item.orderQuantity}`,
      image: item.image,
      badgeClass: requireOption(BADGE_TONES, item.tone, 'Tono'),
    })),
  );

  const drinkItems = renderer.renderEach(
    'partials/molotes/drink-item',
    view.c.drinks.items.map((drink) => ({
      icon: drink.icon,
      name: drink.name,
      description: drink.description,
      price: `${formatPesos(drink.priceCents)} MXN`,
      ...requireOption(DRINK_TONES, drink.tone, 'Tono de bebida'),
    })),
  );

  return renderer.render('pages/molotes', { ...view, menuCards, drinkItems });
}
