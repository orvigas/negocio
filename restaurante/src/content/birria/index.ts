import { image } from '../images.ts';

/**
 * Contenido de Birria El Muñeco (landing de sábado y domingo; su horario de servicio está en ./hours.ts).
 * Fuente: _stich_source_/birrier_a_el_mu_eco_aut_ntica_birria_de_res_color_adobo/code.html
 * Textos: tabla editorial aprobada de REQ-F-032 (solo afirmaciones confirmadas).
 *
 * Solo datos estáticos (textos, horarios, imágenes). La ubicación, el teléfono y el correo son
 * los de la única sucursal, comunes a ambas landings y al bot (../common/index.ts). Los datos
 * editables desde /admin/birria (platillos, showcase del hero y textos del club) viven en el
 * repositorio de menús; su semilla es ./seed.json. El marcado vive en
 * src/views/pages/birria.html y src/views/partials/birria/; los tonos visuales se
 * expresan con claves semánticas (`highlight`) que resuelve src/views/landings/birria.ts.
 */
export const birriaContent = Object.freeze({
  id: 'birria',
  name: 'Birria El Muñeco',
  seo: Object.freeze({
    title: 'Birria El Muñeco | Birria de Res Estilo Los Altos de Jalisco',
    description:
      'Birria de res estilo de Los Altos de Jalisco, de cocción lenta y con consomé caldosito. Sábados y domingos de 8:00 a 15:00. Pide por WhatsApp y te la llevamos hasta tu puerta.',
  }),
  assets: Object.freeze({
    // Una sola hoja de Google Fonts por landing (familias del diseño + iconos Material Symbols).
    fontsHref:
      'https://fonts.googleapis.com/css2?family=Epilogue:wght@400;600;700;800;900&family=Space+Grotesk:wght@600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap',
  }),
  // Favicons, iconos de pantalla de inicio y manifest (REQ-F-002). Los archivos están en
  // public/img/birria/icons/ y se generan con scripts/generate-icons.py: al regenerarlos,
  // incrementa `version` (se añade como ?v= a sus URLs para invalidar la caché HTTP).
  icons: Object.freeze({
    version: 1,
    // Fondo de la landing: theme-color, background_color y fondo de los iconos opacos.
    themeColor: '#290808',
    manifest: Object.freeze({ name: 'Birria El Muñeco', shortName: 'El Muñeco' }),
  }),
  // Imágenes en public/img/birria/ (alt vacío = decorativa).
  images: Object.freeze({
    logo: image('/img/birria/logo-birria.webp', 'Birria El Muñeco', 418, 512),
    // Las repeticiones del logo junto al nombre del negocio son decorativas.
    emblem: image('/img/birria/logo-birria.webp', '', 418, 512),
    fondo: image('/img/birria/fondo-birria.jpg', '', 476, 512),
    hero: image('/img/birria/quesabirria.jpg', 'Quesatacos de birria de res con consomé', 512, 382),
    ritual: image('/img/birria/quesabirria.jpg', 'Quesabirrias con su consomé', 512, 382),
  }),
  brand: Object.freeze({
    shortName: 'El Muñeco',
    tagline: 'Birria de Res Estilo Los Altos',
  }),
  cta: Object.freeze({ label: 'Ordenar ya!' }),
  nav: Object.freeze([
    Object.freeze({ label: 'Inicio', href: '#inicio' }),
    Object.freeze({ label: 'Menú de Birria', href: '#menu-especialidades' }),
    Object.freeze({ label: 'Quesabirrias & Consomé', href: '#menu-especialidades' }),
    Object.freeze({ label: 'Nuestra Birria', href: '#el-ritual' }),
    Object.freeze({ label: 'Ubicación', href: '#ubicaciones-pedidos' }),
  ]),
  hero: Object.freeze({
    eyebrow: 'Estilo Los Altos de Jalisco',
    titleLead: 'Birria de res bien perrona y',
    titleHighlight: 'Quesabirrias de Rechupete',
    description:
      '¡Raza, aquí el antojo se pone serio! Birria de res estilo de Los Altos de Jalisco, de cocción lenta, con carne suavecita y consomé caldosito para que no dejes ni una gota.',
    secondaryCta: Object.freeze({ label: 'Conoce Nuestra Birria', href: '#el-ritual' }),
    badges: Object.freeze([
      Object.freeze({ icon: 'local_fire_department', value: 'Cocción lenta', label: 'Con paciencia' }),
      Object.freeze({ icon: 'soup_kitchen', value: 'Consomé', label: 'Caldosito' }),
      Object.freeze({ icon: 'calendar_month', value: 'Sáb y Dom', label: '8:00 a 15:00' }),
    ]),
  }),
  menu: Object.freeze({
    eyebrow: 'Nuestro Menú',
    title: 'Menú de Birria El Muñeco',
    description: 'Birria de res de cocción lenta con su consomé para chopear sin pena. Escoge tu antojo y pídelo con todo.',
    orderBanner: Object.freeze({
      title: 'Haz tu pedido por WhatsApp',
      description: 'Escríbenos, arma tu pedido y te confirmamos el total. Sin comisiones.',
    }),
  }),
  ritual: Object.freeze({
    eyebrow: 'Nuestra Birria',
    title: 'Lumbre bajita y paciencia de la buena',
    intro: Object.freeze({
      before: 'En ',
      strong: 'Birria El Muñeco',
      after: ' preparamos birria de res estilo de Los Altos de Jalisco con cocción lenta, sin prisas y con mucho cariño.',
    }),
    body: 'El resultado: carne suavecita que se deshace sola y un consomé caldosito para chopear con todo. Nomás sábados y domingos, así que no te quedes con las ganas.',
    method: Object.freeze({ label: 'Preparación', title: 'Cocción lenta' }),
    steps: Object.freeze([
      Object.freeze({ icon: 'schedule', title: '1. Sin prisas', text: 'Cocción lenta para que la carne quede suavecita.' }),
      Object.freeze({ icon: 'soup_kitchen', title: '2. A chopear', text: 'Consomé caldosito para que no dejes ni una gota.' }),
    ]),
    metrics: Object.freeze([
      Object.freeze({ value: '1', label: 'Sucursal' }),
      Object.freeze({ value: 'Sáb y Dom', label: 'Días de birria' }),
      Object.freeze({ value: 'A domicilio', label: 'Por motomandados' }),
    ]),
    quote: Object.freeze({
      text: '"Aquí la birria no se apura: lumbre bajita, paciencia y antojo del bueno."',
      author: '— Birria El Muñeco',
    }),
  }),
  locations: Object.freeze({
    eyebrow: 'A domicilio o en la sucursal',
    title: 'Visítanos o pide por WhatsApp',
    description:
      'Sábados y domingos el consomé está listo desde las 8 de la mañana. Pide por WhatsApp o date una vuelta por la sucursal.',
    schedule: Object.freeze({
      title: 'Horario de servicio',
      slots: Object.freeze([
        Object.freeze({
          days: 'Sábado y Domingo',
          hours: '08:00 AM – 03:00 PM',
          note: 'Birria, consomé y quesabirrias para el antojo del finde.',
        }),
        Object.freeze({
          days: 'Lunes a Viernes',
          hours: 'Cerrado',
          note: 'De martes a viernes te esperan nuestros Molotes.',
        }),
      ]),
    }),
    branches: Object.freeze({
      title: 'Nuestra Sucursal',
      badge: 'Pasa por tu pedido',
      mapLabel: 'Abrir en Google Maps',
      // Mapa embebido de la ubicación común (common.location.embedSrc; REQ-F-032, R-4).
      mapTitle: 'Ubicación de Birria El Muñeco en Google Maps',
      // Una sola sucursal (R-5): "Cómo llegar" enlaza a la ubicación común (common.location.mapsUrl).
      items: Object.freeze([Object.freeze({ name: 'Birria El Muñeco', address: 'Consulta la ubicación en el mapa.' })]),
    }),
    delivery: Object.freeze({
      title: 'Te la llevamos a tu puerta',
      description:
        'Pide por WhatsApp y te llevamos tu birria hasta la puerta con motomandados. El costo del envío depende de la distancia; te lo decimos al hacer tu pedido.',
      // WhatsApp enlaza al bot configurado, "Motomandados" es informativa y "Recoger en
      // sucursal" enlaza a la ubicación común (REQ-F-032, R-8). El orden coincide con la plantilla.
      platforms: Object.freeze([
        Object.freeze({ name: 'WhatsApp', note: 'Sin comisiones' }),
        Object.freeze({ name: 'Motomandados', note: 'Costo según distancia' }),
        Object.freeze({ name: 'Recoger en sucursal', note: 'Pasa por tu pedido' }),
      ]),
    }),
    club: Object.freeze({
      inputLabel: 'Correo electrónico o teléfono',
      placeholder: 'Ingresa tu correo o teléfono',
      submit: 'Activar promoción',
      success: '¡Listo! Pregunta por la promoción vigente al pedir por WhatsApp.',
      disclaimer: 'Sin spam. Solo antojo y promociones reales.',
    }),
  }),
  /**
   * Avisos de la página de inicio (REQ-F-028): `/` es siempre Birria y, según el día, abre uno
   * de estos modales (src/views/partials/birria/home-notice.html).
   */
  homeNotices: Object.freeze({
    molotes: Object.freeze({
      title: '¡Ay, compa! La birria es de fin de semana',
      body: 'Nuestra birria sale calientita nomás sábados y domingos. Pero no te quedes con antojo: de martes a viernes tenemos ricos y deliciosos molotes recién hechecitos, doraditos y con su salsita de la casa.',
      linkLabel: '¡Ordenar ya!',
      linkHref: '/molotes',
      // El alt no repite "¡Ordenar ya!": el nombre del enlace queda "Molotes ¡Ordenar ya!".
      logo: image('/img/molotes/logo-molotes.webp', 'Molotes', 461, 512),
      closeLabel: 'Cerrar',
    }),
    rest: Object.freeze({
      title: '¡Los lunes descansamos!',
      body: 'Hoy el comal y las cazuelas agarran fuerzas, y nosotros también. Mañana martes volvemos con molotes recién hechecitos, y el fin de semana, con la birria de siempre.',
      linkLabel: 'Mañana hay molotes',
      linkHref: '/molotes',
      closeLabel: 'Cerrar',
    }),
  }),
  footer: Object.freeze({
    about: Object.freeze({
      text: 'Birria de res estilo de Los Altos de Jalisco, de cocción lenta, con carne suavecita y consomé caldosito. ¡Para chuparse los dedos!',
      guarantee: 'Hecha con paciencia',
    }),
    hours: Object.freeze({
      title: 'Horario',
      // La segunda fila (días de servicio) va destacada en la plantilla.
      rows: Object.freeze([
        Object.freeze({ days: 'Lunes:', hours: 'Cerrado' }),
        Object.freeze({ days: 'Sábados y Domingos:', hours: '08:00 - 15:00' }),
        Object.freeze({ days: 'Martes a Viernes:', hours: 'Hay Molotes' }),
      ]),
    }),
    // Teléfono, correo y ubicación son los de la única sucursal: common.contact (REQ-F-032, R-6).
    contact: Object.freeze({ title: 'Contacto y pedidos' }),
    secret: Object.freeze({
      title: 'El Consomé',
      text: 'Caldosito, calientito y listo para chopear tus quesabirrias sin pena.',
      badgeTitle: 'Consomé para chopear',
      badgeText: 'Pídelo con tu orden por WhatsApp.',
    }),
    copyright: '© 2026 Birria El Muñeco. Todos los derechos reservados.',
    legal: Object.freeze(['Aviso de Privacidad', 'Términos del Servicio']),
  }),
});
