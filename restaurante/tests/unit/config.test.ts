import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ConfigError, PROJECT_DIR, loadConfig, type Env } from '../../src/config/env.ts';
import { VALID_ENV } from '../helpers.ts';

function issuesFor(env: Env): string[] {
  try {
    loadConfig(env);
  } catch (err) {
    expect(err).toBeInstanceOf(ConfigError);
    return (err as ConfigError).issues;
  }
  throw new Error('Se esperaba ConfigError');
}

describe('loadConfig', () => {
  it('carga una configuración válida y precalcula los enlaces de WhatsApp', () => {
    const config = loadConfig(VALID_ENV);
    expect(config).toMatchObject({ nodeEnv: 'test', port: 3000, timezone: 'America/Mexico_City' });
    expect(config.whatsapp.molotes.href).toBe(
      'https://wa.me/5210000000001?text=Hola%2C%20quiero%20hacer%20un%20pedido%20de%20molotes',
    );
    expect(config.whatsapp.birria.href).toMatch(/^https:\/\/wa\.me\/5210000000002\?text=/);
    expect(Object.isFrozen(config)).toBe(true);
  });

  it('aplica valores por defecto para NODE_ENV, PORT y BUSINESS_TIMEZONE', () => {
    const config = loadConfig({ WHATSAPP_MOLOTES: '5210000000001', WHATSAPP_BIRRIA: '5210000000002' });
    expect(config).toMatchObject({ nodeEnv: 'development', port: 3000, timezone: 'America/Mexico_City' });
  });

  it('da prioridad a WHATSAPP_*_URL cuando está definida', () => {
    const config = loadConfig({ ...VALID_ENV, WHATSAPP_BIRRIA_URL: 'https://example.com/birria' });
    expect(config.whatsapp.birria.href).toBe('https://example.com/birria');
  });

  it('permite solo la URL sin número', () => {
    const config = loadConfig({ ...VALID_ENV, WHATSAPP_MOLOTES: '', WHATSAPP_MOLOTES_URL: 'https://example.com/m' });
    expect(config.whatsapp.molotes.href).toBe('https://example.com/m');
  });

  it.each(['0', '65536', 'abc', '3000.5', '-1'])('rechaza PORT inválido: %s', (PORT) => {
    expect(issuesFor({ ...VALID_ENV, PORT })).toEqual([expect.stringContaining('PORT')]);
  });

  it('rechaza NODE_ENV desconocido', () => {
    expect(issuesFor({ ...VALID_ENV, NODE_ENV: 'staging' })).toEqual([expect.stringContaining('NODE_ENV')]);
  });

  it('rechaza una zona horaria inválida', () => {
    expect(issuesFor({ ...VALID_ENV, BUSINESS_TIMEZONE: 'Mars/Olympus' })).toEqual([
      expect.stringContaining('BUSINESS_TIMEZONE'),
    ]);
  });

  it('rechaza una URL de WhatsApp no https', () => {
    expect(issuesFor({ ...VALID_ENV, WHATSAPP_MOLOTES_URL: 'http://example.com' })).toEqual([
      expect.stringContaining('WHATSAPP_MOLOTES_URL'),
    ]);
  });

  it('rechaza un número de WhatsApp inválido', () => {
    expect(issuesFor({ ...VALID_ENV, WHATSAPP_BIRRIA: '+52 1 000' })).toEqual([
      expect.stringContaining('WHATSAPP_BIRRIA'),
    ]);
  });

  it('exige URL o número para cada negocio y reporta todos los problemas juntos', () => {
    const issues = issuesFor({ PORT: 'x' });
    expect(issues).toHaveLength(3);
    expect(issues.join('\n')).toMatch(/PORT/);
    expect(issues.join('\n')).toMatch(/WHATSAPP_MOLOTES_URL o WHATSAPP_MOLOTES/);
    expect(issues.join('\n')).toMatch(/WHATSAPP_BIRRIA_URL o WHATSAPP_BIRRIA/);
  });

  it('no incluye los valores recibidos en los mensajes de error', () => {
    const issues = issuesFor({ ...VALID_ENV, WHATSAPP_MOLOTES_URL: 'http://secret-token.example' });
    expect(issues.join('\n')).not.toContain('secret-token');
  });

  it('SITE_URL es opcional y se normaliza sin "/" final', () => {
    expect(loadConfig(VALID_ENV).siteUrl).toBeUndefined();
    expect(loadConfig({ ...VALID_ENV, SITE_URL: 'https://ejemplo.mx/' }).siteUrl).toBe('https://ejemplo.mx');
    expect(loadConfig({ ...VALID_ENV, SITE_URL: 'http://localhost:3000/base/' }).siteUrl).toBe('http://localhost:3000/base');
  });

  it.each(['ftp://ejemplo.mx', 'https://u:p@ejemplo.mx', 'https://ejemplo.mx/?a=1', 'https://ejemplo.mx/#x', 'no-es-url'])(
    'rechaza SITE_URL inválida (%s) sin mostrar el valor',
    (value) => {
      const issues = issuesFor({ ...VALID_ENV, SITE_URL: value });
      expect(issues).toEqual([expect.stringMatching(/^SITE_URL debe ser/)]);
      expect(issues.join()).not.toContain(value);
    },
  );
});

