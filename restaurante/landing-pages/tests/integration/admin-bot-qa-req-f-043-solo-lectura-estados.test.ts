import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.ts';
import { makeConfig } from '../helpers.ts';
import { ADMIN_ENV, ADMIN_PASSWORD, ADMIN_USER, TEST_HASH_PARAMS, loginAs, textOf } from '../support/admin.ts';
import { listenLocal } from '../support/http.ts';
import { landingProductsFrom } from '../support/landing-products.ts';
import { DAY, NEW_ADMIN, NOTICE, PATH, bot, csrf, posts } from '../support/admin-bot-qa-req-f-043-solo-lectura.ts';

/**
 * QA de REQ-F-043, PR 3 (sonda S-1): bloqueo caducado sin auditar, ?ok= sin aviso, base caída y app
 * sin `botControl`.
 */

describe('/admin/bot en solo lectura, estados poco comunes', () => {
  it('QA3-10: con un bloqueo caducado, ni la lectura ni los POST auditan la caducidad', async () => {
    const { admin, blockId, clock, prisma, dump } = await bot();
    await prisma.botBlock.update({ where: { id: blockId }, data: { expiresAt: new Date(clock.now().getTime() - 60_000) } });
    clock.advance(DAY);
    const before = await dump();
    const page = await admin.get(PATH);
    expect(textOf(page.text)).not.toContain('*********0000');
    const token = await csrf(admin);
    for (const [path, fields] of posts(blockId)) expect((await admin.post(path).type('form').send({ _csrf: token, ...fields })).status).toBe(410);
    expect(await dump()).toBe(before);
    expect(await prisma.botAudit.count({ where: { action: 'block_expired' } })).toBe(0);
  });

  it('QA3-11: ningún ?ok= produce un aviso de éxito', async () => {
    const { admin } = await bot();
    for (const query of ['ok=paused', 'ok=resumed', 'ok=blocked&n=1234', 'ok=unblocked', 'ok=<script>']) {
      const res = await admin.get(`${PATH}?${query}`);
      expect(res.status, query).toBe(200);
      expect(res.text, query).not.toContain('<script>"');
      expect(textOf(res.text), query).not.toMatch(/Bot pausado:|Bot reanudado|bloqueado\.|quitado/);
    }
  });

  it('QA3-12: base caída, última copia y 410; sin botControl, 503 sin escribir', async () => {
    let down = false;
    const context = await bot(undefined, {
      wrapBotStore: (store) =>
        new Proxy(store, {
          get(target, key, receiver) {
            if (down && (key === 'activeBlocks' || key === 'getControl' || key === 'readUsage')) return () => Promise.reject(new Error('base caída'));
            return Reflect.get(target, key, receiver) as unknown;
          },
        }),
    });
    const { admin, blockId, clock, repository, products, users, logger, dump } = context;
    down = true;
    clock.advance(DAY);
    const page = await admin.get(PATH);
    expect(page.status).toBe(200);
    expect(textOf(page.text)).toContain('se muestra la última copia conocida');
    expect(textOf(page.text)).toContain(NOTICE);
    const token = await csrf(admin);
    expect((await admin.post(`${PATH}/interruptor`).type('form').send({ _csrf: token, accion: 'reanudar' })).status).toBe(410);
    down = false;

    const before = await dump();
    const config = makeConfig({ ...ADMIN_ENV, ADMIN_NEW_URL: NEW_ADMIN });
    const app = createApp({ config, repository, products, landingProducts: landingProductsFrom(products), users, hashParams: TEST_HASH_PARAMS, logger, now: clock.now });
    const server = await listenLocal(app);
    const bare = await loginAs(server.browser(), ADMIN_USER, ADMIN_PASSWORD);
    expect((await bare.get(PATH)).status).toBe(503);
    const bareToken = await csrf(bare);
    for (const [path, fields] of posts(blockId)) expect((await bare.post(path).type('form').send({ _csrf: bareToken, ...fields })).status, path).toBe(503);
    expect(await dump()).toBe(before);
  });
});
