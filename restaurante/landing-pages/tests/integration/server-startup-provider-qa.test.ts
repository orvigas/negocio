import { afterEach, describe, expect, it } from 'vitest';

import { BOT_ENV, TWILIO_BOT_ENV } from '../helpers.ts';
import { makeTempDir } from '../support/database.ts';
import { startServer } from '../support/process.ts';

/**
 * QA de REQ-F-012, ronda 1 (C-P del QA Action Plan): arranque real de `node src/server.ts` con
 * cada combinación de proveedor de CA-8 a CA-12b y CA-20. Se comprueba el código de salida, el
 * mensaje y que ningún valor de las variables aparezca en la salida. Valores ficticios.
 */

const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()?.();
});

/** Copia del entorno sin las variables indicadas. */
const without = (env: Readonly<Record<string, string>>, ...names: string[]): Record<string, string> =>
  Object.fromEntries(Object.entries(env).filter(([name]) => !names.includes(name)));

const SECRET_VALUES = [
  BOT_ENV.WHATSAPP_BOT_ACCESS_TOKEN,
  BOT_ENV.WHATSAPP_BOT_ACCOUNT_ID,
  BOT_ENV.WHATSAPP_BOT_APP_SECRET,
  BOT_ENV.WHATSAPP_BOT_VERIFY_TOKEN,
  TWILIO_BOT_ENV.WHATSAPP_BOT_ACCOUNT_ID,
  TWILIO_BOT_ENV.WHATSAPP_BOT_ACCESS_TOKEN,
  TWILIO_BOT_ENV.WHATSAPP_BOT_WEBHOOK_URL,
  'tunel.example.com',
];

async function boot(env: Record<string, string>) {
  const temp = await makeTempDir();
  cleanups.push(() => temp.cleanup());
  const server = await startServer({ DATA_DIR: temp.dir, ...env }, 20_000);
  cleanups.push(() => server.stop());
  return server;
}

async function expectFailure(env: Record<string, string>, expected: (string | RegExp)[]) {
  const server = await boot(env);
  expect(server.started).toBe(false);
  expect(await server.exited).toBe(1);
  const { stdout, stderr } = server.output();
  const output = stdout + stderr;
  for (const text of expected) {
    if (typeof text === 'string') expect(output).toContain(text);
    else expect(output).toMatch(text);
  }
  for (const value of SECRET_VALUES) expect(output).not.toContain(value);
  return output;
}

async function expectStart(env: Record<string, string>) {
  const server = await boot(env);
  expect(server.started).toBe(true);
  return server;
}

const providerLines = (stdout: string) =>
  stdout
    .split('\n')
    .filter((line) => line.includes('bot_provider_selected'))
    .map((line) => JSON.parse(line) as Record<string, unknown>);

