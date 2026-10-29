import { BUSINESS, type BusinessId } from '../shared/index.ts';
import type { BirriaItem, MolotesDrink, MolotesItem } from './menu-schema.ts';
import type { Product, ProductCategory } from './product-schema.ts';

/**
 * Productos publicados (REQ-F-008): de los productos guardados a las listas con la forma de
 * REQ-F-001 que pintan las landings. Movido sin cambios desde
 * landing-pages/src/repositories/product-repository.ts (REQ-F-038): lo usan el repositorio de
 * productos de landing-pages (caché del bot y de /admin) y la API pública (`api/`).
 */

/** Listas con la forma de los datos de REQ-F-001 que pintan las landings. */
export interface PublishedProducts {
  molotes: { menu: MolotesItem[]; drinks: MolotesDrink[] };
  birria: { menu: BirriaItem[] };
}

const isActive = (product: Product): boolean => !product.deleted;

/** Orden de los productos de una categoría: posición y, a igualdad, id. */
export const byPosition = (a: Product, b: Product): number => a.position - b.position || a.id - b.id;

/** Productos activos de una categoría, en orden. */
export const activeOf = (products: Product[], category: ProductCategory): Product[] =>
  products.filter((product) => isActive(product) && product.category === category).sort(byPosition);

function molotesItem(product: Product): MolotesItem {
  // Platillo de Molotes validado: los campos de su combinación siempre tienen valor.
  return {
    id: product.slug,
    name: product.name,
    description: product.description ?? '',
    badge: product.label ?? '',
    tone: product.tone ?? '',
    unitPriceCents: product.priceCents ?? 0,
    orderPriceCents: product.orderPriceCents ?? 0,
    orderQuantity: product.orderQuantity ?? 0,
    available: product.available,
    image: product.image ?? { src: '', alt: '', width: 0, height: 0 },
  };
}

function molotesDrink(product: Product): MolotesDrink {
  return {
    id: product.slug,
    name: product.name,
    description: product.description ?? '',
    icon: product.icon ?? '',
    tone: product.tone ?? '',
    priceCents: product.priceCents ?? 0,
    available: product.available,
  };
}

function birriaItem(product: Product): BirriaItem {
  const base = {
    slug: product.slug,
    name: product.name,
    tag: product.label ?? '',
    available: product.available,
    image: product.image ?? { src: '', alt: '', width: 0, height: 0 },
    detailsLabel: product.detailsLabel ?? '',
  };
  if (product.detailsType === 'variants') {
    return { ...base, detailsType: 'variants', variants: product.variants.map((variant) => ({ ...variant })) };
  }
  const own = { description: product.description ?? '', priceCents: product.priceCents ?? 0, priceUnit: product.priceUnit ?? '' };
  if (product.detailsType === 'chips') return { ...base, ...own, detailsType: 'chips', chips: product.chips.map((chip) => ({ ...chip })) };
  return { ...base, ...own, detailsType: 'portion', portion: product.portion ?? '', portionExtra: product.portionExtra ?? '' };
}

/** Productos guardados -> listas que pinta la landing (sin los eliminados, por posición). */
export function toPublished<Id extends BusinessId>(business: Id, products: Product[]): PublishedProducts[Id] {
  if (business === BUSINESS.MOLOTES) {
    const molotes: PublishedProducts['molotes'] = {
      menu: activeOf(products, 'platillo').map(molotesItem),
      drinks: activeOf(products, 'bebida').map(molotesDrink),
    };
    // El negocio es Molotes: su forma es la de PublishedProducts['molotes'].
    return molotes as PublishedProducts[Id];
  }
  const birria: PublishedProducts['birria'] = { menu: activeOf(products, 'platillo').map(birriaItem) };
  return birria as PublishedProducts[Id];
}
