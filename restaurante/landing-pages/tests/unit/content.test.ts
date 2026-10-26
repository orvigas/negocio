import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { BUSINESS_IDS, type BusinessId } from '@restaurante/core/shared';
import {
  validateMenuDocument,
  type BirriaChip,
  type BirriaVariant,
  type MenuDocument,
} from '@restaurante/core/catalog';

import { DEFAULT_PUBLIC_DIR } from '../../src/app.ts';
import type { ImageDescriptor } from '../../src/content/images.ts';
import { commonContent, getBusinessContent } from '../../src/content/index.ts';
import { loadSeedDocument } from '../../src/content/seeds.ts';
import { isHttpsUrl } from '../../src/services/whatsapp.ts';

// Diseño fuente en la raíz del repositorio (landing-pages/tests/unit → cuatro niveles; REQ-F-036).
const STITCH = join(import.meta.dirname, '..', '..', '..', '..', '_stich_source_');
const DESIGN_SOURCES = Object.freeze({
  molotes: 'moloteando_aut_nticos_molotes_artesanales',
  birria: 'birrier_a_el_mu_eco_aut_ntica_birria_de_res_color_adobo',
});

/** Texto visible del code.html del diseño (sin etiquetas y con entidades básicas resueltas). */
/** Vista común de los tres tipos de producto de Birria (los campos propios de cada tipo, opcionales). */
interface AnyBirriaItem {
  name: string;
  tag: string;
  detailsLabel: string;
  description?: string;
  chips?: BirriaChip[];
  portion?: string;
  portionExtra?: string;
  variants?: BirriaVariant[];
}

/** Semilla versionada con su tipo; la prueba "cumple el esquema" la valida. */
const seedOf = <Id extends BusinessId>(businessId: Id) => loadSeedDocument(businessId) as MenuDocument<Id>;

function designText(businessId: BusinessId) {
  const file = join(STITCH, DESIGN_SOURCES[businessId], 'code.html');
  return readFileSync(file, 'utf8')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ');
}

const pesosText = (cents: number) => `$${cents / 100}`;

