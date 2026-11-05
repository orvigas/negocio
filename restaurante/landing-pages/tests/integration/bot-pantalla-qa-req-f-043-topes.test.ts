import { afterEach, describe, expect, it } from 'vitest';

import { BOT_ENV } from '../helpers.ts';
import { CUSTOMER, runCleanups as runApiCleanups } from '../support/admin-bot-qa-req-f-043-proceso.ts';
import { csrfOf, noPhone, runCleanups, startReal } from '../support/bot-pantalla-qa-req-f-043.ts';

/**
 * Sonda S-2 de QA de REQ-F-043, PR 2 (QA2-10 a QA2-13 y QA2-15): "alcanzaron un tope hoy" contra la `api` real, con
 * tráfico real al webhook firmado. Lo que el implementador solo probó contra su doble.
 */

afterEach(async () => {
  await runCleanups();
  await runApiCleanups();
});

const tokenIn = (html: string): string => /action="\/bot\/topes\/([^/"]+)\/bloquear"/.exec(html)?.[1] ?? '';

describe('alcanzaron un tope hoy', () => {
  it('QA2-10 a QA2-15: cliente en la lista, personal ausente, bloquear, reenvío y tokens manipulados', async () => {
    const s = await startReal({ BOT_LIMIT_BURST: '3' });
    const staff = BOT_ENV.WHATSAPP_BOT_STAFF_MOLOTES;
    for (let i = 0; i < 6; i += 1) {
      await s.send(CUSTOMER);
      await s.send(staff);
    }
    await s.until(async () => (await s.state()).reached.length > 0, 'cliente en la lista');
    const page = await s.page();
    const tokens = [...page.matchAll(/action="\/bot\/topes\/([^/"]+)\/bloquear"/g)];

    // QA2-10 y QA2-11: enmascarado, con tope y hora; el personal no aparece.
    expect(page).toContain('*********5678');
    expect(page).toContain('Ráfaga');
    expect(page).not.toContain(`*********${staff.slice(-4)}`);
    expect(tokens).toHaveLength(1);
    noPhone(page, 'lista');
    expect(page).not.toContain(CUSTOMER);

    // Motivo con 8 dígitos: 422, sin repintar, la fila sigue y el error se ve.
    const token = tokenIn(page);
    const csrf = csrfOf(page);
    const bad = await s.admin.post(`/bot/topes/${token}/bloquear`, { _csrf: csrf, duracion: '30d', motivo: '55 1234 5678' });
    expect(bad.status).toBe(422);
    expect(bad.html).toContain('No escribas números de teléfono en el motivo.');
    expect(bad.html).not.toContain('55 1234 5678');
    expect(bad.html.match(/name="motivo"[^>]*value="[^"]+"/g)).toBeNull();

    // QA2-15: tokens manipulados, sin escribir y sin alcanzar otra ruta.
    for (const forged of ['0'.repeat(32), '..%2f..%2fbot%2finterruptor', 'x'.repeat(300), '%00']) {
      const res = await s.admin.post(`/bot/topes/${forged}/bloquear`, { _csrf: csrf, duracion: '7d' });
      expect([404, 400], `${forged}: ${String(res.status)}`).toContain(res.status);
    }
    expect((await s.state()).control.paused).toBe(false);
    expect(await s.context.prisma.botBlock.count()).toBe(0);

    // QA2-12: bloquear desde la lista.
    const ok = await s.admin.post(`/bot/topes/${token}/bloquear`, { _csrf: csrf, duracion: '7d', motivo: 'Abuso' });
    expect([ok.status, ok.location]).toEqual([303, '/bot?ok=blocked&n=5678']);
    const after = await s.admin.get(ok.location);
    expect(after.html).toContain('Hoy ningún número ha alcanzado un tope.');
    expect(after.html).toContain('*********5678');
    expect(after.html).toContain('Abuso');
    expect(await s.auditActions()).toEqual(['block_added']);

    // QA2-13: reenvío del token usado.
    const reused = await s.admin.post(`/bot/topes/${token}/bloquear`, { _csrf: csrf, duracion: '7d' });
    expect(reused.status).toBe(404);
    expect(reused.html).toContain('role="alert"');
    expect(reused.html).toContain('Lista negra');
    expect(await s.context.prisma.botBlock.count()).toBe(1);
  });
});
