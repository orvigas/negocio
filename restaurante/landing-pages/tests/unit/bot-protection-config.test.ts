import { describe, expect, it } from 'vitest';
import { canonicalPhone, createUsageMeter, DEFAULT_BOT_LIMITS, estimateMicros, maskPhone, MS, parsePhoneInput } from '@restaurante/core/bot-control';

import { ConfigError, loadConfig, type Env } from '../../src/config/env.ts';
import { botText } from '../../src/content/bot.ts';
import { fixedNoticeMessage } from '../../src/services/whatsapp-bot/messages.ts';
import { toCloudApiRecipient } from '../../src/services/whatsapp-bot/providers/meta/cloud-api.ts';
import { BOT_ENV, VALID_ENV, makeRecordingLogger } from '../helpers.ts';
import { mx } from '../support/whatsapp.ts';

/**
 * REQ-F-025: configuración de los umbrales y de la clave (RF-5, CA-14; D-T1), normalización de
 * números (CA-9; D-T6) y contadores globales con presupuesto (RF-2, CA-4 y CA-5).
 */

function issuesFor(env: Env): string[] {
  try {
    loadConfig(env);
  } catch (err) {
    expect(err).toBeInstanceOf(ConfigError);
    return (err as ConfigError).issues;
  }
  throw new Error('Se esperaba ConfigError');
}

const KEY = BOT_ENV.WHATSAPP_BOT_BLOCKLIST_KEY;

