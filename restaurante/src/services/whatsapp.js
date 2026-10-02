/**
 * Construcción del enlace de pedido por WhatsApp.
 *
 * Prioridad:
 *   1. `url` explícita (debe ser https).
 *   2. https://wa.me/<phone>?text=<message codificado>.
 */

/** Número en formato internacional E.164 sin "+": solo dígitos, 8 a 15. */
export const PHONE_PATTERN = /^\d{8,15}$/;

export const MAX_MESSAGE_LENGTH = 500;

/**
 * @param {unknown} value
 * @returns {boolean} true si es una URL absoluta https sin credenciales embebidas.
 */
export function isHttpsUrl(value) {
  if (typeof value !== 'string' || value.length === 0) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.username === '' && url.password === '';
  } catch {
    return false;
  }
}

/**
 * @param {{ url?: string, phone?: string, message?: string }} options
 * @returns {string} Enlace absoluto https.
 * @throws {TypeError} Si la URL no es https o el número no es válido.
 */
export function buildWhatsAppLink({ url, phone, message } = {}) {
  if (url) {
    if (!isHttpsUrl(url)) {
      throw new TypeError('La URL de WhatsApp debe ser una URL https válida');
    }
    return new URL(url).href;
  }

  if (typeof phone !== 'string' || !PHONE_PATTERN.test(phone)) {
    throw new TypeError(
      'El número de WhatsApp debe tener solo dígitos en formato internacional (8 a 15)',
    );
  }

  const base = `https://wa.me/${phone}`;
  if (!message) return base;

  if (message.length > MAX_MESSAGE_LENGTH) {
    throw new TypeError(
      `El mensaje de WhatsApp no puede superar ${MAX_MESSAGE_LENGTH} caracteres`,
    );
  }
  // encodeURIComponent codifica los espacios como %20 (no "+"), formato documentado por wa.me.
  return `${base}?text=${encodeURIComponent(message)}`;
}
