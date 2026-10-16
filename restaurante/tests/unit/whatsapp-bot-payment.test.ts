import { describe, expect, it } from 'vitest';

import { BUSINESS_IDS, type BusinessId } from '../../src/config/businesses.ts';
import { botText, getBankAccount, type BankAccount } from '../../src/content/bot.ts';
import { buildWhatsAppLink } from '../../src/services/whatsapp.ts';
import { buildCatalog, type BotCatalog } from '../../src/services/whatsapp-bot/catalog.ts';
import { handleTurn, type Conversation, type TurnContext, type TurnResult } from '../../src/services/whatsapp-bot/conversation.ts';
import { createDeterministicInterpreter } from '../../src/services/whatsapp-bot/interpreter/deterministic.ts';
import {
  MAX_TEMPLATE_BODY_CHARS,
  buildStaffTemplate,
  confirmedMessage,
  hydrateStaffTemplate,
  paymentPrompt,
  staffNoticeText,
  summary,
  transferBlock,
  type CartLine,
  type OrderDetails,
} from '../../src/services/whatsapp-bot/messages.ts';
import { PAYMENT_OPTIONS, isPaymentValid, type PaymentMethod } from '../../src/services/whatsapp-bot/payment.ts';
import { TWILIO_MAX_TEXT_CHARS } from '../../src/services/whatsapp-bot/providers/twilio/twilio-bot.ts';
import { MAX_LINE_WIDTH, fill, splitMessage, visibleWidth } from '../../src/services/whatsapp-bot/text.ts';
import { makeProductRepository } from '../support/products.ts';
import { CUSTOMER, STAFF, WEEK, inboundPayload, makeBotHarness, mx, type BotHarness } from '../support/whatsapp.ts';

/**
 * Forma de pago en el bot de WhatsApp (REQ-F-035): pregunta según la entrega, pago escrito con los
 * datos, coherencia con la entrega, bloque de transferencia en el resumen y la confirmación, y el
 * pago en el aviso al personal. Los recorridos se repiten para Molotes y Birria (CA-17).
 */

const IN_HOURS: Record<BusinessId, Date> = { molotes: mx(`${WEEK.tue}T12:00`), birria: mx(`${WEEK.sat}T12:00`) };
/** Fuera de horario, pero con pedidos abiertos (D-16). */
const OFF_HOURS: Record<BusinessId, Date> = { molotes: mx(`${WEEK.mon}T10:00`), birria: mx(`${WEEK.sat}T07:00`) };
const LANDING: Record<BusinessId, string> = {
  molotes: 'Hola, quiero hacer un pedido de molotes',
  birria: 'Hola, quiero hacer un pedido de birria',
};
const ITEMS: Record<BusinessId, string> = { molotes: '2 de queso', birria: '2 tacos' };
const staffLink = (business: BusinessId): string => buildWhatsAppLink({ phone: STAFF[business] });

const PICKUP_PROMPT = '💳 *¿Cómo vas a pagar?*\n*1.* Efectivo\n*2.* Tarjeta\n*3.* Transferencia';
const DELIVERY_PROMPT = '💳 *¿Cómo vas a pagar?*\n*1.* Pagar al recibir\n*2.* Transferencia';
const ADDRESS = 'Calle 5 #10, Centro';
const { repository } = await makeProductRepository();

async function withCart(business: BusinessId, at: Date = IN_HOURS[business]): Promise<BotHarness> {
  const h = await makeBotHarness({ at });
  await h.ask(LANDING[business]);
  await h.ask(ITEMS[business]);
  return h;
}

const codeOf = (text: string): string => /\*([MB]-T\d{3})\* · /.exec(text)?.[1] ?? '';
const optionCount = (text: string): number => text.split('\n').filter((row) => /^\*\d+\.\* /.test(row)).length;

const account = getBankAccount();
const transferData = (code: string, bank: BankAccount = account): string =>
  fill(botText.transferData, { beneficiario: bank.beneficiary, banco: bank.bank, clabe: bank.clabe, codigo: code });
const proof = (code: string, contact: string): string => fill(botText.transferProof, { codigo: code, contacto: contact });

