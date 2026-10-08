import { BUSINESS_IDS, type BusinessId } from '../../config/businesses.ts';
import { commonContent } from '../../content/index.ts';
import { botText, getBotContent } from '../../content/bot.ts';
import { getBusinessHours } from '../../content/hours.ts';
import { formatPesos } from '../price.ts';
import type { BotCatalog, CatalogOption } from './catalog.ts';
import { acceptsOrders, describeHours, describeOpening, isOpen, nextOpening } from './schedule.ts';
import { chunkText, fill } from './text.ts';

/**
 * Textos que envía el bot (REQ-F-009, RF-4): todo sale del contenido de cada negocio
 * (src/content/<negocio>/bot.ts y src/content/common/bot.ts) y del horario estructurado (REQ-F-010). Funciones puras.
 */

export interface CartLine {
  readonly slug: string;
  readonly optionKey: string;
  readonly productName: string;
  readonly optionLabel: string;
  readonly unitPriceCents: number;
  readonly quantity: number;
}

export type DeliveryMethod = 'pickup' | 'delivery';

export interface OrderDetails {
  readonly code: string;
  readonly business: BusinessId;
  readonly lines: readonly CartLine[];
  readonly name: string;
  readonly delivery: DeliveryMethod;
  readonly address: string | undefined;
  readonly notes: string;
  /** Próxima apertura si el pedido se hace fuera de horario (RF-6.2), o null. */
  readonly offHoursOpening: string | null;
}

export const otherBusiness = (business: BusinessId): BusinessId => BUSINESS_IDS.find((id) => id !== business) as BusinessId;
const nameOf = (business: BusinessId): string => getBotContent(business).name;

export const lineSubtotal = (line: CartLine): number => line.unitPriceCents * line.quantity;
export const cartTotal = (lines: readonly CartLine[]): number => lines.reduce((sum, line) => sum + lineSubtotal(line), 0);

const productLabel = (name: string, optionLabel: string): string => (optionLabel === '' ? name : `${name} (${optionLabel})`);
export const lineLabel = (line: CartLine): string => productLabel(line.productName, line.optionLabel);

/** "2 × Molotes de Queso Oaxaca (orden de 3) — $130 c/u = $260". */
export const formatLine = (line: CartLine): string =>
  `${line.quantity} × ${lineLabel(line)} — ${formatPesos(line.unitPriceCents)} ${botText.priceEach} = ${formatPesos(lineSubtotal(line))}`;

const formatOption = (option: CatalogOption): string =>
  option.label === '' ? formatPesos(option.priceCents) : `${option.label} ${formatPesos(option.priceCents)}`;

/** Saludo con el estado del horario y las opciones iniciales (RF-4.1, RF-6.2). */
export function greeting(business: BusinessId, now: Date, timeZone: string): string {
  const content = getBotContent(business);
  const hours = getBusinessHours(business);
  const opening = { apertura: describeOpening(nextOpening(business, now, timeZone)) };
  let status: string;
  if (isOpen(business, now, timeZone)) status = fill(botText.openNow, { cierre: hours.closes });
  else if (acceptsOrders(business, now, timeZone)) status = fill(botText.closedNow, opening);
  else status = fill(botText.closedNoOrders, opening);
  return [fill(botText.greeting, { negocio: content.name, lema: content.tagline }), status, '', botText.rootOptions, '', botText.keywordsHint].join('\n');
}

/** Días y horario del otro negocio (RF-3.4, CA-8). */
export const otherBusinessNote = (business: BusinessId): string => {
  const other = otherBusiness(business);
  return fill(botText.otherBusiness, { otro: nameOf(other), horarioOtro: describeHours(getBusinessHours(other)), negocio: nameOf(business) });
};

export const hoursAndLocation = (business: BusinessId): string =>
  fill(botText.hoursAndLocation, { negocio: nameOf(business), horario: describeHours(getBusinessHours(business)), mapa: commonContent.location.mapsUrl });

/** D-16: el negocio no toma pedidos; cuándo abre y cuándo abre el otro. */
export function ordersClosed(business: BusinessId, now: Date, timeZone: string): string {
  const other = otherBusiness(business);
  return fill(botText.ordersClosed, {
    negocio: nameOf(business),
    apertura: describeOpening(nextOpening(business, now, timeZone)),
    otro: nameOf(other),
    aperturaOtro: describeOpening(nextOpening(other, now, timeZone)),
  });
}

export const personContact = (business: BusinessId, contact: string): string => fill(botText.person, { negocio: nameOf(business), contacto: contact });

