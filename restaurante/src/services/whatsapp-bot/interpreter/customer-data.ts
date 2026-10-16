import { botVocabulary } from '../../../content/bot.ts';
import { paymentOf, type PaymentMethod } from '../payment.ts';
import { cleanText, normalizeInput } from '../text.ts';
import { phraseNorms, tokenize, type Token } from './tokens.ts';
import type { CustomerDataInterpretation } from './types.ts';

/**
 * Datos del cliente en un mensaje (REQ-F-013, RF-5.2): "Juan, recoger" o "Ana, domicilio, Calle 5
 * #10, Centro". Se busca la primera palabra de entrega (solo coincidencia exacta): lo anterior es
 * el nombre y lo posterior, la dirección (a domicilio) o una nota (para recoger; R-6 a). Las
 * longitudes las valida la conversación (D-12 de REQ-F-009). Función pura.
 */

const DELIVERY_PHRASES = [
  ...botVocabulary.pickup.map((phrase) => ({ norms: phraseNorms(phrase), delivery: 'pickup' as const })),
  ...botVocabulary.delivery.map((phrase) => ({ norms: phraseNorms(phrase), delivery: 'delivery' as const })),
].sort((a, b) => b.norms.length - a.norms.length);

const NAME_PREFIXES = botVocabulary.namePrefixes.map(phraseNorms).sort((a, b) => b.length - a.length);
/** Palabras que sobran junto a la palabra de entrega ("Juan para recoger", "a domicilio en Calle 5"). */
const EDGE_WORDS = new Set(['para', 'a', 'al', 'en', 'por', 'es', 'de', 'y', 'mi', 'direccion', 'la']);

const TRIM = /^[\s,.;:\-–—]+|[\s,.;:\-–—]+$/g;

const matchesAt = (tokens: readonly Token[], at: number, norms: readonly string[]): boolean => norms.every((norm, offset) => tokens[at + offset]?.norm === norm);

const isDeliveryWord = (norm: string): boolean => DELIVERY_PHRASES.some(({ norms }) => norms.length === 1 && norms[0] === norm);

/** Quita palabras de relleno al principio o al final, usando las posiciones en el texto original. */
function trimWords(text: string, { start, end, edge = true }: { start: boolean; end: boolean; edge?: boolean }, prefixes: readonly (readonly string[])[] = []): string {
  let tokens = tokenize(text);
  let from = 0;
  let to = text.length;
  if (start) {
    const prefix = prefixes.find((norms) => matchesAt(tokens, 0, norms));
    if (prefix) tokens = tokens.slice(prefix.length);
    // "paso a recoger": las palabras de entrega que siguen a la primera tampoco son datos.
    while (tokens[0] && ((edge && EDGE_WORDS.has(tokens[0].norm)) || isDeliveryWord(tokens[0].norm) || (!edge && tokens[0].norm === 'a' && isDeliveryWord(tokens[1]?.norm ?? '')))) {
      tokens = tokens.slice(1);
    }
    from = tokens[0]?.start ?? text.length;
  }
  if (end) {
    while (tokens.length > 0 && EDGE_WORDS.has(tokens[tokens.length - 1]?.norm ?? '')) tokens = tokens.slice(0, -1);
    to = tokens[tokens.length - 1]?.end ?? from;
  }
  if (tokens.length === 0) return '';
  return cleanText(text.slice(from, Math.max(from, to)).replace(TRIM, '')).replace(TRIM, '');
}

/**
 * Separa la forma de pago (REQ-F-035, RF-2.1): solo un segmento entero entre `,`, `;` o `.` que sea
 * una frase de pago ("Ana, recoger, efectivo"). Una dirección que contiene la palabra ("Av.
 * Transferencia 10") no cuenta. Devuelve el texto sin ese segmento (ni su separador) y el método;
 * si hay varios, el último.
 */
function takePayment(text: string): { rest: string; payment?: PaymentMethod } {
  const parts = text.split(/([,;.])/);
  let payment: PaymentMethod | undefined;
  const kept: string[] = [];
  for (let at = 0; at < parts.length; at += 2) {
    const segment = parts[at] ?? '';
    const separator = at === 0 ? '' : (parts[at - 1] ?? '');
    const method = paymentOf(normalizeInput(segment));
    if (method === null) kept.push(separator, segment);
    else payment = method;
  }
  return payment === undefined ? { rest: text } : { rest: kept.join(''), payment };
}

export function interpretCustomerData(input: string): CustomerDataInterpretation {
  const { rest: text, payment } = takePayment(input);
  const tokens = tokenize(text);
  for (let at = 0; at < tokens.length; at += 1) {
    const found = DELIVERY_PHRASES.find(({ norms }) => matchesAt(tokens, at, norms));
    const first = tokens[at];
    const last = found ? tokens[at + found.norms.length - 1] : undefined;
    if (!found || !first || !last) continue;
    const name = trimWords(text.slice(0, first.start), { start: true, end: true }, NAME_PREFIXES);
    const rest = trimWords(text.slice(last.end), { start: true, end: false, edge: found.delivery === 'delivery' });
    const result: { name?: string; delivery: 'pickup' | 'delivery'; address?: string; note?: string; payment?: PaymentMethod } = { delivery: found.delivery };
    if (name !== '') result.name = name;
    if (payment !== undefined) result.payment = payment;
    if (rest !== '') {
      if (found.delivery === 'delivery') result.address = rest;
      else result.note = rest;
    }
    return result;
  }
  return {};
}
