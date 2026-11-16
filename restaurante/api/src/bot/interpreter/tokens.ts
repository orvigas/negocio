/**
 * Tokens del intérprete de pedidos (REQ-F-013, RF-1.3): palabras con su posición en el texto
 * original (para citar fragmentos y formar detalles con lo que escribió el cliente), su forma
 * normalizada y su forma canónica (número y género). Funciones puras.
 */

export interface Token {
  /** Tal como lo escribió el cliente. */
  readonly raw: string;
  /** Minúsculas y sin acentos: "Órdenes" -> "ordenes". */
  readonly norm: string;
  /** Forma canónica para comparar singular, plural y género: "ordenes" -> "orden", "chica" -> "chico". */
  readonly canon: string;
  readonly start: number;
  readonly end: number;
}

/** Palabra normalizada: sin acentos (diacríticos) y en minúsculas. */
export const normalizeWord = (word: string): string =>
  word
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();

/**
 * Forma canónica (aplicada igual al cliente y al vocabulario): sin la "s" final, sin la "e" del
 * plural tras l, n, r, d, z o j, y con la "a" o la "o" final unificadas. Las palabras de 3 letras o
 * menos y los números no cambian.
 */
export function canonical(norm: string): string {
  if (norm.length <= 3 || /^\d+$/.test(norm)) return norm;
  let word = norm.endsWith('s') ? norm.slice(0, -1) : norm;
  if (word.length > 4 && /[lnrdzj]e$/.test(word)) word = word.slice(0, -1);
  if (word.length > 3 && /[ao]$/.test(word)) word = `${word.slice(0, -1)}o`;
  return word;
}

const WORD = /[\p{L}\p{M}\p{N}]+/gu;

/** Palabras del texto (letras y dígitos; los signos, emojis y espacios separan). */
export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  for (const match of text.matchAll(WORD)) {
    const raw = match[0];
    const norm = normalizeWord(raw);
    if (norm === '') continue;
    tokens.push({ raw, norm, canon: canonical(norm), start: match.index, end: match.index + raw.length });
  }
  return tokens;
}

/** Formas canónicas de una frase del vocabulario ya normalizada ("coca sin azucar"). */
export const phraseCanons = (phrase: string): string[] => tokenize(phrase).map((token) => token.canon);

/** Formas normalizadas de una frase del vocabulario. */
export const phraseNorms = (phrase: string): string[] => tokenize(phrase).map((token) => token.norm);
