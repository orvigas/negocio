import { afterEach, describe, expect, it } from 'vitest';

import { BOT_ENV, TWILIO_BOT_ENV } from '../helpers.ts';
import { without, expectFailure, expectStart, providerLines, runCleanups } from '../support/server-startup-provider-qa.ts';

/**
 * QA de REQ-F-012, ronda 1 (C-P del QA Action Plan): arranque real de `node src/server.ts` con
 * cada combinación de proveedor de CA-8 a CA-12b y CA-20. Se comprueba el código de salida, el
 * mensaje y que ningún valor de las variables aparezca en la salida. Valores ficticios.
 *
 * REQ-F-041: parte de server-startup-provider-qa.test.ts (preparación en
 * tests/support/server-startup-provider-qa.ts).
 */

afterEach(runCleanups);

describe('QA REQ-F-012: arranque real según el proveedor', () => {
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
