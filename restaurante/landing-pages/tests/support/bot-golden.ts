import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { BusinessId } from '@restaurante/core/shared';

import { buildCatalog } from '../../src/services/whatsapp-bot/catalog.ts';
import { handleTurn, type Conversation, type TurnContext, type TurnResult } from '../../src/services/whatsapp-bot/conversation.ts';
import { createDeterministicInterpreter } from '../../src/services/whatsapp-bot/interpreter/deterministic.ts';
import { buildStaffTemplate, hydrateStaffTemplate, staffNoticeText, type CartLine, type OrderDetails } from '../../src/services/whatsapp-bot/messages.ts';
import { makeProductRepository } from './products.ts';
import { WEEK, mx } from './whatsapp.ts';

/**
 * Invariantes doradas de REQ-F-029 (CA-8 y CA-9): lo que no debe cambiar al reacomodar los textos
 * del bot. Los valores esperados están en tests/fixtures/bot-golden/ y se generaron con el código
 * anterior al cambio de formato; las pruebas nunca los regeneran.
 *
 * Cambio intencional (REQ-F-035, forma de pago): se regeneraron una sola vez, con revisión del diff.
 * Cambian solo el parámetro `entrega` (termina en " · Pago: <método>"), el paso `payment`, el campo
 * `customer.payment`, el `payment` de los pedidos y los turnos de pago agregados a los recorridos.
 */

const GOLDEN_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'bot-golden');
export const loadGolden = (name: 'template' | 'flow'): unknown => JSON.parse(readFileSync(join(GOLDEN_DIR, `${name}.json`), 'utf8'));

const CUSTOMER_WA_ID = '5215500001234';

const line = (slug: string, optionKey: string, productName: string, optionLabel: string, unitPriceCents: number, quantity: number, detail = ''): CartLine => ({
  slug,
  optionKey,
  productName,
  optionLabel,
  unitPriceCents,
  quantity,
  detail,
});

const QUESO = line('queso-oaxaca', 'orden', 'Molotes de Queso Oaxaca', 'orden de 3', 13000, 2);
const REFRESCO = line('refrescos', 'unico', 'Refrescos Familia Coca-Cola', '', 3500, 1, 'Coca-Cola Sin Azúcar');
const CONSOME = line('consome-chico', 'v:Con Carne', 'Tazón de Consomé Chico', 'Con Carne', 8000, 1);
const BEBIDA = line('bebidas', 'v:Aguas Frescas', 'Bebidas Frías del Comal', 'Aguas Frescas', 3500, 2, 'Horchata');

const order = (overrides: Partial<OrderDetails>): OrderDetails => ({
  code: 'M-AB12',
  business: 'molotes',
  lines: [QUESO, REFRESCO],
  name: 'Ana',
  delivery: 'pickup',
  address: undefined,
  notes: '',
  payment: 'cash',
  offHoursOpening: null,
  ...overrides,
});

/** Pedidos de CA-8: recoger y domicilio, en horario y fuera de horario, y uno que se compacta. */
export const TEMPLATE_ORDERS: Readonly<Record<string, OrderDetails>> = Object.freeze({
  'molotes-recoger-en-horario': order({}),
  'molotes-domicilio-fuera-de-horario': order({
    delivery: 'delivery',
    address: 'Calle 5 #10, Centro',
    notes: 'Sin cebolla, por favor',
    payment: 'transfer',
    offHoursOpening: 'el martes a las 08:30',
  }),
  'birria-domicilio-en-horario': order({
    code: 'B-CD34',
    business: 'birria',
    lines: [CONSOME, BEBIDA],
    name: 'Luis',
    delivery: 'delivery',
    address: 'Av. Juárez 120, Col. Americana, frente al parque',
    payment: 'onDelivery',
  }),
  'birria-recoger-fuera-de-horario': order({ code: 'B-EF56', business: 'birria', lines: [CONSOME, BEBIDA], payment: 'card', offHoursOpening: 'el sábado a las 08:00' }),
  'molotes-grande-compactado': order({
    code: 'M-GH78',
    lines: Array.from({ length: 15 }, (_, index) =>
      line(`p${index}`, 'unico', `Producto de prueba con un nombre largo número ${index + 1}`, '', 4500 + index * 100, (index % 9) + 1, 'Detalle de sesenta caracteres para medir la compactación ok'),
    ),
    name: 'Nombre de cliente bastante largo para la prueba',
    delivery: 'delivery',
    address: 'Calle muy larga 1234, Colonia con nombre largo, entre calles A y B, junto a la tienda azul',
    notes: 'Notas largas: sin cebolla, con salsa aparte, tocar el timbre dos veces y esperar en la puerta',
    payment: 'onDelivery',
  }),
});

