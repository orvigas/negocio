import { BRANCH_LOCATION } from '@restaurante/core/shared';

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
  // Ubicación de la única sucursal (REQ-F-032, R-3 y RN-3): la usan ambas landings (enlaces y
  // mapa embebido) y el bot ("Horario y ubicación"). El origen del iframe (www.google.com) es el
  // único permitido en `frame-src` de la CSP (src/app.ts).
  location: Object.freeze({
    mapsUrl: BRANCH_LOCATION.mapsUrl,
    embedSrc:
      'https://www.google.com/maps/embed?pb=!4v1792064722212!6m8!1m7!1sCliD7xRS-mkCpf6MwseHcQ!2m2!1d18.81823603166285!2d-98.96914471124853!3f189.613958693852!4f-9.01272483181998!5f0.7820865974627469',
    label: 'Cómo llegar',
    assistiveText: 'en Google Maps (se abre en una pestaña nueva)',
    // Apoyo de los enlaces cuyo texto visible ya dice "Google Maps" (no lo repite).
    newTabText: '(se abre en una pestaña nueva)',
  }),
  // Contacto de la única sucursal en el pie de ambas landings (REQ-F-032, R-6). El teléfono es
  // el de llamadas; el WhatsApp del bot es otro dato y vive en la configuración (RN-6).
  contact: Object.freeze({
    phone: Object.freeze({ label: '+52 735 278 2306', href: 'tel:+527352782306' }),
    email: Object.freeze({ label: 'ordenes@birriaelmuneco.mx', href: 'mailto:ordenes@birriaelmuneco.mx' }),
    mapLabel: 'Ver ubicación en Google Maps',
  }),
  images: Object.freeze({
    // Foto de la sección de bebidas de Molotes (la tarjeta de bebidas de Birria usa la misma).
    bebidas: image('/img/common/bebidas-aguas-frescas-refrescos.jpg', 'Aguas frescas de horchata y Coca-Cola fría', 512, 382),
  }),
});
