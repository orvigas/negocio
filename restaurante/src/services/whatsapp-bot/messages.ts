import { BUSINESS_IDS, type BusinessId } from '../../config/businesses.ts';
import { commonContent } from '../../content/index.ts';
import { botText, getBotContent, getBotVocabulary } from '../../content/bot.ts';
import { getBusinessHours } from '../../content/hours.ts';
import { formatPesos } from '../price.ts';
import type { BotCatalog, CatalogOption } from './catalog.ts';
import { acceptsOrders, describeHours, describeOpening, isOpen, nextOpening } from './schedule.ts';
import { INDENT, MAX_LINE_WIDTH, fill, splitMessage, visibleWidth } from './text.ts';

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
  /** Sabor o indicación (REQ-F-013, RF-8): hasta 60 caracteres, '' si no hay. No cambia el precio. */
  readonly detail: string;
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

export const productLabel = (name: string, optionLabel: string): string => (optionLabel === '' ? name : `${name} (${optionLabel})`);
/** "Refrescos Familia Coca-Cola · Coca-Cola Sin Azúcar" (REQ-F-013, RF-8.3). */
export const lineLabel = (line: Pick<CartLine, 'productName' | 'optionLabel' | 'detail'>): string =>
  `${productLabel(line.productName, line.optionLabel)}${line.detail === '' ? '' : ` · ${line.detail}`}`;

/** Ejemplo de pedido del negocio (REQ-F-013, RF-4.1). */
export const exampleOf = (business: BusinessId): string => getBotVocabulary(business).example;

/** Detalle de una línea del pedido en su renglón, en cursiva y con sangría (REQ-F-029, RF-4). */
const detailRow = (line: Pick<CartLine, 'detail'>): string[] => (line.detail === '' ? [] : [`${INDENT}_${line.detail}_`]);

/** Separador entre líneas del pedido: sin sangría (respaldo de RF-3), un renglón en blanco (D-1). */
const ORDER_LINES_SEPARATOR = INDENT === '' ? '\n\n' : '\n';

/**
 * Bloque de una línea del pedido (REQ-F-029, RF-4): "*1.* Nombre (opción)" en el carrito o
 * "- Nombre (opción)" en el resumen; el detalle en cursiva y "2 × $130 c/u = $260", con sangría.
 */
export const orderLineBlock = (line: CartLine, marker: string): string =>
  [
    `${marker} ${productLabel(line.productName, line.optionLabel)}`,
    ...detailRow(line),
    `${INDENT}${line.quantity} × ${formatPesos(line.unitPriceCents)} ${botText.priceEach} = ${formatPesos(lineSubtotal(line))}`,
  ].join('\n');

/** Línea de "Agregado:" (REQ-F-029, RF-4): "- 2 × Nombre (opción)" y el detalle en su renglón. */
export const addedLineBlock = (line: Pick<CartLine, 'quantity' | 'productName' | 'optionLabel' | 'detail'>): string =>
  [`- ${line.quantity} × ${productLabel(line.productName, line.optionLabel)}`, ...detailRow(line)].join('\n');

const orderLines = (lines: readonly CartLine[], marker: (index: number) => string): string =>
  lines.map((line, index) => orderLineBlock(line, marker(index))).join(ORDER_LINES_SEPARATOR);

const totalRow = (lines: readonly CartLine[]): string => `*${fill(botText.total, { total: formatPesos(cartTotal(lines)) })}*`;

export const formatOption = (option: CatalogOption): string =>
  option.label === '' ? formatPesos(option.priceCents) : `${option.label} ${formatPesos(option.priceCents)}`;

/** Saludo con el estado del horario, sin opciones (REQ-F-013: va antes del menú o del carrito). */
export function greetingHeader(business: BusinessId, now: Date, timeZone: string): string {
  const content = getBotContent(business);
  const hours = getBusinessHours(business);
  const opening = { apertura: describeOpening(nextOpening(business, now, timeZone)) };
  let status: string;
  if (isOpen(business, now, timeZone)) status = fill(botText.openNow, { cierre: hours.closes });
  else if (acceptsOrders(business, now, timeZone)) status = fill(botText.closedNow, opening);
  else status = fill(botText.closedNoOrders, opening);
  return [fill(botText.greeting, { negocio: content.name, lema: content.tagline }), status].join('\n\n');
}

/** Saludo con las opciones iniciales y la invitación a escribir el pedido (RF-4.1, RF-6.2; REQ-F-013 RF-4.1). */
export const greeting = (business: BusinessId, now: Date, timeZone: string): string =>
  [greetingHeader(business, now, timeZone), botText.rootOptions, fill(botText.orderInvite, { ejemplo: exampleOf(business) }), botText.keywordsHint].join('\n\n');

