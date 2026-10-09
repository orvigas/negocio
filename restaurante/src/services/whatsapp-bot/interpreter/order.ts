import { cleanText, codePointLength } from '../text.ts';
import type { CatalogProduct } from '../catalog.ts';
import { allowedEdits, boundedDistance } from './fuzzy.ts';
import { tokenize, type Token } from './tokens.ts';
import type { AnswerInterpretation, Choice, ClarifyBlock, InterpretedLine, OrderInterpretation } from './types.ts';
import { COMMON, MARKERS, type BusinessIndex, type IgnoreKind, type ProductPhrase, type ProductTerms } from './vocabulary.ts';

/**
 * Interpretación determinista de un pedido en texto libre (REQ-F-013, RF-1, RF-3, RF-8; D-3, D-12).
 * Pasos por segmento: frases de producto, cantidades y presentación, relleno, puntaje de cada
 * producto (exacto y con tolerancia), elección (o empate), opción y detalle. Funciones puras, sin
 * expresiones regulares construidas con texto del cliente.
 */

/** Límites (D-12 de REQ-F-009 y RF-1.7). */
export const INTERPRETER_LIMITS = Object.freeze({ maxLines: 15, maxQuantity: 20, maxDetail: 60, maxFragment: 60, maxCandidates: 9 });

type Role = 'free' | 'qty' | 'pres' | 'ignore' | 'connector' | 'phrase';

interface Segment {
  readonly tokens: readonly Token[];
  readonly text: string;
}

interface Match {
  readonly slug: string;
  readonly exact: boolean;
}

/** Recorta un texto del cliente a `max` puntos de código (los emojis no se parten). */
const truncate = (text: string, max: number): string => (codePointLength(text) <= max ? text : `${[...text].slice(0, max - 1).join('')}…`);

const fragmentOf = (text: string): string => truncate(cleanText(text), INTERPRETER_LIMITS.maxFragment);

const startsWith = (tokens: readonly Token[], at: number, norms: readonly string[], key: 'norm' | 'canon' = 'norm'): boolean =>
  norms.length > 0 && norms.every((norm, offset) => tokens[at + offset]?.[key] === norm);

// --- Segmentación (RF-1.2) ----------------------------------------------------------

/** Parte el texto por saltos de línea, ",", ";", "+" y la palabra "y" (salvo dentro de un nombre). */
export function segment(text: string, joinedNames: readonly (readonly string[])[] = []): Segment[] {
  const segments: Segment[] = [];
  let offset = 0;
  for (const chunk of text.split(/[\n,;+]/)) {
    const tokens = tokenize(chunk).map((token) => ({ ...token, start: token.start + offset, end: token.end + offset }));
    offset += chunk.length + 1;
    let current: Token[] = [];
    const flush = (): void => {
      const [first] = current;
      const last = current[current.length - 1];
      if (first && last) segments.push({ tokens: current, text: text.slice(first.start, last.end) });
      current = [];
    };
    tokens.forEach((token, index) => {
      const insideName = joinedNames.some((norms) =>
        norms.some((norm, position) => norm === 'y' && startsWith(tokens, index - position, norms)),
      );
      if ((token.norm === 'y' || token.norm === 'e') && !insideName) flush();
      else current.push(token);
    });
    flush();
  }
  return segments;
}

// --- Productos -------------------------------------------------------------------

interface Scored {
  readonly entry: ProductTerms;
  score: number;
  exact: number;
  readonly tokens: Set<number>;
  readonly phrases: ProductPhrase[];
}

