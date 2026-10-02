// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { DEFAULT_PUBLIC_DIR, DEFAULT_VIEWS_DIR } from '../../src/app.js';
import { renderLandingPage } from '../../src/views/landings/index.js';
import { createRenderer } from '../../src/views/render.js';
import { initPromoForms } from '../../public/js/modules/promo-form.js';
import { initVariantSelectors } from '../../public/js/modules/variant-selector.js';
import { makeConfig } from '../helpers.js';

/** Integra los módulos de public/js con el marcado real de cada landing. */
const renderer = createRenderer({ viewsDir: DEFAULT_VIEWS_DIR });

async function mount(businessId) {
  const html = renderLandingPage({ renderer, config: makeConfig(), businessId }).toString();
  document.documentElement.innerHTML = new DOMParser().parseFromString(html, 'text/html').documentElement.innerHTML;
}

describe('módulos JS sobre el HTML renderizado', () => {
  let dispose;

  afterEach(() => dispose?.());

  it('birria: el selector de variantes actualiza precio, descripción y aria-pressed', async () => {
    await mount('birria');
    dispose = initVariantSelectors(document);

    const options = [...document.querySelectorAll('#card-birriamen [data-variant]')];
    const chica = options.find((button) => button.textContent.includes('Chica'));
    chica.click();

    expect(document.getElementById('price-birriamen').textContent).toBe('$110 MXN');
    expect(document.getElementById('desc-birriamen').textContent).toMatch(/^Porción individual/);
    expect(options.map((button) => button.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
  });

  it('birria: el formulario del club muestra el mensaje de estado', async () => {
    await mount('birria');
    dispose = initPromoForms(document);
    document.getElementById('promo-contact').value = 'ana@ejemplo.mx';
    document.querySelector('[data-promo-form]').requestSubmit();
    expect(document.getElementById('promo-status').hidden).toBe(false);
  });

  it('molotes: el formulario se oculta y muestra el éxito; inválido no avanza', async () => {
    await mount('molotes');
    dispose = initPromoForms(document);
    const form = document.getElementById('promo-form');

    form.requestSubmit();
    expect(document.getElementById('promo-success').hidden).toBe(true);

    document.getElementById('subscriber-name').value = 'Ana';
    document.getElementById('subscriber-email').value = 'ana@ejemplo.mx';
    form.requestSubmit();
    expect(form.hidden).toBe(true);
    expect(document.getElementById('promo-success').hidden).toBe(false);
  });
});

describe('navegación por anclas internas', () => {
  it.each(['molotes', 'birria'])('%s: cada href="#id" apunta a un destino existente y enfocable', async (businessId) => {
    await mount(businessId);
    const hrefs = [...new Set([...document.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute('href')))];

    expect(hrefs.length).toBeGreaterThan(1);
    for (const href of hrefs) {
      const target = document.getElementById(decodeURIComponent(href.slice(1)));
      expect(target, `${businessId}: falta el destino de ${href}`).not.toBeNull();
      // Al seguir el ancla, el navegador mueve el foco al destino solo si es enfocable.
      expect(target.tabIndex, `${businessId}: ${href} no es enfocable`).toBe(-1);
    }
  });

  it.each(['molotes', 'birria'])(
    '%s: el CSS publicado anima el scroll solo sin reduced-motion y compensa el header fijo',
    (businessId) => {
      const css = readFileSync(join(DEFAULT_PUBLIC_DIR, 'css', businessId, 'main.css'), 'utf8');
      const smooth = [...css.matchAll(/scroll-behavior:\s*smooth/g)];

      expect(smooth).toHaveLength(1);
      expect(css.slice(0, smooth[0].index)).toMatch(/@media\s*\(prefers-reduced-motion:\s*no-preference\)\s*\{\s*html\s*\{\s*$/);
      expect(css).toMatch(/scroll-padding-top:\s*var\(--landing-header-height/);
      expect(css).toMatch(/--landing-header-height:\s*[1-9][\d.]*rem/);
    },
  );
});
