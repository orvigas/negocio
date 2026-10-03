import { describe, expect, it } from 'vitest';

import { DEFAULT_VIEWS_DIR } from '../../src/app.js';
import { BUSINESS_IDS, BUSINESS_PATHS } from '../../src/config/businesses.js';
import { createLandingController } from '../../src/controllers/landing.js';
import { canonicalUrl, renderLandingPage } from '../../src/views/landings/index.js';
import { formatPesos } from '../../src/views/landings/shared.js';
import { createRenderer } from '../../src/views/render.js';
import { makeConfig, seedData } from '../helpers.js';

const renderer = createRenderer({ viewsDir: DEFAULT_VIEWS_DIR });

describe('rutas dedicadas', () => {
  it('cada negocio tiene una ruta propia y distinta', () => {
    expect(Object.keys(BUSINESS_PATHS).sort()).toEqual([...BUSINESS_IDS].sort());
    expect(new Set(Object.values(BUSINESS_PATHS)).size).toBe(BUSINESS_IDS.length);
  });

  it('canonicalUrl es absoluta solo con SITE_URL', () => {
    expect(canonicalUrl(undefined, '/birria')).toBe('/birria');
    expect(canonicalUrl('https://ejemplo.mx', '/birria')).toBe('https://ejemplo.mx/birria');
  });
});

describe('createLandingController', () => {
  it('falla rápido con un negocio fijo desconocido', () => {
    expect(() =>
      createLandingController({
        config: makeConfig(),
        renderer,
        now: () => new Date(),
        repository: { getPublished: async () => ({}) },
        businessId: 'tacos',
      }),
    ).toThrow(/Negocio desconocido/);
  });
});

describe('renderLandingPage', () => {
  it.each(BUSINESS_IDS)('%s: se renderiza sin placeholders pendientes', (businessId) => {
    const html = renderLandingPage({ renderer, config: makeConfig(), businessId, menu: seedData(businessId) }).toString();
    expect(html).toContain(`data-business="${businessId}"`);
    expect(html).not.toMatch(/\{\{|\}\}/);
  });
});

describe('formatPesos', () => {
  it('formatea centavos como en el diseño', () => {
    expect(formatPesos(4500)).toBe('$45');
    expect(formatPesos(150000)).toBe('$1,500');
    expect(formatPesos(4550)).toBe('$45.50');
    expect(formatPesos(0)).toBe('$0');
  });

  it.each([-1, 1.5, Number.NaN, '4500'])('rechaza importes inválidos (%s)', (value) => {
    expect(() => formatPesos(value)).toThrow(/Importe inválido/);
  });
});