/** Coincidencias de un token con los productos: exactas y, si no hay ninguna, con tolerancia (D-12). */
function matchToken(token: Token, index: BusinessIndex, entries: readonly ProductTerms[]): Match[] {
  const exact = entries.filter((entry) => entry.terms.has(token.canon)).map((entry) => ({ slug: entry.product.slug, exact: true }));
  if (exact.length > 0) return exact;
  const max = allowedEdits(token.norm.length);
  if (max === 0 || /\d/.test(token.norm) || COMMON.words.has(token.norm) || index.otherTerms.has(token.canon) || index.generic.has(token.canon)) return [];
  let best = max + 1;
  let matches: Match[] = [];
  for (const entry of entries) {
    let distance = max + 1;
    // Se compara la forma canónica y la normalizada ("ques" -> "queso" es 1 edición).
    for (const term of entry.terms) distance = Math.min(distance, boundedDistance(token.canon, term, max), boundedDistance(token.norm, term, max));
    if (distance < best) {
      best = distance;
      matches = [{ slug: entry.product.slug, exact: false }];
    } else if (distance === best && distance <= max) {
      matches.push({ slug: entry.product.slug, exact: false });
    }
  }
  return best <= max ? matches : [];
}

// --- Líneas -----------------------------------------------------------------------

interface LineContext {
  readonly index: BusinessIndex;
  /** Una línea anterior del mismo mensaje indicó "orden" (D-3). */
  inheritOrden: boolean;
}

interface Analysis {
  readonly roles: Role[];
  readonly ignored: Set<IgnoreKind>;
  readonly quantities: { readonly at: number; readonly length: number; readonly value: number; readonly digits: boolean; readonly multiplier: boolean }[];
  presentation: 'pieza' | 'orden' | null;
  /** La palabra "orden" o "pieza" está escrita (no viene de "N de M"; DEF-008). */
  presentationWord: boolean;
  presentationUnits: number | null;
  readonly phrases: { readonly at: number; readonly phrase: ProductPhrase }[];
  /** Posición del primer "con" o "sin": lo que sigue puntúa solo si lo anterior no identifica nada. */
  lateFrom: number;
}

/** Cantidad que empieza en `at`: frase, dígitos, palabra o multiplicador ("x2", "2x", "x 2"; DEF-003). */
function quantityAt(tokens: readonly Token[], at: number): { length: number; value: number; digits: boolean; multiplier: boolean } | null {
  for (const { norms, value } of COMMON.quantityPhrases) if (startsWith(tokens, at, norms)) return { length: norms.length, value, digits: false, multiplier: false };
  const token = tokens[at];
  if (!token) return null;
  if (/^\d{1,4}$/.test(token.norm)) return { length: 1, value: Number(token.norm), digits: true, multiplier: false };
  const multiplier = /^x(\d{1,3})$/.exec(token.norm) ?? /^(\d{1,3})x$/.exec(token.norm);
  if (multiplier?.[1] !== undefined) return { length: 1, value: Number(multiplier[1]), digits: true, multiplier: true };
  const next = tokens[at + 1];
  if (token.norm === 'x' && next && /^\d{1,3}$/.test(next.norm)) return { length: 2, value: Number(next.norm), digits: true, multiplier: true };
  const word = COMMON.quantityWords.get(token.norm);
  return word === undefined ? null : { length: 1, value: word, digits: false, multiplier: false };
}

