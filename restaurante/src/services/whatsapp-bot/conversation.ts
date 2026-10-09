import type { BusinessId } from '../../config/businesses.ts';
import { botKeywords, botText, botVocabulary, getBotContent, getBotVocabulary } from '../../content/bot.ts';
import { getActiveBusinessId } from '../business-schedule.ts';
import { findOption, type BotCatalog, type CatalogProduct } from './catalog.ts';
import type { ClarifyBlock, CustomerDataInterpretation, InterpretScope, InterpretedLine, OrderInterpretation, OrderInterpreter } from './interpreter/types.ts';
import { formatPesos } from '../price.ts';
import {
  cartView,
  cartWithOptions,
  clarifyQuestion,
  dataRequest,
  exampleOf,
  formatOption,
  greeting,
  greetingHeader,
  helpText,
  hoursAndLocation,
  lineLabel,
  menuEmpty,
  menuPrompt,
  menuText,
  optionsPrompt,
  ordersClosed,
  otherBusiness,
  otherBusinessNote,
  personContact,
  productLabel,
  removePrompt,
  summary,
  type CartLine,
  type DeliveryMethod,
  type OrderDetails,
} from './messages.ts';
import { acceptsOrders, describeOpening, isOpen, nextOpening } from './schedule.ts';
import { cleanText, codePointLength, fill, normalizeInput, parseNumber } from './text.ts';

/**
 * Máquina de estados de la conversación del bot (REQ-F-009, RF-3, RF-4, RF-6, D-10 a D-17;
 * REQ-F-013: texto libre, aclaraciones, datos agrupados y notas en el resumen).
 *
 * Pura: recibe la conversación (o null si no hay una vigente), la entrada y el contexto (reloj,
 * catálogo, intérprete, contacto del personal, generadores) y devuelve la conversación siguiente
 * (null si se cerró), las respuestas, los contadores de interpretación y, al confirmar, el pedido
 * para el personal. No envía nada ni registra: lo hace el orquestador. La conversación recibida
 * no se modifica. El texto lo interpreta solo el `OrderInterpreter` del contexto (D-2).
 *
 * En cada paso: primero una palabra clave como mensaje completo; después un mensaje que es solo un
 * número, con el significado de siempre (X-4); al final, el texto libre.
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

export type Step =
  | 'root'
  | 'browse'
  | 'option'
  | 'quantity'
  | 'cart'
  | 'remove'
  | 'clarify'
  | 'dataOrProducts'
  | 'name'
  | 'delivery'
  | 'address'
  | 'confirm'
  | 'sending';

/** A dónde vuelve la conversación tras aclarar o quitar: al carrito o al resumen (RF-7.3). */
type ReturnTo = 'cart' | 'confirm';

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
  /** Producto (y opción) que se está agregando por números. */
  pending: { slug: string; optionKey?: string } | null;
  /** Slugs del último menú mostrado, en el orden de su numeración. */
  menu: string[];
  cart: CartLine[];
  /** D-16 se comprueba al empezar el pedido (PT-2 A). */
  orderStarted: boolean;
  customer: Customer;
  /** Código de referencia (D-19): se genera con el primer resumen y no se guarda al cerrar. */
  code: string | null;
  /** Ya se mostró el aviso de privacidad: solo entonces se capturan datos (REQ-F-013, X-5). */
  privacyShown: boolean;
  /** Líneas ambiguas pendientes de aclarar (REQ-F-013, RF-3). */
  clarify: { blocks: ClarifyBlock[]; returnTo: ReturnTo } | null;
  /** Líneas del carrito entre las que se elige al quitar por nombre (RF-7.1). */
  removeChoices: { lines: number[]; returnTo: ReturnTo } | null;
  /** Mensaje con productos y datos a la vez, mientras se pregunta qué es (RF-5.6). Solo en memoria. */
  pendingText: string | null;
}

export type TurnInput = { readonly kind: 'text'; readonly text: string } | { readonly kind: 'unsupported' };

export interface TurnContext {
  readonly now: Date;
  readonly timeZone: string;
  catalog(business: BusinessId): BotCatalog;
  /** Intérprete de pedidos en texto libre (REQ-F-013, D-2). */
  readonly interpreter: OrderInterpreter;
  /** Enlace de contacto directo con el personal del negocio. */
  staffContact(business: BusinessId): string;
  newCode(prefix: string): string;
  newId(): string;
}