describe('configuración de la protección del bot (RF-5, CA-14)', () => {
  it('sin variables se aplican los valores por defecto del requisito', () => {
    const config = loadConfig({ ...VALID_ENV });
    expect(config.botLimits).toEqual(DEFAULT_BOT_LIMITS);
    expect(config.botLimits).toMatchObject({
      ordersPerNumberDay: 3,
      messagesPerNumberDay: 60,
      messagesPerMinute: 20,
      burst: 5,
      burstWindowMs: 10_000,
      templatesDay: 60,
      templatesMonth: 1500,
      outboundDay: 800,
      outboundMonth: 12_000,
      budgetMonthMicros: 20_000_000,
      utilityCostMicros: 8500,
      serviceCostMicros: 8500,
      freeServiceMonth: 1000,
      repeatCount: 5,
      repeatWindowMs: 10 * MS.minute,
      cooldownMs: 30 * MS.minute,
      capBlockMs: 7 * MS.day,
      repeatBlockStepsMs: [MS.day, 7 * MS.day, 30 * MS.day],
      queueMax: 100,
    });
    // Sin bot no hace falta la clave.
    expect(config.botKeys).toBeNull();
  });

  it('cada umbral se puede cambiar por entorno, con los importes en USD', () => {
    const config = loadConfig({
      ...VALID_ENV,
      BOT_LIMIT_ORDERS_PER_NUMBER_DAY: '2',
      BOT_LIMIT_BURST_WINDOW_SECONDS: '20',
      BOT_BUDGET_MONTH_USD: '12.5',
      BOT_COST_UTILITY_USD: '0.0085',
      BOT_COST_SERVICE_USD: '0',
      BOT_FREE_SERVICE_MONTH: '0',
      BOT_BLOCK_REPEAT_STEPS_HOURS: '1, 2,48',
      BOT_QUEUE_MAX: '7',
    });
    expect(config.botLimits).toMatchObject({
      ordersPerNumberDay: 2,
      burstWindowMs: 20_000,
      budgetMonthMicros: 12_500_000,
      utilityCostMicros: 8500,
      serviceCostMicros: 0,
      freeServiceMonth: 0,
      repeatBlockStepsMs: [MS.hour, 2 * MS.hour, 48 * MS.hour],
      queueMax: 7,
    });
  });

  it.each([
    ['BOT_LIMIT_ORDERS_PER_NUMBER_DAY', '0'],
    ['BOT_LIMIT_MESSAGES_PER_NUMBER_DAY', 'sesenta'],
    ['BOT_LIMIT_MESSAGES_PER_MINUTE', '-1'],
    ['BOT_LIMIT_BURST', '1.5'],
    ['BOT_LIMIT_TEMPLATES_MONTH', '100001'],
    ['BOT_QUEUE_MAX', '0'],
    ['BOT_CONTROL_REFRESH_SECONDS', '301'],
    ['BOT_BUDGET_MONTH_USD', '0'],
    ['BOT_BUDGET_MONTH_USD', '20,5'],
    ['BOT_COST_UTILITY_USD', '2'],
    ['BOT_COST_SERVICE_USD', '0.00000001'],
    ['BOT_BLOCK_REPEAT_STEPS_HOURS', '24,10'],
    ['BOT_BLOCK_REPEAT_STEPS_HOURS', '1,2,3,4,5,6'],
  ])('%s=%s impide arrancar con un mensaje claro que no repite el valor', (name, value) => {
    const issues = issuesFor({ ...VALID_ENV, [name]: value });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatch(new RegExp(`^${name} no es válida: `));
    // Los valores cortos ("0", "-1") pueden coincidir con el texto del rango; los demás nunca aparecen.
    if (value.length >= 3) expect(issues[0]).not.toContain(value);
  });

  it('el tope diario no puede ser mayor que el mensual', () => {
    expect(issuesFor({ ...VALID_ENV, BOT_LIMIT_TEMPLATES_DAY: '2000' })).toEqual(['BOT_LIMIT_TEMPLATES_DAY no puede ser mayor que BOT_LIMIT_TEMPLATES_MONTH']);
    expect(issuesFor({ ...VALID_ENV, BOT_LIMIT_OUTBOUND_DAY: '12001' })).toEqual(['BOT_LIMIT_OUTBOUND_DAY no puede ser mayor que BOT_LIMIT_OUTBOUND_MONTH']);
  });

  it('D-T1: con el bot, WHATSAPP_BOT_BLOCKLIST_KEY es obligatoria y válida; nunca se muestra', () => {
    expect(issuesFor({ ...VALID_ENV, ...BOT_ENV, WHATSAPP_BOT_BLOCKLIST_KEY: undefined })).toEqual([expect.stringMatching(/^WHATSAPP_BOT_BLOCKLIST_KEY es obligatoria si se configura el bot/)]);
    const short = 'corta-de-mas-0123456789';
    const issues = issuesFor({ ...VALID_ENV, ...BOT_ENV, WHATSAPP_BOT_BLOCKLIST_KEY: short });
    expect(issues).toEqual([expect.stringMatching(/^WHATSAPP_BOT_BLOCKLIST_KEY no es válida/)]);
    expect(issues.join()).not.toContain(short);
    expect(issuesFor({ ...VALID_ENV, ...BOT_ENV, WHATSAPP_BOT_BLOCKLIST_KEY_PREVIOUS: KEY })).toEqual([
      'WHATSAPP_BOT_BLOCKLIST_KEY_PREVIOUS debe ser distinta de WHATSAPP_BOT_BLOCKLIST_KEY',
    ]);
    const hex = 'ab'.repeat(32);
    const config = loadConfig({ ...VALID_ENV, ...BOT_ENV, WHATSAPP_BOT_BLOCKLIST_KEY_PREVIOUS: hex });
    expect(config.botKeys?.current.length).toBeGreaterThanOrEqual(32);
    expect(config.botKeys?.previous).toEqual(Buffer.from(hex, 'hex'));
  });

  it('la clave no habilita el bot por sí sola y sin bot se ignora', () => {
    const config = loadConfig({ ...VALID_ENV, WHATSAPP_BOT_BLOCKLIST_KEY: KEY });
    expect(config.whatsappBot).toBeNull();
    expect(config.botKeys).toBeNull();
  });
});

describe('normalización del número (CA-9; D-T6)', () => {
  it('521 + 10 dígitos y 52 + 10 dígitos son el mismo número; los demás no cambian', () => {
    expect(canonicalPhone('5215512345678')).toBe('525512345678');
    expect(canonicalPhone('525512345678')).toBe('525512345678');
    expect(canonicalPhone('whatsapp:+5215512345678')).toBe('525512345678');
    expect(canonicalPhone('14155238886')).toBe('14155238886');
    expect(canonicalPhone('52155123456789')).toBe('52155123456789');
  });

  it('toCloudApiRecipient conserva su comportamiento (PR #47)', () => {
    expect(toCloudApiRecipient('5215512345678')).toBe('525512345678');
    expect(toCloudApiRecipient('525512345678')).toBe('525512345678');
    expect(toCloudApiRecipient('14155238886')).toBe('14155238886');
  });

  it('D-T4: el panel acepta formato internacional o 10 dígitos de México', () => {
    expect(parsePhoneInput('+52 1 55 1234 5678')).toBe('525512345678');
    expect(parsePhoneInput('(55) 1234-5678')).toBe('525512345678');
    expect(parsePhoneInput('+1 415 523 8886')).toBe('14155238886');
    for (const invalid of ['', 'abc', '1234567', '1234567890123456', '55 1234 567a']) expect(parsePhoneInput(invalid)).toBeNull();
  });

  it('el número enmascarado solo muestra los 4 últimos dígitos', () => {
    expect(maskPhone('525512345678')).toBe('********5678');
  });
});

