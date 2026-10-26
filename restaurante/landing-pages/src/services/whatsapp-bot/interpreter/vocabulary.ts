import type { BusinessId } from '../../../config/businesses.ts';
import { botVocabulary, getBotContent, getBotVocabulary } from '../../../content/bot.ts';
import type { BotCatalog, CatalogProduct } from '../catalog.ts';
import { canonical, normalizeWord, phraseCanons, phraseNorms, tokenize } from './tokens.ts';

/**
 * Índices del intérprete (REQ-F-013, RF-10): el vocabulario común y, por turno, el del negocio a
 * partir del catálogo vigente y del contenido (D-10). Un producto se reconoce por las palabras de
 * su nombre aunque no tenga sinónimos; los sinónimos de un slug que no existe se ignoran (RF-10.3).
 */

export type IgnoreKind = 'filler' | 'intent' | 'pickup' | 'delivery';

export interface CommonIndex {
  readonly quantityWords: ReadonlyMap<string, number>;
  /** Frases de cantidad, de la más larga a la más corta (formas normalizadas). */
  readonly quantityPhrases: readonly { readonly norms: readonly string[]; readonly value: number }[];
  /** Relleno, intención y entrega, de la frase más larga a la más corta. */
  readonly ignorePhrases: readonly { readonly norms: readonly string[]; readonly kind: IgnoreKind }[];
  readonly connectors: ReadonlySet<string>;
  /** Forma canónica -> presentación de Molotes. */
  readonly presentations: ReadonlyMap<string, 'pieza' | 'orden'>;
  /** Todas las palabras del vocabulario común: nunca se comparan con tolerancia. */
  readonly words: ReadonlySet<string>;
}

const byLength = <T extends { norms?: readonly string[]; canons?: readonly string[] }>(a: T, b: T): number =>
  (b.norms ?? b.canons ?? []).length - (a.norms ?? a.canons ?? []).length;

function buildCommon(): CommonIndex {
  const v = botVocabulary;
  const ignorePhrases = [
    ...v.filler.map((phrase) => ({ norms: phraseNorms(phrase), kind: 'filler' as const })),
    ...v.intent.map((phrase) => ({ norms: phraseNorms(phrase), kind: 'intent' as const })),
    ...v.pickup.map((phrase) => ({ norms: phraseNorms(phrase), kind: 'pickup' as const })),
    ...v.delivery.map((phrase) => ({ norms: phraseNorms(phrase), kind: 'delivery' as const })),
  ].sort(byLength);
  const quantityPhrases = Object.entries(v.quantityPhrases)
    .map(([phrase, value]) => ({ norms: phraseNorms(phrase), value }))
    .sort(byLength);
  const presentations = new Map<string, 'pieza' | 'orden'>();
  for (const [key, words] of Object.entries(v.presentations) as ['pieza' | 'orden', readonly string[]][]) {
    for (const word of words) presentations.set(canonical(normalizeWord(word)), key);
  }
  const words = new Set<string>();
  for (const list of [v.filler, v.intent, v.pickup, v.delivery, v.connectors, v.confirm, v.finish, v.remove, v.add, Object.keys(v.quantityWords), Object.keys(v.quantityPhrases)]) {
    for (const phrase of list) for (const norm of phraseNorms(phrase)) words.add(norm);
  }
  return {
    quantityWords: new Map(Object.entries(v.quantityWords)),
    quantityPhrases,
    ignorePhrases,
    connectors: new Set(v.connectors),
    presentations,
    words,
  };
}

export const COMMON: CommonIndex = buildCommon();

/** Frase de producto: detalle reconocido, etiqueta de variante de varias palabras o sinónimo. */
export interface ProductPhrase {
  readonly canons: readonly string[];
  readonly slug: string;
  readonly optionKey?: string;
  readonly detail?: string;
  /** La variante existe pero hoy no está disponible. */
  readonly unavailable: boolean;
}

export interface ProductTerms {
  readonly product: CatalogProduct;
  /** Formas canónicas que identifican el producto (nombre, sinónimos, variantes y detalles). */
  readonly terms: ReadonlySet<string>;
  /** Formas canónicas de cada opción con variante (etiqueta sin conectores y sinónimos). */
  readonly optionTerms: ReadonlyMap<string, ReadonlySet<string>>;
}

export interface BusinessIndex {
  readonly products: readonly ProductTerms[];
  readonly unavailable: readonly ProductTerms[];
  /** De la frase más larga a la más corta. */
  readonly phrases: readonly ProductPhrase[];
  readonly generic: ReadonlySet<string>;
  /** Formas canónicas de los nombres y palabras del otro negocio (RF-1.10). */
  readonly otherTerms: ReadonlySet<string>;
  /** Secuencias normalizadas de nombres que contienen "y" (no se parten). */
  readonly joinedNames: readonly (readonly string[])[];
}

