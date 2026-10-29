import { createMemoryProductStore, type MemoryProductStore, type NewProduct } from '@restaurante/core/catalog';
import type { BusinessId } from '@restaurante/core/shared';

/** Productos de prueba de la API (REQ-F-038): uno de cada combinación, en el store en memoria. */

const AT = new Date('2026-10-23T18:00:00Z');
const IMAGE = { src: '/img/molotes/molotes-queso-oaxaca.jpg', alt: 'Molote', width: 800, height: 600 };

const EMPTY = {
  description: null,
  label: null,
  priceCents: null,
  priceUnit: null,
  image: null,
  tone: null,
  orderPriceCents: null,
  orderQuantity: null,
  icon: null,
  detailsLabel: null,
  portion: null,
  portionExtra: null,
  chips: [],
  variants: [],
};

const common = (business: BusinessId, slug: string, name: string, position: number) => ({
  business,
  slug,
  name,
  available: true,
  position,
  version: 1,
  createdAt: AT,
  updatedAt: AT,
  deleted: false,
  deletedAt: null,
});

export const PRODUCTS: NewProduct[] = [
  {
    ...EMPTY,
    ...common('molotes', 'queso', 'Molote de Queso', 1),
    category: 'platillo',
    detailsType: null,
    description: 'Queso Oaxaca.',
    label: 'Clásico',
    tone: 'sky',
    priceCents: 2500,
    orderPriceCents: 7000,
    orderQuantity: 3,
    image: IMAGE,
  },
  { ...EMPTY, ...common('molotes', 'cafe', 'Café de Olla', 1), category: 'bebida', detailsType: null, description: 'Con canela.', icon: 'coffee', tone: 'amber', priceCents: 3000 },
  {
    ...EMPTY,
    ...common('molotes', 'oculto', 'Molote Eliminado', 2),
    category: 'platillo',
    detailsType: null,
    description: 'No se publica.',
    label: 'X',
    tone: 'sky',
    priceCents: 1000,
    orderPriceCents: 2000,
    orderQuantity: 2,
    image: IMAGE,
    deleted: true,
    deletedAt: AT,
  },
  {
    ...EMPTY,
    ...common('birria', 'tacos', 'Tacos de Birria', 2),
    category: 'platillo',
    detailsType: 'chips',
    label: 'Crujiente',
    description: 'Dorados.',
    priceCents: 4000,
    priceUnit: 'c/u',
    image: IMAGE,
    detailsLabel: 'Incluye:',
    chips: [{ text: 'Consomé', highlight: true }],
  },
  {
    ...EMPTY,
    ...common('birria', 'consome', 'Consomé', 1),
    category: 'platillo',
    detailsType: 'portion',
    label: 'Grande',
    description: 'Caldo.',
    priceCents: 6000,
    image: IMAGE,
    detailsLabel: 'Porción:',
    portion: '500ml',
    portionExtra: 'Con tuétano',
  },
  {
    ...EMPTY,
    ...common('birria', 'refresco', 'Refresco', 3),
    category: 'platillo',
    detailsType: 'variants',
    label: 'Frío',
    image: IMAGE,
    detailsLabel: 'Elige:',
    variants: [{ label: 'Coca', priceCents: 3500, description: 'Vidrio', available: true }],
  },
];

/** Store en memoria con los productos de prueba. */
export async function makeStore(): Promise<MemoryProductStore> {
  const store = createMemoryProductStore();
  await store.transaction(async (tx) => {
    for (const product of PRODUCTS) await tx.insert(product);
  });
  return store;
}
