import { botVocabulary } from '../../content/bot.ts';
import type { DeliveryMethod } from './messages.ts';

/**
 * Formas de pago del pedido del bot (REQ-F-035). La regla de qué métodos valen para cada entrega
 * (RN-1) vive aquí, en código; los textos y las palabras que los reconocen, en el contenido.
 */

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'onDelivery';

/** Métodos válidos por entrega, en el orden de sus números de opción (RF-1.2, RN-1). */
export const PAYMENT_OPTIONS: Readonly<Record<DeliveryMethod, readonly PaymentMethod[]>> = Object.freeze({
  pickup: Object.freeze(['cash', 'card', 'transfer'] as const),
  delivery: Object.freeze(['onDelivery', 'transfer'] as const),
});

export const isPaymentValid = (method: PaymentMethod, delivery: DeliveryMethod): boolean => PAYMENT_OPTIONS[delivery].includes(method);

const PAYMENT_WORDS = Object.entries(botVocabulary.payment) as [PaymentMethod, readonly string[]][];

/** Método que nombra un texto ya normalizado, como frase completa (RF-1.3), o null. */
export function paymentOf(normalized: string): PaymentMethod | null {
  for (const [method, words] of PAYMENT_WORDS) if (words.includes(normalized)) return method;
  return null;
}
