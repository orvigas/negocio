import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

import { DEFAULT_VIEWS_DIR } from '../../src/app.ts';
import { getBusinessContent } from '../../src/content/index.ts';
import { loadSeedDocument } from '../../src/content/seeds.ts';
import type { HomeNotice } from '../../src/services/business-schedule.ts';
import type { MenuDocument } from '../../src/services/menu-schema.ts';
import { renderLandingPage } from '../../src/views/landings/index.ts';
import { createRenderer } from '../../src/views/render.ts';
import { makeConfig } from '../helpers.ts';

/**
 * REQ-F-032 (CA-1 y CA-2): `/` y `/birria` publican solo afirmaciones confirmadas, con los textos
 * de la tabla editorial aprobada.
 *
 * Los productos de MySQL y el showcase y la promoción editables en /admin quedan fuera de alcance
 * (ver .claude/docs/pendientes.md): la página se renderiza con la semilla neutralizada (sin
 * platillos y con textos editables neutros), así solo se comprueba el contenido del código.
 */

const renderer = createRenderer({ viewsDir: DEFAULT_VIEWS_DIR });
const c = getBusinessContent('birria');

const NEUTRAL_MENU = (() => {
  const seed = (loadSeedDocument('birria') as MenuDocument<'birria'>).data;
  return {
    ...seed,
    hero: { showcase: { title: 'Platillo', description: 'Descripción', priceCents: seed.hero.showcase.priceCents } },
    menu: { items: [] },
    promo: { badge: 'Promoción', title: 'Promoción vigente', description: 'Pregunta por WhatsApp.' },
  };
})();

/** `/` con cada aviso posible (lunes, martes a viernes y fin de semana) y `/birria` (sin aviso). */
const PAGES: readonly (readonly [string, HomeNotice | null])[] = [
  ['/ (lunes)', 'rest'],
  ['/ (martes a viernes)', 'molotes'],
  ['/birria y / (fin de semana)', null],
];

function page(homeNotice: HomeNotice | null) {
  const html = renderLandingPage({ renderer, config: makeConfig(), businessId: 'birria', menu: NEUTRAL_MENU, homeNotice }).toString();
  const { document } = new JSDOM(html).window;
  // Los <path> de los iconos SVG no son texto publicado.
  for (const svg of document.querySelectorAll('svg')) svg.remove();
  const meta = [...document.querySelectorAll('meta[name="description"], meta[property^="og:"]')].map((node) => node.getAttribute('content') ?? '');
  const alts = [...document.querySelectorAll('img[alt]')].map((node) => node.getAttribute('alt') ?? '');
  const text = (document.body.textContent ?? '').replace(/\s+/g, ' ').trim();
  return { document, text, published: [document.title, ...meta, ...alts, text].join('\n') };
}

const RETIRED = [
  'tatemad', 'horno', 'olla', 'pozo', 'maguey', 'barro', 'brasa', 'leña', 'presión', 'térmic', 'Uber', 'Rappi', 'Sucursales',
  'Años de Tradición', '4.9', 'Opiniones', '14 Horas', '24 horas', '1.8k', 'Maestro', '2x1', '2×1', 'Birriería', 'Tapatía',
  'Ribera de San Cosme', 'Narvarte', 'Coyoacán', '4123-9080', 'Estacionamiento', '2024',
];

describe('REQ-F-032 CA-1: sin afirmaciones no confirmadas en / y /birria', () => {
  it.each(PAGES)('%s: ni el texto visible ni el title, la description, Open Graph o los alt contienen términos retirados', (_name, notice) => {
    const { published } = page(notice);
    const lower = published.toLocaleLowerCase('es-MX');
    for (const term of RETIRED) expect(lower, term).not.toContain(term.toLocaleLowerCase('es-MX'));
  });
});

