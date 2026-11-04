import type { BusinessId } from '@restaurante/core/shared';
import {
  createMemoryProductStore,
  createProductRepository,
  type ImportSource,
  type MemoryProductStore,
  type ProductRepositoryOptions,
  type ProductStore,
} from '@restaurante/core/catalog';

import { seedData } from '../helpers.ts';

/** Repositorio de productos de las pruebas del bot (REQ-F-008; en memoria con las semillas). */

/** Imagen que existe en public/img. */
export const IMAGE = { src: '/img/molotes/molotes-queso-oaxaca.jpg', alt: 'Molote', width: 800, height: 600 };

/** Entrada válida de cada combinación (API: precios en pesos). */
export const VALID_INPUTS = {
  molotesPlatillo: {
    name: 'Molote de Frijol',
    description: 'Frijol con queso.',
    label: 'Nuevo',
    tone: 'sky',
    price: 45,
    orderPrice: '130.00',
    orderQuantity: 3,
    image: IMAGE,
  },
  molotesBebida: { name: 'Café de Olla', description: 'Con canela.', icon: 'coffee', tone: 'amber', price: '30' },
  birriaChips: {
    name: 'Taco Dorado',
    label: 'Crujiente',
    description: 'Dorado en comal.',
    price: 40,
    priceUnit: 'c/u',
    image: IMAGE,
    detailsLabel: 'Incluye:',
    chips: [{ text: 'Consomé', highlight: true }],
  },
  birriaPortion: {
    name: 'Tazón',
    label: 'Grande',
    description: 'Caldo.',
    price: 140,
    image: IMAGE,
    detailsLabel: 'Porción:',
    portion: '500ml',
    portionExtra: 'Con tuétano',
  },
  birriaVariants: {
    name: 'Refresco',
    label: 'Frío',
    image: IMAGE,
    detailsLabel: 'Elige:',
    variants: [{ label: 'Coca', price: 35, description: 'Vidrio', available: true }],
  },
};

export const ANA = Object.freeze({ id: 1, name: 'Ana' });
export const LUIS = Object.freeze({ id: 2, name: 'Luis' });

/** Fuentes de importación desde las semillas. */
export function seedSources(): { [Id in BusinessId]: ImportSource<Id> } {
  return { molotes: { source: 'seed', data: seedData('molotes') }, birria: { source: 'seed', data: seedData('birria') } };
}

/** Repositorio de productos inicializado (por defecto, en memoria y con las semillas importadas). */
export async function makeProductRepository<S extends ProductStore = MemoryProductStore>({
  store,
  sources = seedSources(),
  imageExists = async () => true,
  ...options
}: Partial<Omit<ProductRepositoryOptions, 'store'>> & { store?: S; sources?: ReturnType<typeof seedSources> } = {}) {
  // Sin store propio se usa el de memoria, que es el tipo por defecto de S.
  const productStore = (store ?? createMemoryProductStore()) as S;
  const repository = createProductRepository({ store: productStore, imageExists, ...options });
  await repository.init(sources);
  return { repository, store: productStore };
}