describe.each(BUSINESS_IDS)('pregunta de la forma de pago en %s (RF-1, RF-2, RF-3)', (business) => {
  it('CA-1: al recoger pregunta con exactamente 3 opciones', async () => {
    const h = await withCart(business);
    const reply = await h.ask('Ana, recoger');
    expect(reply).toBe(PICKUP_PROMPT);
    expect(optionCount(reply)).toBe(3);
  });

  it('CA-2: a domicilio, con la dirección válida, pregunta con exactamente 2 opciones', async () => {
    const h = await withCart(business);
    const reply = await h.ask(`Ana, domicilio, ${ADDRESS}`);
    expect(reply).toBe(DELIVERY_PROMPT);
    expect(optionCount(reply)).toBe(2);
  });

  it('CA-3: "5", "hola" o "tarjeta" a domicilio avisan y repiten la pregunta sin pasar al resumen', async () => {
    const h = await withCart(business);
    await h.ask(`Ana, domicilio, ${ADDRESS}`);
    expect(await h.ask('5')).toBe(`${botText.invalidNumber}\n\n${DELIVERY_PROMPT}`);
    expect(await h.ask('hola')).toBe(`${botText.invalidNumber}\n\n${DELIVERY_PROMPT}`);
    expect(await h.ask('tarjeta')).toBe(`${botText.paymentNotFor.delivery}\n\n${DELIVERY_PROMPT}`);
    expect(await h.ask('efectivo')).toBe(`${botText.paymentNotFor.delivery}\n\n${DELIVERY_PROMPT}`);
    // Y al recoger, "al recibir" tampoco vale.
    const pickup = await withCart(business);
    await pickup.ask('Ana, recoger');
    expect(await pickup.ask('al recibir')).toBe(`${botText.paymentNotFor.pickup}\n\n${PICKUP_PROMPT}`);
    expect(await pickup.ask('4')).toBe(`${botText.invalidNumber}\n\n${PICKUP_PROMPT}`);
  });

  it('CA-4: "efectivo" al recoger y "2" a domicilio llegan al resumen con su método', async () => {
    const pickup = await withCart(business);
    await pickup.ask('Ana, recoger');
    const cash = await pickup.ask('efectivo');
    expect(cash).toContain('📝 *Resumen de tu pedido*');
    expect(cash).toContain('🏪 *Entrega:* Recoger en sucursal\n💳 *Pago:* Efectivo\n*Nombre:* Ana');

    const home = await withCart(business);
    await home.ask(`Ana, domicilio, ${ADDRESS}`);
    expect(await home.ask('2')).toContain(`🛵 *Entrega:* A domicilio\n${ADDRESS}\n💳 *Pago:* Transferencia`);
  });

  it('acepta el número de cada opción y las palabras con cortesía ("tarjeta por favor")', async () => {
    for (const [answer, label] of [['2', 'Tarjeta'], ['3', 'Transferencia'], ['tarjeta por favor', 'Tarjeta'], ['por transferencia', 'Transferencia']] as const) {
      const h = await withCart(business);
      await h.ask('Ana, recoger');
      expect(await h.ask(answer)).toContain(`💳 *Pago:* ${label}`);
    }
  });

  it('CA-5: "Ana, recoger, efectivo" va al resumen sin preguntar el pago y sin nota', async () => {
    const h = await withCart(business);
    const reply = await h.ask('Ana, recoger, efectivo');
    expect(reply).not.toContain('¿Cómo vas a pagar?');
    expect(reply).toContain('🏪 *Entrega:* Recoger en sucursal\n💳 *Pago:* Efectivo\n*Nombre:* Ana\n*Notas:* Sin notas');
  });

  it('CA-6: "tarjeta" a domicilio no se toma: avisa y pregunta con las opciones de domicilio', async () => {
    const h = await withCart(business);
    expect(await h.ask(`Ana, domicilio, ${ADDRESS}, tarjeta`)).toBe(`${botText.paymentNotFor.delivery}\n\n${DELIVERY_PROMPT}`);
    const reply = await h.ask('1');
    expect(reply).toContain(`🛵 *Entrega:* A domicilio\n${ADDRESS}\n💳 *Pago:* Pagar al recibir`);
  });

  it('CA-7: si la entrega cambia a domicilio antes del resumen, la tarjeta se descarta y se pregunta de nuevo', async () => {
    const h = await withCart(business);
    expect(await h.ask('recoger, tarjeta')).toBe(botText.askName);
    expect(await h.ask(`Ana, domicilio, ${ADDRESS}`)).toBe(DELIVERY_PROMPT);

    // Desde el paso de pago: el cliente corrige la entrega.
    const other = await withCart(business);
    expect(await other.ask('Ana, recoger')).toBe(PICKUP_PROMPT);
    expect(await other.ask('domicilio')).toBe(botText.askAddress);
    expect(await other.ask(ADDRESS)).toBe(DELIVERY_PROMPT);
  });

  it('RF-1.5: las palabras clave siguen funcionando en la pregunta de pago', async () => {
    const h = await withCart(business);
    await h.ask('Ana, recoger');
    expect(await h.ask('carrito')).toContain('🛒 *Tu pedido*');
    const help = await withCart(business);
    await help.ask('Ana, recoger');
    expect(await help.ask('ayuda')).toContain(PICKUP_PROMPT);
    const cancel = await withCart(business);
    await cancel.ask('Ana, recoger');
    expect(await cancel.ask('cancelar')).toContain('Pedido cancelado.');
  });

  it('en el resumen, "efectivo" es una nota (como la entrega)', async () => {
    const h = await withCart(business);
    await h.ask('Ana, recoger, tarjeta');
    const reply = await h.ask('efectivo');
    expect(reply).toContain('💳 *Pago:* Tarjeta');
    expect(reply).toContain('*Notas:* efectivo');
  });
});