/** Ayuda breve (REQ-F-013, RF-4.9). */
export const helpText = (business: BusinessId): string => fill(botText.help, { ejemplo: exampleOf(business) });

export const menuPrompt = (business: BusinessId): string => fill(botText.menuPrompt, { ejemplo: exampleOf(business) });

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

/**
 * Elemento de una lista numerada del bot: "*1.* texto" (REQ-F-029, decisión del usuario). El número
 * en negrita no dispara la lista automática de WhatsApp; el cliente sigue respondiendo "1".
 */
export const listItem = (number: number, text: string): string => `*${number}.* ${text}`;

/** "🧀 Molotes de Queso Oaxaca"; sin emoji asignado, solo el nombre. */
const withEmoji = (emoji: string | undefined, text: string): string => (emoji === undefined || emoji === '' ? text : `${emoji} ${text}`);

/** Menú numerado por secciones (RF-4.2), partido en mensajes de hasta 4096 caracteres sin separar un producto. */
export const menuMessages = (business: BusinessId, catalog: BotCatalog): string[] => splitMessage(menuText(business, catalog));

/**
 * Bloque de un producto del menú (REQ-F-029, RF-3): "*1.* 🧀 *Nombre*" y, con sangría, los precios
 * unidos con " · " si caben en MAX_LINE_WIDTH de ancho visible; si no, uno por renglón.
 */
export function menuProductBlock(number: number, emoji: string | undefined, product: Pick<BotCatalog['products'][number], 'name' | 'options'>): string {
  const options = product.options.map(formatOption);
  const joined = options.join(' · ');
  const prices = visibleWidth(joined) <= MAX_LINE_WIDTH ? [joined] : options;
  return [listItem(number, withEmoji(emoji, `*${product.name}*`)), ...prices.map((price) => `${INDENT}${price}`)].join('\n');
}

/** Menú numerado como un solo texto (el orquestador lo parte según el proveedor; DT-7 de REQ-F-012). */
export function menuText(business: BusinessId, catalog: BotCatalog): string {
  const content = getBotContent(business);
  const blocks = [fill(botText.menuTitle, { negocio: content.name })];
  let number = 0;
  for (const section of catalog.sections) {
    // El encabezado en mayúsculas es solo presentación (RF-3): el contenido no cambia.
    blocks.push(`*${content.sections[section.category].toLocaleUpperCase('es-MX')}*`);
    for (const product of section.products) {
      number += 1;
      blocks.push(menuProductBlock(number, content.emojis[product.slug], product));
    }
  }
  blocks.push(menuPrompt(business));
  return blocks.join('\n\n');
}

export const menuEmpty = (business: BusinessId): string => fill(botText.menuEmpty, { negocio: nameOf(business) });

export const optionsPrompt = (productName: string, options: readonly CatalogOption[]): string =>
  fill(botText.chooseOption, { producto: productName, opciones: options.map((option, index) => listItem(index + 1, formatOption(option))).join('\n') });

export function cartView(lines: readonly CartLine[]): string {
  if (lines.length === 0) return botText.cartEmpty;
  return [botText.cartTitle, orderLines(lines, (index) => `*${index + 1}.*`), totalRow(lines)].join('\n\n');
}

export const cartWithOptions = (lines: readonly CartLine[]): string => `${cartView(lines)}\n\n${botText.cartOptions}`;

/** Petición de los datos con el aviso de privacidad, en un solo mensaje (REQ-F-013, RF-5.1). */
export const dataRequest = (): string => `${botText.askData}\n\n${botText.privacy}`;

/** Opción de una aclaración: "Tazón de Consomé Chico (Con Carne)" y su precio ("$80"), o null si no se encontró. */
export interface ClarifyOption {
  readonly label: string;
  readonly price: string | null;
}

/** "*2.* Nombre (opción)" y, con sangría, el precio: el mismo bloque que el menú (REQ-F-029, RF-1; DEF-001). */
const clarifyOptionBlock = (option: ClarifyOption, number: number): string =>
  [listItem(number, option.label), ...(option.price === null ? [] : [`${INDENT}${option.price}`])].join('\n');

/** Una sola pregunta para todas las líneas ambiguas, con un bloque por línea (REQ-F-013, RF-3.2). */
export function clarifyQuestion(blocks: readonly { readonly fragment: string; readonly options: readonly ClarifyOption[] }[]): string {
  const body = blocks.map((block, index) =>
    fill(botText.clarifyBlock, { numero: index + 1, fragmento: block.fragment, opciones: block.options.map((option, at) => clarifyOptionBlock(option, at + 1)).join('\n') }),
  );
  return [botText.clarifyTitle, ...body, fill(botText.clarifyHint, { ejemplo: blocks.length === 1 ? '1' : blocks.map((_, index) => String(index === 0 ? 2 : 1)).join(', ') })].join('\n\n');
}

