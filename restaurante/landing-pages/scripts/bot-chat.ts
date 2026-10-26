/**
 * Conversación con el bot de WhatsApp en la terminal, sin Meta ni Twilio (REQ-F-009 RF-12;
 * REQ-F-012 D-16).
 *
 *   npm run bot:chat
 *   npm run bot:chat -- --ahora 2026-10-09T16:00     (fecha y hora locales del negocio)
 *   npm run bot:chat -- --proveedor twilio           (simula Twilio; por defecto, meta)
 *
 * Arranca la app real en 127.0.0.1 con los productos de las semillas (en memoria; no toca
 * DATA_DIR ni la base de datos) y el bot del proveedor elegido conectado a su doble
 * (tests/support/cloud-api-double.ts o tests/support/twilio-api-double.ts). Cada línea que
 * escribes llega al webhook como un mensaje de texto **firmado**, igual que los del proveedor
 * (con Twilio, firmado con la URL configurada del webhook); se muestran las respuestas del bot y
 * el aviso que recibiría el personal. Ninguna petición sale a internet. Solo para desarrollo
 * (no se incluye en la imagen de producción).
 *
 * Escribe como lo haría el cliente, en texto libre ("2 molotes de queso y una coca", "Ana,
 * recoger", "sí") o con los números de opción (REQ-F-013).
 *
 * Comandos: /hora <AAAA-MM-DDTHH:MM> cambia el reloj, /audio envía un mensaje que no es texto,
 * /salir termina. La zona horaria es BUSINESS_TIMEZONE (por defecto, America/Mexico_City).
 */
import { createHmac, randomBytes } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';

import { createApp } from '../src/app.ts';
import { DEFAULTS, isValidTimeZone, loadConfig } from '../src/config/env.ts';
import { loadSeedDocument } from '../src/content/seeds.ts';
import { createMemoryBotControlStore } from '../src/repositories/memory-bot-control-store.ts';
import { createMemoryMenuRepository } from '../src/repositories/memory-menu-repository.ts';
import { createMemoryProductStore } from '../src/repositories/memory-product-store.ts';
import { createProductRepository, type ImportSource } from '../src/repositories/product-repository.ts';
import { createBotControl } from '../src/services/bot-control.ts';
import type { MenuDocument } from '../src/services/menu-schema.ts';
import { createBotOrchestrator } from '../src/services/whatsapp-bot/orchestrator.ts';
import { createBotProtection } from '../src/services/whatsapp-bot/protection/protection.ts';
import { createChatBot } from '../src/services/whatsapp-bot/providers/select.ts';
import { toZonedIsoString } from '../src/utils/datetime.ts';
import { createLogger } from '../src/utils/logger.ts';
import { createCloudApiDouble } from '../tests/support/cloud-api-double.ts';
import { createTwilioApiDouble } from '../tests/support/twilio-api-double.ts';

const CUSTOMER = '5215500000000';
const LOCAL_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

/**
 * Fecha y hora locales de `timeZone` -> instante, o un mensaje de error (DEF-002: sin trazas).
 * La fecha debe existir tal cual: 2026-02-30 o 24:00 no se corrigen a otro día.
 */
function fromLocal(local: string, timeZone: string): Date | string {
  if (!LOCAL_TIME.test(local)) return `Usa el formato AAAA-MM-DDTHH:MM (recibido: ${local})`;
  const guess = new Date(`${local}:00Z`);
  if (Number.isNaN(guess.getTime())) return `Fecha inválida: ${local}`;
  const date = new Date(`${local}:00${toZonedIsoString(guess, timeZone).slice(-6)}`);
  if (Number.isNaN(date.getTime()) || toZonedIsoString(date, timeZone).slice(0, 16) !== local) return `Fecha inválida: ${local}`;
  return date;
}

const USAGE = 'Uso: npm run bot:chat [-- --ahora AAAA-MM-DDTHH:MM] [--proveedor meta|twilio]';
let ahora: string | undefined;
let proveedor: string | undefined;
try {
  ({ ahora, proveedor } = parseArgs({ options: { ahora: { type: 'string' }, proveedor: { type: 'string' } } }).values);
} catch {
  fail(USAGE);
}
const provider = (proveedor ?? 'meta').toLowerCase();
if (provider !== 'meta' && provider !== 'twilio') fail(USAGE);
const timeZone = process.env.BUSINESS_TIMEZONE?.trim() || DEFAULTS.BUSINESS_TIMEZONE;
if (!isValidTimeZone(timeZone)) fail('BUSINESS_TIMEZONE no es una zona horaria IANA válida');