describe.each(BUSINESS_IDS)('transferencia en el resumen y la confirmación de %s (RF-4, RF-5)', (business) => {
  it('CA-8: recoger en horario: datos, concepto igual al código del título y la indicación del comprobante', async () => {
    const h = await withCart(business);
    const reply = await h.ask('Ana, recoger, transferencia');
    const code = codeOf(reply);
    expect(code).toMatch(business === 'molotes' ? /^M-/ : /^B-/);
    expect(reply).toContain(transferData(code));
    expect(reply).toContain('Beneficiario:\nOrlando Villegas Galan\nBanco: Mercado Pago W\nCLABE:\n722969010833880068');
    expect(reply).toContain(`Concepto: *${code}*`);
    expect(reply).toContain(fill(botText.transferConcept, { codigo: code }));
    expect(reply).toContain(`${proof(code, staffLink(business))}\n\n${botText.confirmPrompt}`);
    expect(reply).toContain('captura del comprobante de tu banca móvil');
    expect(reply).toContain('referencia o clave de rastreo');
    expect(reply).toContain('Una vez confirmado tu pedido, transfiere el total: *$');
    expect(reply).not.toContain(botText.transferWaitDelivery);
    expect(reply).not.toContain(botText.transferWaitOffHours);
  });

  it('CA-9 y CA-11: a domicilio se espera la confirmación del total con envío; la confirmación repite el bloque', async () => {
    const h = await withCart(business);
    const reply = await h.ask(`Ana, domicilio, ${ADDRESS}, transferencia`);
    const code = codeOf(reply);
    expect(reply).toContain(transferData(code));
    expect(reply).toContain(botText.transferWaitDelivery);
    expect(reply).toContain(proof(code, staffLink(business)));
    expect(reply).not.toContain('transfiere el total');

    const confirmed = await h.ask('sí');
    expect(confirmed).toContain(`Tu pedido *${code}* fue enviado`);
    expect(confirmed).toContain(transferData(code));
    expect(confirmed).toContain(fill(botText.transferConcept, { codigo: code }));
    expect(confirmed).toContain(botText.transferWaitDelivery);
    // El enlace del personal queda en el último renglón del mensaje.
    expect(confirmed.split('\n').at(-1)).toBe(staffLink(business));
  });

  it('CA-10 y CA-11: fuera de horario, los datos, el comprobante y la espera de la confirmación', async () => {
    const h = await withCart(business, OFF_HOURS[business]);
    const reply = await h.ask('Ana, recoger, transferencia');
    const code = codeOf(reply);
    expect(reply).toContain('🌙 *FUERA DE HORARIO*');
    expect(reply).toContain(transferData(code));
    expect(reply).toContain(botText.transferWaitOffHours);
    expect(reply).toContain(proof(code, staffLink(business)));

    const confirmed = await h.ask('sí');
    expect(confirmed).toContain(transferData(code));
    expect(confirmed).toContain(botText.transferWaitOffHours);
    expect(confirmed).toContain(proof(code, staffLink(business)));
  });

  it.each([
    ['Ana, recoger, efectivo', 'efectivo'],
    ['Ana, recoger, tarjeta', 'tarjeta'],
    [`Ana, domicilio, ${ADDRESS}, al recibir`, 'pagar al recibir'],
  ])('CA-12 y CA-13: con "%s" no hay CLABE ni comprobante, y el aviso al personal termina en "· Pago: %s"', async (data, staffLabel) => {
    const h = await withCart(business);
    const reply = await h.ask(data);
    const confirmed = await h.ask('sí');
    for (const text of [reply, confirmed]) {
      expect(text).not.toContain(account.clabe);
      expect(text).not.toContain('comprobante');
      expect(text).not.toContain('Datos para transferir');
    }
    expect(confirmed).toBe(fill(botText.confirmed, { codigo: codeOf(reply), negocio: business === 'molotes' ? 'Moloteando' : 'Birria El Muñeco' }));
    const [notice] = h.double.templatesTo(STAFF[business]);
    expect(notice?.template?.params.entrega?.endsWith(`· Pago: ${staffLabel}`)).toBe(true);
  });

  it('CA-13: con transferencia, el aviso de Meta lleva "· Pago: transferencia" en el campo de entrega', async () => {
    const h = await withCart(business);
    await h.ask(`Ana, domicilio, ${ADDRESS}, transferencia`);
    await h.ask('sí');
    const notices = h.double.templatesTo(STAFF[business]);
    expect(notices).toHaveLength(1);
    expect(notices[0]?.template?.params.entrega).toBe(`A domicilio: ${ADDRESS} · Pago: transferencia`);
  });

  it('CA-19: tras confirmar con transferencia, una imagen recibe "solo texto" y un texto empieza otra conversación', async () => {
    const h = await withCart(business);
    await h.ask('Ana, recoger, transferencia');
    await h.ask('sí');
    h.clock.now = new Date(h.clock.now.getTime() + 3000);
    const before = h.double.textsTo(CUSTOMER).length;
    await h.deliver(inboundPayload('image', { at: h.clock.now }));
    expect(h.double.textsTo(CUSTOMER).slice(before).join('\n')).toContain(botText.textOnly);
    expect(h.double.templatesTo(STAFF[business])).toHaveLength(1);

    // Un texto (p. ej. la referencia) tras confirmar empieza otra conversación; no se registra ni se reenvía.
    const text = await withCart(business);
    await text.ask('Ana, recoger, transferencia');
    await text.ask('sí');
    expect(await text.ask('Clave de rastreo 1234567890')).toContain('¡Hola! 👋');
    expect(text.double.templatesTo(STAFF[business])).toHaveLength(1);
    expect(text.double.sent.filter((message) => message.to !== CUSTOMER)).toHaveLength(1);
    expect(JSON.stringify(text.logger.lines)).not.toContain('1234567890');
  });
});

