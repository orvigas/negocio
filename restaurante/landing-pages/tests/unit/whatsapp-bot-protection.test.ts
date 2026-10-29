import { describe, expect, it } from 'vitest';

import { createMemoryBotControlStore } from '@restaurante/core/bot-control';

import { canonicalPhone } from '../../src/services/whatsapp-bot/phone.ts';
import { MS } from '../../src/services/whatsapp-bot/protection/limits.ts';
import { createBotProtection } from '../../src/services/whatsapp-bot/protection/protection.ts';
import { parseDelivery } from '../../src/services/whatsapp-bot/providers/meta/webhook.ts';
import { BOT_ENV } from '../helpers.ts';
import { CUSTOMER, PHONE_NUMBER_ID, STAFF, inboundPayload, makeBotHarness, type BotHarness, type HarnessProtection } from '../support/whatsapp.ts';

/**
 * Protección del bot en el orquestador (REQ-F-025) con el bot real de Meta y el doble de la Cloud
 * API: orden de los controles, topes por número y globales, lista negra, repetidos, cola global e
 * interruptor. Nunca se llama a Meta.
 */

const ADMIN = { kind: 'user', id: 1, name: 'Dueña' } as const;
const OTHER = '5215500005678';
/** Sin detección de repetidos (para las pruebas que repiten "ayuda"). */
const NO_REPEATS = { repeatCount: 100 };

async function protectedHarness(protection: HarnessProtection = {}): Promise<BotHarness & { control: NonNullable<BotHarness['control']> }> {
  const h = await makeBotHarness({ protection });
  if (!h.control) throw new Error('El arnés debe llevar la protección');
  return { ...h, control: h.control };
}

async function readyToConfirm(h: BotHarness, from = CUSTOMER): Promise<void> {
  for (const text of ['Hola', '2', '9', '1', '4', 'Ana Pérez, recoger, efectivo']) await h.ask(text, { from });
}

/** Una entrega con un mensaje, sin avanzar el reloj. */
async function burst(h: BotHarness, text: string, from = CUSTOMER): Promise<void> {
  await h.deliver(inboundPayload('text', { from, text, at: h.clock.now }));
}

const messages = (h: BotHarness, msg: string) => h.logger.lines.filter((line) => line.msg === msg);

