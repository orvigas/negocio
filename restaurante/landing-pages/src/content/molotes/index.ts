import { BUSINESS } from '../../config/businesses.ts';
import { image } from '../images.ts';

/**
 * Contenido de Moloteando (landing de lunes a viernes; su horario de servicio está en ./hours.ts).
 * Fuente: _stich_source_/moloteando_aut_nticos_molotes_artesanales/code.html
 *
 * Solo datos estáticos (textos, horarios, contacto, imágenes). Los datos editables desde
 * /admin/molotes (productos, bebidas, showcase del hero, texto destacado del menú y textos
 * de la promoción) viven en el repositorio de menús; su semilla es ./seed.json. El marcado vive en
 * src/views/pages/molotes.html y src/views/partials/molotes/; los tonos visuales se
 * expresan con claves semánticas (`tone`) que resuelve src/views/landings/molotes.ts.
 */
export const molotesContent = Object.freeze({
  id: 'molotes',
  name: 'Moloteando',
  seo: Object.freeze({
    title: 'Moloteando | Auténticos Molotes Artesanales',
    description:
      'Masa de maíz criollo nixtamalizado, rellenos tradicionales cocinados al comal y fritos a la perfección. Bañados con crema de rancho, queso cotija y salsas tatemadas.',
  }),
  assets: Object.freeze({
    // Una sola hoja de Google Fonts por landing (familias del diseño + iconos Material Symbols).
    fontsHref:
      'https://fonts.googleapis.com/css2?family=Epilogue:ital,wght@0,400;0,600;0,700;0,800;1,400&family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap',
  }),
  // Favicons, iconos de pantalla de inicio y manifest (REQ-F-002). Los archivos están en
  // public/img/molotes/icons/ y se generan con scripts/generate-icons.py: al regenerarlos,
  // incrementa `version` (se añade como ?v= a sus URLs para invalidar la caché HTTP).
  icons: Object.freeze({
    version: 1,
    // Fondo de la landing: theme-color, background_color y fondo de los iconos opacos.
    themeColor: '#03132b',
    manifest: Object.freeze({ name: 'Moloteando', shortName: 'Moloteando' }),
  }),
  // Imágenes en public/img/molotes/ (alt tomados del diseño; alt vacío = decorativa).
  images: Object.freeze({
    logo: image('/img/molotes/logo-molotes.webp', 'Moloteando', 461, 512),
    heroLogo: image('/img/molotes/logo-molotes.webp', 'Moloteando - Auténticos Molotes', 461, 512),
    // Las repeticiones del logo junto al nombre del negocio son decorativas.
    emblem: image('/img/molotes/logo-molotes.webp', '', 461, 512),
    fondo: image('/img/molotes/fondo-molotes.jpg', '', 476, 512),
    motivos: image('/img/molotes/motivos-molotes.webp', '', 476, 512),
    hero: image('/img/molotes/molotes-artesanales.jpg', 'Molotes artesanales recién dorados con crema, aguacate y salsa', 512, 382),
  }),
  announcement: 'Horario de Comal: Mar - Vie 08:30 a 15:00 hrs • Salsas Caseras y Masa Recién Frita',
  cta: Object.freeze({ label: 'Ordenar ya!' }),
  nav: Object.freeze([
    Object.freeze({ label: 'Inicio', href: '#inicio' }),
    Object.freeze({ label: 'Menú de Molotes', href: '#menu-seccion' }),
    Object.freeze({ label: 'Especialidades', href: '#bebidas-seccion' }),
    Object.freeze({ label: 'Nosotros', href: '#ritual-seccion' }),
    Object.freeze({ label: 'Ubicación', href: '#pedidos-seccion' }),
  ]),
  hero: Object.freeze({
    pills: Object.freeze([
      Object.freeze({ icon: 'agriculture', text: '100% Maíz Nixtamalizado' }),
      Object.freeze({ icon: 'storefront', text: 'Sabor de Barrio Callejero' }),
      Object.freeze({ icon: 'star', text: 'Estilo Poblano' }),
    ]),
    titleLead: 'Auténticos Molotes Artesanales al',
    titleHighlight: 'Punto de Oro',
    description:
      'Masa de maíz criollo nixtamalizado, rellenos tradicionales cocinados al comal y fritos en manteca y aceite a la perfección. Bañados con crema de rancho, queso cotija y salsas tatemadas.',
    secondaryCta: Object.freeze({ label: 'Conoce Nuestra Tradición', href: '#ritual-seccion' }),
  }),
  divider: 'Antojería Tradicional • Fritura Sagrada',
  menu: Object.freeze({
    eyebrow: 'Carta Oficial y Tradición',
    title: 'Menú de Molotes Tradicionales',
    description: 'Masa recién amasada y frita al punto de oro. Pídelos individuales o en orden de 3.',
    sides: Object.freeze({
      label: 'Acompañamiento Incluido en Cada Orden',
      text: '“Todos nuestros molotes vienen acompañados de lechuga fresca, jitomate en rebanadas, quesito rallado, deliciosa crema y salsas caseras que le dan el toque final.”',
    }),
  }),
  drinks: Object.freeze({
    imageAlt: 'Aguas Frescas y Refrescos Coca-Cola',
    imageTag: 'Bien Frías',
    imageTitle: 'Para Bajar el Antojo',
    eyebrow: 'Bebidas Tradicionales y Refrescos',
    title: 'Para Acompañar tus Molotes',
    description: 'Nada como un agua fresca casera o una Coca-Cola bien helada en botella de vidrio con limón.',
  }),
  ritual: Object.freeze({
    card: Object.freeze({
      title: 'El Molote de Barrio Puro',
      text: 'Cada pieza se forja a mano en metate y prensa de madera, moldeando una masa delgada que encierra el guisado humeante.',
      steps: Object.freeze([
        Object.freeze({ icon: 'grain', title: '1. Nixtamal', note: 'Maíz azul y blanco' }),
        Object.freeze({ icon: 'skillet', title: '2. Fritura Oro', note: '185°C exactos' }),
        Object.freeze({ icon: 'soup_kitchen', title: '3. Corona', note: 'Crema & queso' }),
      ]),
    }),
    eyebrow: 'El Ritual del Maíz',
    title: 'La Magia de la Masa y el Aceite Candente',
    paragraphs: Object.freeze([
      'El secreto de un verdadero molote radica en su cáscara: debe sonar crujiente al primer mordisco sin absorber un gramo de grasa de más. Logramos esta textura templando la masa con un toque sutil de puré de papa criolla y cuidando cada fritura en el comal.',
      'No usamos harinas industriales ni polvos leudantes. Es puro maíz seleccionado de parcelas campesinas poblanas, reposado en cal viva durante la madrugada y molido en piedra volcánica cada mañana.',
    ]),
    metrics: Object.freeze([
      Object.freeze({ value: '2026', title: 'Desde', note: 'Comal recién encendido' }),
      Object.freeze({ value: '1', title: 'Sucursal', note: 'Te esperamos de martes a viernes' }),
      Object.freeze({ value: 'A mano', title: 'Hecho pieza por pieza', note: 'Masa recién amasada' }),
    ]),
  }),
  service: Object.freeze({
    eyebrow: 'Servicio y Domicilio',
    title: 'Pídelos Calientes a Tu Puerta',
    description:
      'Disfruta tus molotes crujientes hasta tu puerta. Contamos con servicio de entrega mediante motomandados; el costo se calcula según la distancia de entrega. Consulta el costo al realizar tu pedido por WhatsApp.',
    schedule: Object.freeze({
      title: 'Horarios de Comal',
      hours: 'Martes a Viernes de 8:30 AM a 3:00 PM',
      note: '* Lunes descansamos. Sábados y domingos te esperamos en Birria El Muñeco.',
    }),
    platformsLabel: 'Plataformas y Pedido Directo:',
    // WhatsApp enlaza al bot configurado; "Motomandados" es informativa (el costo del envío
    // se consulta por WhatsApp; REQ-F-031, R-7) y "Recoger en sucursal" enlaza a la ubicación
    // común (REQ-F-032, R-8). El orden coincide con las casillas de la plantilla.
    platforms: Object.freeze([
      Object.freeze({ name: 'WhatsApp', note: 'Sin comisiones' }),
      Object.freeze({ name: 'Motomandados', note: 'Costo según distancia' }),
      Object.freeze({ name: 'Recoger en sucursal', note: 'Pasa por tu pedido' }),
    ]),
    // Mapa embebido de la ubicación común (common.location.embedSrc; REQ-F-031, R-15).
    mapTitle: 'Ubicación de Moloteando en Google Maps',
  }),
  promo: Object.freeze({
    nameLabel: 'Tu nombre',
    namePlaceholder: 'Tu nombre o apodo garnachero',
    emailLabel: 'Correo electrónico',
    emailPlaceholder: 'correo@ejemplo.com',
    submit: 'Activar promoción',
    success: '¡Gracias por tu interés! Pregunta por la promoción vigente al pedir por WhatsApp.',
    disclaimer: 'Sin spam molesto.',
  }),
  /**
   * Avisos de `/molotes` (REQ-F-034): el lunes, descanso; sábado y domingo, "hoy toca birria"
   * (src/views/partials/molotes/notice.html). `business` es el destino del enlace: la ruta sale
   * de BUSINESS_PATHS y el logo (decorativo) es el `emblem` del destino.
   */
  notices: Object.freeze({
    weekend: Object.freeze({
      title: '¡Raza, hoy toca birria!',
      body: '¡Qué bueno que se te antojaron unos molotes! Los nuestros son de estilo poblano y te esperan de martes a viernes. Pero no te vayas con el antojo: este fin de semana nos ponemos bien birrieros con Birria El Muñeco. ¡Échale un ojo al menú y descubre qué se te antoja hoy!',
      linkLabel: 'Ver Birria El Muñeco',
      business: BUSINESS.BIRRIA,
      closeLabel: 'Quedarme en Molotes',
    }),
    rest: Object.freeze({
      title: '¡Los lunes descansamos!',
      body: 'Hoy el comal agarra fuerzas. Mañana martes volvemos con molotes estilo poblano recién hechecitos. Mientras, échale un ojo al menú y ve escogiendo tu antojo.',
      closeLabel: 'Ver el menú',
    }),
  }),
  footer: Object.freeze({
    // Enlace a la otra landing en la columna de marca del pie (REQ-F-033). La ruta y el logo
    // salen del negocio de destino (BUSINESS_PATHS e images.emblem; src/views/landings/index.ts).
    crossLink: Object.freeze({ label: 'Conoce nuestra Birria', business: BUSINESS.BIRRIA }),
    about:
      'Molotes estilo poblano, crujientes y hechos a mano, con crema de rancho, queso fresco y salsas de molcajete.',
    nav: Object.freeze({
      title: 'Navegación Fonda',
      links: Object.freeze([
        Object.freeze({ label: 'Menú Tradicional', href: '#menu-seccion' }),
        Object.freeze({ label: 'Especialidades del Comal', href: '#menu-seccion' }),
        Object.freeze({ label: 'Nuestras Salsas y Guarniciones', href: '#menu-seccion' }),
        Object.freeze({ label: 'Historia & Masa Nixtamalizada', href: '#ritual-seccion' }),
        Object.freeze({ label: 'Pedidos y Domicilio', href: '#pedidos-seccion' }),
      ]),
    }),
    hours: Object.freeze({
      title: 'Horarios del Comal',
      rows: Object.freeze([
        Object.freeze({ days: 'Martes a Viernes', hours: '08:30 - 15:00' }),
        Object.freeze({ days: 'Sábado y Domingo', hours: 'Cerrado' }),
        Object.freeze({ days: 'Lunes', hours: 'Cerrado' }),
      ]),
    }),
    // Ubicación, teléfono y correo son los de la única sucursal: common.contact (REQ-F-032, R-6).
    contact: Object.freeze({ title: 'Contacto y ubicación' }),
    copyright: '© 2026 Moloteando. Todos los derechos reservados.',
    legal: Object.freeze(['Aviso de Privacidad', 'Términos de Servicio']),
  }),
});
