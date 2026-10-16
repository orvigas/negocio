import { describe, expect, it } from 'vitest';

import { BUSINESS_IDS, type BusinessId } from '../../src/config/businesses.ts';
import { botText } from '../../src/content/bot.ts';
import { buildCatalog } from '../../src/services/whatsapp-bot/catalog.ts';
import { handleTurn, type Conversation, type TurnContext, type TurnResult } from '../../src/services/whatsapp-bot/conversation.ts';
import { createDeterministicInterpreter } from '../../src/services/whatsapp-bot/interpreter/deterministic.ts';
import {
  MAX_TEMPLATE_BODY_CHARS,
  buildStaffTemplate,
  confirmedMessage,
  hydrateStaffTemplate,
  staffNoticeText,
  type CartLine,
  type OrderDetails,
} from '../../src/services/whatsapp-bot/messages.ts';
import type { PaymentMethod } from '../../src/services/whatsapp-bot/payment.ts';
import { TWILIO_MAX_TEXT_CHARS } from '../../src/services/whatsapp-bot/providers/twilio/twilio-bot.ts';
import { splitMessage } from '../../src/services/whatsapp-bot/text.ts';
import { makeProductRepository } from '../support/products.ts';
import { WEEK, mx } from '../support/whatsapp.ts';

/**
 * QA de REQ-F-035 (QA Action Plan aprobado): casos negativos y límite que completan
 * `whatsapp-bot-payment.test.ts`. QA-N2 (números fuera de rango, mayúsculas), QA-N4 (guarda de
 * RN-2 al confirmar), QA-L1 (recorte extremo del aviso al personal), QA-L2 (confirmación larga
 * en Twilio) y QA-L3 (intérprete con puntos, varios pagos y mayúsculas).
 */

const IN_HOURS: Record<BusinessId, Date> = { molotes: mx(`${WEEK.tue}T12:00`), birria: mx(`${WEEK.sat}T12:00`) };
const LANDING: Record<BusinessId, string> = {
  molotes: 'Hola, quiero hacer un pedido de molotes',
  birria: 'Hola, quiero hacer un pedido de birria',
};
const ITEMS: Record<BusinessId, string> = { molotes: '2 de queso', birria: '2 tacos' };
const PICKUP_PROMPT = '💳 *¿Cómo vas a pagar?*\n*1.* Efectivo\n*2.* Tarjeta\n*3.* Transferencia';
const DELIVERY_PROMPT = '💳 *¿Cómo vas a pagar?*\n*1.* Pagar al recibir\n*2.* Transferencia';
const CONTACT = 'https://wa.me/5215511110001';
const { repository } = await makeProductRepository();
const interpreter = createDeterministicInterpreter();

/** Conversación pura: aplica `edit` a la conversación antes del turno indicado (para forzar estados). */
function run(business: BusinessId, inputs: readonly string[], edit?: { before: number; apply: (conversation: Conversation) => void }): TurnResult[] {
  let conversation: Conversation | null = null;
  let now = IN_HOURS[business];
  const results: TurnResult[] = [];
  for (const [turn, text] of inputs.entries()) {
    now = new Date(now.getTime() + 3000);
    const ctx: TurnContext = {
      now,
      timeZone: 'America/Mexico_City',
      catalog: (id) => buildCatalog(id, repository.getPublished(id)),
      interpreter,
      staffContact: () => CONTACT,
      newCode: (prefix) => `${prefix}-Q001`,
      newId: () => 'conv',
    };
    if (edit !== undefined && edit.before === turn && conversation !== null) edit.apply(conversation);
    const result = handleTurn(conversation, { kind: 'text', text }, ctx);
    conversation = result.conversation;
    results.push(result);
  }
  return results;
}

const replyOf = (result: TurnResult | undefined): string => result?.replies.join('\n\n') ?? '';

