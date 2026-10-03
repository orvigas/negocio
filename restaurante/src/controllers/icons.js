import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { BUSINESS_IDS } from '../config/businesses.js';
import { ICON_FILES, buildManifest, iconFilePath } from '../content/icons.js';
import { getActiveBusinessId } from '../services/business-schedule.js';

/**
 * Recurso en memoria con ETag fuerte calculado de su contenido.
 * @param {Buffer} body
 * @param {string} type
 */
function cachedAsset(body, type) {
  const etag = `"${createHash('sha256').update(body).digest('base64url').slice(0, 27)}"`;
  return Object.freeze({ body, type, etag });
}

/**
 * Responde un recurso que obliga a revalidar en cada uso (RF-6): `no-cache` + ETag,
 * con 304 si el navegador ya tiene esa misma versión.
 */
function sendRevalidated(ctx, asset) {
  ctx.set('Cache-Control', 'no-cache');
  ctx.set('ETag', asset.etag);
  ctx.status = 200;
  if (ctx.fresh) {
    ctx.status = 304;
    return;
  }
  ctx.type = asset.type;
  ctx.body = asset.body;
}

/**
 * Iconos de la raíz que siguen al negocio activo del día (RF-5) y manifests por negocio (RF-3).
 * Los archivos se leen una sola vez al construir la app: falla rápido si falta alguno y no
 * hay E/S por petición.
 *
 * @param {{ config: { timezone: string }, now: () => Date, publicDir: string }} deps
 */
export function createIconsController({ config, now, publicDir }) {
  if (typeof publicDir !== 'string') throw new TypeError('createIconsController requiere publicDir');

  const read = (businessId, key) => {
    const path = join(publicDir, iconFilePath(businessId, key));
    try {
      return readFileSync(path);
    } catch (err) {
      throw new Error(`Falta el icono ${iconFilePath(businessId, key)} (genéralo con scripts/generate-icons.py)`, { cause: err });
    }
  };

  const assets = Object.fromEntries(
    BUSINESS_IDS.map((businessId) => [
      businessId,
      Object.freeze({
        ico: cachedAsset(read(businessId, 'ico'), ICON_FILES.ico.type),
        appleTouch: cachedAsset(read(businessId, 'appleTouch'), ICON_FILES.appleTouch.type),
        manifest: cachedAsset(Buffer.from(JSON.stringify(buildManifest(businessId))), 'application/manifest+json'),
      }),
    ]),
  );

  const activeAssets = () => assets[getActiveBusinessId({ now: now(), timeZone: config.timezone })];

  return Object.freeze({
    /** GET /favicon.ico */
    favicon(ctx) {
      sendRevalidated(ctx, activeAssets().ico);
    },
    /** GET /apple-touch-icon.png y /apple-touch-icon-precomposed.png */
    appleTouchIcon(ctx) {
      sendRevalidated(ctx, activeAssets().appleTouch);
    },
    /** Manejador de GET /<negocio>.webmanifest */
    manifest(businessId) {
      if (!BUSINESS_IDS.includes(businessId)) throw new TypeError(`Negocio desconocido: ${businessId}`);
      return (ctx) => sendRevalidated(ctx, assets[businessId].manifest);
    },
  });
}