function analyze(tokens: readonly Token[], index: BusinessIndex): Analysis {
  const roles: Role[] = tokens.map(() => 'free');
  const analysis: Analysis = { roles, ignored: new Set(), quantities: [], presentation: null, presentationWord: false, presentationUnits: null, phrases: [], lateFrom: tokens.length };
  const mark = (from: number, length: number, role: Role): void => {
    for (let i = from; i < from + length; i += 1) roles[i] = role;
  };
  // 1. Frases de producto (detalles reconocidos, variantes de varias palabras, sinónimos), primero las largas.
  for (let at = 0; at < tokens.length; at += 1) {
    if (roles[at] !== 'free') continue;
    const phrase = index.phrases.find((candidate) => candidate.canons.every((canon, offset) => roles[at + offset] === 'free' && tokens[at + offset]?.canon === canon));
    if (phrase) {
      analysis.phrases.push({ at, phrase });
      mark(at, phrase.canons.length, 'phrase');
      at += phrase.canons.length - 1;
    }
  }
  // 2. Cantidades, relleno, intención, entrega, presentación, conectores y palabras genéricas.
  for (let at = 0; at < tokens.length; at += 1) {
    const token = tokens[at];
    if (!token || roles[at] !== 'free') continue;
    const quantity = quantityAt(tokens, at);
    // DEF-009: "de 3 piezas" describe el producto (detalle), no es la cantidad ni la presentación.
    if (quantity && quantity.length === 1 && at > 0 && tokens[at - 1]?.norm === 'de' && COMMON.presentations.has(tokens[at + 1]?.canon ?? '')) {
      at += 1;
      continue;
    }
    if (quantity) {
      analysis.quantities.push({ at, length: quantity.length, value: quantity.value, digits: quantity.digits, multiplier: quantity.multiplier });
      mark(at, quantity.length, 'qty');
      // DEF-006: "1 de 3 de tinga" son N órdenes de M ("de M" es la presentación, como en RF-1.5).
      const after = at + quantity.length;
      const units = !quantity.multiplier && tokens[after]?.norm === 'de' && tokens[after + 2]?.norm === 'de' ? quantityAt(tokens, after + 1) : null;
      if (units && units.length === 1 && !units.multiplier) {
        analysis.presentation = 'orden';
        analysis.presentationUnits = units.value;
        mark(after, 2, 'pres');
        at = after + 1;
        continue;
      }
      at += quantity.length - 1;
      continue;
    }
    const ignore = COMMON.ignorePhrases.find((candidate) => startsWith(tokens, at, candidate.norms));
    if (ignore) {
      analysis.ignored.add(ignore.kind);
      mark(at, ignore.norms.length, 'ignore');
      at += ignore.norms.length - 1;
      continue;
    }
    const presentation = COMMON.presentations.get(token.canon);
    if (presentation) {
      roles[at] = 'pres';
      analysis.presentation = presentation;
      analysis.presentationWord = true;
      // "orden de 3": el número es la presentación, no la cantidad (RF-1.5).
      const next = tokens[at + 1];
      const units = presentation === 'orden' && next?.norm === 'de' ? quantityAt(tokens, at + 2) : null;
      if (units && units.length === 1) {
        analysis.presentationUnits = units.value;
        mark(at + 1, 2, 'pres');
        at += 2;
      }
      continue;
    }
    if (MARKERS.has(token.norm) && analysis.lateFrom === tokens.length) analysis.lateFrom = at;
    if (COMMON.connectors.has(token.norm)) roles[at] = 'connector';
    else if (index.generic.has(token.canon)) roles[at] = 'ignore';
  }
  return analysis;
}

/** Opción de un producto según la presentación (Molotes), las variantes mencionadas o el único precio. */
function resolveOption(
  entry: ProductTerms,
  tokens: readonly Token[],
  analysis: Analysis,
  phrases: readonly ProductPhrase[],
  ctx: LineContext,
): { optionKey: string | null; used: Set<number> } {
  const { product } = entry;
  const used = new Set<number>();
  const keys = product.options.map((option) => option.key);
  if (keys.includes('pieza')) {
    const orden = product.options.find((option) => option.key === 'orden');
    const wanted = analysis.presentation ?? (ctx.inheritOrden && orden ? 'orden' : 'pieza');
    if (wanted === 'orden' && !orden) return { optionKey: null, used };
    // "orden de 5" cuando la orden es de 3: se pregunta (R-6 b).
    if (wanted === 'orden' && analysis.presentationUnits !== null && analysis.presentationUnits !== orden?.units) return { optionKey: null, used };
    return { optionKey: wanted, used };
  }
  const [only] = product.options;
  if (product.options.length === 1 && only) return { optionKey: only.key, used };
  const evidence = new Map<string, number>();
  for (const phrase of phrases) {
    if (phrase.optionKey && !phrase.unavailable && keys.includes(phrase.optionKey)) evidence.set(phrase.optionKey, (evidence.get(phrase.optionKey) ?? 0) + 10);
  }
  tokens.forEach((token, at) => {
    if (analysis.roles[at] !== 'free' || MARKERS.has(token.norm)) return;
    const owners = [...entry.optionTerms].filter(([, terms]) => terms.has(token.canon)).map(([key]) => key);
    const [owner] = owners;
    // Solo cuenta un token distintivo: el de una sola de las opciones ("grande", "chica", "agua").
    if (owners.length === 1 && owner) {
      evidence.set(owner, (evidence.get(owner) ?? 0) + 1);
      used.add(at);
    }
  });
  const ranked = [...evidence].sort((a, b) => b[1] - a[1]);
  const [first, second] = ranked;
  if (!first || (second && second[1] === first[1])) return { optionKey: null, used };
  return { optionKey: first[0], used };
}

