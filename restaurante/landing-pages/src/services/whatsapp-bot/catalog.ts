import { BUSINESS, type BusinessId } from '../../config/businesses.ts';
import { botText } from '../../content/common/bot.ts';
import type { PublishedProducts } from '../../repositories/product-repository.ts';
import { availableOnly, visibleBirriaItems } from '../visible-menu.ts';
import { fill } from './text.ts';

/**
 * Catálogo del bot (REQ-F-009, RF-4.2, RF-5, D-13) a partir de las listas publicadas de REQ-F-008
 * (la caché en memoria: nunca la base de datos) con las mismas reglas de visibilidad que la
 * landing (`visible-menu.ts`). Funciones puras.
 */

export interface CatalogOption {
  /** Identificador estable dentro del producto: 'pieza', 'orden', 'unico' o 'v:<etiqueta>'. */
  readonly key: string;
  /** Texto de la opción ('' si el producto tiene un solo precio). */
  readonly label: string;
  readonly priceCents: number;
  /** Piezas de una orden de Molotes ("orden de 3"); solo en la opción 'orden' (REQ-F-013, RF-1.5). */
  readonly units?: number;
}

export interface CatalogProduct {
  /** Slug: no editable ni reutilizable (REQ-F-008), identifica el producto en el carrito. */
  readonly slug: string;
  readonly name: string;
  readonly options: readonly CatalogOption[];
}

export interface CatalogSection {
  readonly category: 'platillo' | 'bebida';
  readonly products: readonly CatalogProduct[];
}

export interface BotCatalog {
  readonly sections: readonly CatalogSection[];
  /** Todos los productos en el orden en que se numeran en el menú (1, 2, 3...). */
  readonly products: readonly CatalogProduct[];
  /**
   * Lo que existe pero hoy no está disponible (REQ-F-013, RF-1.9), solo para avisarlo: productos
   * completos y, con el mismo slug, las variantes no disponibles de un producto visible. Nunca se
   * agrega al carrito. Los eliminados no están aquí (son texto no reconocido).
   */
  readonly unavailable: readonly CatalogProduct[];
}

const molotesOptions = (item: PublishedProducts['molotes']['menu'][number]): CatalogOption[] => {
  const options: CatalogOption[] = [{ key: 'pieza', label: botText.piece, priceCents: item.unitPriceCents }];
  if (item.orderPriceCents > 0 && item.orderQuantity > 0) {
    options.push({ key: 'orden', label: fill(botText.order, { cantidad: item.orderQuantity }), priceCents: item.orderPriceCents, units: item.orderQuantity });
  }
  return options;
};

type BirriaListItem = PublishedProducts['birria']['menu'][number];

const birriaOptions = (item: BirriaListItem, available: boolean): CatalogOption[] =>
  item.detailsType === 'variants'
    ? item.variants
        .filter((variant) => variant.available === available)
        .map((variant) => ({ key: `v:${variant.label}`, label: variant.label, priceCents: variant.priceCents }))
    : [{ key: 'unico', label: '', priceCents: item.priceCents }];

function unavailableOf<Id extends BusinessId>(business: Id, lists: PublishedProducts[Id]): CatalogProduct[] {
  if (business === BUSINESS.MOLOTES) {
    const molotes = lists as PublishedProducts['molotes'];
    return [
      ...molotes.menu.filter((item) => !item.available).map((item) => ({ slug: item.id, name: item.name, options: molotesOptions(item) })),
      ...molotes.drinks
        .filter((drink) => !drink.available)
        .map((drink) => ({ slug: drink.id, name: drink.name, options: [{ key: 'unico', label: '', priceCents: drink.priceCents }] })),
    ];
  }
  const birria = lists as PublishedProducts['birria'];
  const result: CatalogProduct[] = [];
  for (const item of birria.menu) {
    if (!item.available) result.push({ slug: item.slug, name: item.name, options: birriaOptions(item, true).concat(birriaOptions(item, false)) });
    else if (item.detailsType === 'variants') {
      const options = birriaOptions(item, false);
      if (options.length > 0) result.push({ slug: item.slug, name: item.name, options });
    }
  }
  return result;
}

function molotesSections(lists: PublishedProducts['molotes']): CatalogSection[] {
  const platillos = availableOnly(lists.menu).map((item) => ({ slug: item.id, name: item.name, options: molotesOptions(item) }));
  const bebidas = availableOnly(lists.drinks).map((drink) => ({
    slug: drink.id,
    name: drink.name,
    options: [{ key: 'unico', label: '', priceCents: drink.priceCents }],
  }));
  return [
    { category: 'platillo', products: platillos },
    { category: 'bebida', products: bebidas },
  ];
}

function birriaSections(lists: PublishedProducts['birria']): CatalogSection[] {
  const products = visibleBirriaItems(lists.menu).map((item) => {
    if (item.detailsType === 'variants') {
      return {
        slug: item.slug,
        name: item.name,
        options: item.variants.map((variant) => ({ key: `v:${variant.label}`, label: variant.label, priceCents: variant.priceCents })),
      };
    }
    return { slug: item.slug, name: item.name, options: [{ key: 'unico', label: '', priceCents: item.priceCents }] };
  });
  return [{ category: 'platillo', products }];
}

export function buildCatalog<Id extends BusinessId>(business: Id, lists: PublishedProducts[Id]): BotCatalog {
  const sections = (
    business === BUSINESS.MOLOTES
      ? molotesSections(lists as PublishedProducts['molotes'])
      : birriaSections(lists as PublishedProducts['birria'])
  ).filter((section) => section.products.length > 0);
  return { sections, products: sections.flatMap((section) => section.products), unavailable: unavailableOf(business, lists) };
}

/** Busca una opción vigente del catálogo (para revalidar el carrito, D-13). */
export function findOption(catalog: BotCatalog, slug: string, optionKey: string): { product: CatalogProduct; option: CatalogOption } | null {
  const product = catalog.products.find((candidate) => candidate.slug === slug);
  const option = product?.options.find((candidate) => candidate.key === optionKey);
  return product && option ? { product, option } : null;
}
