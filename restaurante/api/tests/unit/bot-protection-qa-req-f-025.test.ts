import { describe, expect, it } from 'vitest';
import { canonicalPhone } from '@restaurante/core/bot-control';

import { BOT_ENV } from '../helpers.ts';
import { CUSTOMER, STAFF, makeBotHarness, mx, type BotHarness } from '../support/whatsapp.ts';

/**
 * Pruebas de QA de REQ-F-025 del lado del bot (en la api desde REQ-F-042): QA-T1 tope de pedidos
 * alcanzado durante una conversación con el alias 521/52 (CA-1, CA-9), QA-T2 frontera del
 * presupuesto y cambio de día y de mes en la zona del negocio (CA-5) y la parte del bot de QA-T3
 * (privacidad de un flujo con bloqueo automático, CA-15). La parte de /admin de QA-T3 está en
 * landing-pages/tests/integration/bot-protection-qa-req-f-025.test.ts. Nunca se llama a Meta.
 */

async function readyToConfirm(h: BotHarness, from: string): Promise<void> {
  for (const text of ['Hola', '2', '9', '1', '4', 'Ana Pérez, recoger, efectivo']) await h.ask(text, { from });
}

const templates = (h: BotHarness) => h.double.sent.filter((m) => m.template !== undefined);

describe('QA-T1: tope de pedidos alcanzado durante una conversación (CA-1 escenario 2, CA-9)', () => {
  it('dos conversaciones del mismo número (521 y 52): la segunda confirmación recibe el contacto sin plantilla', async () => {
    const h = await makeBotHarness({ protection: { limits: { ordersPerNumberDay: 1, repeatCount: 100 } } });
    const short = canonicalPhone(CUSTOMER);
    expect(short).not.toBe(CUSTOMER);
    await readyToConfirm(h, CUSTOMER);
    await readyToConfirm(h, short);
    expect(await h.ask('1', { from: CUSTOMER })).toContain('fue enviado a Moloteando');
    expect(templates(h)).toHaveLength(1);

    // El proveedor de Meta responde siempre al número con 521 (toCloudApiRecipient): se lee de ahí.
    const before = h.double.textsTo(CUSTOMER).length;
    await h.ask('1', { from: short });
    const second = h.double.textsTo(CUSTOMER).slice(before).join('\n');
    expect(second).not.toContain('fue enviado a Moloteando');
    expect(second).toContain('no se pudo enviar automáticamente al personal de Moloteando');
    expect(second).toContain(`wa.me/${STAFF.molotes}`);
    expect(second).toMatch(/[A-Z]+-T\d{3}/);
    expect(templates(h)).toHaveLength(1);
  });
});

describe('QA-T2: presupuesto y periodos en America/Mexico_City (CA-5)', () => {
  // 1 USD por mensaje de servicio, 2 gratis, presupuesto 2 USD: 4 salientes caben (2 gratis + 2 USD).
  const budget = { freeServiceMonth: 2, serviceCostMicros: 1_000_000, utilityCostMicros: 1_000_000, budgetMonthMicros: 2_000_000, repeatCount: 100 };

  it('el gasto igual al presupuesto se permite; el siguiente se silencia y hay un solo error de presupuesto', async () => {
    const h = await makeBotHarness({ at: mx('2026-10-20T10:00'), protection: { limits: budget } });
    for (let i = 0; i < 6; i += 1) await h.ask('ayuda');
    expect(h.double.textsTo(CUSTOMER)).toHaveLength(4);
    const errors = h.logger.lines.filter((line) => line.level === 'error');
    expect(errors).toEqual([expect.objectContaining({ msg: 'bot_monthly_cap_reached', cap: 'budget', limit: 2 })]);
  });

  it('el mes cambia a las 00:00 de la zona del negocio, no en UTC', async () => {
    // 31 de octubre 23:00 en México = 1 de noviembre 05:00 UTC.
    const h = await makeBotHarness({ at: mx('2026-10-31T23:00'), protection: { limits: budget } });
    for (let i = 0; i < 6; i += 1) await h.ask('ayuda');
    expect(h.double.textsTo(CUSTOMER)).toHaveLength(4);
    h.clock.now = mx('2026-10-31T23:58');
    expect(await h.say('ayuda')).toEqual([]);
    h.clock.now = mx('2026-11-01T00:01');
    expect(await h.say('ayuda')).not.toEqual([]);
  });

  it('el tope diario de salientes se reinicia a las 00:00 de la zona del negocio', async () => {
    const h = await makeBotHarness({ at: mx('2026-10-20T23:50'), protection: { limits: { outboundDay: 2, repeatCount: 100 } } });
    for (let i = 0; i < 4; i += 1) await h.ask('ayuda');
    expect(h.double.textsTo(CUSTOMER)).toHaveLength(2);
    h.clock.now = mx('2026-10-21T00:00');
    expect(await h.say('ayuda')).not.toEqual([]);
  });
});

describe('QA-T3 (bot): bloqueo automático por el tope diario de mensajes sin números completos (CA-15)', () => {
  it('los logs y lo guardado (lista negra, auditoría y contadores) solo llevan el número enmascarado', async () => {
    const h = await makeBotHarness({ at: mx('2026-10-20T10:00'), protection: {} });
    const abuser = '5215500007777';
    for (let i = 0; i < 62; i += 1) {
      h.clock.now = new Date(h.clock.now.getTime() + 4000);
      await h.say(`mensaje ${i}`, { from: abuser });
    }
    expect(h.control?.isBlocked(canonicalPhone(abuser))).toBe(true);
    await h.control?.flush();
    const store = h.store;
    const saved = JSON.stringify({ blocks: await store.activeBlocks(h.clock.now), audit: await store.recentAudit(100) });
    const logs = JSON.stringify(h.logger.lines);
    for (const text of [saved, logs]) {
      for (const n of [abuser, canonicalPhone(abuser), abuser.slice(-10), BOT_ENV.WHATSAPP_BOT_BLOCKLIST_KEY]) expect(text).not.toContain(n);
    }
    expect(saved).toContain('7777');
  });
});
