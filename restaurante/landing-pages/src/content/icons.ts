import { BUSINESS_IDS, type BusinessId } from '@restaurante/core/shared';

import { BUSINESS_PATHS } from '../config/business-paths.ts';
import { commonContent } from './common/index.ts';
import { getBusinessContent } from './index.ts';

/**
 * Favicons, iconos de pantalla de inicio y manifest de cada negocio (REQ-F-002).
 *
 * Los metadatos (versión, color y nombres) viven en `icons` del contenido de cada negocio;
 * aquí se define una sola vez dónde están los archivos y cómo se publican sus URLs.
 */

/** Archivos generados por scripts/generate-icons.py en public/img/<negocio>/icons/. */
export const ICON_FILES = Object.freeze({
  ico: Object.freeze({ file: 'favicon.ico', type: 'image/x-icon' }),
  png16: Object.freeze({ file: 'icon-16.png', type: 'image/png', size: 16 }),
  png32: Object.freeze({ file: 'icon-32.png', type: 'image/png', size: 32 }),
  appleTouch: Object.freeze({ file: 'apple-touch-icon.png', type: 'image/png', size: 180 }),
  png192: Object.freeze({ file: 'icon-192.png', type: 'image/png', size: 192 }),
  png512: Object.freeze({ file: 'icon-512.png', type: 'image/png', size: 512 }),
  maskable512: Object.freeze({ file: 'icon-maskable-512.png', type: 'image/png', size: 512 }),
});

export type IconKey = keyof typeof ICON_FILES;
type SizedIconKey = Exclude<IconKey, 'ico'>;

/** Tamaños incluidos en cada favicon.ico. */
export const ICO_SIZES = Object.freeze([16, 32, 48]);

/** Ruta del archivo dentro de public/ (sin versión). */
export const iconFilePath = (businessId: BusinessId, key: IconKey): string => `/img/${businessId}/icons/${ICON_FILES[key].file}`;

/** URL del manifest: en la raíz, para que `start_url` quede dentro de su scope por defecto. */
export const manifestPath = (businessId: BusinessId): string => `${BUSINESS_PATHS[businessId]}.webmanifest`;

function iconsContent(businessId: BusinessId) {
  const { icons } = getBusinessContent(businessId);
  if (!Number.isSafeInteger(icons?.version) || icons.version < 1) {
    throw new Error(`icons.version inválida para ${businessId}`);
  }
  if (!/^#[0-9a-f]{6}$/i.test(icons.themeColor ?? '')) throw new Error(`icons.themeColor inválido para ${businessId}`);
  const { name, shortName } = icons.manifest ?? {};
  if (!name?.trim() || !shortName?.trim()) throw new Error(`icons.manifest incompleto para ${businessId}`);
  return icons;
}

/** URLs (versionadas con ?v=) y theme-color que declara el <head> de un negocio. */
export function getIconLinks(businessId: BusinessId) {
  const { version, themeColor } = iconsContent(businessId);
  const url = (key: IconKey): string => `${iconFilePath(businessId, key)}?v=${version}`;
  return Object.freeze({
    ico: url('ico'),
    png16: url('png16'),
    png32: url('png32'),
    appleTouch: url('appleTouch'),
    manifest: manifestPath(businessId),
    themeColor,
  });
}

/**
 * Web App Manifest del negocio (RF-3). Se abre en el navegador (`display: browser`),
 * siempre en la URL fija del negocio.
 */
export function buildManifest(businessId: BusinessId) {
  const { version, themeColor, manifest } = iconsContent(businessId);
  const icon = (key: SizedIconKey, purpose?: string) => {
    const { size, type } = ICON_FILES[key];
    return { src: `${iconFilePath(businessId, key)}?v=${version}`, sizes: `${size}x${size}`, type, ...(purpose && { purpose }) };
  };
  return {
    name: manifest.name,
    short_name: manifest.shortName,
    start_url: BUSINESS_PATHS[businessId],
    display: 'browser',
    lang: commonContent.lang,
    theme_color: themeColor,
    background_color: themeColor,
    icons: [icon('png192'), icon('png512'), icon('maskable512', 'maskable')],
  };
}

// Fallo rápido al cargar el módulo si el contenido de algún negocio está incompleto.
for (const businessId of BUSINESS_IDS) buildManifest(businessId);
