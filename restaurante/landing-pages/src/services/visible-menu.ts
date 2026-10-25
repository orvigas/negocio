import { BUSINESS, type BusinessId } from '../config/businesses.ts';
import type {
  BirriaChipsItem,
  BirriaItem,
  BirriaMenuData,
  BirriaPortionItem,
  BirriaVariantsItem,
  MenuDataByBusiness,
  MolotesMenuData,
} from './menu-schema.ts';

/**
 * Reglas de disponibilidad de la landing (RF-4, RN-3): lo no disponible se oculta.
 * - Productos y bebidas no disponibles no aparecen; el resto conserva su orden.
 * - Las variantes no disponibles no aparecen y la activa es la primera disponible:
 *   su precio y su descripción son los de la tarjeta.
 * - Un producto sin variantes disponibles se oculta.
 * Función pura: no modifica los datos recibidos.
 */

const isAvailable = (entry: { available: boolean }): boolean => entry.available === true;

/** Solo las entradas disponibles, en su orden. La comparten la landing y el bot (REQ-F-009). */
export const availableOnly = <T extends { available: boolean }>(items: readonly T[]): T[] => items.filter(isAvailable);

/** Producto visible de Birria: con variantes, lleva además el precio y la descripción de la activa. */
export type VisibleBirriaItem =
  | BirriaChipsItem
  | BirriaPortionItem
  | (BirriaVariantsItem & { priceCents: number; description: string });

function visibleBirriaItem(item: BirriaItem): VisibleBirriaItem | null {
  if (item.detailsType !== 'variants') return item;
  const variants = item.variants.filter(isAvailable);
  const [active] = variants;
  if (active === undefined) return null;
  return { ...item, variants, priceCents: active.priceCents, description: active.description };
}

/** Productos visibles de Birria (la landing y el bot, REQ-F-009). */
export const visibleBirriaItems = (items: readonly BirriaItem[]): VisibleBirriaItem[] =>
  availableOnly(items)
    .map(visibleBirriaItem)
    .filter((item) => item !== null);

const visibleMolotesMenu = (data: MolotesMenuData) => ({
  ...data,
  menu: { ...data.menu, items: availableOnly(data.menu.items) },
  drinks: { ...data.drinks, items: availableOnly(data.drinks.items) },
});

const visibleBirriaMenu = (data: BirriaMenuData) => ({
  ...data,
  menu: { ...data.menu, items: visibleBirriaItems(data.menu.items) },
});

export interface VisibleMenuByBusiness {
  molotes: ReturnType<typeof visibleMolotesMenu>;
  birria: ReturnType<typeof visibleBirriaMenu>;
}

const BUILDERS: { readonly [Id in BusinessId]: (data: MenuDataByBusiness[Id]) => VisibleMenuByBusiness[Id] } = Object.freeze({
  [BUSINESS.MOLOTES]: visibleMolotesMenu,
  [BUSINESS.BIRRIA]: visibleBirriaMenu,
});

/** `data`: datos editables validados del negocio. */
export function buildVisibleMenu<Id extends BusinessId>(businessId: Id, data: MenuDataByBusiness[Id]): VisibleMenuByBusiness[Id] {
  if (!Object.hasOwn(BUILDERS, businessId)) throw new Error(`Negocio desconocido: ${businessId}`);
  return BUILDERS[businessId](data);
}
