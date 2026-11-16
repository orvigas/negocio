import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { MenuDataByBusiness, MenuDocument } from '@restaurante/core/catalog';
import type { BusinessId, LogFields, LogLevel, Logger } from '@restaurante/core/shared';

import { loadApiConfig, type ApiConfig } from '../src/config.ts';

/**
 * Ayudas de las pruebas del bot de WhatsApp en la api (REQ-F-042; antes en landing-pages/tests).
 * Sin base de datos ni red: los stores en memoria y los dobles de Meta y de Twilio.
 */

/** Variables de entorno sin validar. */
export type Env = Readonly<Record<string, string | undefined>>;

/** Entorno válido mínimo de la api para pruebas (sin bot). Los números son ficticios. */
export const VALID_ENV = Object.freeze({
  NODE_ENV: 'test',
  BUSINESS_TIMEZONE: 'America/Mexico_City',
  // Obligatoria; makeConfig no conecta.
  DATABASE_URL: 'mysql://restaurante_test_app:test-dev@127.0.0.1:3307/restaurante_test',
});

/**
 * Variables del bot de WhatsApp con Meta (REQ-F-009; REQ-F-012) con valores ficticios. Con el bot,
 * los CTA de las dos landings usan el mismo número (D-6). Los secretos tienen marcas reconocibles para
 * comprobar que nunca aparecen en los logs ni en las respuestas.
 */
export const BOT_ENV = Object.freeze({
  WHATSAPP_MOLOTES: '5210000000009',
  WHATSAPP_BIRRIA: '5210000000009',
  WHATSAPP_BOT_PROVIDER: 'meta',
  WHATSAPP_BOT_ACCESS_TOKEN: 'EAATOKENSECRETOdePRUEBA0123456789',
  WHATSAPP_BOT_ACCOUNT_ID: '106540352242922',
  WHATSAPP_BOT_APP_SECRET: 'appsecretSECRETOdePRUEBA0123456789',
  WHATSAPP_BOT_VERIFY_TOKEN: 'verify-token-SECRETO-de-prueba',
  WHATSAPP_BOT_STAFF_MOLOTES: '5215511110001',
  WHATSAPP_BOT_STAFF_BIRRIA: '5215522220002',
  WHATSAPP_BOT_STAFF_TEMPLATE: 'nuevo_pedido',
  // REQ-F-025 (D-T1): clave del seudónimo de la lista negra; nunca debe aparecer en logs ni respuestas.
  WHATSAPP_BOT_BLOCKLIST_KEY: 'BLOCKLISTkeySECRETOdePRUEBA0123456789abcdefg',
});

/**
 * Variables del bot con Twilio (REQ-F-012) con valores ficticios. El emisor es WHATSAPP_MOLOTES
 * (D-8). El Auth Token tiene un formato válido pero es inventado; las pruebas lo buscan en los logs.
 */
export const TWILIO_BOT_ENV = Object.freeze({
  WHATSAPP_MOLOTES: '14155238886',
  WHATSAPP_BIRRIA: '14155238886',
  WHATSAPP_BOT_PROVIDER: 'twilio',
  WHATSAPP_BOT_ACCOUNT_ID: 'AC0123456789abcdef0123456789abcdef',
  WHATSAPP_BOT_ACCESS_TOKEN: 'feedfacecafebeef0badf00ddeadbeef',
  WHATSAPP_BOT_WEBHOOK_URL: 'https://tunel.example.com/webhooks/whatsapp',
  WHATSAPP_BOT_STAFF_MOLOTES: '5215511110001',
  WHATSAPP_BOT_STAFF_BIRRIA: '5215522220002',
  WHATSAPP_BOT_BLOCKLIST_KEY: 'BLOCKLISTkeySECRETOdePRUEBA0123456789abcdefg',
});

export function makeConfig(overrides: Env = {}): ApiConfig {
  return loadApiConfig({ ...VALID_ENV, ...overrides });
}

/**
 * Semillas de productos de las pruebas: copia de `landing-pages/src/content/<negocio>/seed.json`
 * (sus listas de productos están congeladas desde REQ-F-008 y ya no se editan). La api no puede leer
 * archivos de otra app, así que el catálogo de las pruebas y del simulador vive en tests/fixtures/seeds.
 */
const SEEDS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'seeds');
const SEEDS = Object.freeze({
  molotes: JSON.parse(readFileSync(join(SEEDS_DIR, 'molotes.json'), 'utf8')) as MenuDocument<'molotes'>,
  birria: JSON.parse(readFileSync(join(SEEDS_DIR, 'birria.json'), 'utf8')) as MenuDocument<'birria'>,
});

/** Copia de los datos de la semilla de un negocio. */
export const seedData = <Id extends BusinessId>(businessId: Id): MenuDataByBusiness[Id] =>
  structuredClone(SEEDS[businessId].data as MenuDataByBusiness[Id]);

/** Logger que acumula las líneas para inspeccionarlas (p. ej. que no haya secretos). */
export type RecordingLogger = Logger & { lines: (LogFields & { level: LogLevel; msg: string })[] };

export function makeRecordingLogger(): RecordingLogger {
  const lines: RecordingLogger['lines'] = [];
  const log = (level: LogLevel) => (msg: string, fields: LogFields = {}) => lines.push({ level, msg, ...fields });
  return { lines, debug: log('debug'), info: log('info'), warn: log('warn'), error: log('error') };
}
