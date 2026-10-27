import { describe, expect, it } from 'vitest';

import { ApiConfigError, loadApiConfig } from '../../src/config.ts';

/** Configuración de la API (REQ-F-038): validada al arrancar, sin repetir valores en los errores. */

const VALID = { NODE_ENV: 'production', DATABASE_URL: 'mysql://restaurante_app:s3cr3t0@mysql:3306/restaurante' };

describe('loadApiConfig', () => {
  it('valores por defecto: 127.0.0.1:3001 y sin tolerar migraciones nuevas', () => {
    expect(loadApiConfig(VALID)).toEqual({
      nodeEnv: 'production',
      host: '127.0.0.1',
      port: 3001,
      allowNewerSchema: false,
      database: { host: 'mysql', port: 3306, user: 'restaurante_app', password: 's3cr3t0', database: 'restaurante' },
    });
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