describe.each(BUSINESS_IDS)('QA-N2: entradas no válidas o con otro formato en la pregunta de pago (%s)', (business) => {
  it('"0" y "3" a domicilio no son opciones; la pregunta se repite y no hay resumen', () => {
    const results = run(business, [LANDING[business], ITEMS[business], 'Ana, domicilio, Calle 5 #10, Centro', '0', '3', '-1', '2.5']);
    for (const result of results.slice(3)) {
      expect(replyOf(result)).toContain(DELIVERY_PROMPT);
      expect(replyOf(result)).not.toContain('Resumen de tu pedido');
      expect(result.conversation?.customer.payment).toBeUndefined();
    }
  });

  it.each<[string, PaymentMethod, string]>([
    ['TRANSFERENCIA', 'transfer', 'Transferencia'],
    ['Efectivo', 'cash', 'Efectivo'],
    ['  tarjeta  ', 'card', 'Tarjeta'],
    ['con tarjeta', 'card', 'Tarjeta'],
  ])('al recoger, "%s" se reconoce y llega al resumen', (text, method, label) => {
    const results = run(business, [LANDING[business], ITEMS[business], 'Ana, recoger', text]);
    expect(replyOf(results[2])).toBe(PICKUP_PROMPT);
    expect(results[3]?.conversation?.customer.payment).toBe(method);
    expect(replyOf(results[3])).toContain(`*Pago:* ${label}`);
  });

  it('a domicilio, "Al Recibir" se reconoce y el resumen no lleva datos bancarios', () => {
    const results = run(business, [LANDING[business], ITEMS[business], 'Ana, domicilio, Calle 5 #10, Centro', 'Al Recibir']);
    const reply = replyOf(results[3]);
    expect(reply).toContain('*Pago:* Pagar al recibir');
    expect(reply).not.toContain('CLABE');
    expect(reply).not.toContain('comprobante');
  });
});

describe.each(BUSINESS_IDS)('QA-N4: guarda de RN-2 al confirmar (%s)', (business) => {
  it('un "sí" sin forma de pago válida no envía el pedido y vuelve a preguntar el pago', () => {
    const results = run(business, [LANDING[business], ITEMS[business], 'Ana, recoger, efectivo', 'sí'], {
      before: 3,
      apply: (conversation) => {
        delete conversation.customer.payment;
      },
    });
    expect(replyOf(results[2])).toContain('Resumen de tu pedido');
    expect(results[3]?.order ?? null).toBeNull();
    expect(replyOf(results[3])).toContain(PICKUP_PROMPT);
  });

  it('un pago que ya no vale para la entrega guardada (tarjeta a domicilio) tampoco se envía', () => {
    const results = run(business, [LANDING[business], ITEMS[business], 'Ana, domicilio, Calle 5 #10, Centro, transferencia', 'sí'], {
      before: 3,
      apply: (conversation) => {
        conversation.customer.payment = 'card';
      },
    });
    expect(results[3]?.order ?? null).toBeNull();
    expect(replyOf(results[3])).toContain(DELIVERY_PROMPT);
  });
});

const line = (index: number, char: string): CartLine => ({
  slug: `p${index}`,
  optionKey: 'unico',
  productName: char.repeat(80),
  optionLabel: char.repeat(40),
  unitPriceCents: 999_999,
  quantity: 99,
  detail: char.repeat(60),
});

const order = (overrides: Partial<OrderDetails> = {}): OrderDetails => ({
  code: 'B-QA01',
  business: 'birria',
  lines: [line(1, 'x')],
  name: 'Ana',
  delivery: 'delivery',
  address: 'Calle 5 #10, Centro',
  notes: '',
  payment: 'transfer',
  offHoursOpening: null,
  ...overrides,
});

const STAFF_LABELS: Record<PaymentMethod, string> = { cash: 'efectivo', card: 'tarjeta', transfer: 'transferencia', onDelivery: 'pagar al recibir' };

