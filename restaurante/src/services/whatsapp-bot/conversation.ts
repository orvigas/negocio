import type { BusinessId } from '../../config/businesses.ts';
import { botText, getBotContent } from '../../content/bot.ts';
import { getActiveBusinessId } from '../business-schedule.ts';
import { findOption, type BotCatalog, type CatalogProduct } from './catalog.ts';
import { formatPesos } from '../price.ts';
import {
  cartWithOptions,
  greeting,
  hoursAndLocation,
  lineLabel,
  menuEmpty,
  menuMessages,
  optionsPrompt,
  ordersClosed,
  otherBusiness,
  otherBusinessNote,
  personContact,
  removePrompt,
  summary,
  type CartLine,
  type DeliveryMethod,
  type OrderDetails,
} from './messages.ts';
import { acceptsOrders, describeOpening, isOpen, nextOpening } from './schedule.ts';
import { cleanText, codePointLength, fill, normalizeInput, parseNumber } from './text.ts';

/**
 * Máquina de estados de la conversación del bot (REQ-F-009, RF-3, RF-4, RF-6, D-10 a D-17).
 *
 * Pura: recibe la conversación (o null si no hay una vigente), la entrada y el contexto (reloj,
 * catálogo, contacto del personal, generadores) y devuelve la conversación siguiente (null si se
 * cerró), las respuestas y, al confirmar, el pedido para el personal. No envía nada: lo hace el
 * orquestador (bot.ts). La conversación recibida no se modifica.
 */

/** Límites del pedido (D-12). */
export const ORDER_LIMITS = Object.freeze({
  maxQuantity: 20,
  maxLines: 15,
  nameMax: 60,
  addressMin: 5,
  addressMax: 200,
  notesMax: 200,
});

export type Step = 'root' | 'browse' | 'option' | 'quantity' | 'cart' | 'remove' | 'name' | 'delivery' | 'address' | 'notes' | 'confirm' | 'sending';

export interface Customer {
  name?: string;
  delivery?: DeliveryMethod;
  address?: string;
  notes?: string;
}

export interface Conversation {
  /** Identificador aleatorio para relacionar las entradas del log (sin datos personales). */
  readonly id: string;
  /** Negocio fijado con el primer mensaje (D-4, RF-3.2). */
  readonly business: BusinessId;
  step: Step;
  /** Producto (y opción) que se está agregando. */
  pending: { slug: string; optionKey?: string } | null;
  /** Slugs del último menú mostrado, en el orden de su numeración. */
  menu: string[];
  cart: CartLine[];
  /** D-16 se comprueba al empezar el pedido (PT-2 A). */
  orderStarted: boolean;
  customer: Customer;
  /** Código de referencia (D-19): se genera con el primer resumen y no se guarda al cerrar. */
  code: string | null;
}

export type TurnInput = { readonly kind: 'text'; readonly text: string } | { readonly kind: 'unsupported' };

export interface TurnContext {
  readonly now: Date;
  readonly timeZone: string;
  catalog(business: BusinessId): BotCatalog;
  /** Enlace de contacto directo con el personal del negocio. */
  staffContact(business: BusinessId): string;
  newCode(prefix: string): string;
  newId(): string;
}

export interface TurnResult {
  readonly conversation: Conversation | null;
  readonly replies: string[];
  /** La conversación empezó en este turno. */
  readonly started: boolean;
  /** El cliente canceló (la conversación se cerró sin enviar nada). */
  readonly cancelled: boolean;
  /** Pedido confirmado que hay que enviar al personal (la conversación queda en `sending`). */
  readonly order: OrderDetails | null;
}

const KEYWORDS = Object.freeze({
  menu: ['menu', 'ver menu', 'ver el menu'],
  cart: ['carrito', 'ver carrito', 'mi carrito', 'pedido', 'mi pedido'],
  cancel: ['cancelar', 'cancela', 'cancelar pedido'],
  person: ['persona', 'humano', 'hablar con una persona', 'asesor'],
  help: ['ayuda', 'help'],
});
type Keyword = keyof typeof KEYWORDS;
const CONFIRM_WORDS = ['1', 'confirmar', 'confirmo', 'si'];
const REJECT_WORDS = ['2'];
const NO_NOTES = ['0', 'no', 'ninguna', 'ninguno', 'nada', 'sin notas'];