const isVariant = (key: string): boolean => key.startsWith('v:');

/** "con" y "sin" marcan lo que sigue como posible detalle (RF-8): nunca identifican un producto. */
export const MARKERS: ReadonlySet<string> = new Set(['con', 'sin']);

const contentCanons = (text: string, generic: ReadonlySet<string>): string[] =>
  tokenize(text)
    .filter((token) => !COMMON.connectors.has(token.norm) && !MARKERS.has(token.norm) && !/^\d+$/.test(token.norm) && !generic.has(token.canon))
    .map((token) => token.canon);

function productTerms(product: CatalogProduct, business: BusinessId, generic: ReadonlySet<string>): ProductTerms {
  const vocabulary = getBotVocabulary(business).products[product.slug];
  const terms = new Set(contentCanons(product.name, generic));
  const optionTerms = new Map<string, Set<string>>();
  for (const option of product.options) {
    if (!isVariant(option.key)) continue;
    const set = new Set(contentCanons(option.label, generic));
    for (const synonym of vocabulary?.variants?.[option.label] ?? []) for (const canon of contentCanons(synonym, generic)) set.add(canon);
    optionTerms.set(option.key, set);
    for (const canon of set) terms.add(canon);
  }
  for (const synonym of vocabulary?.synonyms ?? []) for (const canon of contentCanons(synonym, generic)) terms.add(canon);
  for (const detail of vocabulary?.details ?? []) for (const canon of contentCanons(detail.words, generic)) terms.add(canon);
  return { product, terms, optionTerms };
}

function productPhrases(product: CatalogProduct, business: BusinessId, unavailable: boolean): ProductPhrase[] {
  const vocabulary = getBotVocabulary(business).products[product.slug];
  const phrases: ProductPhrase[] = [];
  const optionKeyOf = (label: string | undefined): string | undefined =>
    label === undefined ? undefined : product.options.find((option) => option.key === `v:${label}`)?.key;
  for (const option of product.options) {
    if (!isVariant(option.key)) continue;
    const canons = phraseCanons(normalizeWord(option.label));
    if (canons.length >= 2) phrases.push({ canons, slug: product.slug, optionKey: option.key, unavailable });
  }
  for (const detail of vocabulary?.details ?? []) {
    const optionKey = optionKeyOf(detail.variant);
    // Un detalle ligado a una variante que no está en esta lista (disponible o no) se ignora aquí.
    if (detail.variant !== undefined && optionKey === undefined) continue;
    phrases.push({ canons: phraseCanons(detail.words), slug: product.slug, detail: detail.detail, unavailable, ...(optionKey === undefined ? {} : { optionKey }) });
  }
  if (!unavailable) {
    for (const synonym of vocabulary?.synonyms ?? []) {
      const canons = phraseCanons(synonym);
      if (canons.length >= 2) phrases.push({ canons, slug: product.slug, unavailable });
    }
  }
  return phrases;
}

const genericOf = (business: BusinessId): Set<string> => new Set(getBotVocabulary(business).genericWords.map((word) => canonical(normalizeWord(word))));

export function buildBusinessIndex(business: BusinessId, catalog: BotCatalog, other: BusinessId, otherCatalog: BotCatalog): BusinessIndex {
  const generic = genericOf(business);
  const otherGeneric = genericOf(other);
  const products = catalog.products.map((product) => productTerms(product, business, generic));
  const unavailable = catalog.unavailable.map((product) => productTerms(product, business, generic));
  const phrases = [
    ...catalog.products.flatMap((product) => productPhrases(product, business, false)),
    ...catalog.unavailable.flatMap((product) => productPhrases(product, business, true)),
  ].sort(byLength);
  const otherTerms = new Set<string>([...otherGeneric, ...getBotContent(other).keywords.map((word) => canonical(normalizeWord(word)))]);
  for (const product of otherCatalog.products) for (const canon of productTerms(product, other, otherGeneric).terms) otherTerms.add(canon);
  // Las palabras propias nunca son "del otro negocio".
  for (const entry of products) for (const canon of entry.terms) otherTerms.delete(canon);
  for (const canon of generic) otherTerms.delete(canon);
  const joinedNames = catalog.products.map((product) => phraseNorms(normalizeWord(product.name))).filter((norms) => norms.includes('y'));
  return { products, unavailable, phrases, generic, otherTerms, joinedNames };
}
