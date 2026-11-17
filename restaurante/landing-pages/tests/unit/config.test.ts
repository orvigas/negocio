import { describe, expect, it } from 'vitest';

import { ConfigError, loadConfig, type Env } from '../../src/config/env.ts';
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

const withoutNodeEnv = (): Record<string, string> => Object.fromEntries(Object.entries(VALID_ENV).filter(([name]) => name !== 'NODE_ENV'));

describe('NODE_ENV obligatorio (REQ-F-015)', () => {
  it.each([
    ['ausente', undefined],
    ['vacío', ''],
    ['solo espacios', '   '],
  ])('CA-3: %s -> ConfigError con el problema de obligatoriedad y la lista de valores', (_case, value) => {
    const issues = issuesFor({ ...withoutNodeEnv(), NODE_ENV: value });
    expect(issues).toEqual(['NODE_ENV es obligatorio: debe ser uno de development, production, test']);
  });

  it.each(['staging', 'Production', 'TEST'])('CA-3: %s no es válido, no se normaliza y no se repite el valor', (value) => {
    const issues = issuesFor({ ...VALID_ENV, NODE_ENV: value });
    expect(issues).toEqual(['NODE_ENV debe ser uno de: development, production, test']);
    expect(issues.join('\n')).not.toContain(value);
  });

  it('CA-2: sin NODE_ENV se informan también los demás problemas', () => {
    const issues = issuesFor({ ...withoutNodeEnv(), PORT: 'abc' });
    expect(issues).toHaveLength(2);
    expect(issues.join('\n')).toContain('NODE_ENV es obligatorio');
    expect(issues.join('\n')).toContain('PORT debe ser');
  });

  it('sin NODE_ENV no se derivan problemas de producción (aviso interno, ADMIN_NEW_URL)', () => {
    const issues = issuesFor({ ...withoutNodeEnv(), INTERNAL_NOTIFY_TOKEN: undefined, ADMIN_NEW_URL: 'http://admin.example.com' });
    expect(issues).toEqual([expect.stringContaining('NODE_ENV es obligatorio')]);
  });

  it('CA-5: la suite corre con NODE_ENV=test (vitest.config.ts), sin exportarlo', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});

describe('HOST (REQ-F-015)', () => {
  it.each(['development', 'production', 'test'])('CA-6: sin HOST vale 127.0.0.1 con NODE_ENV=%s y cualquier TRUST_PROXY', (nodeEnv) => {
    for (const trustProxy of [undefined, 'true', 'false']) {
      const config = loadConfig({ ...VALID_ENV, NODE_ENV: nodeEnv, TRUST_PROXY: trustProxy });
      expect(config.host).toBe('127.0.0.1');
    }
  });

  it.each(['', '   '])('HOST vacío o con solo espacios (%j) vale 127.0.0.1', (HOST) => {
    expect(loadConfig({ ...VALID_ENV, HOST }).host).toBe('127.0.0.1');
  });

  it.each(['127.0.0.1', '0.0.0.0', '::1', '::', '::ffff:127.0.0.1', '192.168.1.20', 'fe80::1%lo0'])('CA-7/CA-12: acepta la IP literal %s', (HOST) => {
    expect(loadConfig({ ...VALID_ENV, HOST }).host).toBe(HOST);
  });

  it('se recorta como el resto de variables', () => {
    expect(loadConfig({ ...VALID_ENV, HOST: ' 0.0.0.0 ' }).host).toBe('0.0.0.0');
  });

  it.each(['localhost', '999.1.1.1', 'abc def', '127.0.0.1:3000', '[::1]', '127.000.0.1', 'mi-maquina.local'])(
    'CA-8: rechaza %s con un mensaje que nombra HOST y no repite el valor',
    (HOST) => {
      const issues = issuesFor({ ...VALID_ENV, HOST });
      expect(issues).toEqual([expect.stringMatching(/^HOST debe ser una IP literal IPv4 o IPv6/)]);
      expect(issues.join('\n')).not.toContain(HOST);
    },
  );

  it('CA-13: HOST=0.0.0.0 con TRUST_PROXY=true se acepta sin más problemas', () => {
    const config = loadConfig({ ...VALID_ENV, HOST: '0.0.0.0', TRUST_PROXY: 'true' });
    expect(config).toMatchObject({ host: '0.0.0.0', trustProxy: true });
  });
});

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

  it('aplica valores por defecto para HOST, PORT y BUSINESS_TIMEZONE', () => {
    const config = loadConfig({
      NODE_ENV: 'development',
      WHATSAPP_MOLOTES: '5210000000001',
      WHATSAPP_BIRRIA: '5210000000002',
      API_INTERNAL_URL: VALID_ENV.API_INTERNAL_URL,
    });
    expect(config).toMatchObject({ nodeEnv: 'development', host: '127.0.0.1', port: 3000, timezone: 'America/Mexico_City' });
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
    const issues = issuesFor({ NODE_ENV: 'test', PORT: 'x' });
    expect(issues).toHaveLength(4);
    expect(issues.join('\n')).toMatch(/API_INTERNAL_URL es obligatoria/);
    expect(issues.join('\n')).toMatch(/PORT/);
    expect(issues.join('\n')).toMatch(/WHATSAPP_MOLOTES_URL o WHATSAPP_MOLOTES/);
    expect(issues.join('\n')).toMatch(/WHATSAPP_BIRRIA_URL o WHATSAPP_BIRRIA/);
  });

  it('no incluye los valores recibidos en los mensajes de error', () => {
    const issues = issuesFor({ ...VALID_ENV, WHATSAPP_MOLOTES_URL: 'http://secret-token.example' });
    expect(issues.join('\n')).not.toContain('secret-token');
  });

  describe('API_INTERNAL_URL (REQ-F-038, CA-15)', () => {
    it.each([
      ['http://127.0.0.1:3001', 'http://127.0.0.1:3001'],
      ['http://api:3001/', 'http://api:3001'],
      ['https://api.interna:8443/base/', 'https://api.interna:8443/base'],
    ])('acepta %s y lo normaliza sin barra final', (value, expected) => {
      expect(loadConfig({ ...VALID_ENV, API_INTERNAL_URL: value }).apiInternalUrl).toBe(expected);
    });

    it.each([undefined, '', '   '])('ausente (%j) impide arrancar', (value) => {
      expect(issuesFor({ ...VALID_ENV, API_INTERNAL_URL: value })).toEqual([expect.stringContaining('API_INTERNAL_URL es obligatoria')]);
    });

    it.each(['ftp://interno:3001', 'interno:3001', 'http://usuario:clave-secreta@api:3001', 'http://api:3001/?token=secreto', 'http://api:3001/#secreto', 'no es una url'])(
      'inválida (%s) impide arrancar sin repetir el valor',
      (value) => {
        const issues = issuesFor({ ...VALID_ENV, API_INTERNAL_URL: value });
        expect(issues).toEqual([expect.stringContaining('API_INTERNAL_URL no es válida')]);
        expect(issues.join('\n')).not.toContain(value);
        expect(issues.join('\n')).not.toMatch(/secret|clave/);
      },
    );
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

describe('loadConfig: variables de la administración, la base y el bot (REQ-F-045, RF-2)', () => {
  it('TRUST_PROXY es false por defecto y acepta true en producción', () => {
    expect(loadConfig(VALID_ENV).trustProxy).toBe(false);
    expect(loadConfig({ ...VALID_ENV, NODE_ENV: 'production', TRUST_PROXY: 'true' })).toMatchObject({ trustProxy: true, isProduction: true });
    expect(issuesFor({ ...VALID_ENV, TRUST_PROXY: 'yes' }).join('\n')).toMatch(/TRUST_PROXY debe ser true o false/);
  });

  it('las variables de la base, los datos, la administración y el bot se ignoran sin validarse, aunque sean inválidas', () => {
    const retired = {
      DATABASE_URL: 'postgres://u:clave-secreta@db/restaurante',
      DATABASE_ALLOW_NEWER_SCHEMA: '1',
      DATA_DIR: 'src/content',
      ADMIN_USER: 'dueno',
      ADMIN_PASSWORD_HASH: 'contraseña-en-claro',
      WHATSAPP_BOT_PROVIDER: 'whatsapp',
      WHATSAPP_BOT_APP_SECRET: 'appsecret',
    };
    for (const nodeEnv of ['test', 'production']) {
      const config = loadConfig({ ...VALID_ENV, NODE_ENV: nodeEnv, ...retired });
      expect(config).toEqual(loadConfig({ ...VALID_ENV, NODE_ENV: nodeEnv }));
    }
  });
});

describe('loadConfig: admin nuevo y aviso interno (REQ-F-039, RF-13 y RF-15)', () => {
  const PROD = { ...VALID_ENV, NODE_ENV: 'production' };

  it('sin ADMIN_NEW_URL no hay admin nuevo al que redirigir (undefined)', () => {
    expect(loadConfig(VALID_ENV).adminNewUrl).toBeUndefined();
  });

  it('ADMIN_NEW_URL se normaliza sin "/" final; http solo fuera de producción', () => {
    expect(loadConfig({ ...VALID_ENV, ADMIN_NEW_URL: 'http://127.0.0.1:3003/' }).adminNewUrl).toBe('http://127.0.0.1:3003');
    expect(loadConfig({ ...PROD, ADMIN_NEW_URL: 'https://admin.birriaelmuneco.com' }).adminNewUrl).toBe('https://admin.birriaelmuneco.com');
    expect(() => loadConfig({ ...PROD, ADMIN_NEW_URL: 'http://admin.birriaelmuneco.com' })).toThrow(/ADMIN_NEW_URL debe ser una URL https/);
  });

  it.each(['no es url', 'ftp://admin.example.com', 'https://usuario:secreto@admin.example.com', 'https://admin.example.com/?x=1', 'https://admin.example.com/#a'])(
    'rechaza ADMIN_NEW_URL=%s sin repetir el valor',
    (value) => {
      let error: unknown;
      try {
        loadConfig({ ...VALID_ENV, ADMIN_NEW_URL: value });
      } catch (err) {
        error = err;
      }
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as ConfigError).message).toContain('ADMIN_NEW_URL');
      expect((error as ConfigError).message).not.toContain('secreto');
    },
  );

  it('con INTERNAL_NOTIFY_TOKEN, puerto interno 3002 por defecto o INTERNAL_PORT', () => {
    const token = 'x'.repeat(40);
    expect(loadConfig({ ...VALID_ENV, INTERNAL_NOTIFY_TOKEN: token }).internalNotify).toEqual({ port: 3002, token });
    expect(loadConfig({ ...VALID_ENV, INTERNAL_NOTIFY_TOKEN: token, INTERNAL_PORT: '4002' }).internalNotify).toEqual({ port: 4002, token });
  });

  it('sin token fuera de producción no hay aviso interno (null); en producción es obligatorio', () => {
    expect(loadConfig({ ...VALID_ENV, INTERNAL_NOTIFY_TOKEN: undefined }).internalNotify).toBeNull();
    expect(() => loadConfig({ ...PROD, INTERNAL_NOTIFY_TOKEN: undefined })).toThrow(/INTERNAL_NOTIFY_TOKEN es obligatoria en producción/);
  });

  it.each([
    [{ INTERNAL_NOTIFY_TOKEN: 'corto-secreto' }, /INTERNAL_NOTIFY_TOKEN debe tener al menos 32/],
    [{ INTERNAL_NOTIFY_TOKEN: `${'x'.repeat(40)} con-espacios` }, /INTERNAL_NOTIFY_TOKEN debe tener al menos 32/],
    [{ INTERNAL_PORT: '70000' }, /INTERNAL_PORT debe ser un entero/],
    [{ INTERNAL_PORT: '3000' }, /INTERNAL_PORT debe ser distinto de PORT/],
  ])('rechaza %j sin repetir el valor', (override, message) => {
    let error: unknown;
    try {
      loadConfig({ ...VALID_ENV, ...override });
    } catch (err) {
      error = err;
    }
    expect(error).toBeInstanceOf(ConfigError);
    expect((error as ConfigError).message).toMatch(message);
    expect((error as ConfigError).message).not.toContain('secreto');
  });
});
