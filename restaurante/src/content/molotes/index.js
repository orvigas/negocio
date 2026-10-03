import { image } from '../images.js';

/**
 * Contenido de Moloteando (lunes a viernes).
 * Fuente: _stich_source_/moloteando_aut_nticos_molotes_artesanales/code.html
 *
 * Solo datos estáticos (textos, horarios, contacto, imágenes). Los datos editables desde
 * /admin/molotes (productos, bebidas, showcase del hero, texto destacado del menú y textos
 * de la promoción) viven en el repositorio de menús; su semilla es ./seed.json. El marcado vive en
 * src/views/pages/molotes.html y src/views/partials/molotes/; los tonos visuales se
 * expresan con claves semánticas (`tone`) que resuelve src/views/landings/molotes.js.
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
  announcement: 'Horario de Comal: Mar - Dom 13:00 a 22:30 hrs • Salsas Caseras y Masa Recién Frita',
  cta: Object.freeze({ label: 'Ordenar ya!' }),
  nav: Object.freeze([
    Object.freeze({ label: 'Inicio', href: '#inicio' }),
    Object.freeze({ label: 'Menú de Molotes', href: '#menu-seccion' }),
    Object.freeze({ label: 'Especialidades', href: '#bebidas-seccion' }),
    Object.freeze({ label: 'Nosotros', href: '#ritual-seccion' }),
    Object.freeze({ label: 'Sucursales', href: '#pedidos-seccion' }),
  ]),
  hero: Object.freeze({
    pills: Object.freeze([
      Object.freeze({ icon: 'agriculture', text: '100% Maíz Nixtamalizado' }),
      Object.freeze({ icon: 'storefront', text: 'Sabor de Barrio Callejero' }),
      Object.freeze({ icon: 'star', text: '4.9 ★ en Calificaciones' }),
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
      'El secreto de un verdadero molote radica en su cáscara: debe sonar crujiente al primer mordisco sin absorber un gramo de grasa de más. Logramos esta textura inigualable templando la masa con un toque sutil de puré de papa criolla y friéndolo con tiempos de comal celosamente cronometrados por tres generaciones de maestras cocineras.',
      'No usamos harinas industriales ni polvos leudantes. Es puro maíz seleccionado de parcelas campesinas poblanas, reposado en cal viva durante la madrugada y molido en piedra volcánica cada mañana.',
    ]),
    metrics: Object.freeze([
      Object.freeze({ value: '+15', title: 'Años de Tradición', note: 'Guardando recetas de barrio' }),
      Object.freeze({ value: '3', title: 'Sucursales Activas', note: 'Comales siempre encendidos' }),
      Object.freeze({ value: '1,500+', title: 'Molotes Diarios', note: 'Servidos bien calientitos' }),
    ]),
  }),
  service: Object.freeze({
    eyebrow: 'Servicio y Domicilio',
    title: 'Pídelos Calientes a Tu Puerta',
    description:
      'Enviamos en empaques térmicos transpirables para que la costra de maíz mantenga su firmeza y crunch hasta el último bocado.',
    schedule: Object.freeze({
      title: 'Horarios de Comal',
      hours: 'Martes a Domingo de 10:00 AM a 8:00 PM',
      note: '* Lunes cerramos comales por molienda de nixtamal artesanal y curación de cazuelas.',
    }),
    platformsLabel: 'Plataformas y Pedido Directo:',
    // WhatsApp enlaza al bot configurado y "En Sucursal" a la ubicación común; el resto
    // no tiene enlace configurado todavía y se muestra como información.
    platforms: Object.freeze([
      Object.freeze({ name: 'WhatsApp', note: 'Sin Comisiones' }),
      Object.freeze({ name: 'Uber Eats', note: 'Disponible' }),
      Object.freeze({ name: 'Rappi', note: 'Envío Turbo' }),
      Object.freeze({ name: 'En Sucursal', note: 'Pick & Go' }),
    ]),
  }),
  promo: Object.freeze({
    nameLabel: 'Tu nombre',
    namePlaceholder: 'Tu nombre o apodo garnachero',
    emailLabel: 'Correo electrónico',
    emailPlaceholder: 'correo@ejemplo.com',
    submit: 'Activar Mi Descuento 2x1',
    success: '¡Listo! Revisa tu bandeja para activar tu 2x1 este próximo jueves.',
    disclaimer: 'Sin spam molesto. Solo promociones crujientes y reales.',
  }),
  footer: Object.freeze({
    about:
      'Tradición crujiente de maíz rellena de sazón mestizo. Molotes poblanos y oaxaqueños con crema de rancho, queso fresco y salsas de molcajete.',
    nav: Object.freeze({
      title: 'Navegación Fonda',
      links: Object.freeze([
        Object.freeze({ label: 'Menú Tradicional', href: '#menu-seccion' }),
        Object.freeze({ label: 'Especialidades del Comal', href: '#menu-seccion' }),
        Object.freeze({ label: 'Nuestras Salsas y Guarniciones', href: '#menu-seccion' }),
        Object.freeze({ label: 'Historia & Masa Nixtamalizada', href: '#ritual-seccion' }),
        Object.freeze({ label: 'Facturación y Pedidos Express', href: '#pedidos-seccion' }),
      ]),
    }),
    hours: Object.freeze({
      title: 'Horarios del Comal',
      rows: Object.freeze([
        Object.freeze({ days: 'Martes a Viernes', hours: '13:00 - 22:30' }),
        Object.freeze({ days: 'Sábado y Domingo', hours: '12:00 - 23:00' }),
        Object.freeze({ days: 'Lunes', hours: 'Cerrado por nixtamal' }),
      ]),
    }),
    contact: Object.freeze({
      title: 'Contacto & Sucursales',
      address: 'Callejon del Sabor #42, Col. San Jerónimo, Ciudad de México',
      phone: Object.freeze({ label: '+52 55 4892 0184', href: 'tel:+525548920184' }),
      email: Object.freeze({ label: 'antojos@moloteando.mx', href: 'mailto:antojos@moloteando.mx' }),
    }),
    copyright: '© 2024 Moloteando S.A. de C.V. Todos los derechos reservados. Antojería de Barrio.',
    legal: Object.freeze(['Aviso de Privacidad', 'Términos de Servicio']),
  }),
});