describe('REQ-F-032 CA-2: textos de la tabla editorial aprobada', () => {
  const { document, text } = page(null);
  const normalized = (value: string | null | undefined) => (value ?? '').replace(/\s+/g, ' ').trim();

  it('nombre, SEO, alt y textos clave', () => {
    expect(c.name).toBe('Birria El Muñeco');
    expect(document.title).toBe('Birria El Muñeco | Birria de Res Estilo Los Altos de Jalisco');
    const description =
      'Birria de res estilo de Los Altos de Jalisco, de cocción lenta y con consomé caldosito. Sábados y domingos de 8:00 a 15:00. Pide por WhatsApp y te la llevamos hasta tu puerta.';
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(description);
    expect(document.querySelector('meta[property="og:site_name"]')?.getAttribute('content')).toBe('Birria El Muñeco');
    expect(c.images.logo.alt).toBe('Birria El Muñeco');
    expect(c.images.ritual.alt).toBe('Quesabirrias con su consomé');
    expect(text).toContain('Los Altos de Jalisco');
    expect(text).toContain('cocción lenta');
  });

  it('cada texto aprobado aparece publicado', () => {
    const APPROVED = [
      'Birria de Res Estilo Los Altos',
      'Inicio', 'Menú de Birria', 'Quesabirrias & Consomé', 'Nuestra Birria', 'Ubicación',
      'Estilo Los Altos de Jalisco',
      'Birria de res bien perrona y', 'Quesabirrias de Rechupete',
      '¡Raza, aquí el antojo se pone serio! Birria de res estilo de Los Altos de Jalisco, de cocción lenta, con carne suavecita y consomé caldosito para que no dejes ni una gota.',
      'Conoce Nuestra Birria',
      'Cocción lenta', 'Con paciencia', 'Consomé', 'Caldosito', 'Sáb y Dom', '8:00 a 15:00',
      'Nuestro Menú', 'Menú de Birria El Muñeco',
      'Birria de res de cocción lenta con su consomé para chopear sin pena. Escoge tu antojo y pídelo con todo.',
      'Haz tu pedido por WhatsApp', 'Escríbenos, arma tu pedido y te confirmamos el total. Sin comisiones.',
      'Lumbre bajita y paciencia de la buena',
      'En Birria El Muñeco preparamos birria de res estilo de Los Altos de Jalisco con cocción lenta, sin prisas y con mucho cariño.',
      'El resultado: carne suavecita que se deshace sola y un consomé caldosito para chopear con todo. Nomás sábados y domingos, así que no te quedes con las ganas.',
      'Preparación', '1. Sin prisas', 'Cocción lenta para que la carne quede suavecita.',
      '2. A chopear', 'Consomé caldosito para que no dejes ni una gota.',
      'Sucursal', 'Días de birria', 'A domicilio', 'Por motomandados',
      '"Aquí la birria no se apura: lumbre bajita, paciencia y antojo del bueno."', '— Birria El Muñeco',
      'A domicilio o en la sucursal', 'Visítanos o pide por WhatsApp',
      'Sábados y domingos el consomé está listo desde las 8 de la mañana. Pide por WhatsApp o date una vuelta por la sucursal.',
      'Horario de servicio',
      'Nuestra Sucursal', 'Pasa por tu pedido', 'Consulta la ubicación en el mapa.', 'Abrir en Google Maps',
      'Te la llevamos a tu puerta',
      'Pide por WhatsApp y te llevamos tu birria hasta la puerta con motomandados. El costo del envío depende de la distancia; te lo decimos al hacer tu pedido.',
      'Sin spam. Solo antojo y promociones reales.',
      'Birria de res estilo de Los Altos de Jalisco, de cocción lenta, con carne suavecita y consomé caldosito. ¡Para chuparse los dedos!',
      'Hecha con paciencia', 'Horario', 'Contacto y pedidos',
      'El Consomé', 'Caldosito, calientito y listo para chopear tus quesabirrias sin pena.',
      'Consomé para chopear', 'Pídelo con tu orden por WhatsApp.',
      '© 2026 Birria El Muñeco. Todos los derechos reservados.',
    ];
    for (const expected of APPROVED) expect(text, expected).toContain(expected);
  });

  it('las etiquetas del menú de navegación conservan sus destinos', () => {
    expect(c.nav.map(({ label, href }) => [label, href])).toEqual([
      ['Inicio', '#inicio'],
      ['Menú de Birria', '#menu-especialidades'],
      ['Quesabirrias & Consomé', '#menu-especialidades'],
      ['Nuestra Birria', '#el-ritual'],
      ['Ubicación', '#ubicaciones-pedidos'],
    ]);
  });

  it('badges del hero, pasos y métricas del ritual en su orden', () => {
    expect(c.hero.badges).toEqual([
      { icon: 'local_fire_department', value: 'Cocción lenta', label: 'Con paciencia' },
      { icon: 'soup_kitchen', value: 'Consomé', label: 'Caldosito' },
      { icon: 'calendar_month', value: 'Sáb y Dom', label: '8:00 a 15:00' },
    ]);
    expect(c.ritual.steps.map(({ icon, title }) => [icon, title])).toEqual([
      ['schedule', '1. Sin prisas'],
      ['soup_kitchen', '2. A chopear'],
    ]);
    expect(c.ritual.method).toEqual({ label: 'Preparación', title: 'Cocción lenta' });
    expect(c.ritual.metrics).toEqual([
      { value: '1', label: 'Sucursal' },
      { value: 'Sáb y Dom', label: 'Días de birria' },
      { value: 'A domicilio', label: 'Por motomandados' },
    ]);
  });

  it('el club: botón "Activar promoción" y su mensaje de éxito (CA-8)', () => {
    const button = document.querySelector('form[data-promo-form] button[type="submit"]');
    expect(normalized(button?.textContent)).toBe('Activar promoción');
    expect(normalized(document.querySelector('#promo-status')?.textContent)).toBe('¡Listo! Pregunta por la promoción vigente al pedir por WhatsApp.');
  });
});