describe('conversación pura: contacto y cambios del catálogo (CA-16, D-13)', () => {
  const interpreter = createDeterministicInterpreter();

  function run(business: BusinessId, inputs: readonly string[], { contact = 'https://wa.me/1', catalog }: { contact?: string; catalog?: (turn: number) => BotCatalog } = {}): TurnResult[] {
    let conversation: Conversation | null = null;
    let now = IN_HOURS[business];
    const results: TurnResult[] = [];
    for (const [turn, text] of inputs.entries()) {
      now = new Date(now.getTime() + 3000);
      const ctx: TurnContext = {
        now,
        timeZone: 'America/Mexico_City',
        catalog: (id) => catalog?.(turn) ?? buildCatalog(id, repository.getPublished(id)),
        interpreter,
        staffContact: () => contact,
        newCode: (prefix) => `${prefix}-T001`,
        newId: () => 'conv',
      };
      const result = handleTurn(conversation, { kind: 'text', text }, ctx);
      conversation = result.conversation;
      results.push(result);
    }
    return results;
  }

  it('CA-16: el enlace de la indicación sale del contacto configurado del personal', () => {
    for (const contact of ['https://wa.me/5215511110001', 'https://wa.me/5219999999999']) {
      const results = run('molotes', [LANDING.molotes, ITEMS.molotes, 'Ana, recoger, transferencia', 'sí'], { contact });
      expect(results[2]?.replies.join('\n')).toContain(`:\n${contact}\n\n${botText.confirmPrompt}`);
      expect(results[3]?.order?.payment).toBe('transfer');
    }
  });

  it('CA-16: ningún texto del bot lleva un número de teléfono fijo', () => {
    expect(JSON.stringify(botText)).not.toMatch(/\d{8,}/);
  });

  it('D-13: si el precio cambia antes del "sí", el resumen actualizado repite el bloque de transferencia con el total nuevo', () => {
    const base = buildCatalog('molotes', repository.getPublished('molotes'));
    const pricier: BotCatalog = {
      ...base,
      products: base.products.map((product) => ({ ...product, options: product.options.map((option) => ({ ...option, priceCents: option.priceCents + 1000 })) })),
      sections: base.sections.map((section) => ({
        ...section,
        products: section.products.map((product) => ({ ...product, options: product.options.map((option) => ({ ...option, priceCents: option.priceCents + 1000 })) })),
      })),
    };
    const results = run('molotes', [LANDING.molotes, ITEMS.molotes, 'Ana, recoger, transferencia', 'sí'], { catalog: (turn) => (turn >= 3 ? pricier : base) });
    const first = results[2]?.replies.join('\n') ?? '';
    const updated = results[3]?.replies.join('\n') ?? '';
    expect(results[3]?.order).toBeNull();
    expect(updated).toContain(botText.catalogChanged);
    expect(updated).toContain(transferData('M-T001'));
    expect(/transfiere el total: \*(\$[\d,]+)\*/.exec(updated)?.[1]).not.toBe(/transfiere el total: \*(\$[\d,]+)\*/.exec(first)?.[1]);
  });
});

