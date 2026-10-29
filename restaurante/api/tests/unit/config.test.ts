import { readdirSync } from 'node:fs';
import { join, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

import { API_DEFAULTS, ApiConfigError, loadApiConfig } from '../../src/config.ts';

/** Configuración de la API (REQ-F-038 y REQ-F-039): validada al arrancar, sin repetir valores en los errores. */

const TOKEN = 'a'.repeat(64);
const VALID = {
  NODE_ENV: 'production',
  DATABASE_URL: 'mysql://restaurante_app:s3cr3t0@mysql:3306/restaurante',
  LANDING_INTERNAL_URL: 'http://app:3002',
  INTERNAL_NOTIFY_TOKEN: TOKEN,
};

describe('loadApiConfig', () => {
  it('valores por defecto: 127.0.0.1:3001 y sin tolerar migraciones nuevas', () => {
    expect(loadApiConfig(VALID)).toEqual({
      nodeEnv: 'production',
      host: '127.0.0.1',
      port: 3001,
      allowNewerSchema: false,
      database: { host: 'mysql', port: 3306, user: 'restaurante_app', password: 's3cr3t0', database: 'restaurante' },
      timezone: 'America/Mexico_City',
      productImagesDir: API_DEFAULTS.PRODUCT_IMAGES_DIR,
      landingNotify: { url: 'http://app:3002', token: TOKEN },
    });
  });

  it('la carpeta de imágenes por defecto es la de las landings y tiene imágenes (REQ-F-039, RF-11)', () => {
    expect(API_DEFAULTS.PRODUCT_IMAGES_DIR.endsWith(`landing-pages${sep}public`)).toBe(true);
    expect(readdirSync(join(API_DEFAULTS.PRODUCT_IMAGES_DIR, 'img', 'molotes')).some((file) => file.endsWith('.jpg'))).toBe(true);
  });

  it('fuera de producción el aviso interno es opcional (sin él, null)', () => {
    const env = { ...VALID, NODE_ENV: 'development', LANDING_INTERNAL_URL: undefined, INTERNAL_NOTIFY_TOKEN: undefined };
    expect(loadApiConfig(env).landingNotify).toBeNull();
  });

  it('acepta HOST, PORT y DATABASE_ALLOW_NEWER_SCHEMA', () => {
    expect(loadApiConfig({ ...VALID, HOST: '0.0.0.0', PORT: '3101', DATABASE_ALLOW_NEWER_SCHEMA: 'true' })).toMatchObject({ host: '0.0.0.0', port: 3101, allowNewerSchema: true });
  });

  it.each([
    [{ NODE_ENV: undefined }, 'NODE_ENV'],
    [{ NODE_ENV: 'staging' }, 'NODE_ENV'],
    [{ HOST: 'localhost' }, 'HOST'],
    [{ PORT: '70000' }, 'PORT'],
    [{ PORT: 'abc' }, 'PORT'],
    [{ DATABASE_URL: undefined }, 'DATABASE_URL'],
    [{ DATABASE_URL: 'postgres://u:s3cr3t0@h/db' }, 'DATABASE_URL'],
    [{ DATABASE_ALLOW_NEWER_SCHEMA: 'yes' }, 'DATABASE_ALLOW_NEWER_SCHEMA'],
    [{ BUSINESS_TIMEZONE: 'Marte/Olympus' }, 'BUSINESS_TIMEZONE'],
    [{ LANDING_INTERNAL_URL: 'ftp://app:3002' }, 'LANDING_INTERNAL_URL'],
    [{ LANDING_INTERNAL_URL: 'http://usuario:clave@app:3002' }, 'LANDING_INTERNAL_URL'],
    [{ LANDING_INTERNAL_URL: 'http://app:3002/ruta' }, 'LANDING_INTERNAL_URL'],
    [{ INTERNAL_NOTIFY_TOKEN: 'corto-s3cr3t0' }, 'INTERNAL_NOTIFY_TOKEN'],
    [{ INTERNAL_NOTIFY_TOKEN: undefined }, 'INTERNAL_NOTIFY_TOKEN'],
    [{ LANDING_INTERNAL_URL: undefined }, 'LANDING_INTERNAL_URL'],
    [{ LANDING_INTERNAL_URL: undefined, INTERNAL_NOTIFY_TOKEN: undefined }, 'En producción, LANDING_INTERNAL_URL'],
  ])('rechaza %j sin repetir el valor', (override, name) => {
    let error: unknown;
    try {
      loadApiConfig({ ...VALID, ...override });
    } catch (err) {
      error = err;
    }
    expect(error).toBeInstanceOf(ApiConfigError);
    const { message } = error as ApiConfigError;
    expect(message).toContain(name);
    expect(message).not.toContain('s3cr3t0');
  });
});
