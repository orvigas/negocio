import { describe, expect, it } from 'vitest';

import { textOf } from '../support/admin.ts';
import { NEW_ADMIN, NOTICE, NOT_SAVED, PATH, TOKEN, bot, csrf, dom, expectNoSecret, movedLines, posts } from '../support/admin-bot-qa-req-f-043-solo-lectura.ts';

/**
 * QA de REQ-F-043, PR 3 (sonda S-1): evidencia independiente de CA-16 con datos propios, volcado
 * completo de las 4 tablas y formularios reales de la página antigua, y el borde de CA-17 de la
 * variable vacía. Preparación en tests/support/admin-bot-qa-req-f-043-solo-lectura.ts.
 */

describe('/admin/bot en solo lectura, evidencia independiente de CA-16', () => {
  it('QA3-01 y QA3-02: estado y uso de la base, enlace exacto aunque la variable lleve barra final', async () => {
    const { admin } = await bot({ ADMIN_NEW_URL: `${NEW_ADMIN}/` });
    const res = await admin.get(PATH);
    expect(res.status).toBe(200);
    const doc = dom(res.text);
    const main = doc.querySelector('main')!;
    expect(main.querySelectorAll('form, input, select, textarea, button')).toHaveLength(0);
    // Punto 3 del plan: la cabecera común conserva "cerrar sesión", fuera de <main>.
    expect(doc.querySelectorAll('header form')).toHaveLength(1);
    expect([...main.querySelectorAll('a[href*="/bot"]')].map((link) => link.getAttribute('href'))).toEqual([`${NEW_ADMIN}/bot`]);
    expect(res.text).not.toContain(`${NEW_ADMIN}//bot`);
    const text = textOf(main.outerHTML);
    expect(text).toContain('Bot pausado');
    expect(text).toContain('Pausa de QA');
    expect(text).toMatch(/\*{9}0000 Manual Fila manual/);
    expect(text).toMatch(/\*{9}5555 Tope diario/);
    expect(text).toContain('41');
    expect(text).toContain('96');
    expect(main.querySelectorAll('.bot-panel__usage')).toHaveLength(5);
    expect(main.querySelectorAll('.bot-panel__block')).toHaveLength(2);
    expect([...main.querySelectorAll('th[scope="col"]')].map((th) => th.textContent)).not.toContain('Acción');
  });

  it('QA3-03: los 4 POST válidos dan 410 con role="alert"; nada cambia en las 4 tablas ni en memoria', async () => {
    const { admin, blockId, dump, memory, logger } = await bot();
    const before = await dump();
    const copy = await memory();
    expect((JSON.parse(before) as unknown[][]).map((rows) => rows.length > 0)).toEqual([true, true, true, true]);
    const token = await csrf(admin);
    for (const [path, fields] of posts(blockId)) {
      const res = await admin.post(path).type('form').send({ _csrf: token, ...fields });
      expect(res.status, path).toBe(410);
      expect(res.headers.location, path).toBeUndefined();
      const main = dom(res.text).querySelector('main')!;
      expect(main.querySelectorAll('form, input, select, textarea, button'), path).toHaveLength(0);
      expect([...main.querySelectorAll('[role="alert"]')].map((node) => node.textContent?.trim()), path).toEqual([NOT_SAVED]);
      expect(main.querySelector(`a[href="${NEW_ADMIN}/bot"]`), path).not.toBeNull();
      expectNoSecret(res.text);
    }
    expect(await dump()).toBe(before);
    expect(await memory()).toBe(copy);
    expect(movedLines(logger.lines).map((line) => Object.keys(line).sort().join())).toEqual(Array(4).fill('action,level,msg,userId'));
    expectNoSecret(JSON.stringify(logger.lines));
    expect(JSON.stringify(movedLines(logger.lines))).not.toContain(TOKEN);
  });

  it('QA3-04: los formularios reales de la página antigua, reenviados tal cual, dan 410 sin error de campos', async () => {
    const old = await bot({});
    const oldDoc = dom((await old.admin.get(PATH)).text);
    const forms = [...oldDoc.querySelectorAll('main form')].map((form) => ({
      action: form.getAttribute('action')!,
      fields: Object.fromEntries([...form.querySelectorAll('input[name], select[name]')].map((input) => [input.getAttribute('name')!, (input as HTMLInputElement).value])),
    }));
    expect(forms.length).toBeGreaterThanOrEqual(3);
    const { admin, blockId, dump } = await bot();
    const before = await dump();
    const token = await csrf(admin);
    for (const { action, fields } of forms) {
      const path = action.includes('/quitar') ? `${PATH}/bloqueos/${String(blockId)}/quitar` : action;
      const res = await admin.post(path).type('form').send({ ...fields, _csrf: token });
      expect(res.status, action).toBe(410);
    }
    const topes = await admin.post(`${PATH}/topes/${TOKEN}/bloquear`).type('form').send({ _csrf: token, duracion: '7d', motivo: '' });
    expect(topes.status).toBe(410);
    expect(await dump()).toBe(before);
  });

});

describe('/admin/bot sin ADMIN_NEW_URL, bordes de CA-17', () => {
  it('QA3-16 y QA3-17: la variable vacía equivale a no tenerla, y ?ok= sigue avisando', async () => {
    const { admin } = await bot({ ADMIN_NEW_URL: '' });
    const res = await admin.get(`${PATH}?ok=paused`);
    expect(res.status).toBe(200);
    expect(dom(res.text).querySelectorAll('main form').length).toBeGreaterThanOrEqual(3);
    const text = textOf(res.text);
    expect(text).not.toContain(NOTICE);
    expect(text).toContain('Bot pausado: no se envía ningún mensaje');
    expect(text).toContain('Mientras tanto, puedes bloquear un número');
  });
});