describe('QA REQ-F-012: arranque real según el proveedor', () => {
  it('CA-8: bot habilitado sin proveedor o con uno no admitido termina con 1 sin valores', async () => {
    await expectFailure(without(TWILIO_BOT_ENV, 'WHATSAPP_BOT_PROVIDER'), ['WHATSAPP_BOT_PROVIDER']);
    const output = await expectFailure({ ...TWILIO_BOT_ENV, WHATSAPP_BOT_PROVIDER: 'whatsapp' }, ['WHATSAPP_BOT_PROVIDER']);
    expect(output).not.toContain('whatsapp debe');
  }, 60_000);

  it('CA-8: META y Twilio (mayúsculas) arrancan y registran solo el proveedor (D-13)', async () => {
    const meta = await expectStart({ ...BOT_ENV, WHATSAPP_BOT_PROVIDER: 'META' });
    expect(providerLines(meta.output().stdout)).toEqual([expect.objectContaining({ msg: 'bot_provider_selected', provider: 'meta' })]);
    const twilio = await expectStart({ ...TWILIO_BOT_ENV, WHATSAPP_BOT_PROVIDER: 'Twilio' });
    const [line] = providerLines(twilio.output().stdout);
    expect(line).toMatchObject({ msg: 'bot_provider_selected', provider: 'twilio' });
    // Solo el proveedor, más los campos fijos del logger.
    expect(Object.keys(line ?? {}).filter((key) => !['level', 'msg', 'time', 'ts', 'timestamp'].includes(key))).toEqual(['provider']);
    for (const value of SECRET_VALUES) expect(twilio.output().stdout).not.toContain(value);
  }, 60_000);

  it('CA-9: datos de cuenta del otro proveedor -> código 1 sin valores', async () => {
    await expectFailure({ ...TWILIO_BOT_ENV, WHATSAPP_BOT_ACCOUNT_ID: BOT_ENV.WHATSAPP_BOT_ACCOUNT_ID }, ['WHATSAPP_BOT_ACCOUNT_ID']);
    await expectFailure({ ...BOT_ENV, WHATSAPP_BOT_ACCOUNT_ID: TWILIO_BOT_ENV.WHATSAPP_BOT_ACCOUNT_ID }, ['WHATSAPP_BOT_ACCOUNT_ID']);
  }, 60_000);

  it('CA-10: Twilio sin WEBHOOK_URL falla y la nombra; Twilio sin variables de Meta arranca; Meta sin STAFF_TEMPLATE falla', async () => {
    await expectFailure(without(TWILIO_BOT_ENV, 'WHATSAPP_BOT_WEBHOOK_URL'), ['WHATSAPP_BOT_WEBHOOK_URL']);
    await expectStart({ ...TWILIO_BOT_ENV });
    await expectFailure(without(BOT_ENV, 'WHATSAPP_BOT_STAFF_TEMPLATE'), ['WHATSAPP_BOT_STAFF_TEMPLATE']);
  }, 60_000);

  it('L-8: WEBHOOK_URL con http, query, credenciales u otra ruta -> código 1 sin el valor', async () => {
    for (const url of [
      'http://tunel.example.com/webhooks/whatsapp',
      'https://tunel.example.com/webhooks/whatsapp?x=1',
      'https://user:pass@tunel.example.com/webhooks/whatsapp',
      'https://tunel.example.com/otra',
    ]) {
      const output = await expectFailure({ ...TWILIO_BOT_ENV, WHATSAPP_BOT_WEBHOOK_URL: url }, ['WHATSAPP_BOT_WEBHOOK_URL']);
      expect(output).not.toContain(url);
      expect(output).not.toContain('user:pass');
    }
  }, 90_000);

  it('CA-11: NODE_ENV=production con twilio termina con 1, con el bot habilitado o sin él', async () => {
    await expectFailure({ ...TWILIO_BOT_ENV, NODE_ENV: 'production' }, [/WHATSAPP_BOT_PROVIDER=twilio no se permite con NODE_ENV=production/]);
    await expectFailure({ NODE_ENV: 'production', WHATSAPP_BOT_PROVIDER: 'twilio' }, [/WHATSAPP_BOT_PROVIDER=twilio no se permite con NODE_ENV=production/]);
  }, 60_000);

  it('CA-12: twilio sin datos de cuenta arranca: webhook 503 y landings 200', async () => {
    const server = await expectStart({ WHATSAPP_BOT_PROVIDER: 'twilio', WHATSAPP_BOT_ACCOUNT_ID: '', WHATSAPP_BOT_ACCESS_TOKEN: '', WHATSAPP_BOT_WEBHOOK_URL: '' });
    expect((await fetch(`${server.url}/webhooks/whatsapp`, { method: 'POST', body: 'a=1' })).status).toBe(503);
    expect((await fetch(`${server.url}/webhooks/whatsapp`)).status).toBe(503);
    for (const path of ['/', '/molotes', '/birria']) expect((await fetch(`${server.url}${path}`)).status).toBe(200);
    expect(server.output().stdout).toContain('"whatsappBot":"disabled"');
    expect(providerLines(server.output().stdout)).toEqual([]);
  }, 60_000);

  it('CA-12b: WHATSAPP_BOT_PHONE_NUMBER_ID (nombre anterior) con el resto de Meta -> código 1, pide renombrarla y nombra ACCOUNT_ID', async () => {
    await expectFailure({ ...without(BOT_ENV, 'WHATSAPP_BOT_ACCOUNT_ID'), WHATSAPP_BOT_PHONE_NUMBER_ID: BOT_ENV.WHATSAPP_BOT_ACCOUNT_ID }, ['WHATSAPP_BOT_PHONE_NUMBER_ID', 'WHATSAPP_BOT_ACCOUNT_ID']);
  }, 60_000);

  it('CA-20: el mismo código cambia de proveedor solo con las variables', async () => {
    const meta = await expectStart({ ...BOT_ENV });
    expect(providerLines(meta.output().stdout)[0]).toMatchObject({ provider: 'meta' });
    const metaGet = await fetch(`${meta.url}/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${BOT_ENV.WHATSAPP_BOT_VERIFY_TOKEN}&hub.challenge=42`);
    expect(metaGet.status).toBe(200);
    expect(await metaGet.text()).toBe('42');

    const twilio = await expectStart({ ...TWILIO_BOT_ENV });
    expect(providerLines(twilio.output().stdout)[0]).toMatchObject({ provider: 'twilio' });
    const twilioGet = await fetch(`${twilio.url}/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=x&hub.challenge=42`);
    expect(twilioGet.status).toBe(405);
    const unsigned = await fetch(`${twilio.url}/webhooks/whatsapp`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'Body=Hola' });
    expect(unsigned.status).toBe(401);
  }, 60_000);
});