export const removePrompt = (lines: readonly CartLine[]): string =>
  fill(botText.removePrompt, { lineas: lines.map((line, index) => listItem(index + 1, lineLabel(line))).join('\n') });

const deliveryText = (order: Pick<OrderDetails, 'delivery' | 'address'>): string =>
  order.delivery === 'delivery' ? fill(botText.delivery, { direccion: order.address ?? '' }) : botText.pickup;

/** Resumen para el cliente (RF-4.5). */
export function summary(order: OrderDetails): string {
  const fields = botText.summaryFields;
  // La entrega del cliente no usa `deliveryText`: ese valor es el parámetro `entrega` de la plantilla (CA-8).
  const delivery = order.delivery === 'delivery' ? `${botText.deliveryHome}\n${order.address ?? ''}` : botText.pickup;
  const data = [
    `${botText.deliveryIcons[order.delivery]} *${fields.delivery}* ${delivery}`,
    `*${fields.name}* ${order.name}`,
    `*${fields.notes}* ${order.notes === '' ? botText.noNotes : order.notes}`,
  ];
  if (order.delivery === 'delivery') data.push(botText.deliveryCost);
  const blocks = [
    fill(botText.summaryTitle, { codigo: order.code, negocio: nameOf(order.business) }),
    orderLines(order.lines, () => '-'),
    totalRow(order.lines),
    data.join('\n'),
  ];
  if (order.offHoursOpening !== null) blocks.push(fill(botText.offHours, { apertura: order.offHoursOpening }));
  blocks.push(botText.confirmPrompt);
  return blocks.join('\n\n');
}

export const confirmedMessage = (order: Pick<OrderDetails, 'code' | 'business'>): string =>
  fill(botText.confirmed, { codigo: order.code, negocio: nameOf(order.business) });

/** D-18: el aviso al personal falló; contacto directo. */
export const staffFailedMessage = (order: Pick<OrderDetails, 'code' | 'business'>, contact: string): string =>
  fill(botText.staffFailed, { codigo: order.code, negocio: nameOf(order.business), contacto: contact });

/** REQ-F-025: mensajes fijos de los topes, con el contacto directo del negocio. */
export const orderCapContactMessage = (order: Pick<OrderDetails, 'code' | 'business'>, contact: string): string =>
  fill(botText.orderCapContact, { codigo: order.code, negocio: nameOf(order.business), contacto: contact });

export type FixedNotice = 'orderLimitReached' | 'dailyLimitReached' | 'directContactMode';
export const fixedNoticeMessage = (kind: FixedNotice, business: BusinessId, contact: string): string =>
  fill(botText[kind], { negocio: nameOf(business), contacto: contact });

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

/**
 * Cuerpo de la plantilla del aviso al personal tal como se crea en el Administrador de WhatsApp
 * (README, "Plantilla del aviso al personal"; una prueba comprueba que coinciden). Meta exige
 * suficiente texto fijo en proporción a las variables (error 2388293).
 */
export const STAFF_TEMPLATE_BODY = [
  'Hola, acaba de llegar un nuevo pedido por WhatsApp.',
  '',
  'Código del pedido: {{codigo}}',
  'Negocio: {{negocio}}',
  'Horario: {{horario}}',
  'Nombre del cliente: {{cliente}}',
  'WhatsApp del cliente: {{whatsapp}}',
  'Forma de entrega: {{entrega}}',
  'Productos: {{lineas}}',
  'Total a cobrar: {{total}}',
  'Notas del cliente: {{notas}}',
  '',
  'Por favor confirma el pedido respondiendo directamente al cliente por WhatsApp.',
].join('\n');

/** Longitud máxima del cuerpo de una plantilla de WhatsApp (documentada para el cuerpo; DT-1 la aplica al cuerpo ya rellenado). */
export const MAX_TEMPLATE_BODY_CHARS = 1024;

/**
 * Recorta a `max` caracteres con "…" al final, por puntos de código: nunca parte un emoji (DEF-004).
 * Un emoji cuenta como 2 unidades en `length`, así que el resultado nunca mide más de `max` puntos de
 * código y su `length` puede quedar por debajo de `max`.
 */
function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const kept: string[] = [];
  let length = 0;
  for (const char of text) {
    if (length + char.length > Math.max(0, max - 1)) break;
    kept.push(char);
    length += char.length;
  }
  return `${kept.join('')}…`;
}

