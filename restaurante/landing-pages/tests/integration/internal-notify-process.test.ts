import { afterEach, describe, expect, it } from 'vitest';

import { VALID_ENV } from '../helpers.ts';
import { startServer } from '../support/process.ts';

/**
 * Proceso real de landing-pages con el puerto interno del aviso de la API (REQ-F-039, RF-13 y RF-14;
 * CA-10): el aviso solo existe en INTERNAL_PORT (Traefik enruta únicamente el puerto de la app) y
 * exige la credencial.
 */

const PATH = '/internal/v1/productos-cambiados';
const TOKEN = VALID_ENV.INTERNAL_NOTIFY_TOKEN;

const stops: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  while (stops.length > 0) await stops.pop()?.();
});

const post = (url: string, token: string | null) =>
  fetch(`${url}${PATH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token === null ? {} : { Authorization: `Bearer ${token}` }) },
    body: JSON.stringify({ business: 'birria' }),
  });

describe('puerto interno del aviso', () => {
  it('responde en INTERNAL_PORT con la credencial; en el puerto de la app no existe', async () => {
    const server = await startServer({});
    stops.push(() => server.stop());
    expect(server.started, server.output().stderr).toBe(true);

    expect((await post(server.url, TOKEN)).status).toBe(404);
    const ok = await post(server.internalUrl, TOKEN);
    expect(ok.status).toBe(200);
    // Sin API en marcha la landing no puede confirmar los datos nuevos; el bot sí recarga.
    expect(await ok.json()).toEqual({ landing: false, bot: true });
    expect((await post(server.internalUrl, null)).status).toBe(401);
    expect((await post(server.internalUrl, 'otra-credencial-incorrecta-0123456789abcd')).status).toBe(401);

    const { stdout, stderr } = server.output();
    expect(stdout).toContain(`"internalPort":${server.internalPort}`);
    expect(stdout + stderr).not.toContain(TOKEN);
  });

  it('sin INTERNAL_NOTIFY_TOKEN (fuera de producción) no abre el puerto interno', async () => {
    const server = await startServer({ INTERNAL_NOTIFY_TOKEN: undefined });
    stops.push(() => server.stop());
    expect(server.started, server.output().stderr).toBe(true);
    await expect(post(server.internalUrl, TOKEN)).rejects.toThrow();
    expect(server.output().stdout).toContain('"internalPort":null');
  });
});
