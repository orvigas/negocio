import { image } from '../images.js';
import { birriaMenuItems } from './menu.js';

/**
 * Contenido de Birriería El Muñeco (sábado y domingo).
 * Fuente: _stich_source_/birrier_a_el_mu_eco_aut_ntica_birria_de_res_color_adobo/code.html
 *
 * Solo datos (textos, precios, horarios, contacto, imágenes). Los platillos del menú
 * están en ./menu.js. El marcado vive en
 * src/views/pages/birria.html y src/views/partials/birria/; los tonos visuales se
 * expresan con claves semánticas (`highlight`) que resuelve src/views/landings/birria.js.
 */
export const birriaContent = Object.freeze({
  id: 'birria',
  name: 'Birriería El Muñeco',
  seo: Object.freeze({
    title: 'Birriería El Muñeco | Auténtica Birria de Res',
    description:
      'Carne tatemada con chiles secos, especias de Jalisco y cocción lenta de 14 horas. Servida con consomé hirviendo, tortillas doradas en grasa de adobo y queso hebra derretido.',
  }),
  assets: Object.freeze({
    // Una sola hoja de Google Fonts por landing (familias del diseño + iconos Material Symbols).
    fontsHref:
      'https://fonts.googleapis.com/css2?family=Epilogue:wght@400;600;700;800;900&family=Space+Grotesk:wght@600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap',
  }),
  // Imágenes en public/img/birria/ (alt tomados del diseño; alt vacío = decorativa).
  images: Object.freeze({
    logo: image('/img/birria/logo-birria.webp', 'Logo Birriería El Muñeco', 418, 512),
    // Las repeticiones del logo junto al nombre del negocio son decorativas.
    emblem: image('/img/birria/logo-birria.webp', '', 418, 512),
    fondo: image('/img/birria/fondo-birria.jpg', '', 476, 512),
    hero: image('/img/birria/quesabirria.jpg', 'Quesatacos de birria de res con consomé', 512, 382),
    ritual: image('/img/birria/quesabirria.jpg', 'Quesatacos sumergidos en adobo artesanal hirviendo', 512, 382),
  }),
  brand: Object.freeze({
    shortName: 'El Muñeco',
    tagline: 'Auténtica Birria de Res',
  }),
  cta: Object.freeze({ label: 'Ordenar ya!' }),
  nav: Object.freeze([
    Object.freeze({ label: 'Inicio', href: '#inicio' }),
    Object.freeze({ label: 'Menú de Birria', href: '#menu-especialidades' }),
    Object.freeze({ label: 'Quesabirrias & Consomé', href: '#menu-especialidades' }),
    Object.freeze({ label: 'Nuestra Receta', href: '#el-ritual' }),
    Object.freeze({ label: 'Ubicaciones', href: '#ubicaciones-pedidos' }),
  ]),
  hero: Object.freeze({
    eyebrow: 'Tradición Tapatía de Res',
    titleLead: 'Auténtica Birria de Res y',
    titleHighlight: 'Quesabirrias al Horno',
    description:
      'Carne tatemada con chiles secos, especias de Jalisco y cocción lenta de 14 horas. Servida con consomé hirviendo, tortillas doradas en grasa de adobo y queso hebra derretido.',
    secondaryCta: Object.freeze({ label: 'Conoce Nuestra Tradición', href: '#el-ritual' }),
    badges: Object.freeze([
      Object.freeze({ icon: 'timer', value: '14 Horas', label: 'A Fuego Lento' }),
      Object.freeze({ icon: 'soup_kitchen', value: '100% Puro', label: 'Consomé de Res' }),
      Object.freeze({ icon: 'star', value: '4.9 ★', label: '+3,400 Opiniones' }),
    ]),
    showcase: Object.freeze({
      title: 'Tostado de Comal',
      description: 'Con costra de queso fundido & adobo',
      price: '$195 MXN',
    }),
  }),
  menu: Object.freeze({
    eyebrow: 'Especialidades del Comal',
    title: 'Nuestro Menú de Birria Artesanal',
    description:
      'Tradición tapatía con carne de res tatemada a fuego lento de 14 horas, tortillas hechas a mano y consomé servido hirviendo.',
    orderBanner: Object.freeze({
      title: 'Haz tu pedido directamente con nuestro asistente de WhatsApp',
      description:
        'Menú interactivo, cotización instantánea y confirmación automática sin comisiones ni registros.',
    }),
    items: birriaMenuItems,
  }),
  ritual: Object.freeze({
    eyebrow: 'El Ritual y La Receta',
    title: 'La Magia de la Olla de Barro y las Brasas',
    intro: Object.freeze({
      before: 'En ',
      strong: 'Birriería El Muñeco',
      after:
        ' no existen atajos modernos. No usamos saborizantes industriales ni polvos artificiales. Nuestra carne de res de primera selección se macera pacientemente en un adobo rojo vivo que ha pasado de generación en generación desde los Altos de Jalisco.',
    }),
    body: 'Al sellar la olla con masa de maíz fresco, el vapor atrapa la esencia profunda de los chiles tostados, desprendiendo los jugos colágenos directamente sobre el consomé, dejándolo espeso, aromático y reconfortante.',
    method: Object.freeze({ label: 'Método de Cocción', title: 'Olla Sellada con Masa' }),
    steps: Object.freeze([
      Object.freeze({
        icon: 'flare',
        title: '1. Marinado en Crudo',
        text: '24 horas en adobo de chiles guajillo, ancho, pimienta gorda, clavo y canela en rama.',
      }),
      Object.freeze({
        icon: 'local_fire_department',
        title: '2. Horno de Pozo',
        text: 'Sellado hermético sobre pencas de maguey a fuego manso toda la madrugada.',
      }),
    ]),
    metrics: Object.freeze([
      Object.freeze({ value: '+18', label: 'Años de Tradición' }),
      Object.freeze({ value: '3', label: 'Sucursales Activas' }),
      Object.freeze({ value: '1.8k', label: 'Lts Consomé / Sem' }),
    ]),
    quote: Object.freeze({
      text: '"El secreto no es apurar la lumbre, sino dejar que el calor de la brasa haga suave hasta el corte más rebelde."',
      author: "— Maestro Birriero 'El Muñeco'",
    }),
  }),
  locations: Object.freeze({
    eyebrow: 'Directo a tu Mesa o Domicilio',
    title: 'Visítanos o Pide en Línea',
    description:
      'El comal arde desde temprana hora los fines de semana. Reserva tus litros de consomé antes de que se agoten.',
    schedule: Object.freeze({
      title: 'Horarios de Servicio',
      slots: Object.freeze([
        Object.freeze({
          days: 'Viernes a Domingo',
          hours: '08:00 AM – 05:00 PM',
          note: 'Consomé matutino y quesabirrias crujientes.',
        }),
        Object.freeze({
          days: 'Lunes a Jueves',
          hours: '11:00 AM – 07:00 PM',
          note: 'Comidas completas y tacos dorados.',
        }),
      ]),
    }),
    branches: Object.freeze({
      title: 'Nuestras 3 Sucursales',
      badge: 'Estacionamiento Disponible',
      directionsLabel: 'Cómo Llegar',
      mapLabel: 'Haz click para abrir en Navegador GPS',
      // Sin enlace propio por sucursal: se usa la ubicación común (common.location.mapsUrl).
      items: Object.freeze([
        Object.freeze({ name: 'Matriz San Rafael', address: 'Calle Ribera de San Cosme #142, CDMX' }),
        Object.freeze({ name: 'Sucursal Narvarte', address: 'Av. Cuauhtémoc #789, Col. Narvarte Poniente' }),
        Object.freeze({
          name: 'Sucursal Coyoacán',
          address: 'Av. Miguel Ángel de Quevedo #450, Barrio del Niño Jesús',
        }),
      ]),
    }),
    delivery: Object.freeze({
      title: 'Pide a Domicilio Inmediato',
      description:
        'Garantizamos empaque térmico especial que conserva las quesabirrias crujientes y el consomé quemando hasta tu puerta.',
      // WhatsApp enlaza al bot configurado y Pick Up a la ubicación común; el resto no
      // tiene enlace configurado todavía y se muestra como información.
      platforms: Object.freeze([
        Object.freeze({ name: 'WhatsApp', note: 'Sin comisiones' }),
        Object.freeze({ name: 'Uber Eats', note: 'Entrega Rápida' }),
        Object.freeze({ name: 'Rappi', note: 'Puntos & Turbo' }),
        Object.freeze({ name: 'Pick Up', note: 'Pasa al mostrador' }),
      ]),
    }),
    club: Object.freeze({
      badge: 'Club El Muñeco',
      title: 'Domingos de Birria Familiar',
      description:
        'Recibe promociones de litros al 2x1 en tu primer pedido del mes y asegura tu paquete con tortillas ilimitadas antes de que se agote el cazo dominical.',
      inputLabel: 'Correo electrónico o teléfono',
      placeholder: 'Ingresa tu correo o teléfono',
      submit: 'Unirme',
      success: '¡Listo! Te avisaremos el sábado en cuanto prenda el horno.',
      disclaimer: 'Sin spam. Solo antojo, consomé y promociones reales.',
    }),
  }),
  footer: Object.freeze({
    about: Object.freeze({
      text: 'Sabor de tradición jalisciense cocinado a fuego lento con chiles secos, especias enteras y el inconfundible aroma de leña de encino.',
      guarantee: 'Garantía de Sazón Artesanal',
    }),
    hours: Object.freeze({
      title: 'Horarios del Comal',
      rows: Object.freeze([
        Object.freeze({ days: 'Miércoles - Viernes:', hours: '08:30 - 17:00' }),
        Object.freeze({ days: 'Sábados y Domingos:', hours: '07:30 - 18:30' }),
        Object.freeze({ days: 'Lunes y Martes:', hours: 'Reposo y Adobo' }),
      ]),
    }),
    contact: Object.freeze({
      title: 'Contacto & Pedidos',
      phone: Object.freeze({ label: '+52 (55) 4123-9080', href: 'tel:+525541239080' }),
      email: Object.freeze({ label: 'ordenes@birriaelmuneco.mx', href: 'mailto:ordenes@birriaelmuneco.mx' }),
      address: 'Mercado Central & Sucursales',
    }),
    secret: Object.freeze({
      title: 'El Secreto del Consomé',
      text: 'Servido siempre hirviendo, desgrasado a mano o con gordito al gusto, acompañado de tortillas recién pasadas por el comal con manteca colorada.',
      badgeTitle: 'Consomé 100% Puro',
      badgeText: 'Sin espesantes artificiales ni concentrados',
    }),
    copyright: '© 2024 Birriería El Muñeco. Tradición, Fuego y Sabor Puro de Res.',
    legal: Object.freeze(['Aviso de Privacidad', 'Términos del Servicio']),
  }),
});
