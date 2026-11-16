import { describe, expect, it } from 'vitest';

import { ApiConfigError, loadApiConfig } from '../../src/config.ts';
import { BOT_ENV, TWILIO_BOT_ENV, VALID_ENV, type Env } from '../helpers.ts';

/**
 * Configuración del bot de WhatsApp en la api (REQ-F-009 RF-2; REQ-F-012 RF-2; desde REQ-F-042, CA-12):
 * los mismos casos y textos que tenía landing-pages.
 */

const loadConfig = loadApiConfig;

function issuesFor(env: Env): string[] {
  try {
    loadApiConfig(env);
  } catch (err) {
    expect(err).toBeInstanceOf(ApiConfigError);
    return (err as ApiConfigError).issues;
  }
  throw new Error('Se esperaba ApiConfigError');
}

describe('loadConfig: bot de WhatsApp con Meta (REQ-F-009 RF-2, CA-4; REQ-F-012 RF-2)', () => {
  const SECRETS = [BOT_ENV.WHATSAPP_BOT_ACCESS_TOKEN, BOT_ENV.WHATSAPP_BOT_APP_SECRET, BOT_ENV.WHATSAPP_BOT_VERIFY_TOKEN];

  it('sin ninguna variable del bot queda deshabilitado (null)', () => {
    expect(loadConfig(VALID_ENV).whatsappBot).toBeNull();
  });

  it('con todas las obligatorias queda habilitado con los valores por defecto', () => {
    const { whatsappBot } = loadConfig({ ...VALID_ENV, ...BOT_ENV });
    expect(whatsappBot).toEqual({
      provider: 'meta',
      accessToken: BOT_ENV.WHATSAPP_BOT_ACCESS_TOKEN,
      accountId: '106540352242922',
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
    const issues = issuesFor({ ...VALID_ENV, WHATSAPP_BOT_PROVIDER: 'meta', WHATSAPP_BOT_APP_SECRET: BOT_ENV.WHATSAPP_BOT_APP_SECRET });
    expect(issues).toHaveLength(6);
    for (const name of ['ACCESS_TOKEN', 'ACCOUNT_ID', 'VERIFY_TOKEN', 'STAFF_MOLOTES', 'STAFF_BIRRIA', 'STAFF_TEMPLATE']) {
      expect(issues.join('\n')).toContain(`WHATSAPP_BOT_${name} es obligatoria`);
    }
    expect(issues.join('\n')).not.toContain(BOT_ENV.WHATSAPP_BOT_APP_SECRET);
  });

  it('solo una variable opcional también habilita el bot y exige el proveedor y los datos comunes', () => {
    const issues = issuesFor({ ...VALID_ENV, WHATSAPP_GRAPH_API_VERSION: 'v26.0' });
    for (const name of ['PROVIDER', 'ACCOUNT_ID', 'ACCESS_TOKEN', 'STAFF_MOLOTES', 'STAFF_BIRRIA']) expect(issues.join('\n')).toContain(`WHATSAPP_BOT_${name} es obligatoria`);
  });

  it.each([
    ['WHATSAPP_BOT_ACCESS_TOKEN', 'con espacios SECRETO'],
    ['WHATSAPP_BOT_ACCOUNT_ID', '12ab'],
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

describe('loadConfig: proveedor del bot y Twilio (REQ-F-012, RF-2)', () => {
  const TWILIO_SECRETS = [TWILIO_BOT_ENV.WHATSAPP_BOT_ACCESS_TOKEN, TWILIO_BOT_ENV.WHATSAPP_BOT_ACCOUNT_ID];
  const withoutVar = (env: Record<string, string>, name: string): Record<string, string> => Object.fromEntries(Object.entries(env).filter(([key]) => key !== name));

  it('con twilio y sus variables queda habilitado (sin APP_SECRET, VERIFY_TOKEN ni STAFF_TEMPLATE; CA-10)', () => {
    expect(loadConfig({ ...VALID_ENV, ...TWILIO_BOT_ENV }).whatsappBot).toEqual({
      provider: 'twilio',
      accountId: TWILIO_BOT_ENV.WHATSAPP_BOT_ACCOUNT_ID,
      accessToken: TWILIO_BOT_ENV.WHATSAPP_BOT_ACCESS_TOKEN,
      staff: { molotes: '5215511110001', birria: '5215522220002' },
      webhookUrl: 'https://tunel.example.com/webhooks/whatsapp',
      staffContentSid: undefined,
      sender: '14155238886',
    });
  });

  it('D-15: con twilio ignora las variables que solo usa Meta, y con meta las de Twilio', () => {
    const metaOnly = { WHATSAPP_BOT_APP_SECRET: 'no-es-valido', WHATSAPP_BOT_VERIFY_TOKEN: 'x', WHATSAPP_BOT_STAFF_TEMPLATE_LANGUAGE: '??', WHATSAPP_GRAPH_API_VERSION: 'x' };
    expect(loadConfig({ ...VALID_ENV, ...TWILIO_BOT_ENV, ...metaOnly }).whatsappBot?.provider).toBe('twilio');
    expect(loadConfig({ ...VALID_ENV, ...BOT_ENV, WHATSAPP_BOT_WEBHOOK_URL: 'no-es-url' }).whatsappBot?.provider).toBe('meta');
  });

  it('con twilio, STAFF_TEMPLATE es el ContentSid (HX…) del Content Template', () => {
    const contentSid = `HX${'a1'.repeat(16)}`;
    expect(loadConfig({ ...VALID_ENV, ...TWILIO_BOT_ENV, WHATSAPP_BOT_STAFF_TEMPLATE: contentSid }).whatsappBot).toMatchObject({ staffContentSid: contentSid });
    expect(issuesFor({ ...VALID_ENV, ...TWILIO_BOT_ENV, WHATSAPP_BOT_STAFF_TEMPLATE: 'nuevo_pedido' })).toEqual([expect.stringMatching(/^WHATSAPP_BOT_STAFF_TEMPLATE no es válida: con twilio/)]);
  });

  it.each(['META', 'Twilio', 'meta', 'TWILIO'])('D-12: acepta %s sin distinguir mayúsculas (CA-8)', (provider) => {
    const env = provider.toLowerCase() === 'meta' ? BOT_ENV : TWILIO_BOT_ENV;
    expect(loadConfig({ ...VALID_ENV, ...env, WHATSAPP_BOT_PROVIDER: provider }).whatsappBot?.provider).toBe(provider.toLowerCase());
  });

  it('CA-8: con el bot habilitado, el proveedor ausente o no admitido impide arrancar y no muestra valores', () => {
    expect(issuesFor({ ...VALID_ENV, ...withoutVar(BOT_ENV, 'WHATSAPP_BOT_PROVIDER') })).toEqual([expect.stringMatching(/^WHATSAPP_BOT_PROVIDER es obligatoria/)]);
    const issues = issuesFor({ ...VALID_ENV, ...BOT_ENV, WHATSAPP_BOT_PROVIDER: 'whatsapp' });
    expect(issues).toEqual(['WHATSAPP_BOT_PROVIDER debe ser uno de: meta, twilio']);
  });

  it('CA-9: los datos de cuenta de otro proveedor impiden arrancar sin mostrar valores', () => {
    const twilioWithMetaId = issuesFor({ ...VALID_ENV, ...TWILIO_BOT_ENV, WHATSAPP_BOT_ACCOUNT_ID: '106540352242922' });
    expect(twilioWithMetaId).toEqual([expect.stringMatching(/^WHATSAPP_BOT_ACCOUNT_ID no es válida: con twilio/)]);
    expect(twilioWithMetaId.join()).not.toContain('106540352242922');
    const metaWithTwilioId = issuesFor({ ...VALID_ENV, ...BOT_ENV, WHATSAPP_BOT_ACCOUNT_ID: TWILIO_BOT_ENV.WHATSAPP_BOT_ACCOUNT_ID });
    expect(metaWithTwilioId).toEqual([expect.stringMatching(/^WHATSAPP_BOT_ACCOUNT_ID no es válida: con meta/)]);
    // Cambiar solo el proveedor con los datos de Meta.
    const switched = issuesFor({ ...VALID_ENV, ...BOT_ENV, WHATSAPP_BOT_PROVIDER: 'twilio' });
    expect(switched.join('\n')).toContain('WHATSAPP_BOT_ACCOUNT_ID no es válida');
    expect(switched.join('\n')).toContain('WHATSAPP_BOT_WEBHOOK_URL es obligatoria');
    for (const secret of [...TWILIO_SECRETS, BOT_ENV.WHATSAPP_BOT_ACCESS_TOKEN]) expect([...twilioWithMetaId, ...metaWithTwilioId, ...switched].join()).not.toContain(secret);
  });

  it('CA-10: con twilio, sin WEBHOOK_URL no arranca y la nombra; con meta, sin STAFF_TEMPLATE tampoco', () => {
    expect(issuesFor({ ...VALID_ENV, ...withoutVar(TWILIO_BOT_ENV, 'WHATSAPP_BOT_WEBHOOK_URL') })).toEqual([expect.stringMatching(/^WHATSAPP_BOT_WEBHOOK_URL es obligatoria/)]);
    expect(issuesFor({ ...VALID_ENV, ...withoutVar(BOT_ENV, 'WHATSAPP_BOT_STAFF_TEMPLATE') })).toEqual([expect.stringMatching(/^WHATSAPP_BOT_STAFF_TEMPLATE es obligatoria/)]);
  });

  it.each([
    'http://tunel.example.com/webhooks/whatsapp',
    'https://tunel.example.com/otra-ruta',
    'https://tunel.example.com/webhooks/whatsapp?x=1',
    'https://tunel.example.com/webhooks/whatsapp#x',
    'https://usuario:clave@tunel.example.com/webhooks/whatsapp',
    'tunel.example.com/webhooks/whatsapp',
  ])('con twilio rechaza WEBHOOK_URL %s', (url) => {
    const issues = issuesFor({ ...VALID_ENV, ...TWILIO_BOT_ENV, WHATSAPP_BOT_WEBHOOK_URL: url });
    expect(issues).toEqual([expect.stringMatching(/^WHATSAPP_BOT_WEBHOOK_URL no es válida/)]);
    expect(issues.join()).not.toContain('clave');
  });

  it('D-8: con twilio, WHATSAPP_MOLOTES debe ser un número (el emisor)', () => {
    const issues = issuesFor({ ...VALID_ENV, ...TWILIO_BOT_ENV, WHATSAPP_MOLOTES: '', WHATSAPP_MOLOTES_URL: 'https://wa.me/14155238886' });
    expect(issues).toEqual([expect.stringContaining('Con twilio, WHATSAPP_MOLOTES es obligatoria como número')]);
  });

  it('CA-11: producción con twilio no arranca, esté o no habilitado el bot', () => {
    // En producción la api exige además el aviso interno a landing-pages (REQ-F-039).
    const production = { ...VALID_ENV, NODE_ENV: 'production', LANDING_INTERNAL_URL: 'http://app:3002', INTERNAL_NOTIFY_TOKEN: 'x'.repeat(40) };
    expect(issuesFor({ ...production, WHATSAPP_BOT_PROVIDER: 'twilio' })).toEqual([expect.stringContaining('WHATSAPP_BOT_PROVIDER=twilio no se permite con NODE_ENV=production')]);
    expect(issuesFor({ ...production, ...TWILIO_BOT_ENV, WHATSAPP_BOT_PROVIDER: 'Twilio' })).toContainEqual(expect.stringContaining('no se permite con NODE_ENV=production'));
    expect(loadConfig({ ...production, ...BOT_ENV }).whatsappBot?.provider).toBe('meta');
  });

  it('CA-12: twilio sin datos de cuenta (credenciales vacías) fuera de producción deja el bot deshabilitado', () => {
    const empty = { WHATSAPP_BOT_PROVIDER: 'twilio', WHATSAPP_BOT_ACCOUNT_ID: '', WHATSAPP_BOT_ACCESS_TOKEN: ' ', WHATSAPP_BOT_WEBHOOK_URL: '', WHATSAPP_BOT_STAFF_MOLOTES: '' };
    expect(loadConfig({ ...VALID_ENV, ...empty }).whatsappBot).toBeNull();
    expect(loadConfig({ ...VALID_ENV, WHATSAPP_BOT_PROVIDER: 'meta' }).whatsappBot).toBeNull();
  });

  it('CA-12b: el nombre anterior WHATSAPP_BOT_PHONE_NUMBER_ID impide arrancar e indica que falta WHATSAPP_BOT_ACCOUNT_ID', () => {
    const env = { ...VALID_ENV, ...withoutVar(BOT_ENV, 'WHATSAPP_BOT_ACCOUNT_ID'), WHATSAPP_BOT_PHONE_NUMBER_ID: '106540352242922' };
    const issues = issuesFor(env);
    expect(issues).toContain('WHATSAPP_BOT_PHONE_NUMBER_ID ya no se usa: renómbrala a WHATSAPP_BOT_ACCOUNT_ID');
    expect(issues.join('\n')).toContain('WHATSAPP_BOT_ACCOUNT_ID es obligatoria');
    expect(issues.join()).not.toContain('106540352242922');
    // Aunque sea la única variable del bot.
    expect(issuesFor({ ...VALID_ENV, WHATSAPP_BOT_PHONE_NUMBER_ID: '106540352242922' })).toEqual(['WHATSAPP_BOT_PHONE_NUMBER_ID ya no se usa: renómbrala a WHATSAPP_BOT_ACCOUNT_ID']);
  });
});