const line = (index: number, emoji = ''): CartLine => ({
  slug: `p${index}`,
  optionKey: 'unico',
  productName: `${emoji}Producto ${index} ${'x'.repeat(80)}`.slice(0, 80),
  optionLabel: '',
  unitPriceCents: 12345,
  quantity: 20,
  detail: `${emoji}${'d'.repeat(60)}`.slice(0, 60),
});

const order = (overrides: Partial<OrderDetails> = {}): OrderDetails => ({
  code: 'M-AB12',
  business: 'molotes',
  lines: [line(1)],
  name: 'Ana',
  delivery: 'pickup',
  address: undefined,
  notes: '',
  payment: 'transfer',
  offHoursOpening: null,
  ...overrides,
});

describe('bloque de transferencia y aviso al personal (funciones puras)', () => {
  it('CA-15: con otra cuenta en el único punto de acceso, el bloque muestra los datos nuevos', () => {
    const other: BankAccount = { beneficiary: 'Otra Persona', bank: 'Otro Banco', clabe: '002180700000000019' };
    const block = transferBlock(order(), 'https://wa.me/1', other);
    expect(block).toContain(transferData('M-AB12', other));
    expect(block).not.toContain(account.clabe);
  });

  it('el bloque solo existe con transferencia (RF-4.3)', () => {
    for (const payment of ['cash', 'card', 'onDelivery'] as const) expect(transferBlock(order({ payment }), 'https://wa.me/1')).toBe('');
  });

  it('la CLABE es válida: 18 dígitos y dígito verificador (pesos 3, 7, 1)', () => {
    expect(account.clabe).toMatch(/^\d{18}$/);
    const digits = [...account.clabe].map(Number);
    const weights = [3, 7, 1];
    const sum = digits.slice(0, 17).reduce((total, digit, index) => total + ((digit * (weights[index % 3] ?? 0)) % 10), 0);
    expect((10 - (sum % 10)) % 10).toBe(digits[17]);
  });

  it('RN-1: métodos válidos por entrega', () => {
    expect(PAYMENT_OPTIONS.pickup).toEqual(['cash', 'card', 'transfer']);
    expect(PAYMENT_OPTIONS.delivery).toEqual(['onDelivery', 'transfer']);
    expect(isPaymentValid('card', 'delivery')).toBe(false);
    expect(isPaymentValid('onDelivery', 'pickup')).toBe(false);
  });

  it('CA-13: el texto libre al personal (Twilio sin plantilla) lleva el pago en "Entrega:"', () => {
    expect(staffNoticeText(order(), '5215500001234')).toContain('\nEntrega: Recoger en sucursal · Pago: transferencia\n');
    expect(staffNoticeText(order({ delivery: 'delivery', address: ADDRESS, payment: 'onDelivery' }), '5215500001234')).toContain(
      `\nEntrega: A domicilio: ${ADDRESS} · Pago: pagar al recibir\n`,
    );
  });

  it.each<[string, PaymentMethod, string]>([
    ['x', 'transfer', 'transferencia'],
    ['🌮', 'onDelivery', 'pagar al recibir'],
  ])('CA-14: dirección de 200, nombre y notas al máximo y 15 líneas largas (%s): ≤ 1024 y "Pago: …" completo', (fillChar, payment, label) => {
    const extreme = order({
      lines: Array.from({ length: 15 }, (_, index) => line(index + 1, fillChar === 'x' ? '' : fillChar)),
      name: fillChar.repeat(60),
      delivery: 'delivery',
      address: fillChar.repeat(200),
      notes: fillChar.repeat(200),
      payment,
    });
    const { params } = buildStaffTemplate(extreme, '5215500001234');
    expect(hydrateStaffTemplate(params).length).toBeLessThanOrEqual(MAX_TEMPLATE_BODY_CHARS);
    expect(params.entrega?.endsWith(` · Pago: ${label}`)).toBe(true);
    expect(params.entrega?.startsWith('A domicilio: ')).toBe(true);
    expect(params.lineas?.split('; ')).toHaveLength(15);
  });

  it('CA-14: al recoger, con nombre y notas al máximo, el pago queda completo', () => {
    const extreme = order({ lines: Array.from({ length: 15 }, (_, index) => line(index + 1, '🌮')), name: '🌮'.repeat(60), notes: '🌮'.repeat(200) });
    const { params } = buildStaffTemplate(extreme, '5215500001234');
    expect(hydrateStaffTemplate(params).length).toBeLessThanOrEqual(MAX_TEMPLATE_BODY_CHARS);
    expect(params.entrega).toBe('Recoger en sucursal · Pago: transferencia');
  });

  it('CA-18: renglones estructurados ≤ 28 y partición con Twilio sin cortar el bloque de transferencia', () => {
    for (const delivery of ['pickup', 'delivery'] as const) {
      for (const row of paymentPrompt(delivery).split('\n')) expect(visibleWidth(row), row).toBeLessThanOrEqual(MAX_LINE_WIDTH);
    }
    for (const row of transferData('M-AB12').split('\n')) expect(visibleWidth(row), row).toBeLessThanOrEqual(MAX_LINE_WIDTH);
    const big = order({ lines: Array.from({ length: 15 }, (_, index) => line(index + 1)), delivery: 'delivery', address: 'a'.repeat(200), notes: 'n'.repeat(200) });
    const contact = 'https://wa.me/5215511110001';
    for (const text of [summary(big, contact), confirmedMessage(big, contact)]) {
      const twilio = splitMessage(text, TWILIO_MAX_TEXT_CHARS);
      for (const part of twilio) expect(part.length).toBeLessThanOrEqual(TWILIO_MAX_TEXT_CHARS);
      expect(twilio.some((part) => part.includes(transferData('M-AB12')))).toBe(true);
      expect(twilio.some((part) => part.includes(proof('M-AB12', contact)))).toBe(true);
      for (const part of splitMessage(text)) expect(part.length).toBeLessThanOrEqual(4096);
    }
  });
});

