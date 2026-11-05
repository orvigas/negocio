import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { BOT_ENV } from '../helpers.ts';
import { textOf } from '../support/admin.ts';
import { BOT_PATH, P, sleep, startStack, waitFor, type Browser, type Stack } from '../support/bot-procesos-qa-req-f-042.ts';

/**
 * QA de REQ-F-042 (PR 2): procesos reales de `api` y `landing-pages`. La preparación está en
 * tests/support/bot-procesos-qa-req-f-042.ts.
 */

describe('bot en la api y /admin en landing-pages, procesos reales', () => {
  let stack: Stack;
  let admin: Browser;
  beforeAll(async () => {
    stack = await startStack();
    admin = await stack.adminBrowser();
  }, 90_000);
  afterAll(async () => {
    await stack?.stop();
  }, 30_000);

  it('T-01: verificación con el token correcto e incorrecto', async () => {
    const query = (token: string) => `?hub.mode=subscribe&hub.verify_token=${token}&hub.challenge=reto-123`;
    const ok = await fetch(`${stack.webhookUrl}${query(BOT_ENV.WHATSAPP_BOT_VERIFY_TOKEN)}`);
    expect(ok.status).toBe(200);
    expect(await ok.text()).toBe('reto-123');
    expect((await fetch(`${stack.webhookUrl}${query('otro')}`)).status).toBe(403);
  });

  it('T-02: un POST firmado lo atiende la api, responde 200 y sale una respuesta al doble', async () => {
    const customer = '5215512340001';
    expect((await stack.send(customer, 'hola')).status).toBe(200);
    await stack.replied(customer, 0);
    expect(stack.apiLog().some((line) => line.msg === 'bot_provider_selected')).toBe(true);
    expect(stack.landing.output().stdout).not.toContain('bot_provider_selected');
    expect((await stack.outbound()).every((entry) => entry.provider === 'meta')).toBe(true);
  });

  it('T-03: sin firma o con firma incorrecta, rechazo sin procesar', async () => {
    const before = (await stack.outbound()).length;
    const body = '{"object":"whatsapp_business_account","entry":[]}';
    const none = await fetch(stack.webhookUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
    const bad = await fetch(stack.webhookUrl, { method: 'POST', headers: { 'content-type': 'application/json', 'x-hub-signature-256': `sha256=${'0'.repeat(64)}` }, body });
    expect([none.status, bad.status]).toEqual([401, 403]);
    expect(stack.apiLog().filter((line) => line.msg === 'bot_webhook_signature_invalid')).toHaveLength(2);
    expect((await stack.outbound()).length).toBe(before);
  });

  it('T-08: la pausa de /admin llega sola al bot; el primer mensaje posterior se descarta y al reanudar se atiende', async () => {
    const customer = '5215512340002';
    expect((await stack.adminPost(admin, `${BOT_PATH}/interruptor`, { accion: 'pausar', motivo: 'Incidente QA' })).status).toBe(303);
    await sleep(1600);
    expect((await stack.send(customer, 'hola')).status).toBe(200);
    await sleep(800);
    expect(await stack.outboundTo(customer)).toHaveLength(0);

    expect((await stack.adminPost(admin, `${BOT_PATH}/interruptor`, { accion: 'reanudar', motivo: '' })).status).toBe(303);
    await sleep(1600);
    expect((await stack.send(customer, 'hola de nuevo')).status).toBe(200);
    await stack.replied(customer, 0);
  });

  it('T-09 y T-13: el alta y la baja de /admin llegan al bot; el personal no se bloquea', async () => {
    const customer = '5215512340003';
    expect((await stack.adminPost(admin, `${BOT_PATH}/bloqueos`, { telefono: customer, duracion: '7d', motivo: '' })).status).toBe(303);
    await sleep(1600);
    await stack.send(customer, 'hola');
    await waitFor(stack.apiLog, (lines) => lines.some((line) => line.msg === 'bot_blocked_message'));
    expect(await stack.outboundTo(customer)).toHaveLength(0);

    const id = (await stack.database.prisma.botBlock.findFirst({ where: { removedAt: null } }))?.id;
    expect((await stack.adminPost(admin, `${BOT_PATH}/bloqueos/${String(id)}/quitar`)).status).toBe(303);
    await sleep(1600);
    await stack.send(customer, 'hola otra vez');
    await stack.replied(customer, 0);

    const staff = await stack.adminPost(admin, `${BOT_PATH}/bloqueos`, { telefono: BOT_ENV.WHATSAPP_BOT_STAFF_MOLOTES, duracion: '7d', motivo: '' });
    expect(staff.status).toBe(422);
    expect(staff.text).not.toContain(BOT_ENV.WHATSAPP_BOT_STAFF_MOLOTES);
  });

  it('T-10: el uso enviado por la api aparece en /admin/bot', async () => {
    const rows = await waitFor(
      () => stack.database.prisma.botUsage.findMany(),
      (list) => list.length === 2 && list.every((row) => row.outbound > 0),
    );
    expect(rows.map((row) => row.periodType).sort()).toEqual(['day', 'month']);
    const outbound = rows.find((row) => row.periodType === 'month')?.outbound ?? 0;
    const page = textOf((await admin.get(BOT_PATH)).text);
    expect(page).toContain(String(outbound));
    expect(page).toContain('está en el admin nuevo');
    expect(page).not.toContain('Números que alcanzaron un tope hoy');
  });

  it('T-12: bloquear desde topes responde 410 y no escribe nada', async () => {
    const blocks = await stack.database.prisma.botBlock.count();
    const audits = await stack.database.prisma.botAudit.count();
    const res = await stack.adminPost(admin, `${BOT_PATH}/topes/${'a'.repeat(32)}/bloquear`, { duracion: '7d', motivo: '' });
    expect(res.status).toBe(410);
    expect(textOf(res.text)).toContain('está en el admin nuevo');
    expect(await stack.database.prisma.botBlock.count()).toBe(blocks);
    expect(await stack.database.prisma.botAudit.count()).toBe(audits);
  });

  it('T-14: un producto no disponible en la api deja de ofrecerse en el siguiente mensaje y la frescura se confirma', async () => {
    const customer = '5215512340004';
    const bodies = async () => (await stack.outboundTo(customer)).map((entry) => entry.body);
    await stack.send(customer, 'menú');
    const first = await waitFor(bodies, (list) => list.some((body) => body.includes('Molotes de Queso Oaxaca')));
    expect(first.join('\n')).toContain('Molotes de Queso Oaxaca');
    await sleep(300);
    const count = (await bodies()).length;

    const session = await stack.apiSession();
    const auth = { authorization: `Bearer ${session.id}` };
    const listRes = await fetch(`${stack.apiUrl}${P}/molotes/productos`, { headers: auth });
    expect(listRes.status).toBe(200);
    const list = (await listRes.json()) as { products: Record<string, unknown>[] };
    const queso = list.products.find((product) => product.name === 'Molotes de Queso Oaxaca');
    if (!queso) throw new Error('Falta el producto de la prueba');
    const put = await fetch(`${stack.apiUrl}${P}/molotes/productos/${String(queso.id)}`, {
      method: 'PUT',
      headers: { ...auth, 'content-type': 'application/json', 'x-csrf-token': session.csrfToken },
      body: JSON.stringify({
        category: 'platillo',
        name: queso.name,
        description: queso.description,
        label: queso.label,
        tone: queso.tone,
        price: (Number(queso.priceCents ?? 0) / 100).toFixed(2),
        orderPrice: (Number(queso.orderPriceCents ?? 0) / 100).toFixed(2),
        orderQuantity: queso.orderQuantity,
        image: queso.image,
        available: false,
        version: queso.version,
      }),
    });
    const putText = await put.text();
    expect(put.status, putText).toBe(200);
    expect((JSON.parse(putText) as { meta: { freshness: string } }).meta.freshness).toBe('confirmed');

    await stack.send(customer, 'menú');
    await stack.replied(customer, count);
    await sleep(300);
        const after = (await bodies()).slice(count).join('\n');
    expect(after).toContain('Molotes de Tinga de Pollo');
    expect(after).not.toContain('Molotes de Queso Oaxaca');
  });

  it('N-03: ningún secreto ni número completo en los logs de los dos procesos', () => {
    const logs = stack.api.output().stdout + stack.api.output().stderr + stack.landing.output().stdout + stack.landing.output().stderr;
    for (const secret of [
      BOT_ENV.WHATSAPP_BOT_ACCESS_TOKEN,
      BOT_ENV.WHATSAPP_BOT_APP_SECRET,
      BOT_ENV.WHATSAPP_BOT_VERIFY_TOKEN,
      BOT_ENV.WHATSAPP_BOT_BLOCKLIST_KEY,
      '5215512340001',
      'hola de nuevo',
    ]) {
      expect(logs).not.toContain(secret);
    }
  });

  it('N-07: SIGTERM justo tras una entrega: salida 0 y contadores guardados', async () => {
    const customer = '5215512340005';
    const month = async () => (await stack.database.prisma.botUsage.findFirst({ where: { periodType: 'month' } }))?.outbound ?? 0;
    const previous = await month();
    await stack.send(customer, 'hola');
    await stack.replied(customer, 0);
    expect(await stack.api.stop()).toBe(0);
    expect(await month()).toBeGreaterThan(previous);
  });
});
