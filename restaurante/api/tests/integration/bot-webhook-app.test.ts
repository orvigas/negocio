import type { IncomingMessage, ServerResponse } from 'node:http';

import { describe, expect, it } from 'vitest';

import { createBotWebhookApp } from '../../src/bot/webhook-app.ts';
import { BOT_ENV, makeRecordingLogger } from '../helpers.ts';
import { startAdmin } from '../support/admin.ts';
import { listenWebhook } from '../support/webhook.ts';
import { makeBotHarness } from '../support/whatsapp.ts';

/**
 * App del puerto del webhook de la api (REQ-F-042, P-1, RF-3 y CA-3): una sola ruta. Es la única que
 * publica Traefik, así que ninguna otra ruta de la api (ni /api/v1/admin ni /api/v1/public) se
 * alcanza por ella, aunque la regla del router fuera demasiado amplia.
 */

const PATH = '/webhooks/whatsapp';

describe('puerto del webhook: solo /webhooks/whatsapp (CA-3)', () => {
  it.each(['/api/v1/admin/sesion', '/api/v1/public/birria/productos', '/', '/admin', '/webhooks/whatsapp/otra', '/internal/v1/productos-cambiados'])(
    '%s -> 404 con el formato de error, sin cache',
    async (path) => {
      const h = await makeBotHarness();
      const server = await listenWebhook({ bot: h.bot, logger: h.logger });
      for (const method of ['get', 'post'] as const) {
        const res = await server.request()[method](path);
        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Recurso no encontrado.' } });
        expect(res.headers['cache-control']).toBe('no-store');
      }
    },
  );

  it('otro método en la ruta del webhook: 405 con Allow', async () => {
    const h = await makeBotHarness();
    const server = await listenWebhook({ bot: h.bot, logger: h.logger });
    const res = await server.request().put(PATH).send('{}');
    expect(res.status).toBe(405);
    expect(res.headers.allow).toContain('POST');
  });

  it('el log de peticiones lleva la ruta sin la query (el token de verificación nunca va al log)', async () => {
    const h = await makeBotHarness();
    const server = await listenWebhook({ bot: h.bot, logger: h.logger });
    const res = await server.request().get(`${PATH}?hub.mode=subscribe&hub.challenge=9&hub.verify_token=${BOT_ENV.WHATSAPP_BOT_VERIFY_TOKEN}`);
    expect(res.text).toBe('9');
    expect(h.logger.lines).toContainEqual(expect.objectContaining({ msg: 'request', path: PATH, status: 200 }));
    expect(JSON.stringify(h.logger.lines)).not.toContain(BOT_ENV.WHATSAPP_BOT_VERIFY_TOKEN);
  });

  it('sin bot: 503 BOT_DISABLED y ningún bot_provider_selected (RF-5)', async () => {
    const logger = makeRecordingLogger();
    const server = await listenWebhook({ bot: undefined, logger });
    const res = await server.request().get(PATH);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('BOT_DISABLED');
    expect(logger.lines.map((line) => line.msg)).not.toContain('bot_provider_selected');
  });

  it('el log de peticiones del webhook lleva la IP (último valor de X-Forwarded-For) y el protocolo (RF-3)', async () => {
    const logger = makeRecordingLogger();
    const server = await listenWebhook({ bot: undefined, logger });
    await server.request().get(PATH).set({ 'X-Forwarded-For': '203.0.113.9, 198.51.100.7', 'X-Forwarded-Proto': 'https' });
    expect(logger.lines).toContainEqual(expect.objectContaining({ msg: 'request', path: PATH, ip: '198.51.100.7', protocol: 'https' }));
    expect(JSON.stringify(logger.lines)).not.toContain('203.0.113.9');
  });

  it('el log de peticiones del puerto principal no cambia: sin IP ni protocolo', async () => {
    const admin = await startAdmin();
    await fetch(`${admin.url}/api/v1/public/birria/productos`, { headers: { 'X-Forwarded-For': '198.51.100.7' } });
    const requests = admin.logger.lines.filter((line) => line.includes('"request"'));
    expect(requests.length).toBeGreaterThan(0);
    for (const line of requests) {
      expect(line).not.toContain('"ip"');
      expect(line).not.toContain('"protocol"');
    }
  });

  it('detrás de Traefik, la IP del cliente es el último valor de X-Forwarded-For (RF-3)', () => {
    const app = createBotWebhookApp({ bot: undefined });
    const req = { headers: { 'x-forwarded-for': '203.0.113.9, 198.51.100.7' }, socket: { remoteAddress: '172.18.0.5' } } as unknown as IncomingMessage;
    const ctx = app.createContext(req, {} as ServerResponse);
    expect(ctx.ips).toEqual(['198.51.100.7']);
    expect(ctx.ip).toBe('198.51.100.7');
  });
});
