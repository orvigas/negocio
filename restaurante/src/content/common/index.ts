import { image } from '../images.ts';

/** Contenido compartido por ambas landing pages. */
export const commonContent = Object.freeze({
  lang: 'es-MX',
  ogLocale: 'es_MX',
  skipLink: 'Saltar al contenido',
  navLabel: 'Principal',
  footerNavLabel: 'Secciones',
  // Aviso de una sección sin productos disponibles (REQ-F-001, RF-4.5).
  emptySection: 'Por ahora no tenemos productos disponibles en esta sección. Escríbenos por WhatsApp.',
  cta: Object.freeze({
    // Texto solo para lectores de pantalla; complementa la etiqueta visible del CTA.
    assistiveText: 'por WhatsApp (se abre en una pestaña nueva)',
  }),
  // Ubicación compartida por ambas landings (enlace corto de Google Maps).
  location: Object.freeze({
    mapsUrl: 'https://maps.app.goo.gl/sAFDEeLdKzs7GGPz9',
    label: 'Cómo llegar',
    assistiveText: 'en Google Maps (se abre en una pestaña nueva)',
  }),
  images: Object.freeze({
    // Foto de la sección de bebidas de Molotes (la tarjeta de bebidas de Birria usa la misma).
    bebidas: image('/img/common/bebidas-aguas-frescas-refrescos.jpg', 'Aguas frescas de horchata y Coca-Cola fría', 512, 382),
  }),
});