function imagesOf(businessId: BusinessId) {
  const images: Readonly<Record<string, ImageDescriptor>> = getBusinessContent(businessId).images;
  return Object.entries(images);
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

  it('REQ-F-031 (R-15) y REQ-F-032 (R-3): la ubicación de la única sucursal es común, en www.google.com y con sus coordenadas oficiales', () => {
    const { location } = commonContent;
    const maps = new URL(location.mapsUrl);
    const embed = new URL(location.embedSrc);
    for (const url of [maps, embed]) {
      expect(url.protocol).toBe('https:');
      expect(url.hostname).toBe('www.google.com');
    }
    expect(maps.pathname).toBe('/maps/search/');
    expect(maps.searchParams.get('api')).toBe('1');
    expect(maps.searchParams.get('query')).toBe('18.81823603166285,-98.96914471124853');
    expect(embed.pathname).toBe('/maps/embed');
    expect(embed.searchParams.get('pb')).toContain('!1d18.81823603166285!2d-98.96914471124853');
    // Ningún negocio guarda una copia propia de la ubicación (RN-3).
    for (const businessId of BUSINESS_IDS) expect(getBusinessContent(businessId)).not.toHaveProperty('location');
    expect(getBusinessContent('molotes').service.mapTitle).toBe('Ubicación de Moloteando en Google Maps');
    expect(getBusinessContent('birria').locations.branches.mapTitle).toBe('Ubicación de Birria El Muñeco en Google Maps');
  });

  it('REQ-F-032 (R-6): el teléfono y el correo comunes enlazan al mismo dato que muestran', () => {
    const { phone, email } = commonContent.contact;
    expect(phone).toEqual({ label: '+52 735 278 2306', href: 'tel:+527352782306' });
    expect(phone.href.replace(/\D/g, '')).toBe(phone.label.replace(/\D/g, ''));
    expect(email).toEqual({ label: 'ordenes@birriaelmuneco.mx', href: 'mailto:ordenes@birriaelmuneco.mx' });
    expect(email.href).toBe(`mailto:${email.label}`);
    for (const businessId of BUSINESS_IDS) {
      expect(Object.keys(getBusinessContent(businessId).footer.contact)).toEqual(['title']);
    }
  });

  it.each(BUSINESS_IDS)('REQ-F-033: el enlace del pie de %s apunta al otro negocio y tiene texto', (businessId) => {
    const { crossLink } = getBusinessContent(businessId).footer;
    expect(BUSINESS_IDS).toContain(crossLink.business);
    expect(crossLink.business).not.toBe(businessId);
    expect(crossLink.label.trim()).not.toBe('');
  });

  it.each(BUSINESS_IDS)('%s: la semilla cumple el esquema editable', (businessId) => {
    const seed = seedOf(businessId);
    expect(validateMenuDocument(businessId, seed, seed.data)).toEqual([]);
    expect(seed).toMatchObject({ schemaVersion: 1, business: businessId, revision: 0, updatedAt: null, updatedBy: null });
  });

  it.each(BUSINESS_IDS)('%s: las fotos del menú de la semilla existen en public/ con alt y medidas', (businessId) => {
    for (const item of seedOf(businessId).data.menu.items) {
      expect(existsSync(join(DEFAULT_PUBLIC_DIR, item.image.src)), item.image.src).toBe(true);
      expect(item.image.alt.trim(), item.name).not.toBe('');
      expect(Number.isInteger(item.image.width) && item.image.width > 0).toBe(true);
      expect(Number.isInteger(item.image.height) && item.image.height > 0).toBe(true);
    }
  });

  // CA-39: la prueba de contenido contra el diseño fuente se aplica a la semilla, no a los datos vivos.
  // REQ-F-031 (R-23): los textos comerciales de la promoción prevalecen sobre el diseño (el diseño
  // anunciaba un 2x1 que no existe); el resto de la semilla sigue comparándose con él.
  it('molotes: la semilla (platillos, bebidas, hero y texto destacado) coincide con el diseño fuente; la promoción lleva los textos de REQ-F-031', () => {
    const design = designText('molotes');
    const { menu, drinks, hero, promo } = seedOf('molotes').data;
    for (const text of [menu.highlight, hero.showcase.tag, hero.showcase.title, hero.showcase.description, hero.showcase.unit]) {
      expect(design, text).toContain(text);
    }
    expect(design).toContain(`${pesosText(hero.showcase.priceCents)} MXN`);
    expect(promo).toEqual({
      badge: 'Promociones',
      title: 'Promociones de Molotes',
      description: 'Pregunta por la promoción vigente al hacer tu pedido por WhatsApp. Déjanos tus datos y no te pierdas nuestras novedades.',
    });
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

  it('birria: la semilla (platillos, chips, porción, variantes, hero y club) coincide con el diseño fuente', () => {
    const design = designText('birria');
    const { menu, hero, promo } = seedOf('birria').data;
    const items: AnyBirriaItem[] = menu.items;
    for (const text of [hero.showcase.title, hero.showcase.description, ...Object.values(promo)]) {
      expect(design, text).toContain(text);
    }
    expect(design).toContain(`${pesosText(hero.showcase.priceCents)} MXN`);
    expect(items).toHaveLength(6);
    for (const item of items) {
      for (const text of [item.name, item.tag, item.detailsLabel]) expect(design, text).toContain(text);
      if (item.description) expect(design, item.description).toContain(item.description);
      for (const chip of item.chips ?? []) expect(design).toContain(chip.text);
      for (const text of [item.portion, item.portionExtra].filter(Boolean)) expect(design).toContain(text);
      for (const variant of item.variants ?? []) {
        expect(design).toContain(`${variant.label} (${pesosText(variant.priceCents)})`);
      }
      // Con variantes, el precio y la descripción de la tarjeta salen de la variante activa (RF-2).
      if (item.variants) {
        expect(item).not.toHaveProperty('priceCents');
        expect(item).not.toHaveProperty('description');
        // El diseño muestra al cargar la descripción de la primera variante.
        expect(design, item.variants[0]!.description).toContain(item.variants[0]!.description);
      }
    }
  });

  it('lanza error con un negocio desconocido', () => {
    // @ts-expect-error: negocio desconocido, a propósito.
    expect(() => getBusinessContent('tacos')).toThrow(/No hay contenido/);
  });
});
