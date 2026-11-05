import { afterEach, describe, expect, it } from 'vitest';

import { CUSTOMER, runCleanups as runApiCleanups } from '../support/admin-bot-qa-req-f-043-proceso.ts';
import { csrfOf, runCleanups, startReal } from '../support/bot-pantalla-qa-req-f-043.ts';

/** Sonda S-2b de QA de REQ-F-043, PR 2 (QA2-14): número con bloqueo automático que sigue en la lista. */

afterEach(async () => {
  await runCleanups();
  await runApiCleanups();
});

const tokenIn = (html: string): string => /action="\/bot\/topes\/([^/"]+)\/bloquear"/.exec(html)?.[1] ?? '';

describe('alcanzaron un tope hoy, ya bloqueado', () => {
  it('QA2-14: un número ya bloqueado que sigue en la lista da 409 sin duplicar', async () => {
    const s = await startReal({ BOT_LIMIT_MESSAGES_PER_NUMBER_DAY: '5' });
    for (let i = 0; i < 8; i += 1) await s.send(CUSTOMER);
    await s.until(async () => (await s.state()).blocks.length > 0 && (await s.state()).reached.length > 0, 'bloqueo automático y fila');
    const page = await s.page();
    const res = await s.admin.post(`/bot/topes/${tokenIn(page)}/bloquear`, { _csrf: csrfOf(page), duracion: '7d' });
    expect(res.status).toBe(409);
    expect(res.html).toContain('role="alert"');
    expect(await s.context.prisma.botBlock.count()).toBe(1);
  });
});
