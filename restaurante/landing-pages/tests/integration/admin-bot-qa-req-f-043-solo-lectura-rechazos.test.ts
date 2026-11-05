import { describe, expect, it } from 'vitest';

import { createUser, loginAs } from '../support/admin.ts';
import { PATH, SECRET_PHONE, TOKEN, bot, csrf, expectNoSecret, movedLines, posts } from '../support/admin-bot-qa-req-f-043-solo-lectura.ts';

/**
 * QA de REQ-F-043, PR 3 (sonda S-1): lo que admin-bot-moved.test.ts no prueba de los rechazos: CSRF
 * incorrecto o de otra sesión, otro origen, cuerpo excesivo, rutas raras y números en cualquier campo.
 */

describe('/admin/bot en solo lectura, rechazos', () => {
  it('QA3-05: anónimo, editor, CSRF ausente, incorrecto o de otra sesión, en los 4 POST, sin escribir', async () => {
    const { admin, users, browser, blockId, dump, memory, logger } = await bot();
    await createUser(users, { username: 'editora' });
    const editor = await loginAs(browser(), 'editora');
    const before = await dump();
    const copy = await memory();
    const adminToken = await csrf(admin);
    const otherToken = await csrf(editor);
    const seen: string[] = [];
    for (const [path, fields] of posts(blockId)) {
      const results = [
        await browser().post(path).type('form').send(fields),
        await editor.post(path).type('form').send({ _csrf: otherToken, ...fields }),
        await editor.post(path).type('form').send({ _csrf: adminToken, ...fields }),
        await admin.post(path).type('form').send(fields),
        await admin.post(path).type('form').send({ _csrf: 'x'.repeat(adminToken.length), ...fields }),
        await admin.post(path).type('form').send({ _csrf: otherToken, ...fields }),
      ];
      seen.push(results.map((res) => res.status).join());
      for (const res of results) expectNoSecret(res.text);
    }
    expect(seen).toEqual(Array(4).fill('303,403,403,403,403,403'));
    expect(await dump()).toBe(before);
    expect(await memory()).toBe(copy);
    expect(movedLines(logger.lines)).toHaveLength(0);
    expectNoSecret(JSON.stringify(logger.lines));
  });

  it('QA3-06 y QA3-07: otro origen, cuerpo excesivo y campo desconocido no escriben ni dan 500', async () => {
    const { admin, blockId, dump, logger } = await bot();
    const before = await dump();
    const token = await csrf(admin);
    for (const [path, fields] of posts(blockId)) {
      const foreign = await admin.post(path).set('Origin', 'https://malicioso.test').set('Sec-Fetch-Site', 'cross-site').type('form').send({ _csrf: token, ...fields });
      expect(foreign.status, path).toBe(403);
      const large = await admin.post(path).type('form').send({ _csrf: token, ...fields, motivo: 'm'.repeat(5 * 1024) });
      expect(large.status, path).toBe(413);
      const unknown = await admin.post(path).type('form').send({ _csrf: token, ...fields, extra: SECRET_PHONE });
      expect(unknown.status, path).toBe(400);
      expectNoSecret(unknown.text);
    }
    expect(await dump()).toBe(before);
    expect(movedLines(logger.lines)).toHaveLength(0);
    expectNoSecret(JSON.stringify(logger.lines));
  });

  it('QA3-08: ids y tokens raros no escriben ni dan 500', async () => {
    const { admin, dump } = await bot();
    const before = await dump();
    const token = await csrf(admin);
    const paths = [
      ...['abc', '0', '-1', '999999999', '99999999999999999999', '1e3', '1%20'].map((id) => `${PATH}/bloqueos/${id}/quitar`),
      ...['x', 'z'.repeat(500), 'B'.repeat(32), '%2e%2e', 'a%00b'].map((value) => `${PATH}/topes/${value}/bloquear`),
    ];
    const seen = new Map<string, number>();
    for (const path of paths) {
      const fields = path.includes('/topes/') ? { duracion: '7d' } : {};
      seen.set(path.slice(0, 40), (await admin.post(path).type('form').send({ _csrf: token, ...fields })).status);
    }
    expect([...new Set(seen.values())], JSON.stringify([...seen])).toEqual([410]);
    expect(await dump()).toBe(before);
  });

  it('QA3-09: un número en cualquier campo y una duración inválida dan 410 sin repetirlo', async () => {
    const { admin, blockId, dump, logger } = await bot();
    const before = await dump();
    const token = await csrf(admin);
    const cases: [string, Record<string, string>][] = [
      [`${PATH}/interruptor`, { accion: SECRET_PHONE, motivo: SECRET_PHONE }],
      [`${PATH}/bloqueos`, { telefono: SECRET_PHONE, duracion: 'mala', motivo: SECRET_PHONE }],
      [`${PATH}/topes/${TOKEN}/bloquear`, { duracion: 'mala', motivo: SECRET_PHONE }],
      [`${PATH}/bloqueos/${String(blockId)}/quitar`, {}],
    ];
    for (const [path, fields] of cases) {
      const res = await admin.post(path).type('form').send({ _csrf: token, ...fields });
      expect(res.status, path).toBe(410);
      expectNoSecret(res.text);
    }
    expect(await dump()).toBe(before);
    expectNoSecret(JSON.stringify(logger.lines));
  });

});