describe('loadConfig: administración y datos (REQ-F-001)', () => {
  const HASH = 'scrypt$16384$8$1$c2FsLXNhbC1zYWwtc2FsLQ$aGFzaGhhc2hoYXNoaGFzaGhhc2hoYXNoaGFzaGhhc2g';

  it('sin credenciales la administración queda deshabilitada y la app arranca (CA-24)', () => {
    const config = loadConfig(VALID_ENV);
    expect(config.admin).toEqual({ enabled: false });
    expect(config.trustProxy).toBe(false);
    // Por defecto, la carpeta data/ del proyecto (sin depender del nombre de la carpeta clonada).
    expect(config.dataDir).toBe(join(PROJECT_DIR, 'data'));
  });

  it('con usuario y hash válidos la administración queda habilitada', () => {
    const config = loadConfig({ ...VALID_ENV, ADMIN_USER: 'dueno', ADMIN_PASSWORD_HASH: HASH });
    expect(config.admin).toEqual({ enabled: true, user: 'dueno', passwordHash: HASH });
  });

  it.each([
    [{ ADMIN_USER: 'dueno' }, /ADMIN_USER y ADMIN_PASSWORD_HASH juntas/],
    [{ ADMIN_PASSWORD_HASH: HASH }, /ADMIN_USER y ADMIN_PASSWORD_HASH juntas/],
    [{ ADMIN_USER: 'dueno', ADMIN_PASSWORD_HASH: 'contraseña-en-claro' }, /ADMIN_PASSWORD_HASH no tiene un formato válido/],
    [{ ADMIN_USER: 'x'.repeat(61), ADMIN_PASSWORD_HASH: HASH }, /ADMIN_USER no puede superar/],
    [{ TRUST_PROXY: 'yes' }, /TRUST_PROXY debe ser true o false/],
    [{ NODE_ENV: 'production' }, /DATA_DIR es obligatoria en producción/],
    [{ NODE_ENV: 'production', DATA_DIR: 'data' }, /DATA_DIR debe ser una ruta absoluta/],
    [{ DATA_DIR: 'src/content' }, /DATA_DIR no puede estar dentro de src\/ ni de public\//],
    [{ DATA_DIR: 'public' }, /DATA_DIR no puede estar dentro de src\/ ni de public\//],
  ])('configuración inválida: %o', (overrides, message) => {
    const issues = issuesFor({ ...VALID_ENV, ...overrides });
    expect(issues.join('\n')).toMatch(message);
  });

  it('los mensajes de error nunca incluyen el hash ni el usuario', () => {
    const issues = issuesFor({ ...VALID_ENV, ADMIN_USER: 'usuario-secreto', ADMIN_PASSWORD_HASH: 'hash-secreto' });
    expect(issues.join('\n')).not.toMatch(/usuario-secreto|hash-secreto/);
  });

  it('acepta TRUST_PROXY=true y DATA_DIR absoluta en producción', () => {
    const config = loadConfig({ ...VALID_ENV, NODE_ENV: 'production', DATA_DIR: '/var/lib/restaurante', TRUST_PROXY: 'true' });
    expect(config).toMatchObject({ dataDir: '/var/lib/restaurante', trustProxy: true, isProduction: true });
  });
});
