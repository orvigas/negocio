/**
 * Número de cliente enmascarado para los logs (REQ-F-009, RF-9.2): solo los 4 últimos dígitos.
 * "5215512345678" -> "*********5678".
 */
export function maskPhone(phone: string): string {
  const visible = phone.slice(-4);
  return `${'*'.repeat(Math.max(phone.length - visible.length, 0))}${visible}`;
}

const MX_MOBILE_WA_ID = /^521(\d{10})$/;

/** Celular de México: `521` + 10 dígitos -> `52` + 10; cualquier otro valor, sin cambios. */
export const withoutMxMobilePrefix = (digits: string): string => digits.replace(MX_MOBILE_WA_ID, '52$1');

/**
 * Forma canónica de un número de WhatsApp (REQ-F-025, CA-9; D-T6): solo dígitos y, para un
 * celular de México, `52` + 10 dígitos. Meta entrega el `wa_id` como `521` + 10 y solo acepta
 * enviarle como `52` + 10 (PR #47): las dos formas son el mismo número en los topes, la lista
 * negra, la detección de repetidos y la lista blanca del personal.
 */
export function canonicalPhone(phone: string): string {
  return withoutMxMobilePrefix(phone.replace(/\D/g, ''));
}

const PHONE_INPUT_SEPARATORS = /[\s().+-]/g;
const PHONE_DIGITS = /^\d{8,15}$/;

/**
 * Número escrito en el panel (D-T4): formato internacional (`+52 55 1234 5678`, `5215512345678`)
 * o 10 dígitos de México (se antepone 52). Se ignoran espacios, guiones, puntos, paréntesis y
 * "+". null si no queda un número de 8 a 15 dígitos.
 */
export function parsePhoneInput(input: string): string | null {
  const digits = input.replace(PHONE_INPUT_SEPARATORS, '');
  if (!/^\d+$/.test(digits)) return null;
  const international = digits.length === 10 ? `52${digits}` : digits;
  return PHONE_DIGITS.test(international) ? canonicalPhone(international) : null;
}
