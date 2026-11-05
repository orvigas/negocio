import { afterEach, describe, expect, it } from 'vitest';

import { BOT_ENV } from '../helpers.ts';
import { ALL, BIG, CUSTOMER, TOKEN, WRITES, runCleanups, start, type Raw } from '../support/admin-bot-qa-req-f-043-acceso.ts';

/**
 * QA de REQ-F-043 (PR 1, sonda S-2): matriz de acceso (401 -> 403 de rol -> CSRF -> cuerpo -> dominio) de `/api/v1/admin/bot*` con el proceso real de la API contra
 * MySQL. Se arranca como proceso hijo: landing-pages nunca importa código de `api/`. Preparación en
 * tests/support/admin-bot-qa-req-f-043-acceso.ts.
 */

afterEach(runCleanups);

describe('acceso', () => {
  it('QA-20 a QA-23: un editor siempre recibe 403 de rol, sin datos ni cambios; sin sesión, 401', async () => {
    const { login, raw, tables, context } = await start(BOT_ENV);
    const before = await tables();
    const sessions = [await login('em'), await login('eb')];
    const variants: Omit<Raw, 'session' | 'method'>[] = [
      {},
      { body: JSON.stringify({ paused: true, phone: CUSTOMER, duration: '7d' }) },
      { body: '{"phone":' },
      { body: BIG },
      { body: 'hola', type: 'text/plain' },
      { body: '{}', csrf: null },
      { body: '{}', csrf: 'x'.repeat(40) },
    ];
    let checked = 0;
    for (const session of sessions) {
      for (const [method, path] of [...ALL, ['POST', '/bot/bloqueos/abc/quitar'], ['POST', '/bot/topes/noesuntoken/bloquear']] as [string, string][]) {
        for (const variant of method === 'GET' ? [{}] : variants) {
          const res = await raw(path, { ...variant, session, method });
          const text = await res.text();
          expect([method, path, res.status]).toEqual([method, path, 403]);
          expect(JSON.parse(text)).toEqual({ error: { code: 'FORBIDDEN_ROLE', message: 'No tienes permiso para gestionar el bot.' } });
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(70);
    expect(await tables()).toEqual(before);

    const eli = await login('segunda');
    expect((await raw('/bot', { session: eli, method: 'GET' })).status).toBe(200);
    await context.prisma.user.updateMany({ where: { username: 'segunda' }, data: { role: 'editor' } });
    expect((await raw('/bot', { session: eli, method: 'GET' })).status).toBe(403);
    expect((await raw('/bot/interruptor', { session: eli, method: 'PUT', body: '{"paused":true}' })).status).toBe(403);

    for (const [method, path] of ALL) {
      for (const bearer of [undefined, 'Bearer aaaaaaaaaaaaaaaa', 'Basic abc', 'Bearer !!']) {
        const res = await raw(path, { ...(bearer ? { bearer } : {}), method, ...(method === 'GET' ? {} : { body: '{}' }) });
        expect([path, res.status, ((await res.json()) as { error: { code: string } }).error.code]).toEqual([path, 401, 'UNAUTHENTICATED']);
      }
    }
    expect(await tables()).toEqual(before);
  });

  it('QA-24 a QA-26: CSRF antes que cuerpo, cuerpo antes que dominio, y rutas', async () => {
    const { login, owner, raw, json, tables } = await start(BOT_ENV);
    const before = await tables();
    const other = await login('segunda');
    for (const [method, path] of WRITES) {
      for (const csrf of [null, 'x'.repeat(40), other.csrfToken]) {
        for (const body of ['{"paused":true}', '{"phone":', BIG]) {
          const res = await raw(path, { session: owner, method, csrf, body });
          expect([path, res.status, ((await res.json()) as { error: { code: string } }).error.code]).toEqual([path, 403, 'CSRF_INVALID']);
        }
      }
      expect((await raw(path, { session: owner, method, body: BIG })).status).toBe(413);
      expect((await raw(path, { session: owner, method, body: 'hola', type: 'text/plain' })).status).toBe(415);
      expect((await raw(path, { session: owner, method, body: '{"phone":' })).status).toBe(400);
      expect((await raw(path, { session: owner, method, body: '[]' })).status).toBe(422);
      expect((await raw(path, { session: owner, method, body: '{"otro":1}' })).status).toBe(422);
    }
    expect((await raw('/bot/bloqueos/abc/quitar', { session: owner, body: '{"otro":1}' })).status).toBe(422);
    expect((await json('/bot/bloqueos/abc/quitar', 'POST', {})).status).toBe(404);
    // Observación: el formato del token se mira antes que `duration`; uno bien formado, después.
    expect((await raw('/bot/topes/noesuntoken/bloquear', { session: owner, body: '{"duration":"nope"}' })).status).toBe(404);
    expect((await raw(`/bot/topes/${TOKEN}/bloquear`, { session: owner, body: '{"duration":"nope"}' })).status).toBe(422);
    expect((await json('/bot/topes/noesuntoken/bloquear', 'POST', { duration: '7d' })).status).toBe(404);
    expect(await tables()).toEqual(before);

    const notAllowed = await raw('/bot/interruptor', { session: owner, method: 'GET' });
    expect(notAllowed.status).toBe(405);
    expect(notAllowed.headers.get('allow')).toContain('PUT');
    expect((await raw('/bot', { session: owner, method: 'DELETE', csrf: owner.csrfToken })).status).toBe(405);
    expect((await raw('/bot/productos', { session: owner, method: 'GET' })).status).toBe(404);
    expect((await raw('/bot/productos', { session: owner, method: 'POST', body: '{}' })).status).toBe(404);
    expect((await raw('/bot/bloqueos/1/quitar/extra', { session: owner, body: '{}' })).status).toBe(404);
    const editor = await login('em');
    const head = await raw('/bot', { session: editor, method: 'HEAD' });
    expect(head.status).toBe(403);
    expect(await head.text()).toBe('');
    expect(((await (await raw('/usuarios', { session: editor, method: 'GET' })).json()) as { error: { message: string } }).error.message).toContain('gestionar usuarios');
  });
});