// Reloj: avanza con el tiempo real desde la hora indicada (o la actual).
const start = ahora === undefined ? new Date() : fromLocal(ahora, timeZone);
if (typeof start === 'string') fail(start);
let base = start;
let startedAt = Date.now();
const now = () => new Date(base.getTime() + (Date.now() - startedAt));

// Configuración ficticia: solo existe en este proceso. Con Twilio, la URL del webhook es la que
// "configuraste en Twilio": la firma se calcula con ella aunque el simulador escuche en 127.0.0.1.
const BOT_NUMBER = '5210000000000';
const appSecret = randomBytes(16).toString('hex');
const authToken = randomBytes(16).toString('hex');
const providerEnv =
  provider === 'meta'
    ? {
        WHATSAPP_BOT_ACCESS_TOKEN: 'token-del-simulador',
        WHATSAPP_BOT_ACCOUNT_ID: '100000000000000',
        WHATSAPP_BOT_APP_SECRET: appSecret,
        WHATSAPP_BOT_VERIFY_TOKEN: randomBytes(16).toString('hex'),
        WHATSAPP_BOT_STAFF_TEMPLATE: 'nuevo_pedido',
      }
    : {
        WHATSAPP_BOT_ACCESS_TOKEN: authToken,
        WHATSAPP_BOT_ACCOUNT_ID: `AC${randomBytes(16).toString('hex')}`,
        WHATSAPP_BOT_WEBHOOK_URL: 'https://simulador.invalid/webhooks/whatsapp',
      };
const config = loadConfig({
  NODE_ENV: 'development',
  BUSINESS_TIMEZONE: timeZone,
  WHATSAPP_MOLOTES: BOT_NUMBER,
  WHATSAPP_BIRRIA: BOT_NUMBER,
  WHATSAPP_BOT_PROVIDER: provider,
  WHATSAPP_BOT_STAFF_MOLOTES: '5215511110001',
  WHATSAPP_BOT_STAFF_BIRRIA: '5215522220002',
  // Obligatoria en la configuración (REQ-F-014), pero el simulador nunca conecta: usa el store en memoria.
  DATABASE_URL: 'mysql://simulador:simulador@127.0.0.1/simulador',
  // Clave del seudónimo de la lista negra (REQ-F-025): aleatoria en cada ejecución (store en memoria).
  WHATSAPP_BOT_BLOCKLIST_KEY: randomBytes(32).toString('base64url'),
  ...providerEnv,
});
const botConfig = config.whatsappBot;
if (!botConfig) fail('No se pudo preparar la configuración del simulador');

const seeds = { molotes: loadSeedDocument('molotes') as MenuDocument<'molotes'>, birria: loadSeedDocument('birria') as MenuDocument<'birria'> };
const repository = createMemoryMenuRepository({ seeds, timezone: timeZone });
await repository.init();
const products = createProductRepository({ store: createMemoryProductStore(), imageExists: async () => true });
const sources: { [Id in keyof typeof seeds]: ImportSource<Id> } = {
  molotes: { source: 'seed', data: seeds.molotes.data },
  birria: { source: 'seed', data: seeds.birria.data },
};
await products.init(sources);