describe('topes por número (RF-1)', () => {
  it('CA-3: el sexto mensaje en 10 s se ignora, no cuenta para el tope diario y se registra una vez', async () => {
    const h = await protectedHarness({ limits: { ...NO_REPEATS, messagesPerNumberDay: 6 } });
    for (let i = 0; i < 6; i += 1) await burst(h, `ayuda ${i}`);
    expect(h.double.textsTo(CUSTOMER)).toHaveLength(5);
    expect(messages(h, 'bot_burst_limited')).toEqual([{ level: 'warn', msg: 'bot_burst_limited', customer: '*********1234' }]);
    // El sexto no contó: pasada la ventana, el siguiente se procesa (sería el aviso del tope si contara).
    h.clock.now = new Date(h.clock.now.getTime() + 11_000);
    expect(await h.ask('ayuda')).not.toContain('límite de mensajes');
  });

  it('CA-3: el tope de 20 mensajes por minuto sigue funcionando', async () => {
    const h = await protectedHarness({ limits: NO_REPEATS });
    for (let i = 0; i < 24; i += 1) {
      await burst(h, 'ayuda');
      h.clock.now = new Date(h.clock.now.getTime() + 2500);
    }
    expect(h.double.textsTo(CUSTOMER)).toHaveLength(20);
    expect(messages(h, 'bot_rate_limited')).toHaveLength(1);
  });

  it('CA-2: pasado el tope diario recibe un único mensaje fijo y queda bloqueado 7 días con origen "tope"', async () => {
    const h = await protectedHarness({ limits: { ...NO_REPEATS, messagesPerNumberDay: 5 } });
    for (let i = 0; i < 5; i += 1) await h.ask('ayuda');
    const notice = await h.say('ayuda');
    expect(notice).toHaveLength(1);
    expect(notice[0]).toContain('Llegaste al límite de mensajes de hoy');
    expect(notice[0]).toContain('wa.me/5215511110001');
    expect(await h.say('ayuda')).toEqual([]);
    expect(await h.say('otra cosa')).toEqual([]);
    const [block] = h.store.dump().blocks;
    expect(block).toMatchObject({ origin: 'tope', last4: '1234' });
    expect((block?.expiresAt?.getTime() ?? 0) - (block?.createdAt.getTime() ?? 0)).toBe(7 * MS.day);
    expect(messages(h, 'bot_number_cap_reached')).toEqual([expect.objectContaining({ customer: '*********1234', cap: 'messages' })]);
    expect((await h.control.snapshot()).reached).toEqual([expect.objectContaining({ masked: '*********1234', cap: 'messages' })]);
  });

  it('CA-1: con los pedidos del día agotados recibe el contacto directo y no se envía ninguna plantilla', async () => {
    const h = await protectedHarness({ limits: { ordersPerNumberDay: 1 } });
    await readyToConfirm(h);
    expect(await h.ask('1')).toContain('fue enviado a Moloteando');
    expect(h.double.templatesTo(STAFF.molotes)).toHaveLength(1);
    const refused = await h.say('Hola, quiero otro pedido');
    expect(refused).toEqual([expect.stringContaining('Por hoy ya recibimos el máximo de pedidos desde este número')]);
    // D-T3: el mensaje fijo como mucho una vez cada 2 h.
    expect(await h.say('Hola?')).toEqual([]);
    expect(h.double.templatesTo(STAFF.molotes)).toHaveLength(1);
    expect(messages(h, 'bot_number_cap_reached')).toEqual([expect.objectContaining({ cap: 'orders' })]);
  });

  it('CA-1: un aviso rechazado por Meta no cuenta como pedido', async () => {
    const h = await protectedHarness({ limits: { ordersPerNumberDay: 1 } });
    await readyToConfirm(h);
    h.double.failNext({ kind: 'graph-error', status: 400, code: 100 });
    expect(await h.ask('1')).toContain('No pude enviar tu pedido');
    await readyToConfirm(h);
    expect(await h.ask('1')).toContain('fue enviado a Moloteando');
  });

  it('CA-8: el personal está exento de los topes por número y de los repetidos', async () => {
    const h = await protectedHarness({ limits: { messagesPerNumberDay: 5 } });
    for (let i = 0; i < 8; i += 1) {
      expect(await h.say('ayuda', { from: STAFF.birria })).not.toEqual([]);
      h.clock.now = new Date(h.clock.now.getTime() + 2 * MS.minute);
    }
    expect(h.store.dump().blocks).toHaveLength(0);
    expect(await h.control.blockManual(STAFF.birria, '7d', null, ADMIN)).toBe('staff');
  });

  it('CA-9: 521 y 52 del mismo número comparten los topes y la lista negra', async () => {
    const h = await protectedHarness({ limits: { ...NO_REPEATS, messagesPerNumberDay: 2 } });
    const short = canonicalPhone(CUSTOMER);
    await h.ask('ayuda');
    await h.ask('ayuda', { from: short });
    expect(await h.ask('ayuda')).toContain('Llegaste al límite de mensajes de hoy');
    expect(await h.say('ayuda', { from: short })).toEqual([]);
  });
});

describe('repetidos y bucles (RF-7, CA-10)', () => {
  it('5 textos idénticos en 10 minutos: enfriamiento de 30 minutos; el segundo del día bloquea 24 h', async () => {
    const h = await protectedHarness();
    for (let i = 0; i < 4; i += 1) {
      expect(await h.say('¡Hola!')).not.toEqual([]);
      h.clock.now = new Date(h.clock.now.getTime() + MS.minute);
    }
    expect(await h.say('hola')).toEqual([]);
    expect(await h.say('menú')).toEqual([]);
    expect(messages(h, 'bot_cooldown_started')).toHaveLength(1);
    h.clock.now = new Date(h.clock.now.getTime() + 31 * MS.minute);
    expect(await h.say('menú')).not.toEqual([]);
    for (let i = 0; i < 5; i += 1) {
      await h.say('cancelar');
      h.clock.now = new Date(h.clock.now.getTime() + MS.minute);
    }
    expect(h.store.dump().blocks).toEqual([expect.objectContaining({ origin: 'repeticion' })]);
    const [block] = h.store.dump().blocks;
    expect((block?.expiresAt?.getTime() ?? 0) - (block?.createdAt.getTime() ?? 0)).toBe(24 * MS.hour);
    expect(await h.say('menú')).toEqual([]);
  });
});