/** Menú numerado por secciones (RF-4.2), partido en mensajes de hasta 4096 caracteres. */
export function menuMessages(business: BusinessId, catalog: BotCatalog): string[] {
  const content = getBotContent(business);
  const lines = [fill(botText.menuTitle, { negocio: content.name })];
  let number = 0;
  for (const section of catalog.sections) {
    lines.push('', `*${content.sections[section.category]}*`);
    for (const product of section.products) {
      number += 1;
      lines.push(`${number}. ${product.name} — ${product.options.map(formatOption).join(' · ')}`);
    }
  }
  lines.push('', botText.menuPrompt);
  return chunkText(lines.join('\n'));
}

export const menuEmpty = (business: BusinessId): string => fill(botText.menuEmpty, { negocio: nameOf(business) });

export const optionsPrompt = (productName: string, options: readonly CatalogOption[]): string =>
  fill(botText.chooseOption, { producto: productName, opciones: options.map((option, index) => `${index + 1}. ${formatOption(option)}`).join('\n') });

export function cartView(lines: readonly CartLine[]): string {
  if (lines.length === 0) return botText.cartEmpty;
  return [botText.cartTitle, ...lines.map((line, index) => `${index + 1}. ${formatLine(line)}`), `*Total: ${formatPesos(cartTotal(lines))}*`].join('\n');
}

export const cartWithOptions = (lines: readonly CartLine[]): string => `${cartView(lines)}\n\n${botText.cartOptions}`;

export const removePrompt = (lines: readonly CartLine[]): string =>
  fill(botText.removePrompt, { lineas: lines.map((line, index) => `${index + 1}. ${lineLabel(line)}`).join('\n') });

const deliveryText = (order: Pick<OrderDetails, 'delivery' | 'address'>): string =>
  order.delivery === 'delivery' ? fill(botText.delivery, { direccion: order.address ?? '' }) : botText.pickup;

/** Resumen para el cliente (RF-4.5). */
export function summary(order: OrderDetails): string {
  const lines = [
    fill(botText.summaryTitle, { codigo: order.code, negocio: nameOf(order.business) }),
    ...order.lines.map(formatLine),
    `*Total: ${formatPesos(cartTotal(order.lines))}*`,
    `Entrega: ${deliveryText(order)}`,
    `Nombre: ${order.name}`,
    `Notas: ${order.notes === '' ? botText.noNotes : order.notes}`,
  ];
  if (order.delivery === 'delivery') lines.push(botText.deliveryCost);
  if (order.offHoursOpening !== null) lines.push('', fill(botText.offHours, { apertura: order.offHoursOpening }));
  lines.push('', botText.confirmPrompt);
  return lines.join('\n');
}

export const confirmedMessage = (order: Pick<OrderDetails, 'code' | 'business'>): string =>
  fill(botText.confirmed, { codigo: order.code, negocio: nameOf(order.business) });

/** D-18: el aviso al personal falló; contacto directo. */
export const staffFailedMessage = (order: Pick<OrderDetails, 'code' | 'business'>, contact: string): string =>
  fill(botText.staffFailed, { codigo: order.code, negocio: nameOf(order.business), contacto: contact });

/**
 * Parámetro de plantilla: sin saltos de línea ni tabuladores, sin espacios repetidos y nunca
 * vacío (la Cloud API rechaza esos valores; error 132018).
 */
const templateParam = (value: string): string => {
  const clean = value
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();
  return clean === '' ? '-' : clean;
};

/** Línea del pedido en el aviso al personal: "2 × Agua a $35 = $70". */
const staffLine = (line: CartLine): string => `${line.quantity} × ${lineLabel(line)} a ${formatPesos(line.unitPriceCents)} = ${formatPesos(lineSubtotal(line))}`;

/** Parámetros con nombre de la plantilla del aviso al personal (DT-6; README). */
export function staffTemplateParams(order: OrderDetails, customerWaId: string): Record<string, string> {
  const params = {
    codigo: order.code,
    negocio: nameOf(order.business),
    horario: order.offHoursOpening === null ? botText.staffHours : fill(botText.staffOffHours, { apertura: order.offHoursOpening }),
    cliente: order.name,
    whatsapp: `+${customerWaId}`,
    entrega: deliveryText(order),
    lineas: order.lines.map(staffLine).join('; '),
    total: formatPesos(cartTotal(order.lines)),
    notas: order.notes === '' ? botText.noNotes : order.notes,
  };
  return Object.fromEntries(Object.entries(params).map(([key, value]) => [key, templateParam(value)]));
}

/**
 * Aviso al personal como texto libre (REQ-F-012, D-6), con los mismos datos que la plantilla
 * (REQ-F-009 CA-14): una línea por producto, el resto sin saltos de línea del cliente.
 */
export function staffNoticeText(order: OrderDetails, customerWaId: string): string {
  const params = staffTemplateParams(order, customerWaId);
  return fill(botText.staffNotice, { ...params, lineas: order.lines.map((line) => templateParam(staffLine(line))).join('\n') });
}
