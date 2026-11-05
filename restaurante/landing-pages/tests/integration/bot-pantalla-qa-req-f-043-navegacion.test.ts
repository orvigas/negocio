import { afterEach, describe, expect, it } from 'vitest';

import { runCleanups as runApiCleanups } from '../support/admin-bot-qa-req-f-043-proceso.ts';
import { browser, noPhone, runCleanups, startReal } from '../support/bot-pantalla-qa-req-f-043.ts';

/** Sonda S-3b de QA de REQ-F-043, PR 2 (QA2-81 y QA2-82): `sanitizeNext` y orden de rutas, por `POST /acceso` real. */

afterEach(async () => {
  await runCleanups();
  await runApiCleanups();
});

describe('volver tras entrar', () => {
  it('QA2-81 y QA2-82: `next` y orden de rutas', async () => {
    const s = await startReal();
    const login = async (next: string) => {
      const b = browser(s.inventory.url);
      return (await b.post('/acceso', { username: 'dueno', password: 'clave-de-prueba-SECRETA-123', next })).location;
    };
    expect(await login('/bot')).toBe('/bot');
    for (const next of ['/bot/', '/bot?x=1', '//evil.example', '/bot/bloqueos', 'https://evil.example', '/\\evil.example', '%2F%2Fevil.example', '/bot\nSet-Cookie: x=1', '/BOT']) {
      expect(await login(next), next).toBe('/');
    }
    expect((await s.admin.get('/acceso?next=//evil.example')).location).not.toContain('evil');
    expect((await s.admin.get('/usuarios/productos')).status).toBe(404);
    expect((await s.admin.get('/bot/productos')).status).toBe(404);
    expect((await s.admin.get('/bot/bloqueos')).status).toBe(405);
    expect((await s.admin.get('/bot/interruptor')).status).toBe(405);
    noPhone(s.logs(), 'logs');
  });
});
