import { loadConfig } from '../src/config/env.js';

/** Entorno válido mínimo para pruebas. Los números son ficticios. */
export const VALID_ENV = Object.freeze({
  NODE_ENV: 'test',
  PORT: '3000',
  BUSINESS_TIMEZONE: 'America/Mexico_City',
  WHATSAPP_MOLOTES: '5210000000001',
  WHATSAPP_MOLOTES_MESSAGE: 'Hola, quiero hacer un pedido de molotes',
  WHATSAPP_BIRRIA: '5210000000002',
  WHATSAPP_BIRRIA_MESSAGE: 'Hola, quiero hacer un pedido de birria',
});

export function makeConfig(overrides = {}) {
  return loadConfig({ ...VALID_ENV, ...overrides });
}