function scoreProducts(tokens: readonly Token[], analysis: Analysis, entries: readonly ProductTerms[], index: BusinessIndex, includeLate: boolean): Scored[] {
  const scored = new Map<string, Scored>();
  const get = (entry: ProductTerms): Scored => {
    let item = scored.get(entry.product.slug);
    if (!item) {
      item = { entry, score: 0, exact: 0, tokens: new Set(), phrases: [] };
      scored.set(entry.product.slug, item);
    }
    return item;
  };
  for (const { phrase } of analysis.phrases) {
    const entry = entries.find((candidate) => candidate.product.slug === phrase.slug);
    if (!entry) continue;
    const item = get(entry);
    item.score += phrase.canons.length;
    item.exact += phrase.canons.length;
    item.phrases.push(phrase);
  }
  tokens.forEach((token, at) => {
    if (analysis.roles[at] !== 'free' || MARKERS.has(token.norm) || (!includeLate && at > analysis.lateFrom)) return;
    for (const match of matchToken(token, index, entries)) {
      const entry = entries.find((candidate) => candidate.product.slug === match.slug);
      if (!entry) continue;
      const item = get(entry);
      item.score += 1;
      if (match.exact) item.exact += 1;
      item.tokens.add(at);
    }
  });
  return [...scored.values()].filter((item) => item.score > 0);
}

function best(scored: readonly Scored[]): Scored[] {
  const top = Math.max(...scored.map((item) => item.score));
  const leaders = scored.filter((item) => item.score === top);
  const topExact = Math.max(...leaders.map((item) => item.exact));
  return leaders.filter((item) => item.exact === topExact);
}

/** Detalle (RF-8): detalles reconocidos y lo que sobra del segmento, recortado a 60 caracteres. */
function detailOf(tokens: readonly Token[], analysis: Analysis, consumed: ReadonlySet<number>, recognized: readonly string[]): string {
  const leftover = tokens.filter((token, at) => {
    if (consumed.has(at)) return false;
    const role = analysis.roles[at];
    if (role === 'free' || role === 'connector') return true;
    // Un número que no fue la cantidad queda en el detalle ("coca de 600").
    return role === 'qty' && /^\d+$/.test(token.norm);
  });
  const leading = new Set([...COMMON.connectors].filter((connector) => connector !== 'con'));
  while (leftover[0] && leading.has(leftover[0].norm)) leftover.shift();
  while (leftover.length > 0 && COMMON.connectors.has(leftover[leftover.length - 1]?.norm ?? '')) leftover.pop();
  const text = leftover.map((token) => token.raw).join(' ');
  const parts = [...new Set(recognized), ...(text === '' ? [] : [text])];
  return truncate(cleanText(parts.join(', ')), INTERPRETER_LIMITS.maxDetail);
}

const hasContent = (tokens: readonly Token[], analysis: Analysis): boolean =>
  tokens.some((token, at) => {
    const role = analysis.roles[at];
    return role === 'free' || role === 'pres' || role === 'phrase' || (role === 'qty' && /^\d+$/.test(token.norm));
  });

const optionLabel = (product: CatalogProduct, optionKey: string): string => {
  const label = product.options.find((option) => option.key === optionKey)?.label ?? '';
  return label === '' ? product.name : `${product.name} (${label})`;
};