function keywordOf(normalized: string): Keyword | null {
  for (const [keyword, words] of Object.entries(KEYWORDS) as [Keyword, string[]][]) if (words.includes(normalized)) return keyword;
  return null;
}

/** ¿El texto menciona al otro negocio? (RF-3.4). */
const mentionsOther = (business: BusinessId, normalized: string): boolean => {
  const words = normalized.split(' ');
  return getBotContent(otherBusiness(business)).keywords.some((keyword) => words.includes(keyword));
};

/** Acumula las respuestas y los efectos de un turno. */
class Turn {
  readonly replies: string[] = [];
  confirmedOrder: OrderDetails | null = null;
  /** Texto del mensaje tal como llegó (los números se leen de aquí: "-1" no es "1"). */
  text = '';
  closed = false;
  cancelled = false;

  readonly conversation: Conversation;
  readonly ctx: TurnContext;

  constructor(conversation: Conversation, ctx: TurnContext) {
    this.conversation = conversation;
    this.ctx = ctx;
  }

  say(...messages: string[]): void {
    this.replies.push(...messages.filter((message) => message !== ''));
  }

  get business(): BusinessId {
    return this.conversation.business;
  }

  catalog(): BotCatalog {
    return this.ctx.catalog(this.business);
  }

  /** Mensaje del paso actual (se repite tras una ayuda o una entrada no válida). */
  prompt(): string {
    const c = this.conversation;
    switch (c.step) {
      case 'root':
        return botText.rootOptions;
      case 'browse':
        return botText.menuPrompt;
      case 'option': {
        const product = this.pendingProduct();
        return product ? optionsPrompt(product.name, product.options) : botText.menuPrompt;
      }
      case 'quantity': {
        const product = this.pendingProduct();
        return fill(botText.askQuantity, { producto: product?.name ?? '', max: ORDER_LIMITS.maxQuantity });
      }
      case 'cart':
        return cartWithOptions(c.cart);
      case 'remove':
        return removePrompt(c.cart);
      case 'name':
        return botText.askName;
      case 'delivery':
        return botText.askDelivery;
      case 'address':
        return botText.askAddress;
      case 'notes':
        return botText.askNotes;
      case 'confirm':
        return botText.confirmPrompt;
      case 'sending':
        return '';
    }
  }

  pendingProduct(): CatalogProduct | undefined {
    const slug = this.conversation.pending?.slug;
    return this.catalog().products.find((product) => product.slug === slug);
  }

  showMenu(): void {
    const catalog = this.catalog();
    const c = this.conversation;
    if (catalog.products.length === 0) {
      c.step = 'root';
      this.say(menuEmpty(this.business));
      return;
    }
    c.menu = catalog.products.map((product) => product.slug);
    c.step = 'browse';
    c.pending = null;
    this.say(...menuMessages(this.business, catalog));
  }

  showCart(): void {
    const c = this.conversation;
    if (c.cart.length === 0) {
      c.step = 'root';
      this.say(`${botText.cartEmpty}\n\n${botText.rootOptions}`);
      return;
    }
    c.step = 'cart';
    this.say(cartWithOptions(c.cart));
  }

  /** D-16 (PT-2 A): se comprueba al empezar el pedido. false si el negocio no toma pedidos. */
  startOrder(): boolean {
    const c = this.conversation;
    if (c.orderStarted) return true;
    if (!acceptsOrders(this.business, this.ctx.now, this.ctx.timeZone)) {
      c.step = 'root';
      c.pending = null;
      this.say(ordersClosed(this.business, this.ctx.now, this.ctx.timeZone));
      return false;
    }
    c.orderStarted = true;
    return true;
  }

  notUnderstood(normalized: string): void {
    const c = this.conversation;
    const note = (c.step === 'root' || c.step === 'browse') && mentionsOther(this.business, normalized) ? otherBusinessNote(this.business) : '';
    if (note !== '') this.say(`${note}\n\n${this.prompt()}`);
    else this.say(`${botText.notUnderstood} ${botText.help}\n\n${this.prompt()}\n\n${botText.keywordsHint}`);
  }

  cancel(): void {
    this.closed = true;
    this.cancelled = true;
    this.say(botText.cancelled);
  }

