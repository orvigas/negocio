import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { DEFAULT_PUBLIC_DIR } from '../../src/app.js';
import { BUSINESS_IDS } from '../../src/config/businesses.js';
import { ICON_FILES, ICO_SIZES, buildManifest, getIconLinks, iconFilePath } from '../../src/content/icons.js';
import { getBusinessContent } from '../../src/content/index.js';
import { hexToRgb, readIcoSizes, readPng } from '../support/png.js';

const OTHER = { molotes: 'birria', birria: 'molotes' };
const COLORS = { molotes: '#03132b', birria: '#290808' };
const readIcon = (businessId, key) => readFileSync(join(DEFAULT_PUBLIC_DIR, iconFilePath(businessId, key)));

describe('enlaces de iconos por negocio (RF-2, RF-4, RF-8)', () => {
  it.each(BUSINESS_IDS)('%s: URLs propias, versionadas y su theme-color', (businessId) => {
    const { version } = getBusinessContent(businessId).icons;
    const links = getIconLinks(businessId);

    expect(links).toEqual({
      ico: `/img/${businessId}/icons/favicon.ico?v=${version}`,
      png16: `/img/${businessId}/icons/icon-16.png?v=${version}`,
      png32: `/img/${businessId}/icons/icon-32.png?v=${version}`,
      appleTouch: `/img/${businessId}/icons/apple-touch-icon.png?v=${version}`,
      manifest: `/${businessId}.webmanifest`,
      themeColor: COLORS[businessId],
    });
    expect(JSON.stringify(links)).not.toContain(OTHER[businessId]);
  });
});

describe('manifest por negocio (RF-3, CA-6)', () => {
  const icons = (businessId) => {
    const v = getBusinessContent(businessId).icons.version;
    return [
      { src: `/img/${businessId}/icons/icon-192.png?v=${v}`, sizes: '192x192', type: 'image/png' },
      { src: `/img/${businessId}/icons/icon-512.png?v=${v}`, sizes: '512x512', type: 'image/png' },
      { src: `/img/${businessId}/icons/icon-maskable-512.png?v=${v}`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ];
  };

  it('Molotes: "Moloteando", abre /molotes en el navegador', () => {
    expect(buildManifest('molotes')).toStrictEqual({
      name: 'Moloteando',
      short_name: 'Moloteando',
      start_url: '/molotes',
      display: 'browser',
      lang: 'es-MX',
      theme_color: '#03132b',
      background_color: '#03132b',
      icons: icons('molotes'),
    });
  });

  it('Birria: "Birria El Muñeco" / "El Muñeco", abre /birria en el navegador', () => {
    expect(buildManifest('birria')).toStrictEqual({
      name: 'Birria El Muñeco',
      short_name: 'El Muñeco',
      start_url: '/birria',
      display: 'browser',
      lang: 'es-MX',
      theme_color: '#290808',
      background_color: '#290808',
      icons: icons('birria'),
    });
  });
});

describe('archivos de iconos (RF-1, CA-4, CA-5)', () => {
  const pngKeys = Object.keys(ICON_FILES).filter((key) => ICON_FILES[key].type === 'image/png');

  it.each(BUSINESS_IDS)('%s: cada PNG mide lo que declara', (businessId) => {
    for (const key of pngKeys) {
      const { width, height } = readPng(readIcon(businessId, key));
      expect({ key, width, height }).toEqual({ key, width: ICON_FILES[key].size, height: ICON_FILES[key].size });
    }
  });

  it.each(BUSINESS_IDS)('%s: el .ico contiene 16, 32 y 48 px', (businessId) => {
    const sizes = readIcoSizes(readIcon(businessId, 'ico'));
    expect(sizes).toEqual(ICO_SIZES.map((size) => ({ width: size, height: size })));
  });

  // apple-touch y maskable deben ser opacos (CA-5); los pequeños son la mascota en un
  // círculo sobre el color del negocio, también opacos. La esquina muestra el fondo.
  it.each(BUSINESS_IDS)('%s: los iconos opacos no tienen transparencia y su fondo es el color del negocio', (businessId) => {
    for (const key of ['png16', 'png32', 'appleTouch', 'maskable512']) {
      const png = readPng(readIcon(businessId, key));
      expect({ key, transparent: png.hasTransparency }).toEqual({ key, transparent: false });
      const [r, g, b] = png.firstPixel;
      const [er, eg, eb] = hexToRgb(COLORS[businessId]);
      // Tolerancia por la paleta de 256 colores con la que se optimizan los iconos grandes.
      expect(Math.max(Math.abs(r - er), Math.abs(g - eg), Math.abs(b - eb)), key).toBeLessThanOrEqual(3);
    }
  });

  it('los iconos de la raíz no existen como archivos estáticos (koa-static los serviría con caché larga)', () => {
    for (const file of ['favicon.ico', 'apple-touch-icon.png', 'apple-touch-icon-precomposed.png']) {
      expect(existsSync(join(DEFAULT_PUBLIC_DIR, file)), file).toBe(false);
    }
  });
});
