import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { DEFAULT_PUBLIC_DIR } from '../../src/app.js';
import { BUSINESS_IDS } from '../../src/config/businesses.js';
import { commonContent, getBusinessContent } from '../../src/content/index.js';
import { isHttpsUrl } from '../../src/services/whatsapp.js';

const STITCH = join(import.meta.dirname, '..', '..', '..', '_stich_source_');
const DESIGN_SOURCES = Object.freeze({
  molotes: 'moloteando_aut_nticos_molotes_artesanales',
  birria: 'birrier_a_el_mu_eco_aut_ntica_birria_de_res_color_adobo',
});

/** Texto visible del code.html del diseño (sin etiquetas y con entidades básicas resueltas). */
function designText(businessId) {
  const file = join(STITCH, DESIGN_SOURCES[businessId], 'code.html');
  return readFileSync(file, 'utf8')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ');
}

const pesosText = (cents) => `$${cents / 100}`;

function imagesOf(businessId) {
  return Object.entries(getBusinessContent(businessId).images);
}

describe('contenido por negocio', () => {
  it.each(BUSINESS_IDS)('%s: las imágenes referenciadas existen en public/ y en su directorio', (businessId) => {
    for (const [key, img] of imagesOf(businessId)) {
      expect(img.src, key).toMatch(new RegExp(`^/img/${businessId}/[a-z0-9-]+\\.(jpg|png|webp)$`));
      expect(existsSync(join(DEFAULT_PUBLIC_DIR, img.src)), img.src).toBe(true);
      expect(typeof img.alt, key).toBe('string');
      expect(img.width).toBeGreaterThan(0);
      expect(img.height).toBeGreaterThan(0);
    }
  });

  it('las imágenes comunes existen en public/img/common/', () => {
    for (const img of Object.values(commonContent.images)) {
      expect(img.src).toMatch(/^\/img\/common\//);
      expect(existsSync(join(DEFAULT_PUBLIC_DIR, img.src)), img.src).toBe(true);
    }
  });

  it.each(BUSINESS_IDS)('%s: tiene entrada JS propia y hoja de fuentes https', (businessId) => {
    expect(existsSync(join(DEFAULT_PUBLIC_DIR, 'js', businessId, 'main.js'))).toBe(true);
    expect(isHttpsUrl(getBusinessContent(businessId).assets.fontsHref)).toBe(true);
  });

  it('la ubicación compartida es un enlace https de Google Maps', () => {
    expect(isHttpsUrl(commonContent.location.mapsUrl)).toBe(true);
    expect(new URL(commonContent.location.mapsUrl).hostname).toBe('maps.app.goo.gl');
  });

  it.each(BUSINESS_IDS)('%s: las fotos del menú existen en public/ con alt y medidas', (businessId) => {
    for (const item of getBusinessContent(businessId).menu.items) {
      expect(existsSync(join(DEFAULT_PUBLIC_DIR, item.image.src)), item.image.src).toBe(true);
      expect(item.image.alt.trim(), item.name).not.toBe('');
      expect(Number.isInteger(item.image.width) && item.image.width > 0).toBe(true);
      expect(Number.isInteger(item.image.height) && item.image.height > 0).toBe(true);
    }
  });

  it('molotes: platillos y bebidas coinciden con el diseño fuente', () => {
    const design = designText('molotes');
    const { menu, drinks } = getBusinessContent('molotes');
    expect(menu.items).toHaveLength(8);
    for (const item of menu.items) {
      for (const text of [item.name, item.badge, item.description]) expect(design, text).toContain(text);
      expect(design).toContain(`${pesosText(item.unitPriceCents)} c/u`);
      expect(design).toContain(`${pesosText(item.orderPriceCents)} orden de ${item.orderQuantity}`);
    }
    expect(drinks.items).toHaveLength(2);
    for (const drink of drinks.items) {
      for (const text of [drink.icon, drink.name, drink.description]) expect(design, text).toContain(text);
      expect(design).toContain(`${pesosText(drink.priceCents)} MXN`);
    }
  });

  it('birria: platillos, chips, porción y variantes coinciden con el diseño fuente', () => {
    const design = designText('birria');
    const { items } = getBusinessContent('birria').menu;
    expect(items).toHaveLength(6);
    for (const item of items) {
      for (const text of [item.name, item.tag, item.description, item.detailsLabel]) expect(design, text).toContain(text);
      for (const chip of item.chips ?? []) expect(design).toContain(chip.text);
      for (const text of [item.portion, item.portionExtra].filter(Boolean)) expect(design).toContain(text);
      for (const variant of item.variants ?? []) {
        expect(design).toContain(`${variant.label} (${pesosText(variant.priceCents)})`);
      }
      if (item.variants) {
        expect(item.variants[0]).toMatchObject({ priceCents: item.priceCents, description: item.description });
      }
    }
  });

  it('lanza error con un negocio desconocido', () => {
    expect(() => getBusinessContent('tacos')).toThrow(/No hay contenido/);
  });
});