function interpretSegment(seg: Segment, ctx: LineContext): InterpretedLine | null {
  const { tokens } = seg;
  const { index } = ctx;
  const analysis = analyze(tokens, index);
  const fragment = fragmentOf(seg.text);
  let scored = scoreProducts(tokens, analysis, index.products, index, false);
  if (scored.length === 0) scored = scoreProducts(tokens, analysis, index.products, index, true);
  const available = scored.filter((item) => item.phrases.length === 0 || item.phrases.some((phrase) => !phrase.unavailable) || item.tokens.size > 0);

  if (available.length === 0) {
    // Variante no disponible de un producto visible, o producto no disponible (RF-1.9).
    const unavailablePhrase = analysis.phrases.find(({ phrase }) => phrase.unavailable)?.phrase;
    const unavailableScored = scoreProducts(tokens, analysis, index.unavailable, index, true).filter((item) => item.exact > 0);
    const [unavailableEntry] = unavailableScored.length > 0 ? best(unavailableScored) : [];
    if (unavailablePhrase || unavailableEntry) {
      const entry = unavailableEntry?.entry ?? index.unavailable.find((candidate) => candidate.product.slug === unavailablePhrase?.slug);
      const name = entry ? (unavailablePhrase?.optionKey ? optionLabel(entry.product, unavailablePhrase.optionKey) : entry.product.name) : fragment;
      return { kind: 'unavailable', fragment, name, exact: true };
    }
    // Producto o palabra del otro negocio (RF-1.10).
    if (tokens.some((token, at) => analysis.roles[at] !== 'connector' && index.otherTerms.has(token.canon))) {
      return { kind: 'otherBusiness', fragment, exact: true };
    }
    // Los datos de entrega no son "no entendidos" (R-5.4): se piden después (DEF-005).
    if (analysis.ignored.has('pickup') || analysis.ignored.has('delivery')) return null;
    return hasContent(tokens, analysis) ? { kind: 'unknown', fragment } : null;
  }

  const leaders = best(available);
  const anchor = Math.min(
    ...leaders.flatMap((item) => [...item.tokens, ...analysis.phrases.filter(({ phrase }) => item.phrases.includes(phrase)).map(({ at }) => at)]),
  );
  // Cantidad: la más cercana antes del producto; si no hay, la primera después; si no, 1.
  // "3 tacos x2": una cantidad y un multiplicador a la vez; no se adivina (DEF-003).
  if (analysis.quantities.some((quantity) => quantity.multiplier) && analysis.quantities.length > 1) return { kind: 'unclear', fragment, reason: 'quantity', exact: leaders.some((item) => item.exact > 0) };
  const before = analysis.quantities.filter((quantity) => quantity.at < anchor);
  const chosen = before[before.length - 1] ?? analysis.quantities.find((quantity) => quantity.at > anchor);
  let quantity = chosen?.value ?? 1;
  const exact = leaders.some((item) => item.exact > 0);
  // DEF-008 y OBS-4: "orden" en un producto que no tiene orden en el catálogo. Con la palabra
  // escrita y "de M", son N×M unidades ("2 órdenes de 3 tacos" = 6). Sin la palabra ("una de 3 de
  // tacos") o sin M ("una orden de tacos"), no se adivina: se pregunta cuántos y no se agrega.
  const [leader] = leaders;
  if (leaders.length === 1 && leader && analysis.presentation === 'orden' && !leader.entry.product.options.some((option) => option.key === 'orden')) {
    if (!analysis.presentationWord || analysis.presentationUnits === null) return { kind: 'unclear', fragment, reason: 'quantity', exact };
    quantity *= analysis.presentationUnits;
  }
  if (quantity < 1 || quantity > INTERPRETER_LIMITS.maxQuantity) return { kind: 'outOfRange', fragment, exact };

  const ordenHere = analysis.presentation === 'orden';
  const resolve = (item: Scored) => resolveOption(item.entry, tokens, analysis, item.phrases, ctx);
  const recognizedOf = (item: Scored): string[] => item.phrases.flatMap((phrase) => (phrase.detail ? [phrase.detail] : []));

  const [single] = leaders;
  if (leaders.length === 1 && single) {
    // La variante pedida existe pero hoy no está disponible (RF-1.9).
    const unavailableOption = single.phrases.find((phrase) => phrase.unavailable && phrase.optionKey)?.optionKey;
    if (unavailableOption && !single.phrases.some((phrase) => !phrase.unavailable && phrase.optionKey)) {
      const entry = index.unavailable.find((candidate) => candidate.product.slug === single.entry.product.slug);
      return { kind: 'unavailable', fragment, name: entry ? optionLabel(entry.product, unavailableOption) : single.entry.product.name, exact };
    }
    const { optionKey, used } = resolve(single);
    // DEF-007: una palabra del nombre precedida de un número que no es la cantidad ("de 2 tortillas")
    // es parte del detalle, no del producto.
    const quantified = (at: number): boolean => analysis.roles[at - 1] === 'qty' && /^\d+$/.test(tokens[at - 1]?.norm ?? '') && chosen?.at !== at - 1;
    const consumed = new Set<number>([...[...single.tokens].filter((at) => !quantified(at) || at === anchor), ...used]);
    for (const { at, phrase } of analysis.phrases) if (single.phrases.includes(phrase)) for (let i = 0; i < phrase.canons.length; i += 1) consumed.add(at + i);
    if (chosen) for (let i = 0; i < chosen.length; i += 1) consumed.add(chosen.at + i);
    // Las palabras del nombre del producto elegido no son detalle aunque vayan tras "con".
    tokens.forEach((token, at) => {
      if (analysis.roles[at] === 'free' && single.entry.terms.has(token.canon) && !quantified(at)) consumed.add(at);
    });
    const detail = detailOf(tokens, analysis, consumed, recognizedOf(single));
    if (ordenHere) ctx.inheritOrden = true;
    if (optionKey !== null) return { kind: 'item', slug: single.entry.product.slug, optionKey, quantity, detail, exact };
    const candidates = single.entry.product.options.map((option) => ({ slug: single.entry.product.slug, optionKey: option.key }));
    return { kind: 'ambiguous', fragment, quantity, detail, reason: 'variant', candidates, exact };
  }

  // Empate entre productos (RF-3.1): cada uno aporta su opción resuelta o todas sus opciones.
  const candidates: Choice[] = leaders.flatMap((item) => {
    const { optionKey } = resolve(item);
    const { product } = item.entry;
    return optionKey === null ? product.options.map((option) => ({ slug: product.slug, optionKey: option.key })) : [{ slug: product.slug, optionKey }];
  });
  if (candidates.length > INTERPRETER_LIMITS.maxCandidates) return { kind: 'unknown', fragment };
  const consumed = new Set<number>(leaders.flatMap((item) => [...item.tokens]));
  for (const { at, phrase } of analysis.phrases) for (let i = 0; i < phrase.canons.length; i += 1) consumed.add(at + i);
  if (chosen) for (let i = 0; i < chosen.length; i += 1) consumed.add(chosen.at + i);
  const detail = detailOf(tokens, analysis, consumed, []);
  if (ordenHere) ctx.inheritOrden = true;
  return { kind: 'ambiguous', fragment, quantity, detail, reason: exact ? 'products' : 'typo', candidates, exact };
}