describe('contadores globales y presupuesto (RF-2, CA-4 y CA-5)', () => {
  const at = mx('2026-10-14T10:00');

  function meter(overrides: Partial<typeof DEFAULT_BOT_LIMITS> = {}) {
    const logger = makeRecordingLogger();
    const persisted: unknown[] = [];
    const capped: unknown[] = [];
    const usage = createUsageMeter({
      limits: { ...DEFAULT_BOT_LIMITS, ...overrides },
      timeZone: 'America/Mexico_City',
      logger,
      persist: (...args) => persisted.push(args),
      markCapped: (...args) => capped.push(args),
    });
    usage.load([], at);
    return { usage, logger, persisted, capped };
  }

  it('gasto estimado = plantillas × utility + máx(0, salientes − cupo) × servicio', () => {
    expect(estimateMicros(DEFAULT_BOT_LIMITS, 10, 900)).toBe(85_000);
    expect(estimateMicros(DEFAULT_BOT_LIMITS, 10, 1100)).toBe(85_000 + 100 * 8500);
  });

  it('el tope diario de plantillas corta y registra un único error sin números', () => {
    const { usage, logger, capped } = meter({ templatesDay: 2 });
    expect(usage.reserve('template', at)).not.toBeNull();
    expect(usage.reserve('template', at)).not.toBeNull();
    expect(usage.reserve('template', at)).toBeNull();
    expect(usage.blocked('template', at)).toBe('templates_day');
    const errors = logger.lines.filter((line) => line.level === 'error');
    expect(errors).toEqual([{ level: 'error', msg: 'bot_daily_cap_reached', cap: 'templates', limit: 2, period: '2026-10-14' }]);
    expect(capped).toEqual([['day', '2026-10-14', 'templates']]);
    // Al día siguiente vuelve a haber cupo.
    expect(usage.reserve('template', mx('2026-10-15T00:00'))).not.toBeNull();
  });

  it('el presupuesto usa las tarifas y el cupo configurados y corta los salientes hasta el mes siguiente', () => {
    const { usage, logger } = meter({ freeServiceMonth: 1, serviceCostMicros: 10_000, budgetMonthMicros: 20_000 });
    for (let i = 0; i < 3; i += 1) expect(usage.reserve('outbound', at)).not.toBeNull();
    expect(usage.reserve('outbound', at)).toBeNull();
    expect(logger.lines.filter((line) => line.level === 'error')).toEqual([
      { level: 'error', msg: 'bot_monthly_cap_reached', cap: 'budget', limit: 0.02, period: '2026-10' },
    ]);
    expect(usage.reserve('outbound', mx('2026-10-31T23:59'))).toBeNull();
    expect(usage.reserve('outbound', mx('2026-11-01T00:00'))).not.toBeNull();
  });

  it('D-T2: liberar una reserva la descuenta y la persiste', () => {
    const { usage, persisted } = meter();
    const ticket = usage.reserve('outbound', at);
    expect(ticket).not.toBeNull();
    if (ticket) usage.release(ticket, at);
    expect(usage.snapshot(at).day.outbound).toBe(0);
    expect(persisted).toContainEqual(['day', '2026-10-14', { templates: 0, outbound: -1 }]);
  });

  it('CA-5: los contadores cargados al arrancar mantienen el corte (sin repetir el evento)', () => {
    const { usage, logger } = meter({ outboundDay: 5 });
    usage.load([{ periodType: 'day', period: '2026-10-14', templates: 0, outbound: 5, cappedAt: { outbound: at } }], at);
    expect(usage.reserve('outbound', at)).toBeNull();
    expect(logger.lines.filter((line) => line.level === 'error')).toEqual([]);
  });
});

describe('textos fijos de los topes (CA-16)', () => {
  it('viven con el resto de textos del bot y llevan el negocio y el contacto directo', () => {
    for (const key of ['orderLimitReached', 'dailyLimitReached', 'directContactMode', 'orderCapContact'] as const) {
      expect(botText[key]).toContain('{negocio}');
      expect(botText[key]).toContain('{contacto}');
    }
    expect(botText.orderCapContact).toContain('{codigo}');
    expect(fixedNoticeMessage('dailyLimitReached', 'birria', 'https://wa.me/5215522220002')).toContain('https://wa.me/5215522220002');
  });
});
