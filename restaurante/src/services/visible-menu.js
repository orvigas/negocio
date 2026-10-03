import { BUSINESS } from '../config/businesses.js';

/**
 * Reglas de disponibilidad de la landing (RF-4, RN-3): lo no disponible se oculta.
 * - Productos y bebidas no disponibles no aparecen; el resto conserva su orden.
 * - Las variantes no disponibles no aparecen y la activa es la primera disponible:
 *   su precio y su descripción son los de la tarjeta.
 * - Un producto sin variantes disponibles se oculta.
 * Función pura: no modifica los datos recibidos.
 */

const isAvailable = (entry) => entry.available === true;

function visibleBirriaItem(item) {
  if (item.detailsType !== 'variants') return item;
  const variants = item.variants.filter(isAvailable);
  if (variants.length === 0) return null;
  const [active] = variants;
  return { ...item, variants, priceCents: active.priceCents, description: active.description };
}

const BUILDERS = Object.freeze({
  [BUSINESS.MOLOTES]: (data) => ({
    ...data,
    menu: { ...data.menu, items: data.menu.items.filter(isAvailable) },
    drinks: { ...data.drinks, items: data.drinks.items.filter(isAvailable) },
  }),
  [BUSINESS.BIRRIA]: (data) => ({
    ...data,
    menu: {
      ...data.menu,
      items: data.menu.items
        .filter(isAvailable)
        .map(visibleBirriaItem)
        .filter((item) => item !== null),
    },
  }),
});

/**
 * @param {'molotes'|'birria'} businessId
 * @param {object} data Datos editables validados del negocio.
 */
export function buildVisibleMenu(businessId, data) {
  if (!Object.hasOwn(BUILDERS, businessId)) throw new Error(`Negocio desconocido: ${businessId}`);
  return BUILDERS[businessId](data);
}
