/**
 * Conversación con el bot de WhatsApp en la terminal, sin Meta (REQ-F-009, RF-12).
 *
 *   npm run bot:chat
 *   npm run bot:chat -- --ahora 2026-10-09T16:00     (fecha y hora locales del negocio)
 *
 * Arranca la app real en 127.0.0.1 con los productos de las semillas (en memoria; no toca
 * DATA_DIR ni la base de datos) y el bot conectado al doble de la Cloud API
 * (tests/support/cloud-api-double.ts). Cada línea que escribes llega al webhook como un mensaje
 * de texto **firmado**, igual que los de Meta; se muestran las respuestas del bot y el aviso que
 * recibiría el personal. Ninguna petición sale a internet. Solo para desarrollo (no se incluye
 * en la imagen de producción).
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
import { createMemoryMenuRepository } from '../src/repositories/memory-menu-repository.ts';
import { createMemoryProductStore } from '../src/repositories/memory-product-store.ts';
import { createProductRepository, type ImportSource } from '../src/repositories/product-repository.ts';
import type { MenuDocument } from '../src/services/menu-schema.ts';
import { createWhatsAppBot } from '../src/services/whatsapp-bot/bot.ts';
import { createCloudApiClient } from '../src/services/whatsapp-bot/cloud-api.ts';
import { toZonedIsoString } from '../src/utils/datetime.ts';
import { createLogger } from '../src/utils/logger.ts';
import { createCloudApiDouble } from '../tests/support/cloud-api-double.ts';

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

let ahora: string | undefined;
try {
  ({ ahora } = parseArgs({ options: { ahora: { type: 'string' } } }).values);
} catch {
  fail('Uso: npm run bot:chat [-- --ahora AAAA-MM-DDTHH:MM]');
}
const timeZone = process.env.BUSINESS_TIMEZONE?.trim() || DEFAULTS.BUSINESS_TIMEZONE;
if (!isValidTimeZone(timeZone)) fail('BUSINESS_TIMEZONE no es una zona horaria IANA válida');

// Reloj: avanza con el tiempo real desde la hora indicada (o la actual).
const start = ahora === undefined ? new Date() : fromLocal(ahora, timeZone);
if (typeof start === 'string') fail(start);
let base = start;
let startedAt = Date.now();
const now = () => new Date(base.getTime() + (Date.now() - startedAt));

// Configuración ficticia: solo existe en este proceso.
const appSecret = randomBytes(16).toString('hex');
const config = loadConfig({
  NODE_ENV: 'development',
  BUSINESS_TIMEZONE: timeZone,
  WHATSAPP_MOLOTES: '5210000000000',
  WHATSAPP_BIRRIA: '5210000000000',
  WHATSAPP_BOT_ACCESS_TOKEN: 'token-del-simulador',
  WHATSAPP_BOT_PHONE_NUMBER_ID: '100000000000000',
  WHATSAPP_BOT_APP_SECRET: appSecret,
  WHATSAPP_BOT_VERIFY_TOKEN: randomBytes(16).toString('hex'),
  WHATSAPP_BOT_STAFF_MOLOTES: '5215511110001',
  WHATSAPP_BOT_STAFF_BIRRIA: '5215522220002',
  WHATSAPP_BOT_STAFF_TEMPLATE: 'nuevo_pedido',
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
const double = createCloudApiDouble();
const bot = createWhatsAppBot({
  config: botConfig,
  timeZone,
  products,
  client: createCloudApiClient({ config: botConfig, fetch: double.fetch, logger }),
  logger,
  now,
});
const app = createApp({ config, repository, products, logger, now, whatsappBot: bot });
const server: Server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));
const webhookUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/webhooks/whatsapp`;

let counter = 0;
async function send(message: Record<string, unknown>): Promise<void> {
  counter += 1;
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
              metadata: { display_phone_number: '5210000000000', phone_number_id: botConfig?.phoneNumberId },
              contacts: [{ profile: { name: 'Cliente' }, wa_id: CUSTOMER }],
              messages: [{ from: CUSTOMER, id: `wamid.SIMULADOR${counter}`, timestamp: String(Math.floor(now().getTime() / 1000)), ...message }],
            },
          },
        ],
      },
    ],
  });
  const signature = `sha256=${createHmac('sha256', appSecret).update(body).digest('hex')}`;
  const response = await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': signature }, body });
  if (response.status !== 200) stdout.write(`(el webhook respondió ${response.status})\n`);
  await bot.drain();
  for (const sent of double.sent.splice(0)) {
    if (sent.to === CUSTOMER) stdout.write(`\nbot> ${(sent.text ?? '').replaceAll('\n', '\n     ')}\n`);
    else stdout.write(`\n[aviso al personal +${sent.to}, plantilla ${sent.template?.name}]\n${JSON.stringify(sent.template?.params, null, 2)}\n`);
  }
}

stdout.write(`Simulador del bot (${toZonedIsoString(now(), timeZone)}, ${timeZone}). /hora AAAA-MM-DDTHH:MM, /audio, /salir.\n`);
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
    await send({ type: 'audio', audio: { id: '1', mime_type: 'audio/ogg' } });
  } else if (text !== '') {
    if (!stdin.isTTY) stdout.write(`\ntú> ${text}\n`);
    await send({ type: 'text', text: { body: text } });
  }
  prompt();
}
rl.close();
server.close();