  /** Revalida el carrito contra el catálogo vigente (D-13). Devuelve los avisos de los cambios. */
  revalidate(): string[] {
    const c = this.conversation;
    const catalog = this.catalog();
    const notices: string[] = [];
    const lines: CartLine[] = [];
    for (const line of c.cart) {
      const current = findOption(catalog, line.slug, line.optionKey);
      if (!current) {
        notices.push(fill(botText.lineRemoved, { producto: lineLabel(line) }));
        continue;
      }
      const updated: CartLine = { ...line, productName: current.product.name, optionLabel: current.option.label, unitPriceCents: current.option.priceCents };
      if (updated.unitPriceCents !== line.unitPriceCents) {
        notices.push(fill(botText.linePriceChanged, { producto: lineLabel(updated), precio: formatPesos(updated.unitPriceCents) }));
      }
      lines.push(updated);
    }
    c.cart = lines;
    return notices;
  }

  buildOrder(): OrderDetails {
    const c = this.conversation;
    c.code ??= this.ctx.newCode(getBotContent(this.business).codePrefix);
    const open = isOpen(this.business, this.ctx.now, this.ctx.timeZone);
    return {
      code: c.code,
      business: this.business,
      lines: c.cart,
      name: c.customer.name ?? '',
      delivery: c.customer.delivery ?? 'pickup',
      address: c.customer.address,
      notes: c.customer.notes ?? '',
      offHoursOpening: open ? null : describeOpening(nextOpening(this.business, this.ctx.now, this.ctx.timeZone)),
    };
  }

  /** Revalida el carrito (D-13) y muestra el resumen (RF-4.5), con los avisos de cambios. */
  showSummary(notices: string[] = this.revalidate()): void {
    const c = this.conversation;
    if (notices.length > 0) this.say([botText.catalogChanged, ...notices].join('\n'));
    if (c.cart.length === 0) {
      this.say(botText.cartNowEmpty);
      this.showMenu();
      return;
    }
    c.step = 'confirm';
    this.say(summary(this.buildOrder()));
  }
}

// --- Pasos ---------------------------------------------------------------------

function handleRoot(turn: Turn, normalized: string): void {
  switch (parseNumber(turn.text)) {
    case 1:
      return turn.showMenu();
    case 2:
      if (turn.startOrder()) turn.showMenu();
      return undefined;
    case 3:
      return turn.say(`${hoursAndLocation(turn.business)}\n\n${botText.rootOptions}`);
    case 4:
      return turn.say(personContact(turn.business, turn.ctx.staffContact(turn.business)));
    default:
      return turn.notUnderstood(normalized);
  }
}

function selectProduct(turn: Turn, product: CatalogProduct): void {
  const c = turn.conversation;
  if (!turn.startOrder()) return;
  const [only] = product.options;
  if (product.options.length === 1 && only) {
    c.pending = { slug: product.slug, optionKey: only.key };
    c.step = 'quantity';
  } else {
    c.pending = { slug: product.slug };
    c.step = 'option';
  }
  turn.say(turn.prompt());
}

function handleBrowse(turn: Turn, normalized: string): void {
  const c = turn.conversation;
  const number = parseNumber(turn.text);
  const slug = number === null ? undefined : c.menu[number - 1];
  if (slug === undefined) return turn.notUnderstood(normalized);
  const product = turn.catalog().products.find((candidate) => candidate.slug === slug);
  if (!product) {
    turn.say(fill(botText.lineRemoved, { producto: `#${number}` }));
    return turn.showMenu();
  }
  return selectProduct(turn, product);
}

function handleOption(turn: Turn): void {
  const c = turn.conversation;
  const product = turn.pendingProduct();
  if (!product || !c.pending) return turn.showMenu();
  const number = parseNumber(turn.text);
  const option = number === null ? undefined : product.options[number - 1];
  if (!option) return turn.say(`${botText.invalidNumber}\n\n${turn.prompt()}`);
  c.pending = { slug: product.slug, optionKey: option.key };
  c.step = 'quantity';
  return turn.say(turn.prompt());
}

