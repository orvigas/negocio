import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

import { DEFAULT_VIEWS_DIR } from '../../src/app.ts';
import type { BusinessId } from '../../src/config/businesses.ts';
import type { HomeNotice } from '../../src/services/business-schedule.ts';
import { renderLandingPage } from '../../src/views/landings/index.ts';
import { createRenderer } from '../../src/views/render.ts';
import { makeConfig, seedData } from '../helpers.ts';

/**
 * REQ-F-033: enlace del pie a la otra landing, con el logo oficial del destino.
 * Birria se renderiza con cada aviso posible de `/` (lunes, martes a viernes, fin de semana) y
 * sin aviso, que es también `/birria`.
 */

const renderer = createRenderer({ viewsDir: DEFAULT_VIEWS_DIR });

function footerOf(businessId: BusinessId, homeNotice: HomeNotice | null = null) {
  const html = renderLandingPage({ renderer, config: makeConfig(), businessId, menu: seedData(businessId), homeNotice }).toString();
  const { document } = new JSDOM(html).window;
  return { document, footer: document.querySelector('footer.site-footer')! };
}

/** Nombre accesible calculado del contenido: el texto, con cada imagen sustituida por su alt. */
function accessibleName(link: Element): string {
  const clone = link.cloneNode(true) as Element;
  for (const img of clone.querySelectorAll('img')) img.replaceWith(img.getAttribute('alt') ?? '');
  return (clone.textContent ?? '').replace(/\s+/g, ' ').trim();
}

const CASES = [
  ['birria', null, '/molotes', '/img/molotes/logo-molotes.webp', 'Conoce nuestros Molotes'],
  ['birria', 'molotes', '/molotes', '/img/molotes/logo-molotes.webp', 'Conoce nuestros Molotes'],
  ['birria', 'rest', '/molotes', '/img/molotes/logo-molotes.webp', 'Conoce nuestros Molotes'],
  ['molotes', null, '/birria', '/img/birria/logo-birria.webp', 'Conoce nuestra Birria'],
] as const;

describe('REQ-F-033: navegación cruzada desde el pie', () => {
  it.each(CASES)('%s (aviso %s): un único enlace a %s con el logo del destino', (businessId, notice, href, logoSrc, name) => {
    const { footer } = footerOf(businessId, notice);
    const links = footer.querySelectorAll(`a[href="${href}"]`);
    expect(links).toHaveLength(1);
    const link = links[0]!;

    // CA-1 / CA-2: nombre accesible exacto, solo del contenido (el logo es decorativo).
    expect(accessibleName(link)).toBe(name);
    for (const attribute of ['aria-label', 'aria-labelledby', 'title', 'aria-hidden']) {
      expect(link.hasAttribute(attribute), attribute).toBe(false);
    }

    // R-6: logo oficial, diferido y con dimensiones declaradas.
    const images = link.querySelectorAll('img');
    expect(images).toHaveLength(1);
    const img = images[0]!;
    expect(img.getAttribute('src')).toBe(logoSrc);
    expect(img.getAttribute('alt')).toBe('');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(Number(img.getAttribute('width'))).toBeGreaterThan(0);
    expect(Number(img.getAttribute('height'))).toBeGreaterThan(0);

    // Caso límite: si el logo no carga, el texto visible sigue en el enlace.
    expect((link.querySelector('.cross-link__label')?.textContent ?? '').trim()).toBe(name);

    // CA-3 / CA-6: enlace normal, misma pestaña y sin depender de JavaScript.
    for (const attribute of ['target', 'rel', 'data-action']) {
      expect(link.hasAttribute(attribute), attribute).toBe(false);
    }
  });

  it.each(CASES)('%s (aviso %s): el enlace va en la columna de marca del pie', (businessId, notice) => {
    const { footer } = footerOf(businessId, notice);
    const link = footer.querySelector('a.cross-link')!;
    const grid = footer.querySelector('.grid')!;
    // Primera columna de la cuadrícula del pie.
    expect(grid.firstElementChild!.contains(link)).toBe(true);
  });

  it('/ martes a viernes: el enlace del aviso sigue existiendo fuera del pie (REQ-F-028)', () => {
    const { document, footer } = footerOf('birria', 'molotes');
    const notice = document.querySelector('dialog[data-home-notice="molotes"]')!;
    expect(notice.querySelector('a[href="/molotes"]')).not.toBeNull();
    expect(footer.contains(notice)).toBe(false);
  });
});