/** Contadores de un mensaje interpretado (REQ-F-013, RF-11): nunca texto. */
export interface InterpretationCounts {
  readonly source: 'order' | 'answer' | 'edit';
  readonly recognized: number;
  readonly ambiguous: number;
  readonly unrecognized: number;
  /** Fuera de los límites: cantidad, líneas de más por mensaje o del pedido (D-12). */
  readonly rejected: number;
  readonly unavailable: number;
  readonly otherBusiness: number;
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
  /** Contadores de cada interpretación del turno (el orquestador los registra). */
  readonly interpretations: InterpretationCounts[];
}

type Keyword = keyof typeof botKeywords;

function keywordOf(normalized: string): Keyword | null {
  for (const [keyword, words] of Object.entries(botKeywords) as [Keyword, readonly string[]][]) if (words.includes(normalized)) return keyword;
  return null;
}

const REJECT_WORDS = ['2'];

/** Relleno y cortesía que se quitan para leer una confirmación ("sí por favor"); los verbos de agregar no. */
const COURTESY = botVocabulary.filler.filter((phrase) => !botVocabulary.add.includes(phrase)).map((phrase) => phrase.split(' '));

/**
 * El mensaje sin relleno ni cortesía (REQ-F-013, precisión aprobada del 2026-10-08): "si por
 * favor" -> "si", "ok gracias" -> "ok". Solo se usa en el resumen para confirmar o para "no".
 */
function withoutCourtesy(normalized: string): string {
  const words = normalized.split(' ').filter((word) => word !== '');
  const phrases = [...COURTESY].sort((a, b) => b.length - a.length);
  const kept: string[] = [];
  for (let at = 0; at < words.length; ) {
    const phrase = phrases.find((candidate) => candidate.every((word, offset) => words[at + offset] === word));
    if (phrase) at += phrase.length;
    else {
      kept.push(words[at] ?? '');
      at += 1;
    }
  }
  return kept.join(' ');
}
const isOneOf = (normalized: string, words: readonly string[]): boolean => words.includes(normalized);

/** Verbo inicial de una lista ("quita", "sin la"...) y el texto original que le sigue. */
function afterVerb(text: string, normalized: string, verbs: readonly string[]): string | null {
  const verb = [...verbs].sort((a, b) => b.length - a.length).find((candidate) => normalized.startsWith(`${candidate} `));
  if (verb === undefined) return null;
  // Se salta en el texto original tantas palabras como tenga el verbo.
  const words = verb.split(' ').length;
  const matches = [...text.matchAll(/[\p{L}\p{M}\p{N}]+/gu)];
  const next = matches[words];
  return next === undefined ? null : text.slice(next.index);
}

/** ¿El texto menciona al otro negocio? (RF-3.4). */
const mentionsOther = (business: BusinessId, normalized: string): boolean => {
  const words = normalized.split(' ');
  return getBotContent(otherBusiness(business)).keywords.some((keyword) => words.includes(keyword));
};

const isProductLine = (line: InterpretedLine): boolean => line.kind === 'item' || line.kind === 'ambiguous';

/** Resultado de aplicar líneas al carrito. */
interface Outcome {
  readonly added: string[];
  readonly problems: string[];
  readonly blocks: ClarifyBlock[];
  otherNote: boolean;
  /** El mensaje traía datos de entrega antes del aviso de privacidad (DEF-005). */
  dataLater: boolean;
}

const emptyOutcome = (): Outcome => ({ added: [], problems: [], blocks: [], otherNote: false, dataLater: false });

/** Acumula las respuestas y los efectos de un turno. */
class Turn {
  readonly replies: string[] = [];
  readonly interpretations: InterpretationCounts[] = [];
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

  /** Une en un solo mensaje, detrás de `header`, todo lo dicho desde `from` (REQ-F-013, D-7). */
  mergeFrom(from: number, header: string): void {
    const tail = this.replies.splice(from);
    this.replies.push([header, ...tail].join('\n\n'));
  }

  get business(): BusinessId {
    return this.conversation.business;
  }

  catalog(): BotCatalog {
    return this.ctx.catalog(this.business);
  }

  scope(): InterpretScope {
    return { business: this.business, catalog: this.catalog(), otherCatalog: this.ctx.catalog(otherBusiness(this.business)) };
  }