describe('QA-L1: aviso al personal en el peor caso (RF-6.3, CA-14)', () => {
  const cases: [string, 'pickup' | 'delivery', PaymentMethod][] = [];
  for (const char of ['x', '🌮', 'ñ']) {
    for (const method of ['cash', 'card', 'transfer'] as const) cases.push([char, 'pickup', method]);
    for (const method of ['onDelivery', 'transfer'] as const) cases.push([char, 'delivery', method]);
  }

  it.each(cases)('"%s", %s, %s: ≤ 1024 y "· Pago: <método>" completo en la plantilla y el texto libre (sin presupuesto propio)', (char, delivery, payment) => {
    const extreme = order({
      lines: Array.from({ length: 15 }, (_, index) => line(index + 1, char)),
      name: char.repeat(60),
      delivery,
      address: delivery === 'delivery' ? char.repeat(200) : undefined,
      notes: char.repeat(200),
      payment,
    });
    const { params } = buildStaffTemplate(extreme, '5215500001234');
    const label = STAFF_LABELS[payment];
    expect(hydrateStaffTemplate(params).length).toBeLessThanOrEqual(MAX_TEMPLATE_BODY_CHARS);
    expect(params.entrega?.endsWith(` · Pago: ${label}`)).toBe(true);
    const text = staffNoticeText(extreme, '5215500001234');
    expect(text).toContain(` · Pago: ${label}\n`);
    expect(text).toContain('B-QA01');
  });
});

describe('QA-L2: confirmación con transferencia y pedido largo en Twilio (CA-18)', () => {
  it.each(['pickup', 'delivery'] as const)('%s: cada parte ≤ 1600 y el bloque de transferencia queda entero en una parte', (delivery) => {
    const big = order({
      lines: Array.from({ length: 15 }, (_, index) => line(index + 1, 'x')),
      delivery,
      address: delivery === 'delivery' ? 'a'.repeat(200) : undefined,
      offHoursOpening: null,
    });
    const text = confirmedMessage(big, CONTACT);
    const parts = splitMessage(text, TWILIO_MAX_TEXT_CHARS);
    for (const part of parts) expect(part.length).toBeLessThanOrEqual(TWILIO_MAX_TEXT_CHARS);
    const last = parts.at(-1) ?? '';
    expect(last.endsWith(CONTACT)).toBe(true);
    expect(parts.some((part) => part.includes('CLABE:\n') && part.includes('Concepto: *B-QA01*'))).toBe(true);
  });
});

describe('QA-L3: pago escrito con los datos, formatos poco comunes (RF-2)', () => {
  it.each([
    ['Ana, domicilio, Av. Juárez 10. Centro, transferencia', { name: 'Ana', delivery: 'delivery', address: 'Av. Juárez 10. Centro', payment: 'transfer' }],
    ['Ana, RECOGER, Efectivo', { name: 'Ana', delivery: 'pickup', payment: 'cash' }],
    ['Ana, recoger, efectivo.', { name: 'Ana', delivery: 'pickup', payment: 'cash' }],
    ['Ana, recoger, tarjeta, efectivo', { name: 'Ana', delivery: 'pickup', payment: 'cash' }],
    ['Ana, domicilio, Calle Efectivo 3, Centro', { name: 'Ana', delivery: 'delivery', address: 'Calle Efectivo 3, Centro' }],
  ])('"%s"', (text, expected) => {
    expect(interpreter.customerData(text)).toEqual(expected);
  });

  it.each(BUSINESS_IDS)('%s: la dirección con puntos llega intacta al resumen y al aviso al personal', (business) => {
    const results = run(business, [LANDING[business], ITEMS[business], 'Ana, domicilio, Av. Juárez 10. Centro, transferencia', 'sí']);
    expect(replyOf(results[2])).toContain('Av. Juárez 10. Centro\n');
    expect(results[3]?.order?.address).toBe('Av. Juárez 10. Centro');
    expect(results[3]?.order?.payment).toBe('transfer');
  });

  it('el aviso de método no válido escrito con los datos solo aparece una vez', () => {
    const results = run('birria', [LANDING.birria, ITEMS.birria, 'Ana, domicilio, Calle 5 #10, Centro, efectivo']);
    const reply = replyOf(results[2]);
    expect(reply).toBe(`${botText.paymentNotFor.delivery}\n\n${DELIVERY_PROMPT}`);
    expect(results[2]?.conversation?.customer.address).toBe('Calle 5 #10, Centro');
  });
});
