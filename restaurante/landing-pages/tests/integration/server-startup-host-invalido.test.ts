import { afterEach, describe, expect, it } from 'vitest';

import { hasIPv6Loopback, logLines, connects, boot, expectConfigFailure, expectStarted, runCleanups } from '../support/server-startup-config.ts';

/**
 * REQ-F-015: arranque real de `node src/server.ts` (y de los scripts `start` y `dev` de
 * package.json) con NODE_ENV obligatorio y HOST. Los procesos no heredan el entorno del
 * desarrollador (ni su .env): los scripts usan un .env temporal.
 *
 * REQ-F-041: parte de server-startup-config.test.ts (preparación en
 * tests/support/server-startup-config.ts).
 */

afterEach(runCleanups);

describe('REQ-F-015: HOST', () => {
  it.runIf(hasIPv6Loopback)('CA-12: HOST=::1 escucha solo en el loopback IPv6; HOST=:: en todas', async () => {
    const loopback = await expectStarted({ HOST: '::1' });
    expect(loopback.started).toMatchObject({ host: '::1' });
    expect((await fetch(`http://[::1]:${loopback.server.port}/molotes`)).status).toBe(200);
    expect(await connects('127.0.0.1', loopback.server.port)).toBe(false);
    await loopback.server.stop();

    const all = await expectStarted({ HOST: '::' });
    expect(all.started).toMatchObject({ host: '::' });
    expect(await connects('::1', all.server.port)).toBe(true);
    expect(await connects('127.0.0.1', all.server.port)).toBe(true);
  }, 60_000);

  it.each(['localhost', '999.1.1.1', 'abc def', '127.0.0.1:3000'])('CA-8: HOST=%s -> código 1 sin repetir el valor ni abrir puertos', async (host) => {
    const output = await expectConfigFailure({ HOST: host }, ['HOST', 'IP literal IPv4 o IPv6']);
    expect(output).not.toContain(host);
  });

  it('IP que no es de la máquina: termina con 1, nombra HOST y no se queda colgado', async () => {
    // 192.0.2.1 (TEST-NET-1, RFC 5737) nunca se asigna a una interfaz.
    const server = await boot({ HOST: '192.0.2.1' });
    expect(server.started).toBe(false);
    expect(await server.exited).toBe(1);
    const { stdout, stderr } = server.output();
    expect(stderr).toContain('HOST');
    expect(stderr).not.toContain('192.0.2.1');
    expect(stdout).not.toContain('192.0.2.1');
    expect(logLines(stdout).find((line) => line.msg === 'server_listen_failed')).toMatchObject({ level: 'error', code: 'EADDRNOTAVAIL' });
  });
});
