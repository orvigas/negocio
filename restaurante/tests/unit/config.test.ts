import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ConfigError, PROJECT_DIR, loadConfig, type Env } from '../../src/config/env.ts';
import { BOT_ENV, VALID_ENV } from '../helpers.ts';

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

  it('sin credenciales no hay primer administrador y la app arranca (CA-24; REQ-F-007 R-4)', () => {
    const config = loadConfig(VALID_ENV);
    expect(config.adminBootstrap).toBeNull();
    expect(config.trustProxy).toBe(false);
    // Por defecto, la carpeta data/ del proyecto (sin depender del nombre de la carpeta clonada).
    expect(config.dataDir).toBe(join(PROJECT_DIR, 'data'));
  });

  it('con usuario y hash válidos queda la credencial del primer administrador (REQ-F-007 D-4)', () => {
    const config = loadConfig({ ...VALID_ENV, ADMIN_USER: ' Dueño ', ADMIN_PASSWORD_HASH: HASH });
    // El usuario se recorta (como en el acceso) y conserva mayúsculas.
    expect(config.adminBootstrap).toEqual({ user: 'Dueño', passwordHash: HASH });
  });

  it.each([
    [{ ADMIN_USER: 'dueno' }, /ADMIN_USER y ADMIN_PASSWORD_HASH juntas/],
    [{ ADMIN_PASSWORD_HASH: HASH }, /ADMIN_USER y ADMIN_PASSWORD_HASH juntas/],
    [{ ADMIN_USER: 'dueno', ADMIN_PASSWORD_HASH: 'contraseña-en-claro' }, /ADMIN_PASSWORD_HASH no tiene un formato válido/],
    [{ ADMIN_USER: 'x'.repeat(61), ADMIN_PASSWORD_HASH: HASH }, /ADMIN_USER no es un usuario válido/],
    [{ ADMIN_USER: 'due\u0007no', ADMIN_PASSWORD_HASH: HASH }, /ADMIN_USER no es un usuario válido/],
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

describe('loadConfig: bot de WhatsApp (REQ-F-009, RF-2, CA-4)', () => {
  const SECRETS = [BOT_ENV.WHATSAPP_BOT_ACCESS_TOKEN, BOT_ENV.WHATSAPP_BOT_APP_SECRET, BOT_ENV.WHATSAPP_BOT_VERIFY_TOKEN];

  it('sin ninguna variable del bot queda deshabilitado (null)', () => {
    expect(loadConfig(VALID_ENV).whatsappBot).toBeNull();
  });

  it('con todas las obligatorias queda habilitado con los valores por defecto', () => {
    const { whatsappBot } = loadConfig({ ...VALID_ENV, ...BOT_ENV });
    expect(whatsappBot).toEqual({
      accessToken: BOT_ENV.WHATSAPP_BOT_ACCESS_TOKEN,
      phoneNumberId: '106540352242922',
      appSecret: BOT_ENV.WHATSAPP_BOT_APP_SECRET,
      verifyToken: BOT_ENV.WHATSAPP_BOT_VERIFY_TOKEN,
      staff: { molotes: '5215511110001', birria: '5215522220002' },
      staffTemplate: { name: 'nuevo_pedido', language: 'es_MX' },
      graphApiVersion: 'v26.0',
    });
  });

  it('acepta idioma de plantilla y versión de la Graph API', () => {
    const { whatsappBot } = loadConfig({ ...VALID_ENV, ...BOT_ENV, WHATSAPP_BOT_STAFF_TEMPLATE_LANGUAGE: 'es', WHATSAPP_GRAPH_API_VERSION: 'v25.0' });
    expect(whatsappBot).toMatchObject({ staffTemplate: { language: 'es' }, graphApiVersion: 'v25.0' });
  });

  it('una sola variable exige todas las obligatorias y lista cada problema sin valores', () => {
    const issues = issuesFor({ ...VALID_ENV, WHATSAPP_BOT_APP_SECRET: BOT_ENV.WHATSAPP_BOT_APP_SECRET });
    expect(issues).toHaveLength(6);
    for (const name of ['ACCESS_TOKEN', 'PHONE_NUMBER_ID', 'VERIFY_TOKEN', 'STAFF_MOLOTES', 'STAFF_BIRRIA', 'STAFF_TEMPLATE']) {
      expect(issues.join('\n')).toContain(`WHATSAPP_BOT_${name} es obligatoria`);
    }
    expect(issues.join('\n')).not.toContain(BOT_ENV.WHATSAPP_BOT_APP_SECRET);
  });

  it('solo una variable opcional también habilita el bot y exige las obligatorias', () => {
    expect(issuesFor({ ...VALID_ENV, WHATSAPP_GRAPH_API_VERSION: 'v26.0' })).toHaveLength(7);
  });

  it.each([
    ['WHATSAPP_BOT_ACCESS_TOKEN', 'con espacios SECRETO'],
    ['WHATSAPP_BOT_PHONE_NUMBER_ID', '12ab'],
    ['WHATSAPP_BOT_APP_SECRET', 'corto'],
    ['WHATSAPP_BOT_APP_SECRET', 'secreto-con-guiones-SECRETO'],
    ['WHATSAPP_BOT_VERIFY_TOKEN', 'corto'],
    ['WHATSAPP_BOT_VERIFY_TOKEN', 'token con espacios SECRETO'],
    ['WHATSAPP_BOT_STAFF_MOLOTES', '+52 55 1111 0001'],
    ['WHATSAPP_BOT_STAFF_BIRRIA', '123'],
    ['WHATSAPP_BOT_STAFF_TEMPLATE', 'Nuevo Pedido'],
    ['WHATSAPP_BOT_STAFF_TEMPLATE_LANGUAGE', 'español'],
    ['WHATSAPP_GRAPH_API_VERSION', 'version-x'],
  ])('rechaza %s inválida sin mostrar el valor', (name, value) => {
    const issues = issuesFor({ ...VALID_ENV, ...BOT_ENV, [name]: value });
    expect(issues).toEqual([expect.stringMatching(new RegExp(`^${name} no es válida`))]);
    expect(issues.join()).not.toContain(value);
    for (const secret of SECRETS) expect(issues.join()).not.toContain(secret);
  });

  it('con el bot, los números de las dos landings deben ser el del bot (D-6)', () => {
    const issues = issuesFor({ ...VALID_ENV, ...BOT_ENV, WHATSAPP_BIRRIA: '5210000000002' });
    expect(issues).toEqual([expect.stringContaining('WHATSAPP_MOLOTES y WHATSAPP_BIRRIA deben ser el mismo número')]);
    // Con *_URL en lugar de número no se compara.
    expect(loadConfig({ ...VALID_ENV, ...BOT_ENV, WHATSAPP_BIRRIA: '', WHATSAPP_BIRRIA_URL: 'https://wa.me/5210000000009' }).whatsappBot).not.toBeNull();
  });
});
