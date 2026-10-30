import { afterEach, describe, expect, it } from 'vitest';

import { BOT_ENV, TWILIO_BOT_ENV } from '../helpers.ts';
import { without, SECRET_VALUES, expectFailure, expectStart, providerLines, runCleanups } from '../support/server-startup-provider-qa.ts';

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
