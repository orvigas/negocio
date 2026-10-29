import type { Renderer, SafeHtml } from '@restaurante/web';

import { getBusinessContent } from '../../content/index.ts';
import type { LandingView, LandingViewData } from './index.ts';
import { formatPesos, priceMxn, renderListOrEmpty, requireOption, withNoticeHref } from './shared.ts';

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

/** Botón que cierra el aviso: secundario junto al enlace a Birria; principal si es el único. */
const NOTICE_CLOSE_TONES = Object.freeze({
  weekend: 'border border-on-surface/50 text-on-surface hover:bg-on-surface/10',
  rest: 'bg-secondary-container text-on-secondary shadow-[0_4px_16px_rgba(243,163,0,0.35)] hover:bg-secondary',
});

/**
 * Aviso de `/molotes` (REQ-F-034): un `<dialog>` cerrado que abre public/js/modules/home-notice.js,
 * el mismo módulo del aviso de `/`. Entre semana no se pinta nada.
 */
function renderNotice(renderer: Renderer, view: LandingViewData<'molotes'>): SafeHtml {
  const { homeNotice: variant } = view;
  if (variant === null) return renderer.join([]);
  const closeClass = requireOption(NOTICE_CLOSE_TONES, variant, 'Aviso');
  if (variant === 'rest') {
    return renderer.render('partials/molotes/notice', { variant, notice: view.c.notices.rest, action: renderer.join([]), closeClass });
  }
  const linked = withNoticeHref(view.c.notices.weekend);
  // El texto del enlace ya nombra el destino: su logo es decorativo (emblem, alt vacío).
  const notice = { ...linked, logo: getBusinessContent(linked.business).images.emblem };
  return renderer.render('partials/molotes/notice', {
    variant,
    notice,
    action: renderer.render('partials/molotes/notice-weekend-action', { notice }),
    closeClass,
  });
}

/** Combina el contenido estático con los datos editables ya filtrados por disponibilidad. */
function withEditableContent(view: LandingViewData<'molotes'>) {
  const { hero, menu, promo } = view.menu;
  return {
    ...view.c,
    hero: { ...view.c.hero, showcase: { ...hero.showcase, price: priceMxn(hero.showcase.priceCents) } },
    menu: { ...view.c.menu, highlight: menu.highlight },
    promo: { ...view.c.promo, ...promo },
  };
}

export function buildMolotesBody({ renderer, ...view }: LandingView<'molotes'>): SafeHtml {
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

  return renderer.render('pages/molotes', {
    ...view,
    c: withEditableContent(view),
    menuCards,
    drinkItems,
    notice: renderNotice(renderer, view),
  });
}