/** Lo que recibe el personal por cada pedido (plantilla de Meta y texto libre de Twilio). */
export function templateTraces(): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(TEMPLATE_ORDERS).map(([name, details]) => {
      const { params, level } = buildStaffTemplate(details, CUSTOMER_WA_ID);
      return [name, { params, level, body: hydrateStaffTemplate(params), text: staffNoticeText(details, CUSTOMER_WA_ID) }];
    }),
  );
}

/** Recorridos de CA-9: por números y en texto libre, en los dos negocios. */
export const FLOW_SCRIPTS: readonly { readonly name: string; readonly at: string; readonly inputs: readonly string[] }[] = Object.freeze([
  { name: 'molotes-numeros', at: `${WEEK.tue}T10:00`, inputs: ['Hola, quiero hacer un pedido de molotes', '1', '2', '2', '1', '10', '1', '4', 'Juan, recoger', '1', '1'] },
  {
    name: 'molotes-texto-libre-domicilio',
    at: `${WEEK.tue}T10:00`,
    inputs: ['Hola, quiero 2 órdenes de queso y una coca', 'quita la coca', '1 coca sin azucar', 'Ana, domicilio, Calle 5 #10, Centro, transferencia', 'sin cebolla', 'sí'],
  },
  { name: 'molotes-palabras-clave', at: `${WEEK.wed}T11:00`, inputs: ['Hola', 'ayuda', 'menú', '3', '1', '2', 'carrito', '3', 'persona', 'cancelar'] },
  { name: 'molotes-fuera-de-horario', at: `${WEEK.tue}T07:00`, inputs: ['Hola', '2 de queso', 'Luis, recoger, tarjeta', 'agrega una coca', 'sí'] },
  { name: 'birria-aclaracion', at: `${WEEK.sat}T10:00`, inputs: ['Hola, quiero hacer un pedido de birria', 'consomé, una bebida y 2 tacos', '2, 1', 'Ana, recoger', 'transferencia', 'sí'] },
  {
    name: 'birria-quitar-y-datos-por-pasos',
    at: `${WEEK.sat}T10:00`,
    inputs: ['Hola', '3 quesabirrias y un consome chico con carne', '2', '1', '4', 'Ana, domicilio', 'Calle 5 #10, Centro', '1', 'quita las quesabirrias', 'confirmo'],
  },
  { name: 'birria-otro-negocio', at: `${WEEK.sun}T09:00`, inputs: ['Hola, quiero molotes', 'menú', 'quiero hacer un pedido', '1'] },
  { name: 'molotes-sin-pedidos', at: `${WEEK.fri}T18:00`, inputs: ['Hola', '2 de queso', 'menú'] },
]);

/** Recorre FLOW_SCRIPTS con `handleTurn` (sin proveedor) y entrega cada turno a `visit`. */
export async function runFlowScripts(visit: (script: string, input: string, result: TurnResult) => void): Promise<void> {
  const products = (await makeProductRepository()).repository;
  const interpreter = createDeterministicInterpreter();
  for (const script of FLOW_SCRIPTS) {
    let codes = 0;
    let now = mx(script.at);
    let conversation: Conversation | null = null;
    for (const input of script.inputs) {
      now = new Date(now.getTime() + 3000);
      const ctx: TurnContext = {
        now,
        timeZone: 'America/Mexico_City',
        catalog: (business: BusinessId) => buildCatalog(business, products.getPublished(business)),
        staffContact: (business: BusinessId) => `https://wa.me/${business}`,
        newCode: (prefix) => `${prefix}-T${String((codes += 1)).padStart(3, '0')}`,
        newId: () => 'conv',
        interpreter,
      };
      const result = handleTurn(conversation, { kind: 'text', text: input }, ctx);
      conversation = result.conversation;
      visit(script.name, input, result);
    }
  }
}

/** Estado del flujo turno por turno, sin los textos (que sí cambian con REQ-F-029). */
export async function flowTraces(): Promise<Record<string, unknown[]>> {
  const traces: Record<string, unknown[]> = {};
  await runFlowScripts((script, input, result) => {
    const conversation = result.conversation;
    (traces[script] ??= []).push({
      input,
      replies: result.replies.length,
      cancelled: result.cancelled,
      order: result.order,
      interpretations: result.interpretations,
      state: conversation && {
        business: conversation.business,
        step: conversation.step,
        pending: conversation.pending,
        menu: conversation.menu,
        cart: conversation.cart,
        customer: conversation.customer,
        code: conversation.code,
        clarify: conversation.clarify,
        removeChoices: conversation.removeChoices,
      },
    });
  });
  return traces;
}