/**
 * Niveles de `lineas` (REQ-F-013, DT-1): completo; sin precio unitario; detalles a 20 caracteres;
 * cada línea abreviada a su parte. Nunca se omite una línea, una cantidad ni el total.
 */
const STAFF_LINE_LEVELS: readonly ((line: CartLine) => string)[] = [
  staffLine,
  (line) => `${line.quantity} × ${lineLabel(line)} = ${formatPesos(lineSubtotal(line))}`,
  (line) => `${line.quantity} × ${lineLabel({ ...line, detail: clip(line.detail, 20) })} = ${formatPesos(lineSubtotal(line))}`,
];
const ABBREVIATED = '(abreviado) ';
const SEPARATOR = '; ';

function compactLines(lines: readonly CartLine[], budget: number): { text: string; level: number } {
  for (const [level, format] of STAFF_LINE_LEVELS.entries()) {
    const text = lines.map((line) => templateParam(format(line))).join(SEPARATOR);
    if (text.length <= budget) return { text, level };
  }
  const last = STAFF_LINE_LEVELS[STAFF_LINE_LEVELS.length - 1] ?? staffLine;
  const share = Math.max(8, Math.floor((budget - ABBREVIATED.length - SEPARATOR.length * (lines.length - 1)) / Math.max(1, lines.length)));
  const text = `${ABBREVIATED}${lines.map((line) => clip(templateParam(last(line)), share)).join(SEPARATOR)}`;
  return { text, level: STAFF_LINE_LEVELS.length };
}

/** Textos libres del cliente que se recortan si el cuerpo aún no cabe (DT-1), en este orden. */
const FREE_TEXT_PARAMS = ['notas', 'entrega', 'cliente'] as const;

/** Parámetros de la plantilla y nivel de compactación de `lineas` (0 = completo; DT-1). */
export function buildStaffTemplate(order: OrderDetails, customerWaId: string): { params: Record<string, string>; level: number } {
  const others = {
    codigo: order.code,
    negocio: nameOf(order.business),
    horario: order.offHoursOpening === null ? botText.staffHours : fill(botText.staffOffHours, { apertura: order.offHoursOpening }),
    cliente: order.name,
    whatsapp: `+${customerWaId}`,
    entrega: deliveryText(order),
    total: formatPesos(cartTotal(order.lines)),
    notas: order.notes === '' ? botText.noNotes : order.notes,
  };
  const clean = Object.fromEntries(Object.entries(others).map(([key, value]) => [key, templateParam(value)]));
  const fixed = STAFF_TEMPLATE_BODY.replace(/\{\{\w+\}\}/g, '').length;
  const budget = MAX_TEMPLATE_BODY_CHARS - fixed - Object.values(clean).reduce((sum, value) => sum + value.length, 0);
  const { text, level } = compactLines(order.lines, budget);
  // El mismo orden de siempre (README): codigo, negocio, horario, cliente, whatsapp, entrega, lineas, total, notas.
  const { total, notas, ...first } = clean;
  const params: Record<string, string> = { ...first, lineas: templateParam(text), total: total ?? '', notas: notas ?? '' };
  // Último recurso: si ni las líneas abreviadas caben (nombre, dirección y notas al máximo, p. ej. con emojis),
  // se recortan los textos libres del cliente en este orden. Nunca las líneas, las cantidades ni el total.
  for (const key of FREE_TEXT_PARAMS) {
    const overflow = hydrateStaffTemplate(params).length - MAX_TEMPLATE_BODY_CHARS;
    if (overflow <= 0) break;
    const value = params[key] ?? '';
    params[key] = clip(value, Math.max(1, value.length - overflow));
  }
  return { params, level };
}

/** Parámetros con nombre de la plantilla del aviso al personal (DT-6; README). */
export const staffTemplateParams = (order: OrderDetails, customerWaId: string): Record<string, string> => buildStaffTemplate(order, customerWaId).params;

/** Rellena el cuerpo de la plantilla (pruebas y medición de DT-1). */
export const hydrateStaffTemplate = (params: Readonly<Record<string, string>>): string =>
  STAFF_TEMPLATE_BODY.replace(/\{\{(\w+)\}\}/g, (match, key: string) => params[key] ?? match);

/**
 * Aviso al personal como texto libre (REQ-F-012, D-6), con los mismos datos que la plantilla
 * (REQ-F-009 CA-14): una línea por producto, el resto sin saltos de línea del cliente.
 */
export function staffNoticeText(order: OrderDetails, customerWaId: string): string {
  const params = staffTemplateParams(order, customerWaId);
  return fill(botText.staffNotice, {
    ...params,
    lineas: order.lines.map((line) => templateParam(staffLine(line))).join('\n'),
    notas: templateParam(order.notes === '' ? botText.noNotes : order.notes),
  });
}
