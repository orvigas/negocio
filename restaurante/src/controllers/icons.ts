import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Context, Middleware } from 'koa';

import { BUSINESS_IDS, isBusinessId, type BusinessId } from '../config/businesses.ts';
import type { Config } from '../config/env.ts';
import { ICON_FILES, buildManifest, iconFilePath, type IconKey } from '../content/icons.ts';
import { getActiveBusinessId } from '../services/business-schedule.ts';

interface CachedAsset {
  readonly body: Buffer;
  readonly type: string;
  readonly etag: string;
}

interface BusinessIconAssets {
  readonly ico: CachedAsset;
  readonly appleTouch: CachedAsset;
  readonly manifest: CachedAsset;
}

// favicon y appleTouchIcon son propiedades función (no métodos): el router los recibe sueltos, sin `this`.
export interface IconsController {
  favicon: (ctx: Context) => void;
  appleTouchIcon: (ctx: Context) => void;
  manifest(businessId: BusinessId): Middleware;
}

/** Recurso en memoria con ETag fuerte calculado de su contenido. */
function cachedAsset(body: Buffer, type: string): CachedAsset {
  const etag = `"${createHash('sha256').update(body).digest('base64url').slice(0, 27)}"`;
  return Object.freeze({ body, type, etag });
}

/**
 * Responde un recurso que obliga a revalidar en cada uso (RF-6): `no-cache` + ETag,
 * con 304 si el navegador ya tiene esa misma versión.
 */
function sendRevalidated(ctx: Context, asset: CachedAsset): void {
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
 */
export function createIconsController({
  config,
  now,
  publicDir,
}: {
  config: Pick<Config, 'timezone'>;
  now: () => Date;
  publicDir: string;
}): IconsController {
  if (typeof publicDir !== 'string') throw new TypeError('createIconsController requiere publicDir');

  const read = (businessId: BusinessId, key: IconKey): Buffer => {
    const path = join(publicDir, iconFilePath(businessId, key));
    try {
      return readFileSync(path);
    } catch (err) {
      throw new Error(`Falta el icono ${iconFilePath(businessId, key)} (genéralo con scripts/generate-icons.py)`, { cause: err });
    }
  };

  // `fromEntries` pierde las claves; el objeto se construye con todos los BUSINESS_IDS.
  const assets = Object.fromEntries(
    BUSINESS_IDS.map((businessId) => [
      businessId,
      Object.freeze({
        ico: cachedAsset(read(businessId, 'ico'), ICON_FILES.ico.type),
        appleTouch: cachedAsset(read(businessId, 'appleTouch'), ICON_FILES.appleTouch.type),
        manifest: cachedAsset(Buffer.from(JSON.stringify(buildManifest(businessId))), 'application/manifest+json'),
      }),
    ]),
  ) as Record<BusinessId, BusinessIconAssets>;

  const activeAssets = () => assets[getActiveBusinessId({ now: now(), timeZone: config.timezone })];

  return Object.freeze<IconsController>({
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
      if (!isBusinessId(businessId)) throw new TypeError(`Negocio desconocido: ${String(businessId)}`);
      return (ctx) => sendRevalidated(ctx, assets[businessId].manifest);
    },
  });
}
