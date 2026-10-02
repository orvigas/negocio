import { image } from '../images.js';

/**
 * Menú de Birriería El Muñeco: platillos con chips, porción o variantes.
 * Fuente: _stich_source_/birrier_a_el_mu_eco_aut_ntica_birria_de_res_color_adobo/code.html
 * Datos estáticos: precios en centavos de MXN (el formato "$45", "$155 MXN" se aplica en
 * src/views/landings/). El orden de los arreglos es el orden de aparición en la landing.
 */

const pesos = (amount) => amount * 100;

/**
 * Tarjetas de partials/birria/menu-card.html. detailsType: chips | portion | variants.
 * Con variantes, el precio y la descripción del platillo son los de la primera variante.
 */
export const birriaMenuItems = Object.freeze([
  {
    slug: 'quesabirria',
    image: image('/img/birria/quesabirria.jpg', 'Quesabirria con tortilla de mano y queso asadero', 512, 382),
    priceCents: pesos(65),
    priceUnit: 'c/u',
    tag: 'La Favorita del Comal',
    name: 'Quesabirria con Tortilla de Mano',
    description:
      'Tortilla hecha a mano dorada en grasa de adobo, abundante queso asadero fundido y carne deshebrada de birria. Crujiente por fuera y jugosa por dentro con caldo para chopear.',
    detailsType: 'chips',
    detailsLabel: 'Preparación:',
    chips: [
      { text: 'Tortilla a mano' },
      { text: 'Queso asadero fundido' },
      { text: 'Consomé para chopear', highlight: true },
    ],
  },
  {
    slug: 'taco-de-birria',
    image: image('/img/birria/taco-de-birria.jpg', 'Taco de birria con tortilla de maíz hecha a mano', 512, 382),
    priceCents: pesos(40),
    priceUnit: 'c/u',
    tag: 'Sabor Tradicional',
    name: 'Taco de Birria con Tortilla de Mano',
    description:
      'Carne jugosa de birria tatemada sobre tortilla de maíz recién echada a mano en comal, cilantro criollo, cebolla y limón fresco, acompañado de vasito de consomé para sopear.',
    detailsType: 'chips',
    detailsLabel: 'Incluye:',
    chips: [
      { text: 'Cilantro criollo' },
      { text: 'Cebolla picada' },
      { text: 'Limón fresco' },
      { text: 'Caldito para sopear', highlight: true },
    ],
  },
  {
    slug: 'consome-grande',
    image: image('/img/birria/consome-grande.jpg', 'Tazón de consomé con carne grande humeante', 512, 279),
    priceCents: pesos(140),
    tag: 'Porción Grande',
    name: 'Tazón de Consomé Grande',
    description:
      '500ml de consomé de cocción lenta con 150g de carne maciza y surtida, tuétano a la brasa, cilantro, cebolla picada y orden de tortillas a mano recién hechas en comal.',
    detailsType: 'portion',
    detailsLabel: 'Porción & Gramaje:',
    portion: '500ml caldo + 150g carne',
    portionExtra: 'Con Tuétano',
  },
  {
    slug: 'consome-chico',
    image: image('/img/birria/consome-chico.jpg', 'Tazón de consomé chico con y sin carne', 512, 279),
    priceCents: pesos(80),
    tag: 'Individual',
    name: 'Tazón de Consomé Chico',
    description:
      '250ml de consomé concentrado + 80g de carne de res maciza deshebrada, acompañado de cebollitas y orégano.',
    detailsType: 'variants',
    detailsLabel: 'Selecciona Variante:',
    variants: [
      {
        label: 'Con Carne',
        priceCents: pesos(80),
        description:
          '250ml de consomé concentrado + 80g de carne de res maciza deshebrada, acompañado de cebollitas y orégano.',
      },
      {
        label: 'Sin Carne',
        priceCents: pesos(45),
        description: 'Solo caldito hirviendo con especias tradicionales, hierbas de olor, cilantro y cebolla al gusto.',
      },
    ],
  },
  {
    slug: 'birriamen',
    image: image('/img/birria/birriamen.jpg', 'Tazón humeante de Birriamen', 512, 382),
    priceCents: pesos(155),
    tag: 'Fusión Japonesa-Mexicana',
    name: 'Birriamen Artesanal',
    description:
      'Fusión japonesa-mexicana en tazón hondo, fideos ramen artesanales sumergidos en rico consomé concentrado de birria, carne deshebrada, huevo cocido marinado, rábano, cilantro y toque de salsa macha.',
    detailsType: 'variants',
    detailsLabel: 'Tamaño de Porción:',
    variants: [
      {
        label: 'Grande',
        priceCents: pesos(155),
        description:
          'Fusión japonesa-mexicana en tazón hondo, fideos ramen artesanales sumergidos en rico consomé concentrado de birria, carne deshebrada, huevo cocido marinado, rábano, cilantro y toque de salsa macha.',
      },
      {
        label: 'Chica',
        priceCents: pesos(110),
        description:
          'Porción individual reconfortante con los mismos ingredientes y fideos ramen en caldo espeso de birria.',
      },
    ],
  },
  {
    slug: 'bebidas',
    // Misma foto que la sección de bebidas de Molotes.
    image: image('/img/common/bebidas-aguas-frescas-refrescos.jpg', 'Aguas frescas de horchata y Coca-Cola fría', 512, 382),
    priceCents: pesos(35),
    tag: 'Para Acompañar',
    name: 'Bebidas Frías del Comal',
    description:
      'Aguas frescas artesanales del día: Horchata fresca con canela de Ceilán o Jamaica natural, servidas con hielo escarchado.',
    detailsType: 'variants',
    detailsLabel: 'Selecciona tu Bebida:',
    variants: [
      {
        label: 'Aguas Frescas',
        priceCents: pesos(35),
        description:
          'Aguas frescas artesanales del día: Horchata fresca con canela de Ceilán o Jamaica natural, servidas con hielo escarchado.',
      },
      {
        label: 'Coca-Cola Vidrio',
        priceCents: pesos(35),
        description:
          'Refrescos Familia Coca-Cola: Coca-Cola de vidrio de 355ml bien helada, Sidral Mundet o Coca-Cola Sin Azúcar.',
      },
    ],
  },
]);