  /** Mensaje del paso actual (se repite tras una ayuda o una entrada no válida). */
  prompt(): string {
    const c = this.conversation;
    switch (c.step) {
      case 'root':
        return botText.rootOptions;
      case 'browse':
        return menuPrompt(this.business);
      case 'option': {
        const product = this.pendingProduct();
        return product ? optionsPrompt(product.name, product.options) : menuPrompt(this.business);
      }
      case 'quantity': {
        const product = this.pendingProduct();
        return fill(botText.askQuantity, { producto: product?.name ?? '', max: ORDER_LIMITS.maxQuantity });
      }
      case 'cart':
        return cartWithOptions(c.cart);
      case 'remove':
        return c.removeChoices ? this.removeWhich(c.removeChoices.lines) : removePrompt(c.cart);
      case 'clarify':
        return c.clarify ? this.clarifyText(c.clarify.blocks) : cartWithOptions(c.cart);
      case 'dataOrProducts':
        return botText.dataOrProducts;
      case 'name':
        return botText.askName;
      case 'delivery':
        return botText.askDelivery;
      case 'address':
        return botText.askAddress;
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

  menuReply(): string {
    const catalog = this.catalog();
    const c = this.conversation;
    if (catalog.products.length === 0) {
      c.step = 'root';
      return menuEmpty(this.business);
    }
    c.menu = catalog.products.map((product) => product.slug);
    c.step = 'browse';
    c.pending = null;
    return menuText(this.business, catalog);
  }

  showMenu(): void {
    this.say(this.menuReply());
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

  help(): string {
    return `${helpText(this.business)}\n\n${this.prompt()}\n\n${botText.keywordsHint}`;
  }

  notUnderstood(normalized: string): void {
    const c = this.conversation;
    const note = (c.step === 'root' || c.step === 'browse') && mentionsOther(this.business, normalized) ? otherBusinessNote(this.business) : '';
    if (note !== '') this.say(`${note}\n\n${this.prompt()}`);
    else this.say(`${botText.notUnderstood} ${this.help()}`);
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

  /** Revalida el carrito (D-13) y muestra el resumen (RF-4.5; REQ-F-013 RF-6.1), con los avisos de cambios. */
  showSummary(notices: string[] = this.revalidate(), before: string[] = []): void {
    const c = this.conversation;
    if (notices.length > 0) before.push([botText.catalogChanged, ...notices].join('\n'));
    if (c.cart.length === 0) {
      this.say(...before, botText.cartNowEmpty);
      this.showMenu();
      return;
    }
    c.step = 'confirm';
    this.say([...before, summary(this.buildOrder())].join('\n\n'));
  }

  // --- Interpretación y carrito (REQ-F-013) ---------------------------------------

  record(source: InterpretationCounts['source'], counts: Omit<InterpretationCounts, 'source'>): void {
    this.interpretations.push({ source, ...counts });
  }

  /** Agrega una línea concreta al carrito, uniéndola con una igual (RF-1.6). Devuelve el problema, si lo hay. */
  addLine(choice: { slug: string; optionKey: string; quantity: number; detail: string }, outcome: Outcome): boolean {
    const c = this.conversation;
    const { maxQuantity, maxLines } = ORDER_LIMITS;
    const current = findOption(this.catalog(), choice.slug, choice.optionKey);
    if (!current) {
      outcome.problems.push(fill(botText.lineRemoved, { producto: choice.slug }));
      return false;
    }
    const line: CartLine = {
      slug: current.product.slug,
      optionKey: current.option.key,
      productName: current.product.name,
      optionLabel: current.option.label,
      unitPriceCents: current.option.priceCents,
      quantity: choice.quantity,
      detail: choice.detail,
    };
    const sameDetail = normalizeInput(line.detail);
    const index = c.cart.findIndex((other) => other.slug === line.slug && other.optionKey === line.optionKey && normalizeInput(other.detail) === sameDetail);
    const existing = c.cart[index];
    if (existing) {
      if (existing.quantity + line.quantity > maxQuantity) {
        outcome.problems.push(fill(botText.limitLine, { motivo: fill(botText.lineTooLarge, { max: maxQuantity, producto: lineLabel(line) }) }));
        return false;
      }
      c.cart = c.cart.map((other, i) => (i === index ? { ...existing, quantity: existing.quantity + line.quantity } : other));
    } else {
      if (c.cart.length >= maxLines) {
        outcome.problems.push(fill(botText.limitLine, { motivo: fill(botText.tooManyLines, { max: maxLines }) }));
        return false;
      }
      c.cart = [...c.cart, line];
    }
    outcome.added.push(`- ${line.quantity} × ${lineLabel(line)}`);
    return true;
  }

  /** Aplica las líneas interpretadas (RF-1, RF-2): agrega lo claro y reúne lo ambiguo. */
  applyLines(interpretation: OrderInterpretation, source: InterpretationCounts['source']): Outcome {
    const outcome = emptyOutcome();
    outcome.dataLater = interpretation.hasDeliveryWord && !this.conversation.privacyShown;
    let recognized = 0;
    let rejected = interpretation.overflow;
    const counts = { ambiguous: 0, unrecognized: 0, unavailable: 0, otherBusiness: 0 };
    const other = getBotContent(otherBusiness(this.business)).name;
    for (const line of interpretation.lines) {
      switch (line.kind) {
        case 'item':
          if (this.addLine(line, outcome)) recognized += 1;
          else rejected += 1;
          break;
        case 'ambiguous':
          counts.ambiguous += 1;
          outcome.blocks.push({ fragment: line.fragment, quantity: line.quantity, detail: line.detail, candidates: line.candidates });
          break;
        case 'unavailable':
          counts.unavailable += 1;
          outcome.problems.push(fill(botText.unavailableLine, { producto: line.name }));
          break;
        case 'otherBusiness':
          counts.otherBusiness += 1;
          outcome.otherNote = true;
          outcome.problems.push(fill(botText.otherBusinessLine, { fragmento: line.fragment, otro: other }));
          break;
        case 'outOfRange':
          rejected += 1;
          outcome.problems.push(fill(botText.outOfRangeLine, { fragmento: line.fragment, max: ORDER_LIMITS.maxQuantity }));
          break;
        case 'unknown':
          counts.unrecognized += 1;
          outcome.problems.push(fill(botText.notUnderstoodFragment, { fragmento: line.fragment }));
          break;
        case 'unclear':
          counts.unrecognized += 1;
          outcome.problems.push(
            line.reason === 'quantity'
              ? fill(botText.unclearLine, { fragmento: line.fragment, ejemplo: exampleOf(this.business) })
              : fill(botText.unseparatedLine, { fragmento: line.fragment, ejemplo: getBotVocabulary(this.business).separatedExample }),
          );
          break;
      }
    }
    if (interpretation.overflow > 0) outcome.problems.push(fill(botText.overflowLine, { cantidad: interpretation.overflow, max: ORDER_LIMITS.maxLines }));
    this.record(source, { recognized, rejected, ...counts });
    return outcome;
  }

  clarifyText(blocks: readonly ClarifyBlock[]): string {
    const catalog = this.catalog();
    return clarifyQuestion(
      blocks.map((block) => ({
        fragment: block.fragment,
        options: block.candidates.map((candidate) => {
          const found = findOption(catalog, candidate.slug, candidate.optionKey);
          return found ? `${productLabel(found.product.name, found.option.label)} — ${formatOption({ ...found.option, label: '' })}` : candidate.slug;
        }),
      })),
    );
  }

  removeWhich(indexes: readonly number[]): string {
    const lines = indexes.flatMap((index, at) => {
      const line = this.conversation.cart[index];
      return line ? [`${at + 1}. ${lineLabel(line)}`] : [];
    });
    return fill(botText.removeWhich, { lineas: lines.join('\n') });
  }

  /**
   * Respuesta tras agregar (RF-2), en un solo mensaje: lo agregado, lo no agregado, el carrito, las
   * opciones, la petición de datos con el aviso de privacidad y la invitación a seguir. Con líneas
   * ambiguas, la pregunta única va al final (RF-3.2). Desde el resumen, vuelve al resumen (RF-7.3).
   */
  respond(outcome: Outcome, returnTo: ReturnTo): void {
    const c = this.conversation;
    const parts: string[] = [];
    if (outcome.added.length > 0) parts.push(fill(botText.added, { lineas: outcome.added.join('\n') }));
    if (outcome.problems.length > 0) parts.push(fill(botText.notAdded, { lineas: outcome.problems.join('\n') }));
    if (outcome.otherNote) parts.push(otherBusinessNote(this.business));
    if (outcome.dataLater && (outcome.added.length > 0 || outcome.blocks.length > 0)) parts.push(botText.dataLater);
    if (outcome.blocks.length > 0) {
      c.clarify = { blocks: outcome.blocks, returnTo };
      c.step = 'clarify';
      if (c.cart.length > 0) parts.push(cartView(c.cart));
      parts.push(this.clarifyText(outcome.blocks));
      this.say(parts.join('\n\n'));
      return;
    }
    c.clarify = null;
    if (returnTo === 'confirm') {
      this.showSummary(this.revalidate(), parts);
      return;
    }
    if (c.cart.length === 0) {
      if (c.step === 'cart' || c.step === 'clarify') c.step = 'root';
      parts.push(this.prompt());
      this.say(parts.join('\n\n'));
      return;
    }
    c.step = 'cart';
    c.privacyShown = true;
    parts.push(cartView(c.cart), botText.cartOptions, dataRequest(), botText.moreHint);
    this.say(parts.join('\n\n'));
  }

  /** Texto libre como pedido (RF-1): D-16 al empezar, agrega y responde (RF-2). */
  order(text: string, normalized: string, returnTo: ReturnTo, source: InterpretationCounts['source'] = 'order'): void {
    const interpretation = this.ctx.interpreter.order(text, this.scope());
    const c = this.conversation;
    if (interpretation.lines.some(isProductLine)) {
      if (!this.startOrder()) {
        this.record(source, { recognized: 0, ambiguous: 0, unrecognized: 0, rejected: 0, unavailable: 0, otherBusiness: 0 });
        return;
      }
      this.respond(this.applyLines(interpretation, source), returnTo);
      return;
    }
    // Sin productos: intención de pedir (RF-4.2) o lo que no se pudo agregar.
    if (interpretation.intent && (c.step === 'root' || c.step === 'browse')) {
      if (this.startOrder()) this.showMenu();
      return;
    }
    if (interpretation.lines.length === 0 || interpretation.lines.every((line) => line.kind === 'unknown')) {
      if (interpretation.lines.length > 0) this.applyLines(interpretation, source);
      this.notUnderstood(normalized);
      return;
    }
    this.respond(this.applyLines(interpretation, source), returnTo);
  }

  /** Quitar por nombre (RF-7.1). false si después del verbo no hay un producto. */
  removeByName(rest: string, returnTo: ReturnTo): boolean {
    const c = this.conversation;
    const interpretation = this.ctx.interpreter.order(rest, this.scope());
    const slugs = new Set(
      interpretation.lines.flatMap((line) => (line.kind === 'item' ? [line.slug] : line.kind === 'ambiguous' ? line.candidates.map((candidate) => candidate.slug) : [])),
    );
    if (slugs.size === 0) return false;
    const indexes = c.cart.flatMap((line, index) => (slugs.has(line.slug) ? [index] : []));
    const [only] = indexes;
    if (indexes.length === 0 || only === undefined) {
      this.say(`${fill(botText.removeNotFound, { texto: cleanText(rest) })}\n\n${returnTo === 'confirm' ? botText.confirmPrompt : this.prompt()}`);
      return true;
    }
    if (indexes.length > 1) {
      c.removeChoices = { lines: indexes, returnTo };
      c.step = 'remove';
      this.say(this.removeWhich(indexes));
      return true;
    }
    this.removeAt(only, returnTo);
    return true;
  }

  removeAt(index: number, returnTo: ReturnTo): void {
    const c = this.conversation;
    const line = c.cart[index];
    c.removeChoices = null;
    if (!line) return;
    c.cart = c.cart.filter((_, i) => i !== index);
    const removed = fill(botText.removed, { producto: lineLabel(line) });
    if (returnTo === 'confirm') {
      this.showSummary(this.revalidate(), [removed]);
      return;
    }
    this.say(removed);
    this.showCart();
  }

  // --- Datos del cliente (RF-5) ---------------------------------------------------

  /** Pide lo que falte (RF-5.4) o muestra el resumen. */
  askNext(): void {
    const c = this.conversation;
    const customer = c.customer;
    if (customer.name === undefined) {
      c.step = 'name';
      this.say(botText.askName);
    } else if (customer.delivery === undefined) {
      c.step = 'delivery';
      this.say(botText.askDelivery);
    } else if (customer.delivery === 'delivery' && customer.address === undefined) {
      c.step = 'address';
      this.say(botText.askAddress);
    } else {
      this.showSummary();
    }
  }

  /** Aplica los datos de un mensaje (nombre, entrega, dirección y nota) con los límites de D-12. */
  applyData(data: CustomerDataInterpretation): void {
    const c = this.conversation;
    const { nameMax, addressMin, addressMax, notesMax } = ORDER_LIMITS;
    if (data.delivery) {
      c.customer.delivery = data.delivery;
      if (data.delivery === 'pickup') delete c.customer.address;
    }
    if (data.note !== undefined) c.customer.notes = [...cleanText(data.note)].slice(0, notesMax).join('');
    if (data.name !== undefined) {
      const name = cleanText(data.name);
      const length = codePointLength(name);
      if (length < 1 || length > nameMax) {
        c.step = 'name';
        this.say(`${fill(botText.invalidName, { max: nameMax })}\n\n${botText.askName}`);
        return;
      }
      c.customer.name = name;
    }
    if (data.address !== undefined) {
      const address = cleanText(data.address);
      const length = codePointLength(address);
      if (length < addressMin || length > addressMax) {
        delete c.customer.address;
        c.step = 'address';
        this.say(`${fill(botText.invalidAddress, { min: addressMin, max: addressMax })}\n\n${botText.askAddress}`);
        return;
      }
      c.customer.address = address;
    }
    this.askNext();
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
    case null:
      return freeText(turn, normalized);
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
  if (number === null) return freeText(turn, normalized);
  const slug = c.menu[number - 1];
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
  const { maxQuantity } = ORDER_LIMITS;
  const quantity = parseNumber(turn.text);
  if (quantity === null || quantity < 1 || quantity > maxQuantity) {
    return turn.say(`${fill(botText.invalidQuantity, { max: maxQuantity })}\n\n${turn.prompt()}`);
  }
  const pending = c.pending;
  if (pending?.optionKey === undefined || !findOption(turn.catalog(), pending.slug, pending.optionKey)) return turn.showMenu();
  const outcome = emptyOutcome();
  c.pending = null;
  turn.addLine({ slug: pending.slug, optionKey: pending.optionKey, quantity, detail: '' }, outcome);
  return turn.respond(outcome, 'cart');
}

/** Texto libre en el saludo, el menú o el carrito: quitar por nombre o pedido (RF-1, RF-7). */
function freeText(turn: Turn, normalized: string, returnTo: ReturnTo = 'cart'): void {
  const rest = afterVerb(turn.text, normalized, botVocabulary.remove);
  if (rest !== null) {
    if (turn.conversation.cart.length === 0) return turn.say(`${botText.cartEmpty}\n\n${turn.prompt()}`);
    if (turn.removeByName(rest, returnTo)) return undefined;
  }
  return turn.order(turn.text, normalized, returnTo);
}

function handleCart(turn: Turn, normalized: string): void {
  const c = turn.conversation;
  switch (parseNumber(turn.text)) {
    case 1:
      return turn.showMenu();
    case 2:
      if (c.cart.length === 0) return turn.showCart();
      c.step = 'remove';
      c.removeChoices = null;
      return turn.say(removePrompt(c.cart));
    case 3:
      c.cart = [];
      c.step = 'root';
      return turn.say(`${botText.emptied}\n\n${botText.rootOptions}`);
    case 4:
      if (c.cart.length === 0) return turn.showCart();
      c.privacyShown = true;
      return turn.say(dataRequest());
    case null:
      break;
    default:
      return turn.notUnderstood(normalized);
  }
  if (isOneOf(normalized, botVocabulary.finish)) {
    if (c.cart.length === 0) return turn.showCart();
    c.privacyShown = true;
    return turn.say(dataRequest());
  }
  const rest = afterVerb(turn.text, normalized, botVocabulary.remove);
  if (rest !== null && turn.removeByName(rest, 'cart')) return undefined;
  return productsOrData(turn, turn.text, normalized);
}

/** RF-5.6: productos, datos, una pregunta o la ayuda breve. Los datos solo tras el aviso (X-5). */
function productsOrData(turn: Turn, text: string, normalized: string): void {
  const c = turn.conversation;
  const interpretation = turn.ctx.interpreter.order(text, turn.scope());
  const data = c.privacyShown && interpretation.hasDeliveryWord ? turn.ctx.interpreter.customerData(text) : {};
  if (data.delivery !== undefined) {
    // Con una palabra de entrega solo cuentan los productos reconocidos sin tolerancia (R-5.5).
    // Un fragmento "no separable" con un producto exacto también cuenta (DEF-002).
    if (interpretation.lines.some((line) => line.kind !== 'unknown' && line.exact)) {
      c.pendingText = text;
      c.step = 'dataOrProducts';
      return turn.say(botText.dataOrProducts);
    }
    return turn.applyData(data);
  }
  if (interpretation.lines.some((line) => line.kind !== 'unknown')) return turn.order(text, normalized, 'cart');
  if (interpretation.lines.length > 0) turn.applyLines(interpretation, 'order');
  // OBS-1: tras el aviso de privacidad, un nombre solo recibe el recordatorio de la entrega.
  const hint = c.privacyShown && c.cart.length > 0 ? ` ${botText.dataHint}` : '';
  return turn.say(`${botText.notUnderstood}${hint} ${turn.help()}`);
}

function handleDataOrProducts(turn: Turn, normalized: string): void {
  const c = turn.conversation;
  const text = c.pendingText ?? '';
  c.pendingText = null;
  c.step = 'cart';
  switch (parseNumber(turn.text)) {
    case 1:
      return turn.order(text, normalizeInput(text), 'cart');
    case 2:
      return turn.applyData(turn.ctx.interpreter.customerData(text));
    default:
      return handleCart(turn, normalized);
  }
}

function handleRemove(turn: Turn): void {
  const c = turn.conversation;
  const number = parseNumber(turn.text);
  const choices = c.removeChoices;
  const index = number === null ? undefined : choices ? choices.lines[number - 1] : number - 1;
  if (index === undefined || !c.cart[index]) return turn.say(`${botText.invalidNumber}\n\n${turn.prompt()}`);
  return turn.removeAt(index, choices?.returnTo ?? 'cart');
}

function handleClarify(turn: Turn, normalized: string): void {
  const c = turn.conversation;
  const pending = c.clarify;
  if (!pending) return turn.showCart();
  const answer = turn.ctx.interpreter.answer(turn.text, pending.blocks, turn.scope());
  if (answer.looksLikeOrder) {
    // RF-3.3: otro pedido en lugar de la respuesta; lo pendiente se descarta con un aviso.
    c.clarify = null;
    c.step = pending.returnTo === 'confirm' ? 'confirm' : c.cart.length > 0 ? 'cart' : 'root';
    turn.say(botText.clarifyDiscarded);
    return turn.order(turn.text, normalized, pending.returnTo);
  }
  const outcome = emptyOutcome();
  let recognized = 0;
  let rejected = 0;
  pending.blocks.forEach((block, at) => {
    const choice = answer.choices[at];
    const candidate = choice === null || choice === undefined ? undefined : block.candidates[choice];
    if (!candidate) {
      outcome.blocks.push(block);
      return;
    }
    if (turn.addLine({ ...candidate, quantity: block.quantity, detail: block.detail }, outcome)) recognized += 1;
    else rejected += 1;
  });
  turn.record('answer', { recognized, ambiguous: outcome.blocks.length, unrecognized: 0, rejected, unavailable: 0, otherBusiness: 0 });
  if (recognized + rejected === 0) return turn.say(`${botText.notUnderstood}\n\n${turn.clarifyText(pending.blocks)}`);
  return turn.respond(outcome, pending.returnTo);
}

function handleName(turn: Turn, text: string): void {
  const data = turn.ctx.interpreter.customerData(text);
  if (data.delivery !== undefined) return turn.applyData(data);
  return turn.applyData({ name: text });
}

function handleDelivery(turn: Turn, text: string): void {
  const number = parseNumber(turn.text);
  if (number === 1 || number === 2) return turn.applyData({ delivery: number === 1 ? 'pickup' : 'delivery' });
  const data = turn.ctx.interpreter.customerData(text);
  if (data.delivery !== undefined) return turn.applyData(data);
  return turn.say(`${botText.invalidNumber}\n\n${botText.askDelivery}`);
}

function handleAddress(turn: Turn, text: string): void {
  return turn.applyData({ address: text });
}

function handleConfirm(turn: Turn, text: string, normalized: string): void {
  const c = turn.conversation;
  if (REJECT_WORDS.includes(normalized)) return turn.cancel();
  // RF-6.3 con la precisión aprobada: confirma si, sin relleno ni cortesía, solo queda una palabra
  // de confirmación ("sí por favor", "ok gracias", "dale, gracias"). RN-3: sigue siendo explícita.
  const bare = withoutCourtesy(normalized);
  if (isOneOf(normalized, botVocabulary.confirm) || isOneOf(bare, botVocabulary.confirm)) {
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
  // RF-6.5: "no" ni cancela ni es una nota.
  if (normalized === 'no' || bare === 'no') return turn.say(botText.confirmPrompt);
  if (isOneOf(normalized, botVocabulary.clearNotes)) {
    c.customer.notes = '';
    return turn.showSummary();
  }
  // RF-7.3: editar el carrito con un verbo de quitar o de agregar seguido de un producto.
  const removed = afterVerb(text, normalized, botVocabulary.remove);
  if (removed !== null && turn.removeByName(removed, 'confirm')) return undefined;
  const added = afterVerb(text, normalized, botVocabulary.add);
  if (added !== null && turn.ctx.interpreter.order(added, turn.scope()).lines.some((line) => line.kind !== 'unknown')) {
    return turn.order(added, normalizeInput(added), 'confirm', 'edit');
  }
  // RF-6.2: cualquier otro texto es la nota (reemplaza a la anterior).
  const notes = cleanText(text);
  if (codePointLength(notes) > ORDER_LIMITS.notesMax) {
    return turn.say(`${fill(botText.invalidNotes, { max: ORDER_LIMITS.notesMax })}\n\n${botText.confirmPrompt}`);
  }
  c.customer.notes = notes;
  return turn.showSummary();
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
      return turn.say(turn.help());
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
    case 'clarify':
      return handleClarify(turn, normalized);
    case 'dataOrProducts':
      return handleDataOrProducts(turn, normalized);
    case 'name':
      return handleName(turn, text);
    case 'delivery':
      return handleDelivery(turn, text);
    case 'address':
      return handleAddress(turn, text);
    case 'confirm':
      return handleConfirm(turn, text, normalized);
    case 'sending':
      return undefined;
  }
}

/**
 * Primer mensaje (REQ-F-013, D-7): saludo; con intención de pedir, D-16 y el menú; con productos,
 * D-16 y la respuesta de RF-2; siempre en **un** mensaje. Los datos personales no se capturan (X-5).
 */
function handleFirst(turn: Turn, input: TurnInput): void {
  const c = turn.conversation;
  const { now, timeZone } = turn.ctx;
  if (input.kind === 'unsupported') return turn.say(greeting(c.business, now, timeZone), botText.textOnly);
  const normalized = normalizeInput(input.text);
  turn.text = input.text;
  const keyword = keywordOf(normalized);
  const header = greetingHeader(c.business, now, timeZone);
  const other = mentionsOther(c.business, normalized) ? otherBusinessNote(c.business) : '';
  const from = turn.replies.length;
  if (keyword === 'menu') {
    turn.say(turn.menuReply());
    return turn.mergeFrom(from, [header, other].filter((part) => part !== '').join('\n\n'));
  }
  if (keyword === 'person') return turn.say(greeting(c.business, now, timeZone), personContact(c.business, turn.ctx.staffContact(c.business)));
  if (keyword === null || keyword === 'cart') {
    const interpretation = turn.ctx.interpreter.order(input.text, turn.scope());
    if (interpretation.lines.some(isProductLine)) {
      turn.order(input.text, normalized, 'cart');
      return turn.mergeFrom(from, header);
    }
    // Sin productos pero con algo que avisar (otro negocio, no disponible, no separable...).
    if (!interpretation.intent && interpretation.lines.some((line) => line.kind !== 'unknown')) {
      turn.order(input.text, normalized, 'cart');
      return turn.mergeFrom(from, header);
    }
    if (interpretation.intent) {
      if (turn.startOrder()) turn.showMenu();
      const note = other !== '' || interpretation.lines.some((line) => line.kind === 'otherBusiness') ? otherBusinessNote(c.business) : '';
      return turn.mergeFrom(from, [header, note].filter((part) => part !== '').join('\n\n'));
    }
  }
  turn.say([greeting(c.business, now, timeZone), other].filter((part) => part !== '').join('\n\n'));
  return undefined;
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
    privacyShown: false,
    clarify: null,
    removeChoices: null,
    pendingText: null,
  };
}

/** Procesa un mensaje del cliente. */
export function handleTurn(current: Conversation | null, input: TurnInput, ctx: TurnContext): TurnResult {
  const started = current === null;
  const conversation = started ? newConversation(ctx) : structuredClone(current);
  const turn = new Turn(conversation, ctx);

  if (conversation.step === 'sending') {
    // El pedido ya se está enviando: se ignora lo que llegue mientras tanto (RN-4).
    return { conversation, replies: [], started, cancelled: false, order: null, interpretations: [] };
  }

  if (started) handleFirst(turn, input);
  else if (input.kind === 'unsupported') turn.say(`${botText.textOnly}\n\n${turn.prompt()}`);
  else handleText(turn, input.text);

  return {
    conversation: turn.closed ? null : conversation,
    replies: turn.replies,
    started,
    cancelled: turn.cancelled,
    order: turn.confirmedOrder,
    interpretations: turn.interpretations,
  };
}
