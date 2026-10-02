import { image } from '../images.js';

/**
 * Menú de Moloteando: platillos (tarjetas) y bebidas (#bebidas-seccion).
 * Fuente: _stich_source_/moloteando_aut_nticos_molotes_artesanales/code.html
 * Datos estáticos: precios en centavos de MXN (el formato "$45", "$155 MXN" se aplica en
 * src/views/landings/). El orden de los arreglos es el orden de aparición en la landing.
 */

const pesos = (amount) => amount * 100;

/** Tarjetas de partials/molotes/menu-card.html. tone: secondary | primary | tertiary | sky | amber | red | gold. */
export const molotesMenuItems = Object.freeze([
  {
    image: image('/img/molotes/molotes-queso-oaxaca.jpg', 'Molotes de Queso Oaxaca', 512, 382),
    badge: 'El Clásico',
    tone: 'secondary',
    name: 'Molotes de Queso Oaxaca',
    unitPriceCents: pesos(45),
    orderPriceCents: pesos(130),
    orderQuantity: 3,
    description: 'El clásico que nunca falla. Queso derretido que hace "hilo" hasta el corazón.',
  },
  {
    image: image('/img/molotes/molotes-tinga-de-pollo.jpg', 'Molotes de Tinga de Pollo', 512, 382),
    badge: 'Favorito',
    tone: 'primary',
    name: 'Molotes de Tinga de Pollo',
    unitPriceCents: pesos(45),
    orderPriceCents: pesos(130),
    orderQuantity: 3,
    description:
      'Pollito jugoso bañado en su salsa de chipotle... con ese piquete que te hace pedir otro (o dos, no juzgamos).',
  },
  {
    // El diseño reutiliza la foto del hero para este platillo.
    image: image('/img/molotes/molotes-artesanales.jpg', 'Molotes de Papas con Chorizo', 512, 382),
    badge: 'Dupla Dorada',
    tone: 'tertiary',
    name: 'Molotes de Papas con Chorizo',
    unitPriceCents: pesos(45),
    orderPriceCents: pesos(130),
    orderQuantity: 3,
    description:
      'La dupla dorada que le sube el ánimo a cualquiera. Papita suavecita + chorizo con carácter = amor a primera mordida.',
  },
  {
    image: image('/img/molotes/molotes-champinones-epazote.jpg', 'Molotes de Champiñones con Epazote', 512, 382),
    badge: 'Toque Gourmet',
    tone: 'sky',
    name: 'Molotes de Champiñones con Epazote',
    unitPriceCents: pesos(45),
    orderPriceCents: pesos(130),
    orderQuantity: 3,
    description:
      'Para los que quieren algo con su toque gourmet sin salir de la banqueta. Terrositos, aromáticos y con ese epazote que redondea todo.',
  },
  {
    // El diseño reutiliza la foto de champiñones para este platillo.
    image: image('/img/molotes/molotes-champinones-epazote.jpg', 'Molotes de Hongos Zetas con Epazote', 512, 382),
    badge: 'Silvestre',
    tone: 'amber',
    name: 'Molotes de Hongos Zetas con Epazote',
    unitPriceCents: pesos(48),
    orderPriceCents: pesos(140),
    orderQuantity: 3,
    description:
      'El primo silvestre de los champiñones: más carnoso, más sabor a monte. Para paladares que buscan algo diferente.',
  },
  {
    image: image('/img/molotes/molotes-picadillo-de-cerdo.jpg', 'Molotes de Picadillo de Cerdo con Verduras', 512, 382),
    badge: 'Sabor de Casa',
    tone: 'primary',
    name: 'Molotes de Picadillo de Cerdo con Verduras',
    unitPriceCents: pesos(48),
    orderPriceCents: pesos(140),
    orderQuantity: 3,
    description: 'Sabor de casa, de esos que saben a domingo familiar. Carnita con verduritas en su punto justo.',
  },
  {
    image: image('/img/molotes/molotes-chicharron-prensado.jpg', 'Molotes de Chicharrón Prensado en Adobo', 512, 382),
    badge: 'Para Valientes',
    tone: 'red',
    name: 'Molotes de Chicharrón Prensado en Adobo',
    unitPriceCents: pesos(48),
    orderPriceCents: pesos(140),
    orderQuantity: 3,
    description:
      'Para los valientes del picante y el sabor intenso. Chicharrón bañado en adobo que te va a dejar pidiendo servilletas... y más molotes.',
  },
  {
    image: image('/img/molotes/molotes-huitlacoche.jpg', 'Molotes de Huitlacoche con Epazote', 512, 382),
    badge: 'Caviar Mexicano',
    tone: 'gold',
    name: 'Molotes de Huitlacoche con Epazote',
    unitPriceCents: pesos(50),
    orderPriceCents: pesos(145),
    orderQuantity: 3,
    description:
      'El "caviar mexicano" en tu molote. Cremoso, terroso y con un sabor que enamora hasta a los más escépticos.',
  },
]);
/** Filas de #bebidas-seccion (partials/molotes/drink-item.html). tone: amber | red. icon: Material Symbols. */
export const molotesDrinkItems = Object.freeze([
  {
    icon: 'water_full',
    tone: 'amber',
    name: 'Aguas Frescas Naturales del Día',
    description: 'Horchata con canela, Jamaica fresca o Limón con chía.',
    priceCents: pesos(35),
  },
  {
    icon: 'sports_bar',
    tone: 'red',
    name: 'Refrescos Familia Coca-Cola',
    description: 'Coca-Cola Vidrio 355ml, Sin Azúcar, Sidral Mundet o Sprite.',
    priceCents: pesos(35),
  },
]);