const logger = createLogger({ level: 'silent' });
const metaDouble = createCloudApiDouble();
const twilioDouble = createTwilioApiDouble();
// Protección del bot (REQ-F-025, D-T10) con los umbrales del entorno y un store en memoria.
const botControl = createBotControl({
  store: createMemoryBotControlStore(),
  keys: config.botKeys,
  limits: config.botLimits,
  timeZone,
  staff: Object.values(botConfig.staff),
  logger,
  now,
});
await botControl.init();
const bot = createBotOrchestrator({
  chatBot: createChatBot(botConfig, { fetch: provider === 'meta' ? metaDouble.fetch : twilioDouble.fetch, logger }),
  staff: botConfig.staff,
  timeZone,
  products,
  logger,
  now,
  protection: createBotProtection({ control: botControl, limits: config.botLimits, timeZone, logger }),
});
const app = createApp({ config, repository, products, logger, now, bot, botControl });
const server: Server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));
const webhookUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/webhooks/whatsapp`;

let counter = 0;

/** Entrega firmada como la de Meta: JSON con `X-Hub-Signature-256`. */
function metaRequest(message: Record<string, unknown>): { body: string; headers: Record<string, string> } {
  const body = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'simulador',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: BOT_NUMBER, phone_number_id: botConfig?.accountId },
              contacts: [{ profile: { name: 'Cliente' }, wa_id: CUSTOMER }],
              messages: [{ from: CUSTOMER, id: `wamid.SIMULADOR${counter}`, timestamp: String(Math.floor(now().getTime() / 1000)), ...message }],
            },
          },
        ],
      },
    ],
  });
  const signature = `sha256=${createHmac('sha256', appSecret).update(body).digest('hex')}`;
  return { body, headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': signature } };
}

/** Entrega firmada como la de Twilio: formulario con `X-Twilio-Signature` (URL configurada + parámetros ordenados). */
function twilioRequest(fields: Record<string, string>): { body: string; headers: Record<string, string> } {
  const sid = `SM${counter.toString(16).padStart(32, '0')}`;
  const params: Record<string, string> = {
    MessageSid: sid,
    SmsMessageSid: sid,
    AccountSid: botConfig?.accountId ?? '',
    From: `whatsapp:+${CUSTOMER}`,
    To: `whatsapp:+${BOT_NUMBER}`,
    WaId: CUSTOMER,
    ProfileName: 'Cliente',
    SmsStatus: 'received',
    NumMedia: '0',
    ...fields,
  };
  const data = Object.keys(params)
    .sort()
    .reduce((acc, name) => `${acc}${name}${params[name]}`, 'https://simulador.invalid/webhooks/whatsapp');
  const signature = createHmac('sha1', authToken).update(data, 'utf8').digest('base64');
  return { body: new URLSearchParams(params).toString(), headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Twilio-Signature': signature } };
}

function printSent(): void {
  if (provider === 'meta') {
    for (const sent of metaDouble.sent.splice(0)) {
      if (sent.to === CUSTOMER) stdout.write(`\nbot> ${(sent.text ?? '').replaceAll('\n', '\n     ')}\n`);
      else stdout.write(`\n[aviso al personal +${sent.to}, plantilla ${sent.template?.name}]\n${JSON.stringify(sent.template?.params, null, 2)}\n`);
    }
    return;
  }
  for (const sent of twilioDouble.sent.splice(0)) {
    if (sent.to === CUSTOMER) stdout.write(`\nbot> ${(sent.text ?? '').replaceAll('\n', '\n     ')}\n`);
    else if (sent.contentSid !== undefined) stdout.write(`\n[aviso al personal +${sent.to}, Content Template ${sent.contentSid}]\n${JSON.stringify(sent.variables, null, 2)}\n`);
    else stdout.write(`\n[aviso al personal +${sent.to}, texto libre]\n${sent.text ?? ''}\n`);
  }
}

async function send(kind: 'text' | 'audio', text = ''): Promise<void> {
  counter += 1;
  const request =
    provider === 'meta'
      ? metaRequest(kind === 'text' ? { type: 'text', text: { body: text } } : { type: 'audio', audio: { id: '1', mime_type: 'audio/ogg' } })
      : twilioRequest(kind === 'text' ? { Body: text } : { Body: '', NumMedia: '1', MediaContentType0: 'audio/ogg' });
  const response = await fetch(webhookUrl, { method: 'POST', headers: request.headers, body: request.body });
  if (response.status !== 200) stdout.write(`(el webhook respondió ${response.status})\n`);
  await bot.drain();
  printSent();
}

stdout.write(`Simulador del bot con ${provider} (${toZonedIsoString(now(), timeZone)}, ${timeZone}). /hora AAAA-MM-DDTHH:MM, /audio, /salir.\n`);
const rl = createInterface({ input: stdin, output: stdout, terminal: stdin.isTTY });
let inputClosed = false;
rl.once('close', () => (inputClosed = true));
const prompt = (): void => {
  // Con la entrada redirigida (un archivo o una tubería), readline se cierra al terminarla.
  if (!inputClosed) rl.prompt();
};
rl.setPrompt('\ntú> ');
prompt();
for await (const line of rl) {
  const text = line.trim();
  if (text === '/salir') break;
  if (text.startsWith('/hora ')) {
    const date = fromLocal(text.slice(6).trim(), timeZone);
    if (typeof date === 'string') {
      // La sesión sigue abierta con el reloj anterior.
      stdout.write(`${date}\n`);
    } else {
      base = date;
      startedAt = Date.now();
      stdout.write(`Reloj: ${toZonedIsoString(now(), timeZone)}\n`);
    }
  } else if (text === '/audio') {
    await send('audio');
  } else if (text !== '') {
    if (!stdin.isTTY) stdout.write(`\ntú> ${text}\n`);
    await send('text', text);
  }
  prompt();
}
rl.close();
server.close();
