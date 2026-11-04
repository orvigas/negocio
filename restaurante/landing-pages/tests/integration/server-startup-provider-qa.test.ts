import { afterEach, describe, expect, it } from 'vitest';

import { BOT_ENV, TWILIO_BOT_ENV } from '../helpers.ts';
import { without, SECRET_VALUES, expectFailure, expectStart, providerLines, runCleanups } from '../support/server-startup-provider-qa.ts';

/**
 * QA de REQ-F-012, ronda 1 (C-P del QA Action Plan): arranque real del proceso del bot (la api desde
 * REQ-F-042, `node ../api/src/server.ts`) con
 * cada combinación de proveedor de CA-8 a CA-12b y CA-20. Se comprueba el código de salida, el
 * mensaje y que ningún valor de las variables aparezca en la salida. Valores ficticios.
 *
 * REQ-F-041: parte de server-startup-provider-qa.test.ts (preparación en
 * tests/support/server-startup-provider-qa.ts).
 */

afterEach(runCleanups);

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
});

describe('REQ-F-042: el webhook en el puerto propio de la api (P-1, CA-3 y CA-12)', () => {
  it('el puerto del webhook solo atiende /webhooks/whatsapp; la API sigue en el suyo', async () => {
    const server = await expectStart({ ...BOT_ENV });
    expect((await fetch(`${server.url}/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${BOT_ENV.WHATSAPP_BOT_VERIFY_TOKEN}&hub.challenge=7`)).status).toBe(200);
    for (const path of ['/api/v1/public/birria/productos', '/api/v1/admin/sesion', '/', '/admin']) {
      expect((await fetch(`${server.url}${path}`)).status, path).toBe(404);
    }
    expect((await fetch(`${server.apiUrl}/api/v1/public/birria/productos`)).status).toBe(200);
    expect((await fetch(`${server.apiUrl}/webhooks/whatsapp`)).status).toBe(404);
    expect(server.output().stdout).toContain('"whatsappBot":"enabled"');
  }, 60_000);

  it('configuración incompleta: código 1 con la lista de problemas y sin valores (los mismos textos que tenía landing-pages)', async () => {
    const output = await expectFailure({ WHATSAPP_BOT_PROVIDER: 'meta', WHATSAPP_BOT_APP_SECRET: BOT_ENV.WHATSAPP_BOT_APP_SECRET, WHATSAPP_BOT_VERIFY_TOKEN: 'corto' }, [
      'Configuración de la API inválida',
      'WHATSAPP_BOT_ACCESS_TOKEN es obligatoria',
      'WHATSAPP_BOT_VERIFY_TOKEN no es válida',
    ]);
    expect(output).not.toContain(BOT_ENV.WHATSAPP_BOT_APP_SECRET);
  }, 60_000);
});
