import type { BusinessId, LogFields, LogLevel, Logger } from '@restaurante/core/shared';
import {
  pickPageData,
  type MenuDataByBusiness,
  type MenuDocument,
  type PageDataByBusiness,
} from '@restaurante/core/catalog';

import { loadConfig, type Config, type Env } from '../src/config/env.ts';
import { loadSeedDocument } from '../src/content/seeds.ts';
import { createMemoryMenuRepository } from '../src/repositories/memory-menu-repository.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any justificado: las pruebas corrompen los datos a propósito (tipos, campos y estructura inválidos).
export type CorruptibleData = any;

/** Entorno válido mínimo para pruebas. Los números son ficticios. */
export const VALID_ENV = Object.freeze({
  NODE_ENV: 'test',
  PORT: '3000',
  BUSINESS_TIMEZONE: 'America/Mexico_City',
  WHATSAPP_MOLOTES: '5210000000001',
  WHATSAPP_MOLOTES_MESSAGE: 'Hola, quiero hacer un pedido de molotes',
  WHATSAPP_BIRRIA: '5210000000002',
  WHATSAPP_BIRRIA_MESSAGE: 'Hola, quiero hacer un pedido de birria',
  // Obligatoria (REQ-F-014). makeConfig no conecta: las pruebas usan la base de tests/support/database.ts.
  DATABASE_URL: 'mysql://restaurante_test_app:test-dev@127.0.0.1:3307/restaurante_test',
  // Obligatoria (REQ-F-038). Un puerto cerrado: un servidor de prueba arranca sin API (sirve la
  // semilla) y nunca habla con una API local del desarrollador; las pruebas de la API usan el doble.
  API_INTERNAL_URL: 'http://127.0.0.1:9',
});

/**
 * Variables del bot de WhatsApp con Meta (REQ-F-009; REQ-F-012) con valores ficticios. Con el bot, los CTA de las dos
 * landings usan el mismo número (D-6). Los secretos tienen marcas reconocibles para comprobar que
 * nunca aparecen en los logs ni en las respuestas.
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

export function makeConfig(overrides: Env = {}): Config {
  return loadConfig({ ...VALID_ENV, ...overrides });
}

/** Semillas leídas una sola vez (copias nuevas en cada llamada a seedData). */
// Semillas versionadas: content.test y el propio repositorio las validan contra el esquema.
const SEEDS = Object.freeze({
  molotes: loadSeedDocument('molotes') as MenuDocument<'molotes'>,
  birria: loadSeedDocument('birria') as MenuDocument<'birria'>,
});

/** Copia de los datos editables de la semilla de un negocio. */
export const seedData = <Id extends BusinessId>(businessId: Id): MenuDataByBusiness[Id] =>
  structuredClone(SEEDS[businessId].data as MenuDataByBusiness[Id]);
export const seedDocuments = () => structuredClone(SEEDS);
/** Datos de página de la semilla (hero, destacado y promociones; lo que guarda el formulario desde REQ-F-008). */
export const seedPage = <Id extends BusinessId>(businessId: Id): PageDataByBusiness[Id] => pickPageData(businessId, seedData(businessId));

/** Repositorio en memoria ya inicializado (CA-38: sin leer archivos de datos). */
export async function makeRepository(options: Parameters<typeof createMemoryMenuRepository>[0] = {}) {
  const repository = createMemoryMenuRepository({ seeds: seedDocuments(), ...options });
  await repository.init();
  return repository;
}

/** Logger que acumula las líneas para inspeccionarlas (p. ej. que no haya contraseñas). */
export type RecordingLogger = Logger & { lines: (LogFields & { level: LogLevel; msg: string })[] };

export function makeRecordingLogger(): RecordingLogger {
  const lines: RecordingLogger['lines'] = [];
  const log = (level: LogLevel) => (msg: string, fields: LogFields = {}) => lines.push({ level, msg, ...fields });
  return { lines, debug: log('debug'), info: log('info'), warn: log('warn'), error: log('error') };
}