const isChosen = (line: InterpretedLine | undefined): line is Extract<InterpretedLine, { kind: 'item' | 'ambiguous' }> =>
  line?.kind === 'item' || line?.kind === 'ambiguous';

/**
 * DEF-001: un segmento sin cantidad ni presentación que solo nombra variantes de la línea anterior
 * ("un consome chico, con carne"; "1 birriamen, grande") la completa. Devuelve la línea anterior
 * actualizada, o null si el segmento no es eso.
 */
function refineVariant(seg: Segment, analysis: Analysis, previous: InterpretedLine | undefined, index: BusinessIndex): InterpretedLine | null {
  if (!isChosen(previous) || analysis.quantities.length > 0 || analysis.presentation !== null) return null;
  const choices: readonly Choice[] = previous.kind === 'item' ? [{ slug: previous.slug, optionKey: previous.optionKey }] : previous.candidates;
  const slugs = new Set(choices.map((choice) => choice.slug));
  const evidence = new Set<string>();
  let content = 0;
  for (const { phrase } of analysis.phrases) {
    content += 1;
    if (!slugs.has(phrase.slug) || !phrase.optionKey || phrase.unavailable) return null;
    evidence.add(`${phrase.slug}|${phrase.optionKey}`);
  }
  for (const [at, token] of seg.tokens.entries()) {
    if (analysis.roles[at] !== 'free' || MARKERS.has(token.norm)) continue;
    content += 1;
    const owners = index.products
      .filter((entry) => slugs.has(entry.product.slug))
      .flatMap((entry) => [...entry.optionTerms].filter(([, terms]) => terms.has(token.canon)).map(([key]) => `${entry.product.slug}|${key}`));
    if (owners.length === 0) return null;
    for (const owner of owners) evidence.add(owner);
  }
  if (content === 0 || evidence.size === 0) return null;
  const matching = choices.filter((choice) => evidence.has(`${choice.slug}|${choice.optionKey}`));
  if (previous.kind === 'item') return matching.length === 1 ? previous : null;
  const [only] = matching;
  if (matching.length === 1 && only) return { kind: 'item', slug: only.slug, optionKey: only.optionKey, quantity: previous.quantity, detail: previous.detail, exact: previous.exact };
  if (matching.length > 1) return { ...previous, candidates: matching };
  return null;
}

