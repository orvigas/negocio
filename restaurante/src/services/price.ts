/**
 * Precios editables (RN-1): se capturan en pesos con hasta 2 decimales y se guardan
 * como enteros en centavos. La conversión usa aritmética entera (sin coma flotante).
 */

export const MIN_PRICE_CENTS = 1;
export const MAX_PRICE_CENTS = 500_000; // $5,000.00 MXN

const PRICE_INPUT = /^(\d{1,7})(?:\.(\d{1,2}))?$/;

export const PRICE_ERRORS = Object.freeze({
  required: 'Escribe un precio.',
  format: 'Usa un número con hasta 2 decimales (por ejemplo 45 o 45.50).',
  min: 'El precio debe ser mayor que $0.',
  max: 'El máximo es $5,000.00.',
});

/** ¿Es un importe en centavos dentro del rango permitido? */
export function isValidPriceCents(cents: unknown): cents is number {
  return typeof cents === 'number' && Number.isSafeInteger(cents) && cents >= MIN_PRICE_CENTS && cents <= MAX_PRICE_CENTS;
}

export type PesosInputResult = { ok: true; cents: number } | { ok: false; error: string };

/** Convierte lo escrito por el usuario ("45", "45.5", "45.50") a centavos. */
export function parsePesosInput(input: unknown): PesosInputResult {
  const text = typeof input === 'string' ? input.trim() : '';
  if (text === '') return { ok: false, error: PRICE_ERRORS.required };

  const match = PRICE_INPUT.exec(text);
  if (!match) return { ok: false, error: PRICE_ERRORS.format };

  const cents = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  if (cents < MIN_PRICE_CENTS) return { ok: false, error: PRICE_ERRORS.min };
  if (cents > MAX_PRICE_CENTS) return { ok: false, error: PRICE_ERRORS.max };
  return { ok: true, cents };
}

/** Centavos -> texto para el campo del formulario ("45.50"). */
export function centsToInput(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new TypeError(`Importe inválido: ${cents}`);
  return `${Math.trunc(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}