describe('pago escrito con los datos (RF-2; intérprete)', () => {
  const interpreter = createDeterministicInterpreter();

  it.each([
    ['Ana, recoger, efectivo', { name: 'Ana', delivery: 'pickup', payment: 'cash' }],
    ['Ana, domicilio, Calle 5 #10, Centro, tarjeta', { name: 'Ana', delivery: 'delivery', address: 'Calle 5 #10, Centro', payment: 'card' }],
    ['Ana; transferencia; domicilio, Calle 5 #10', { name: 'Ana', delivery: 'delivery', address: 'Calle 5 #10', payment: 'transfer' }],
    ['Luis, domicilio, Reforma 12, pago al recibir', { name: 'Luis', delivery: 'delivery', address: 'Reforma 12', payment: 'onDelivery' }],
    ['Ana, domicilio, Av. Transferencia 10', { name: 'Ana', delivery: 'delivery', address: 'Av. Transferencia 10' }],
    ['Ana recoger efectivo', { name: 'Ana', delivery: 'pickup', note: 'efectivo' }],
    ['Ana, efectivo', {}],
  ])('"%s"', (text, expected) => {
    expect(interpreter.customerData(text)).toEqual(expected);
  });
});

describe('textos del aviso al personal (RF-6)', () => {
  it('los métodos para el personal no llevan emojis', () => {
    for (const label of Object.values(botText.staffPaymentLabels)) expect(label).toMatch(/^[a-z ]+$/);
  });
});
