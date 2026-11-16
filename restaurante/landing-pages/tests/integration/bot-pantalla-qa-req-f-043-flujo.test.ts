import { afterEach, describe, expect, it } from 'vitest';

import { BOT_ENV } from '../helpers.ts';
import { CUSTOMER } from '../support/admin-bot-qa-req-f-043-proceso.ts';
import { PHONE, csrfOf, noPhone, runCleanups, selectedDuration, startReal, valueOf } from '../support/bot-pantalla-qa-req-f-043.ts';
import { runCleanups as runApiCleanups } from '../support/admin-bot-qa-req-f-043-proceso.ts';

/**
 * Sonda S-1 de QA de REQ-F-043, PR 2: la pantalla contra la `api` real, con el webhook firmado y MySQL
 * (QA2-01 a QA2-09). Lo que afirma la pantalla se comprueba en el bot y en `bot_audit`.
 */

afterEach(async () => {
  await runCleanups();
  await runApiCleanups();
});

describe('pantalla contra la api real', () => {
  it('QA2-01 a QA2-07: pausa, motivo con dígitos, alta, rechazos, baja y contadores', async () => {
    const s = await startReal();
    await s.send(CUSTOMER);
    await s.until(async () => (await s.sentTo(CUSTOMER)) > 0, 'el bot atiende al inicio');
    const before = await s.sentTo(CUSTOMER);

    // QA2-02: 422 sin cambiar el estado y sin repintar el motivo.
    const digits = await s.admin.post('/bot/interruptor', { _csrf: await s.csrf(), accion: 'pausar', motivo: '55 1234 5678' });
    expect(digits.status).toBe(422);
    expect(digits.html).toContain('No escribas números de teléfono en el motivo.');
    expect(digits.html).not.toContain('55 1234 5678');
    expect((await s.state()).control.paused).toBe(false);

    // QA2-01.
    const pause = await s.admin.post('/bot/interruptor', { _csrf: await s.csrf(), accion: 'pausar', motivo: 'Gasto raro' });
    expect([pause.status, pause.location]).toEqual([303, '/bot?ok=paused']);
    await s.send(CUSTOMER);
    await s.until(() => s.logged('bot_paused_dropped'), 'descarta sin esperar el refresco');
    expect(await s.sentTo(CUSTOMER)).toBe(before);
    const paused = await s.page();
    expect(paused).toContain('Gasto raro');
    expect(paused).toMatch(/Bot pausado|Pausado/);
    const resume = await s.admin.post('/bot/interruptor', { _csrf: csrfOf(paused), accion: 'reanudar' });
    expect([resume.status, resume.location]).toEqual([303, '/bot?ok=resumed']);

    // QA2-03.
    const add = await s.admin.post('/bot/bloqueos', { _csrf: await s.csrf(), telefono: PHONE, duracion: '7d', motivo: 'Abuso' });
    expect([add.status, add.location]).toEqual([303, '/bot?ok=blocked&n=5432']);
    const listed = await s.admin.get(add.location);
    expect(listed.html).toContain('*********5432');
    noPhone(listed.html, 'lista');
    const log = (await s.sentTo(PHONE));
    await s.send(PHONE);
    await s.until(() => s.logged('bot_blocked_message'), 'el bot lo ignora');
    expect(await s.sentTo(PHONE)).toBe(log);

    // QA2-04.
    const csrf = csrfOf(listed.html);
    const cases: [string, number][] = [[PHONE, 409], ['abc', 422], [BOT_ENV.WHATSAPP_BOT_STAFF_MOLOTES, 422]];
    const blocksBefore = await s.context.prisma.botBlock.count();
    for (const [telefono, status] of cases) {
      const res = await s.admin.post('/bot/bloqueos', { _csrf: csrf, telefono, duracion: '30d', motivo: 'Conservado' });
      expect(res.status, telefono).toBe(status);
      expect(valueOf(res.html, 'telefono') ?? '', telefono).toBe('');
      expect(valueOf(res.html, 'motivo'), telefono).toBe('Conservado');
      expect(selectedDuration(res.html), telefono).toBe('30d');
      expect(/name="telefono"[^>]*aria-invalid="true"/.test(res.html), telefono).toBe(true);
      expect(res.html, telefono).toContain('b-telefono-error');
    }
    expect(await s.context.prisma.botBlock.count()).toBe(blocksBefore);

    // QA2-05 y QA2-06.
    const [block] = (await s.state()).blocks;
    const out = await s.admin.post(`/bot/bloqueos/${String(block?.id)}/quitar`, { _csrf: csrf });
    expect([out.status, out.location]).toEqual([303, '/bot?ok=unblocked&n=5432']);
    const again = await s.admin.post(`/bot/bloqueos/${String(block?.id)}/quitar`, { _csrf: csrf });
    expect(again.status).toBe(404);
    expect(again.html).toContain('Lista negra');
    await s.send(PHONE);
    await s.until(async () => (await s.sentTo(PHONE)) > log, 'vuelve a atender');

    expect(await s.auditActions()).toEqual(['bot_paused', 'bot_resumed', 'block_added', 'block_removed']);

    // QA2-07: los 5 contadores de la api y sin controles de topes.
    const { usage } = await s.state();
    const page = await s.page();
    expect(usage.counters).toHaveLength(5);
    expect(page.match(/Disponible|Alcanzado/g)?.length).toBe(5);
    for (const { used, limit } of usage.counters.slice(0, 4)) expect(page).toContain(`${String(used)} de ${String(limit)}`);
    expect(page).not.toMatch(/name="(?:tope|limite|limit)/);
  });
});