function handleQuantity(turn: Turn): void {
  const c = turn.conversation;
  const { maxQuantity, maxLines } = ORDER_LIMITS;
  const quantity = parseNumber(turn.text);
  if (quantity === null || quantity < 1 || quantity > maxQuantity) {
    return turn.say(`${fill(botText.invalidQuantity, { max: maxQuantity })}\n\n${turn.prompt()}`);
  }
  const current = c.pending?.optionKey === undefined ? null : findOption(turn.catalog(), c.pending.slug, c.pending.optionKey);
  if (!current) return turn.showMenu();

  const line: CartLine = {
    slug: current.product.slug,
    optionKey: current.option.key,
    productName: current.product.name,
    optionLabel: current.option.label,
    unitPriceCents: current.option.priceCents,
    quantity,
  };
  const index = c.cart.findIndex((existing) => existing.slug === line.slug && existing.optionKey === line.optionKey);
  const existing = c.cart[index];
  if (existing) {
    if (existing.quantity + quantity > maxQuantity) {
      return turn.say(`${fill(botText.lineTooLarge, { max: maxQuantity, producto: lineLabel(line) })}\n\n${turn.prompt()}`);
    }
    c.cart = c.cart.map((other, i) => (i === index ? { ...line, quantity: existing.quantity + quantity } : other));
  } else {
    if (c.cart.length >= maxLines) {
      c.pending = null;
      c.step = 'cart';
      return turn.say(`${fill(botText.tooManyLines, { max: maxLines })}\n\n${cartWithOptions(c.cart)}`);
    }
    c.cart = [...c.cart, line];
  }
  c.pending = null;
  c.step = 'cart';
  return turn.say(`${fill(botText.added, { linea: `${quantity} × ${lineLabel(line)}` })}\n\n${cartWithOptions(c.cart)}`);
}

function handleCart(turn: Turn, normalized: string): void {
  const c = turn.conversation;
  switch (parseNumber(turn.text)) {
    case 1:
      return turn.showMenu();
    case 2:
      if (c.cart.length === 0) return turn.showCart();
      c.step = 'remove';
      return turn.say(removePrompt(c.cart));
    case 3:
      c.cart = [];
      c.step = 'root';
      return turn.say(`${botText.emptied}\n\n${botText.rootOptions}`);
    case 4:
      if (c.cart.length === 0) return turn.showCart();
      c.step = 'name';
      return turn.say(botText.privacy, botText.askName);
    default:
      return turn.notUnderstood(normalized);
  }
}

function handleRemove(turn: Turn): void {
  const c = turn.conversation;
  const number = parseNumber(turn.text);
  const line = number === null ? undefined : c.cart[number - 1];
  if (!line) return turn.say(`${botText.invalidNumber}\n\n${turn.prompt()}`);
  c.cart = c.cart.filter((other) => other !== line);
  turn.say(fill(botText.removed, { producto: lineLabel(line) }));
  return turn.showCart();
}

function handleName(turn: Turn, text: string): void {
  const name = cleanText(text);
  const length = codePointLength(name);
  if (length < 1 || length > ORDER_LIMITS.nameMax) return turn.say(`${fill(botText.invalidName, { max: ORDER_LIMITS.nameMax })}\n\n${botText.askName}`);
  turn.conversation.customer.name = name;
  turn.conversation.step = 'delivery';
  return turn.say(botText.askDelivery);
}

/** Tras la entrega: notas, o el resumen si ya se habían capturado. */
function afterDelivery(turn: Turn): void {
  const c = turn.conversation;
  if (c.customer.notes === undefined) {
    c.step = 'notes';
    turn.say(botText.askNotes);
  } else {
    turn.showSummary();
  }
}

function handleDelivery(turn: Turn): void {
  const c = turn.conversation;
  const number = parseNumber(turn.text);
  if (number === 1) {
    c.customer.delivery = 'pickup';
    delete c.customer.address;
    return afterDelivery(turn);
  }
  if (number === 2) {
    c.customer.delivery = 'delivery';
    c.step = 'address';
    return turn.say(botText.askAddress);
  }
  return turn.say(`${botText.invalidNumber}\n\n${botText.askDelivery}`);
}

function handleAddress(turn: Turn, text: string): void {
  const { addressMin, addressMax } = ORDER_LIMITS;
  const address = cleanText(text);
  const length = codePointLength(address);
  if (length < addressMin || length > addressMax) {
    return turn.say(`${fill(botText.invalidAddress, { min: addressMin, max: addressMax })}\n\n${botText.askAddress}`);
  }
  turn.conversation.customer.address = address;
  return afterDelivery(turn);
}

