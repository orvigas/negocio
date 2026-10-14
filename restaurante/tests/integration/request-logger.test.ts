import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.ts';
import { makeConfig, makeRecordingLogger, makeRepository } from '../helpers.ts';
import { listenLocal } from '../support/http.ts';
import { makeProductRepository } from '../support/products.ts';

/**
 * Log de cada petición con la IP del cliente y el esquema (REQ-F-016, D-4 y CA-5). Detrás de
 * Traefik (TRUST_PROXY=true) la app toma la última IP de X-Forwarded-For y X-Forwarded-Proto.
 */

async function serve(env: Record<string, string> = {}) {
  const logger = makeRecordingLogger();
  const products = (await makeProductRepository()).repository;
  const server = await listenLocal(createApp({ config: makeConfig(env), repository: await makeRepository(), products, logger }));
  const requestLines = () => logger.lines.filter((line) => line.msg === 'request');
  return { server, requestLines };
}

describe('log de peticiones (REQ-F-016, CA-5)', () => {
  it('con TRUST_PROXY=true registra la IP que añade el proxy y el esquema https', async () => {
    const { server, requestLines } = await serve({ TRUST_PROXY: 'true' });
    const res = await server.request().get('/molotes?nombre=secreto').set('X-Forwarded-For', '198.51.100.9, 203.0.113.7').set('X-Forwarded-Proto', 'https');
    expect(res.status).toBe(200);
    const [line] = requestLines();
    expect(line).toMatchObject({ method: 'GET', path: '/molotes', status: 200, ip: '203.0.113.7', protocol: 'https' });
    // La query nunca se registra.
    expect(JSON.stringify(requestLines())).not.toContain('secreto');
  });

  it('sin proxy de confianza ignora las cabeceras X-Forwarded-* (IP del socket y http)', async () => {
    const { server, requestLines } = await serve();
    await server.request().get('/molotes').set('X-Forwarded-For', '203.0.113.7').set('X-Forwarded-Proto', 'https');
    const [line] = requestLines();
    expect(line?.protocol).toBe('http');
    expect(line?.ip).toMatch(/^(::ffff:)?127\.0\.0\.1$/);
  });
});