describe('topes globales (RF-2)', () => {
  it('CA-4: con el tope de plantillas, quien empieza o confirma recibe el contacto directo; un solo error sin números', async () => {
    const h = await protectedHarness({ limits: { templatesDay: 1 } });
    await readyToConfirm(h, OTHER);
    await readyToConfirm(h);
    expect(await h.ask('1')).toContain('fue enviado a Moloteando');
    const atConfirm = await h.ask('1', { from: OTHER });
    expect(atConfirm).toContain('no se pudo enviar automáticamente al personal de Moloteando');
    expect(atConfirm).toContain('wa.me/5215511110001');
    const third = '5215500009999';
    expect(await h.say('Hola', { from: third })).toEqual([expect.stringContaining('Por ahora no puedo tomar pedidos por este medio')]);
    expect(h.double.sent.filter((m) => m.template !== undefined)).toHaveLength(1);
    const errors = h.logger.lines.filter((line) => line.level === 'error');
    expect(errors).toEqual([expect.objectContaining({ msg: 'bot_daily_cap_reached', cap: 'templates', limit: 1 })]);
    expect(JSON.stringify(errors)).not.toMatch(/5500/);
  });

  it('CA-5: con el tope de salientes no se envía nada más, y el corte se mantiene tras un reinicio', async () => {
    const store = createMemoryBotControlStore();
    const h = await protectedHarness({ limits: { outboundDay: 3, ...NO_REPEATS }, store });
    for (let i = 0; i < 5; i += 1) await h.ask('ayuda');
    expect(h.double.textsTo(CUSTOMER)).toHaveLength(3);
    await h.control.flush();
    expect(store.dump().usage.get('day:2026-10-06')?.outbound).toBe(3);

    const restarted = await protectedHarness({ limits: { outboundDay: 3, ...NO_REPEATS }, store });
    expect(await restarted.say('ayuda', { from: OTHER })).toEqual([]);
    expect(restarted.logger.lines.filter((line) => line.level === 'error')).toEqual([]);
  });
});

describe('lista negra, cola e interruptor (RF-3, RF-8, RF-9)', () => {
  it('CA-6: un número bloqueado no recibe respuesta, no cuenta y vuelve a ser atendido al vencer', async () => {
    const h = await protectedHarness();
    await h.control.blockManual(CUSTOMER, '24h', null, ADMIN);
    expect(await h.say('Hola')).toEqual([]);
    expect(await h.say('Hola otra vez')).toEqual([]);
    expect((await h.control.snapshot()).usage.day.outbound).toBe(0);
    expect(messages(h, 'bot_blocked_message')).toEqual([{ level: 'info', msg: 'bot_blocked_message', customer: '*********1234' }]);
    h.clock.now = new Date(h.clock.now.getTime() + 24 * MS.hour);
    expect(await h.say('Hola')).not.toEqual([]);
  });

  it('CA-11: con la cola llena los mensajes se descartan sin respuesta, con un registro por minuto sin números', async () => {
    const h = await protectedHarness({ limits: { queueMax: 2 } });
    const delivery = (offset: number) => {
      const payload = inboundPayload('text', { from: `52155000100${offset}0`, text: 'Hola', at: h.clock.now });
      const value = payload.entry[0].changes[0].value;
      for (let i = 1; i < 5; i += 1) value.messages.push(inboundPayload('text', { from: `52155000100${offset}${i}`, text: 'Hola', at: h.clock.now }).entry[0].changes[0].value.messages[0]);
      return parseDelivery(payload, PHONE_NUMBER_ID);
    };
    h.bot.receive(delivery(1));
    h.bot.receive(delivery(2));
    await h.bot.drain();
    expect(new Set(h.double.sent.map((m) => m.to)).size).toBe(2);
    const full = messages(h, 'bot_queue_full');
    expect(full).toEqual([{ level: 'warn', msg: 'bot_queue_full', dropped: 1 }]);
    expect(JSON.stringify(full)).not.toMatch(/5215/);
  });

  it('CA-12: con el bot pausado no sale nada y no cuenta; al reanudar vuelve a atender', async () => {
    const h = await protectedHarness();
    await h.control.setPaused(true, ADMIN, null);
    expect(await h.say('Hola')).toEqual([]);
    expect(h.double.requests).toHaveLength(0);
    expect((await h.control.snapshot()).usage.day.outbound).toBe(0);
    await h.control.setPaused(false, ADMIN, null);
    expect(await h.say('Hola de nuevo')).not.toEqual([]);
  });

  it('CA-12: la pausa se comprueba antes de cada envío (lo que ya estaba en la cola no sale)', async () => {
    const h = await protectedHarness();
    const protection = createBotProtection({ control: h.control, limits: h.limits, timeZone: 'America/Mexico_City', logger: h.logger });
    expect(protection.templateCheck(CUSTOMER, h.clock.now)).toBe('ok');
    await h.control.setPaused(true, ADMIN, null);
    expect(protection.templateCheck(CUSTOMER, h.clock.now)).toBe('paused');
    expect(protection.reserve('outbound', h.clock.now)).toBeNull();
    expect(protection.reserve('template', h.clock.now)).toBeNull();
  });

  it('CA-15: ningún log lleva el número completo ni la clave', async () => {
    const h = await protectedHarness({ limits: { messagesPerNumberDay: 5, templatesDay: 1 } });
    await readyToConfirm(h);
    await h.ask('1');
    for (let i = 0; i < 3; i += 1) await h.ask('ayuda');
    const text = JSON.stringify(h.logger.lines);
    expect(text).not.toContain('5500001234');
    expect(text).not.toContain(BOT_ENV.WHATSAPP_BOT_BLOCKLIST_KEY);
  });
});