function handleNotes(turn: Turn, text: string, normalized: string): void {
  const notes = NO_NOTES.includes(normalized) ? '' : cleanText(text);
  if (codePointLength(notes) > ORDER_LIMITS.notesMax) {
    return turn.say(`${fill(botText.invalidNotes, { max: ORDER_LIMITS.notesMax })}\n\n${botText.askNotes}`);
  }
  turn.conversation.customer.notes = notes;
  turn.showSummary();
  return undefined;
}

function handleConfirm(turn: Turn, normalized: string): void {
  const c = turn.conversation;
  if (REJECT_WORDS.includes(normalized)) return turn.cancel();
  if (!CONFIRM_WORDS.includes(normalized)) return turn.say(`${botText.invalidNumber}\n\n${botText.confirmPrompt}`);

  // D-13: si algo cambió desde el resumen, se avisa y se muestra el resumen actualizado.
  const notices = turn.revalidate();
  if (notices.length > 0) return turn.showSummary(notices);
  // CA-13: a domicilio sin dirección, se pide antes de confirmar.
  if (c.customer.delivery === 'delivery' && !c.customer.address) {
    c.step = 'address';
    return turn.say(botText.askAddress);
  }
  c.step = 'sending';
  turn.confirmedOrder = turn.buildOrder();
  return undefined;
}

function handleText(turn: Turn, text: string): void {
  const c = turn.conversation;
  const normalized = normalizeInput(text);
  turn.text = text;

  switch (keywordOf(normalized)) {
    case 'menu':
      return turn.showMenu();
    case 'cart':
      return turn.showCart();
    case 'cancel':
      return turn.cancel();
    case 'person':
      return turn.say(personContact(turn.business, turn.ctx.staffContact(turn.business)));
    case 'help':
      return turn.say(`${botText.help}\n\n${turn.prompt()}\n\n${botText.keywordsHint}`);
    case null:
      break;
  }

  switch (c.step) {
    case 'root':
      return handleRoot(turn, normalized);
    case 'browse':
      return handleBrowse(turn, normalized);
    case 'option':
      return handleOption(turn);
    case 'quantity':
      return handleQuantity(turn);
    case 'cart':
      return handleCart(turn, normalized);
    case 'remove':
      return handleRemove(turn);
    case 'name':
      return handleName(turn, text);
    case 'delivery':
      return handleDelivery(turn);
    case 'address':
      return handleAddress(turn, text);
    case 'notes':
      return handleNotes(turn, text, normalized);
    case 'confirm':
      return handleConfirm(turn, normalized);
    case 'sending':
      return undefined;
  }
}

function newConversation(ctx: TurnContext): Conversation {
  return {
    id: ctx.newId(),
    business: getActiveBusinessId({ now: ctx.now, timeZone: ctx.timeZone }),
    step: 'root',
    pending: null,
    menu: [],
    cart: [],
    orderStarted: false,
    customer: {},
    code: null,
  };
}

/** Procesa un mensaje del cliente. */
export function handleTurn(current: Conversation | null, input: TurnInput, ctx: TurnContext): TurnResult {
  const started = current === null;
  const conversation = started ? newConversation(ctx) : structuredClone(current);
  const turn = new Turn(conversation, ctx);

  if (conversation.step === 'sending') {
    // El pedido ya se está enviando: se ignora lo que llegue mientras tanto (RN-4).
    return { conversation, replies: [], started, cancelled: false, order: null };
  }

  if (started) {
    const normalized = input.kind === 'text' ? normalizeInput(input.text) : '';
    const keyword = keywordOf(normalized);
    turn.say(greeting(conversation.business, ctx.now, ctx.timeZone));
    if (input.kind === 'unsupported') turn.say(botText.textOnly);
    else if (mentionsOther(conversation.business, normalized)) turn.say(otherBusinessNote(conversation.business));
    if (keyword === 'menu') turn.showMenu();
    if (keyword === 'person') turn.say(personContact(conversation.business, ctx.staffContact(conversation.business)));
  } else if (input.kind === 'unsupported') {
    turn.say(`${botText.textOnly}\n\n${turn.prompt()}`);
  } else {
    handleText(turn, input.text);
  }

  return {
    conversation: turn.closed ? null : conversation,
    replies: turn.replies,
    started,
    cancelled: turn.cancelled,
    order: turn.confirmedOrder,
  };
}