/** Parte un segmento en las cantidades que no siguen a "de" ("2 tacos 1 coca" -> "2 tacos", "1 coca"). */
function splitByQuantities(seg: Segment, analysis: Analysis): Segment[] {
  const starts = analysis.quantities
    .filter((quantity) => !quantity.multiplier && quantity.at > 0 && seg.tokens[quantity.at - 1]?.norm !== 'de')
    .map((quantity) => quantity.at);
  if (starts.length === 0) return [seg];
  const bounds = [0, ...starts, seg.tokens.length];
  const parts: Segment[] = [];
  for (let i = 0; i < bounds.length - 1; i += 1) {
    const tokens = seg.tokens.slice(bounds[i], bounds[i + 1]);
    const [first] = tokens;
    const last = tokens[tokens.length - 1];
    if (first && last) parts.push({ tokens, text: seg.text.slice(first.start - (seg.tokens[0]?.start ?? 0), last.end - (seg.tokens[0]?.start ?? 0)) });
  }
  return parts;
}

/**
 * Un segmento con varias cantidades y varios productos sin separador (DEF-002): se separa por las
 * cantidades solo si cada parte es un producto; si no, no se agrega nada de él y se pide
 * reescribirlo con comas. Devuelve null si el segmento no tiene ese problema.
 */
function interpretUnseparated(seg: Segment, analysis: Analysis, ctx: LineContext): InterpretedLine[] | null {
  const parts = splitByQuantities(seg, analysis);
  if (parts.length < 2) return null;
  const trial: LineContext = { index: ctx.index, inheritOrden: ctx.inheritOrden };
  const lines = parts.map((part) => interpretSegment(part, trial));
  // Una línea que pregunta cuántos (OBS-4) es un producto; no impide separar las demás.
  const products = lines.filter((line) => line !== null && line.kind !== 'unknown' && !(line.kind === 'unclear' && line.reason === 'unseparated'));
  const doubtful = lines.some((line) => line?.kind === 'unknown' || (line?.kind === 'unclear' && line.reason === 'unseparated'));
  if (products.length === 0 || (products.length === 1 && !doubtful)) return null;
  // Una parte que no se entiende junto a un producto ("2 tacos 1 cocacolota", "2 tacos 3"): nada
  // se agrega y nunca queda un número sobrante como detalle.
  if (doubtful) {
    const exact = products.some((line) => line !== null && 'exact' in line && line.exact);
    return [{ kind: 'unclear', fragment: fragmentOf(seg.text), reason: 'unseparated', exact }];
  }
  ctx.inheritOrden = trial.inheritOrden;
  return lines.filter((line) => line !== null);
}

/** Interpreta un mensaje como pedido (RF-1). */
export function interpretOrder(text: string, index: BusinessIndex): OrderInterpretation {
  const ctx: LineContext = { index, inheritOrden: false };
  const lines: InterpretedLine[] = [];
  let overflow = 0;
  let intent = false;
  let hasDeliveryWord = false;
  const push = (line: InterpretedLine): void => {
    if (lines.length >= INTERPRETER_LIMITS.maxLines) overflow += 1;
    else lines.push(line);
  };
  for (const seg of segment(text, index.joinedNames)) {
    // Intención y entrega se detectan en todos los segmentos, también los que no traen productos.
    const analysis = analyze(seg.tokens, index);
    if (analysis.ignored.has('intent')) intent = true;
    if (analysis.ignored.has('pickup') || analysis.ignored.has('delivery')) hasDeliveryWord = true;
    const previous = lines[lines.length - 1];

    // DEF-001: variantes de la línea anterior ("…, con carne"; "…, grande").
    const refined = refineVariant(seg, analyze(seg.tokens, index), previous, index);
    if (refined) {
      lines[lines.length - 1] = refined;
      continue;
    }
    // RF-8.1: "2 tacos sin cebolla, con mucha salsa": un segmento sin cantidad ni presentación que
    // empieza con "con" o "sin" sigue el detalle de la línea anterior del mismo mensaje.
    const firstWord = seg.tokens.find((_, at) => analysis.roles[at] !== 'ignore');
    if (isChosen(previous) && firstWord !== undefined && MARKERS.has(firstWord.norm) && analysis.quantities.length === 0 && analysis.presentation === null) {
      const detail = truncate(cleanText([previous.detail, seg.text].filter((part) => part !== '').join(', ')), INTERPRETER_LIMITS.maxDetail);
      lines[lines.length - 1] = { ...previous, detail };
      continue;
    }
    // DEF-002: varias cantidades y productos sin separador.
    const separated = interpretUnseparated(seg, analysis, ctx);
    if (separated) {
      for (const line of separated) push(line);
      continue;
    }
    const line = interpretSegment(seg, ctx);
    if (line !== null) push(line);
  }
  return { lines, overflow, intent, hasDeliveryWord };
}

// --- Respuesta a una aclaración (RF-3.3) ----------------------------------------------

/** Partes de la respuesta, en orden: "2, 1", "2 1" o "chico con carne y grande". */
function answerParts(text: string): Segment[] {
  return segment(text).flatMap((seg) =>
    seg.tokens.length > 1 && seg.tokens.every((token) => /^\d+$/.test(token.norm))
      ? seg.tokens.map((token) => ({ tokens: [token], text: token.raw }))
      : [seg],
  );
}

function choose(part: Segment, block: ClarifyBlock, index: BusinessIndex): number | null {
  const [only] = part.tokens;
  if (part.tokens.length === 1 && only && /^\d+$/.test(only.norm)) {
    const number = Number(only.norm);
    return number >= 1 && number <= block.candidates.length ? number - 1 : null;
  }
  const scores = block.candidates.map((candidate) => {
    const entry = index.products.find((item) => item.product.slug === candidate.slug);
    const option = entry?.product.options.find((item) => item.key === candidate.optionKey);
    if (!entry || !option) return 0;
    // Solo el nombre y la opción del candidato: los términos de las otras variantes no cuentan.
    const words = new Set([...tokenize(entry.product.name), ...tokenize(option.label)].map((token) => token.canon));
    for (const term of entry.optionTerms.get(option.key) ?? []) words.add(term);
    let score = 0;
    for (const token of part.tokens) {
      if (COMMON.connectors.has(token.norm) && !MARKERS.has(token.norm)) continue;
      if (words.has(token.canon)) score += 2;
      else {
        const max = allowedEdits(token.norm.length);
        if (max > 0 && [...words].some((word) => boundedDistance(token.canon, word, max) <= max)) score += 1;
      }
    }
    return score;
  });
  const top = Math.max(0, ...scores);
  const winners = scores.flatMap((score, at) => (score === top && top > 0 ? [at] : []));
  return winners.length === 1 ? (winners[0] ?? null) : null;
}

export function interpretAnswer(text: string, blocks: readonly ClarifyBlock[], index: BusinessIndex): AnswerInterpretation {
  const parts = answerParts(text);
  const choices = blocks.map((block, at) => {
    const part = parts[at];
    return part ? choose(part, block, index) : null;
  });
  const looksLikeOrder = choices.every((choice) => choice === null) && interpretOrder(text, index).lines.some((line) => line.kind === 'item' || line.kind === 'ambiguous');
  return { choices, looksLikeOrder };
}
